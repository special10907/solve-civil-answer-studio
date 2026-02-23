const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '5mb' }));

function simpleParseQuestions(text) {
  if (!text || !text.trim()) return [];
  // Normalize separators
  const normalized = text.replace(/\r\n/g, "\n").replace(/\n{2,}/g, "\n\n");

  // Split by double newlines first to get likely blocks
  const blocks = normalized.split(/\n\n+/).map(s => s.trim()).filter(Boolean);
  const results = [];
  const qHeadRe = /^(?:Q\s*\d+|문제\s*\d+|\d+\s*[.)]|\d+\s*번)/i;

  blocks.forEach((blk, idx) => {
    // try to find a line that looks like a question header
    const lines = blk.split('\n').map(l => l.trim()).filter(Boolean);
    let id = null;
    let title = null;
    for (const ln of lines) {
      const m = ln.match(qHeadRe);
      if (m) {
        id = m[0].replace(/\s+/g, '');
        title = ln.replace(qHeadRe, '').trim() || blk.slice(0, 80);
        break;
      }
    }

    // fallback: if block contains a question mark or ends with ? or starts with 숫자.
    if (!id && /\?/m.test(blk)) {
      id = `Q${idx+1}`;
      title = blk.split('\n')[0].slice(0,80);
    }

    // final fallback - create an entry if block length is reasonable
    if (!id && blk.length > 30) {
      id = `Q${idx+1}`;
      title = blk.slice(0, 80);
    }

    if (id) {
      results.push({ id, title, rawQuestion: blk });
    }
  });

  return results;
}

app.post('/api/analyze-questions', (req, res) => {
  const { text, source } = req.body || {};
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text (string) required' });
  }

  // In a production setup, replace this with an actual LLM call.
  const questions = simpleParseQuestions(text);

  return res.json({
    ok: true,
    source: source || 'local-mock',
    questions,
    count: questions.length
  });
});

app.post('/api/analyze-attachments', (req, res) => {
  const { items, focus } = req.body || {};
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'items (array) required' });
  }

  // Aggregate text excerpts and parse
  const combined = items.map(it => (it && it.textExcerpt) || '').join('\n\n');
  const questions = simpleParseQuestions(combined);

  // counts per file (rough)
  const countsByFile = items.map(it => ({
    name: it.name || 'unknown',
    count: simpleParseQuestions((it && it.textExcerpt) || '').length,
  }));

  return res.json({
    ok: true,
    mode: 'local-mock',
    files: items.length,
    focus: focus || null,
    countsByFile,
    questions,
    count: questions.length,
  });
});

app.post('/api/analyze-webpage', (req, res) => {
  const { url, focus } = req.body || {};
  if (!url) return res.status(400).json({ error: 'url required' });

  // placeholder: return a minimal insight
  const summary = `간단 요약: ${url}`;
  return res.json({ ok: true, mode: 'local-mock', url, focus: focus || null, summary });
});

app.post('/api/transcribe', async (req, res) => {
  // Development mock: accept metadata and return a fake transcript
  const { name, type, size } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });

  // Simulate processing latency
  await new Promise((r) => setTimeout(r, 350));

  const transcript = `자동 전사(모의): 파일 ${name} (${type || 'unknown'})의 요약/전사 결과입니다.`;
  return res.json({ ok: true, mode: 'transcribe-mock', name, transcript });
});

app.get('/api/validate-keys', (req, res) => {
  // Return fake provider diagnostics for development
  return res.json({
    openai: { status: 'missing' },
    google: { status: 'missing' },
    anthropic: { status: 'missing' },
  });
});

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`Analyze-questions mock server listening on http://localhost:${PORT}`);
});
