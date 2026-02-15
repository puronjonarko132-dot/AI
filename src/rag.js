import { config } from "./config.js";

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = (Math.sqrt(na) * Math.sqrt(nb)) || 1e-9;
  return dot / denom;
}

export class RAGIndex {
  constructor(openaiClient) {
    this.client = openaiClient;
    this.docs = []; // { id, text, embedding }
  }

  async embed(text) {
    const resp = await this.client.embeddings.create({
      model: config.embedModel,
      input: text.slice(0, 8000),
    });
    return resp.data[0].embedding;
  }

  async ingest(texts) {
    for (const text of texts) {
      const embedding = await this.embed(text);
      this.docs.push({
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        text,
        embedding,
      });
    }
  }

  async query(q, k = 4, minScore = 0.20) {
    if (this.docs.length === 0) return [];
    const qEmb = await this.embed(q);
    const scored = this.docs.map((d) => ({
      score: cosine(qEmb, d.embedding),
      text: d.text,
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.filter((x) => x.score >= minScore).slice(0, k);
  }
}
