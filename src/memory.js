import { config } from "./config.js";

export class MemoryStore {
  constructor() {
    // sessionId -> { turns: [{role, content, ts}], summary: string }
    this.sessions = new Map();
  }

  get(sessionId) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, { turns: [], summary: "" });
    }
    return this.sessions.get(sessionId);
  }

  addTurn(sessionId, role, content) {
    const s = this.get(sessionId);
    s.turns.push({ role, content, ts: Date.now() });

    // hard trim
    if (s.turns.length > config.memoryMaxTurns) {
      s.turns.splice(0, s.turns.length - config.memoryMaxTurns);
    }
  }

  buildMessages(sessionId) {
    const s = this.get(sessionId);
    const msgs = [];
    if (s.summary) {
      msgs.push({ role: "system", content: `Conversation summary so far:\n${s.summary}` });
    }
    for (const t of s.turns) msgs.push({ role: t.role, content: t.content });
    return msgs;
  }

  needsSummary(sessionId) {
    const s = this.get(sessionId);
    return s.turns.length >= config.memorySummaryTrigger;
  }

  applySummary(sessionId, summaryText) {
    const s = this.get(sessionId);
    s.summary = summaryText;
    // keep last few turns after summarizing
    s.turns = s.turns.slice(-12);
  }
}
