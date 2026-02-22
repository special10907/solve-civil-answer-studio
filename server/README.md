# Local analyze-questions mock server

This lightweight Express server provides a development `/api/analyze-questions` endpoint
that accepts POST JSON `{ text: string, source?: string }` and returns a simple
extraction of question blocks. It's intended for local development and testing.

Run:

```bash
cd server
npm install
npm start
```

Then point the page's `AI Endpoint URL` (or use default backend) — default base URL: `http://localhost:8787`.

Notes:
- This is a heuristic, non-ML parser. Replace with an LLM-backed service for better results.
