import express from "express";
import OpenAI from "openai";

import { config } from "./config.js";
import { httpLogger, logger } from "./logger.js";
import { requireServerKey, rateLimit } from "./security.js";
import { chatSchema, ingestSchema } from "./schemas.js";
import { MemoryStore } from "./memory.js";
import { RAGIndex } from "./rag.js";
import { toolSchemas, runTool } from "./tools.js";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(httpLogger);

const jarvasClient = new OpenAI({ apiKey: config.openaiKey });
const memory = new MemoryStore();
const rag = new RAGIndex(jarvasClient);

await rag.ingest([
  "Jarvas is a helpful, safe assistant.",
  "Jarvas refuses illegal, harmful, or privacy-invasive requests.",
  "Jarvas answers clearly and concisely unless asked otherwise.",
  "Jarvas can debate ideas, challenge assumptions, and keep humor playful.",
]);

function detectLiveOverrides(message, style) {
  const text = String(message || "").toLowerCase();
  const out = { ...style };

  if (/no roast|stop roasting|be nice/.test(text)) out.roastMode = false;
  if (/roast me|go hard|extra savage/.test(text)) out.roastMode = true;

  if (/no debate|don't debate|just answer/.test(text)) out.debateMode = false;
  if (/debate me|argue with me|push back/.test(text)) out.debateMode = true;

  if (/deep answer|full breakdown/.test(text)) out.responseFormat = "deep";
  if (/quick answer|tldr/.test(text)) out.responseFormat = "quick";

  return out;
}

function buildPersonality(style = {}) {
  const roastMode = style.roastMode !== false;
  const debateMode = style.debateMode !== false;
  const intensity = Number(style.intensity || 2);
  const persona = style.persona || "jarvis";
  const responseFormat = style.responseFormat || "standard";

  const personaLines = {
    jarvis: "Persona: elegant, dry-witty, composed, futuristic but warm.",
    mentor: "Persona: strategic coach, high standards, encouraging pressure.",
    sparring: "Persona: analytical sparring partner, direct challenge, no fluff.",
    chill: "Persona: calm, friendly, low-ego, lightly playful.",
  };

  return [
    personaLines[persona] || personaLines.jarvis,
    roastMode
      ? "Roast mode: enabled. Keep jokes clever, friendly, and non-abusive. Roast decisions, not identity."
      : "Roast mode: disabled.",
    debateMode
      ? "Debate mode: enabled. Challenge weak logic and ask one incisive follow-up when useful."
      : "Debate mode: disabled.",
    `Intensity: ${Math.min(Math.max(intensity, 1), 5)} / 5.`,
    `Response format: ${responseFormat}.`,
    style.allowProfanity
      ? "Profanity setting: mirror mild user language only; never abuse."
      : "Profanity setting: avoid profanity.",
    style.goals?.length
      ? `User goals: ${style.goals.map((g) => `"${g}"`).join(", ")}`
      : "User goals: not provided.",
  ].join("\n");
}

function buildResponseProtocol(style) {
  if (style.responseFormat === "quick") {
    return [
      "Output protocol:",
      "1) One-line verdict.",
      "2) One strongest counterpoint.",
      "3) One upgraded action step.",
    ].join("\n");
  }

  if (style.responseFormat === "deep") {
    return [
      "Output protocol:",
      "1) Executive take (2-3 lines).",
      "2) Argument map: claim, assumptions, strongest counter.",
      "3) Upgrade plan with concrete next steps.",
      "4) If roast mode on, add one playful roast line at the end.",
    ].join("\n");
  }

  return [
    "Output protocol:",
    "1) Short answer.",
    "2) Why.",
    "3) Better move next.",
  ].join("\n");
}

function systemPrompt(contextSnips, style) {
  const ctx = contextSnips.length ? contextSnips.map((s) => `- ${s}`).join("\n") : "- (no extra context)";

  return (
    `You are ${config.jarvasName}, a highly capable, safe AI assistant.\n` +
    `Rules:\n` +
    `- Refuse illegal/harmful requests.\n` +
    `- Never produce hate, abuse, doxxing, or targeted harassment.\n` +
    `- Keep banter consent-based and reversible when user asks.\n` +
    `- Be honest about uncertainty; do not fabricate facts.\n\n` +
    `${buildPersonality(style)}\n\n` +
    `${buildResponseProtocol(style)}\n\n` +
    `Relevant context:\n${ctx}`
  );
}

async function maybeSummarize(sessionId) {
  if (!memory.needsSummary(sessionId)) return;

  const msgs = memory.buildMessages(sessionId);
  const resp = await jarvasClient.chat.completions.create({
    model: config.model,
    messages: [
      {
        role: "system",
        content:
          "Summarize in 6-10 bullets: user preferences, goals, unresolved tasks, and communication style signals.",
      },
      ...msgs,
    ],
  });

  const summary = resp.choices[0].message.content || "";
  memory.applySummary(sessionId, summary);
}

async function runToolLoop(messages) {
  let cur = messages;

  for (let step = 0; step < config.maxToolSteps; step++) {
    const resp = await jarvasClient.chat.completions.create({
      model: config.model,
      messages: cur,
      tools: toolSchemas,
      tool_choice: "auto",
    });

    const msg = resp.choices[0].message;

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return { finalText: msg.content || "", usedTools: false };
    }

    cur = [...cur, { role: "assistant", content: msg.content || "" }];

    for (const tc of msg.tool_calls) {
      const name = tc.function.name;
      let args = {};
      try {
        args = JSON.parse(tc.function.arguments || "{}");
      } catch {
        args = {};
      }

      const out = runTool(name, args);

      cur.push({
        role: "tool",
        name,
        content: JSON.stringify(out),
      });
    }
  }

  return {
    finalText: "I hit my tool-step limit. Ask again with fewer steps.",
    usedTools: true,
  };
}

app.get("/", (req, res) => res.send("Jarvas is online ✅"));

app.post("/jarvas/ingest", requireServerKey, rateLimit, async (req, res) => {
  const parsed = ingestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  await rag.ingest(parsed.data.texts);
  res.json({ ok: true, count: parsed.data.texts.length });
});

app.post("/jarvas/chat", requireServerKey, rateLimit, async (req, res) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const { sessionId, message, stream } = parsed.data;

  const storedStyle = memory.getStyleProfile(sessionId);
  const requestedStyle = { ...storedStyle, ...parsed.data.style };
  const effectiveStyle = detectLiveOverrides(message, requestedStyle);
  memory.saveStyleProfile(sessionId, effectiveStyle);

  memory.addTurn(sessionId, "user", message);
  await maybeSummarize(sessionId);

  const ragHits = await rag.query(message, 4, 0.2);
  const contextSnips = ragHits.map((h) => h.text);

  const baseMessages = [
    { role: "system", content: systemPrompt(contextSnips, effectiveStyle) },
    ...memory.buildMessages(sessionId),
  ];

  if (stream) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const { finalText } = await runToolLoop(baseMessages);
    memory.addTurn(sessionId, "assistant", finalText);

    const chunks = finalText.match(/.{1,140}/g) || [finalText];
    for (const c of chunks) {
      res.write(`data: ${JSON.stringify({ token: c })}\n\n`);
    }

    res.write(
      `data: ${JSON.stringify({ done: true, style: effectiveStyle })}\n\n`
    );
    return res.end();
  }

  const { finalText } = await runToolLoop(baseMessages);
  memory.addTurn(sessionId, "assistant", finalText);
  res.json({
    assistant: config.jarvasName,
    reply: finalText,
    style: effectiveStyle,
  });
});

app.use((err, req, res, next) => {
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
});

app.listen(config.port, () => {
  logger.info(`Jarvas running on port ${config.port}`);
});
