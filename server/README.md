# Local analyze-questions mock server

This lightweight Express server provides a development `/api/analyze-questions` endpoint
that accepts POST JSON `{ text: string, source?: string }` and returns a simple
extraction of question blocks. It's intended for local development and testing.

Run:

```powershell
cd server
npm install
npm start # foreground

# or use the restart helper (Windows PowerShell) which stops any process on port 8787 and starts the server in background
npm run restart
```

Then point the page's `AI Endpoint URL` (or use default backend) — default base URL: `http://localhost:8787`.

Notes:
- This is a heuristic, non-ML parser. Replace with an LLM-backed service for better results.
- To run quick attachment tests:
	- `node test_post_attachment.js`
	- `node test_post.js`
