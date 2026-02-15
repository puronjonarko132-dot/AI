# Jarvas (Advanced Node AI Server)

## What you get
- `/jarvas/chat` (SSE streaming or JSON)
- `/jarvas/ingest` (add RAG docs)
- Session memory + auto-summary
- Embeddings RAG (in-memory vector index)
- Tool calling loop (safe tools)
- API key auth + rate limiting
- Structured logging (pino)

## Setup
1) Copy env:
```bash
cp .env.example .env
```
2) Edit `.env`:
- `OPENAI_API_KEY`
- `SERVER_KEY` (your private server auth key)

3) Install + run:
```bash
npm i
npm start
```

## Test
Non-stream:
```bash
curl -X POST "http://localhost:3000/jarvas/chat" \
  -H "Content-Type: application/json" \
  -H "X-Server-Key: change-me" \
  -d '{"sessionId":"demo","message":"Hello Jarvas","stream":false}'
```

Streaming (SSE):
```bash
curl -N -X POST "http://localhost:3000/jarvas/chat" \
  -H "Content-Type: application/json" \
  -H "X-Server-Key: change-me" \
  -d '{"sessionId":"demo","message":"Explain gravity in 3 lines","stream":true}'
```

Ingest docs:
```bash
curl -X POST "http://localhost:3000/jarvas/ingest" \
  -H "Content-Type: application/json" \
  -H "X-Server-Key: change-me" \
  -d '{"texts":["My custom doc text here","Another doc"]}'
```

## Deploy
- Put this repo on GitHub
- Deploy on Render/Railway/Fly
- Set env vars in the host dashboard (don’t upload `.env`)
# jarvas
