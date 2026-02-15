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

// Seed starter knowledge (replace via /jarvas/ingest)
await rag.ingest([
  "Jarvas is a helpful, safe assistant.",
  "Jarvas refuses illegal, harmful, or privacy-invasive requests.",
  "Jarvas answers clearly and concisely unless asked otherwise.",
]);

function systemPrompt(contextSnips) {
  const ctx = contextSnips.length
    ? contextSnips.map((s) => `- ${s}`).join("\n")
    : "- (no extra context)";
  return (
    `You are ${config.jarvasName}, a helpful and safe AI.\n` +
    `Rules:\n` +
    `- Refuse illegal/harmful requests.\n` +
    `- Keep responses clear, not too long.\n` +
    `- Use context if relevant; don't invent facts.\n\n` +
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
          "Summarize the conversation so far in 6-10 bullet points. Keep key preferences, goals, and open tasks.",
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

  memory.addTurn(sessionId, "user", message);
  await maybeSummarize(sessionId);

  const ragHits = await rag.query(message, 4, 0.2);
  const contextSnips = ragHits.map((h) => h.text);

  const baseMessages = [
    { role: "system", content: systemPrompt(contextSnips) },
    ...memory.buildMessages(sessionId),
  ];

  if (stream) {
    // Simple SSE streaming of final text (clean + reliable)
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
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    return res.end();
  }

  const { finalText } = await runToolLoop(baseMessages);
  memory.addTurn(sessionId, "assistant", finalText);
  res.json({ assistant: config.jarvasName, reply: finalText });
});

app.use((err, req, res, next) => {
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
});

app.listen(config.port, () => {
  logger.info(`Jarvas running on port ${config.port}`);
});
