import { config } from "./config.js";

const DEFAULT_STYLE = Object.freeze({
  roastMode: true,
  debateMode: true,
  intensity: 2,
  persona: "jarvis",
  responseFormat: "standard",
  allowProfanity: false,
  goals: [],
});

export class MemoryStore {
  constructor() {
    // sessionId -> { turns: [{role, content, ts}], summary: string, styleProfile: object }
    this.sessions = new Map();
  }

  get(sessionId) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        turns: [],
        summary: "",
        styleProfile: { ...DEFAULT_STYLE },
      });
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

  saveStyleProfile(sessionId, style) {
    const s = this.get(sessionId);
    s.styleProfile = { ...s.styleProfile, ...style };
  }

  getStyleProfile(sessionId) {
    const s = this.get(sessionId);
    return { ...s.styleProfile };
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
