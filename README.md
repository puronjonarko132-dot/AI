# Jarvas (Advanced Node AI Server)

A local AI backend with memory, RAG, tool-calling, and a configurable Jarvis-style personality.

## Features
- `/jarvas/chat` with SSE or JSON
- `/jarvas/ingest` for custom knowledge
- Session memory + auto-summary
- Tool loop with safe local tools
- Adaptive persona: roast/debate + response depth + live overrides
- API key auth + rate limiting

## Run on MacBook Air M4
```bash
cp .env.example .env
npm i
npm start
```

Set in `.env`:
- `OPENAI_API_KEY`
- `SERVER_KEY`

## Advanced style controls (`/jarvas/chat`)
`style` fields:
- `roastMode` (`true|false`)
- `debateMode` (`true|false`)
- `intensity` (`1..5`)
- `persona` (`jarvis|mentor|sparring|chill`)
- `responseFormat` (`quick|standard|deep`)
- `allowProfanity` (`true|false`)
- `goals` (`string[]` max 8)

### Example request
```bash
curl -X POST "http://localhost:3000/jarvas/chat" \
  -H "Content-Type: application/json" \
  -H "X-Server-Key: change-me" \
  -d '{
    "sessionId":"demo",
    "message":"My business plan is perfect. Debate me and roast lightly.",
    "stream":false,
    "style": {
      "roastMode": true,
      "debateMode": true,
      "intensity": 3,
      "persona": "sparring",
      "responseFormat": "deep",
      "goals": ["Find weaknesses", "Improve execution plan"]
    }
  }'
```

## Live override phrases (in plain user message)
Jarvas can adapt immediately if users type phrases like:
- `"no roast"`, `"stop roasting"`, `"be nice"`
- `"debate me"`, `"argue with me"`, `"just answer"`
- `"quick answer"`, `"deep answer"`

## Safety
- Banter is kept playful and non-abusive.
- No hate/harassment/doxxing behavior.
- If user asks to stop roast/debate, it can switch immediately.
