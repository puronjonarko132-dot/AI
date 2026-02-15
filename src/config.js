import "dotenv/config";

function must(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const config = Object.freeze({
  port: Number(process.env.PORT || 3000),
  serverKey: must("SERVER_KEY"),
  openaiKey: must("OPENAI_API_KEY"),
  model: process.env.MODEL || "gpt-4o-mini",
  embedModel: process.env.EMBED_MODEL || "text-embedding-3-small",
  rateLimitPerMin: Number(process.env.RATE_LIMIT_PER_MIN || 60),
  maxToolSteps: Number(process.env.MAX_TOOL_STEPS || 3),
  memoryMaxTurns: Number(process.env.MEMORY_MAX_TURNS || 40),
  memorySummaryTrigger: Number(process.env.MEMORY_SUMMARY_TRIGGER || 28),
  jarvasName: "Jarvas",
});
