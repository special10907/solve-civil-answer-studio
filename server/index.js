const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');

// Multer memory storage so we can forward buffers to external ASR providers
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

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

app.post('/api/transcribe', upload.single('file'), async (req, res) => {
  // Support multiple modes: 'openai' (server-side whisper), 'whispercpp' (not-implemented here), 'mock'
  const provider = (process.env.TRANSCRIBE_PROVIDER || 'mock').toLowerCase();

  // If client uploaded a file via multipart/form-data, multer placed it in req.file
  const uploaded = req.file;

  if (provider === 'openai' && process.env.OPENAI_API_KEY && uploaded) {
    try {
      // Forward the audio file to OpenAI's transcription endpoint
      const form = new FormData();
      form.append('file', uploaded.buffer, { filename: uploaded.originalname, contentType: uploaded.mimetype });
      // Use a stable whisper model name; change if your OpenAI account expects a different model id
      form.append('model', 'whisper-1');

      const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: form,
      });

      if (!resp.ok) {
        const text = await resp.text();
        return res.status(502).json({ ok: false, error: 'openai-transcribe-failed', detail: text });
      }

      const json = await resp.json();
      const transcript = json.text || json.transcript || '';
      return res.json({ ok: true, mode: 'openai', name: uploaded.originalname, transcript, raw: json });
    } catch (err) {
      console.error('OpenAI transcribe error', err);
      return res.status(500).json({ ok: false, error: 'openai-error', message: String(err) });
    }
  }

  if (provider === 'whispercpp') {
    // Whisper.cpp/local models require an external binary and are environment-specific.
    // To enable, set env WHISPERCPP_COMMAND to the command or script that accepts an input file path
    // and writes transcript to stdout. Example: WHISPERCPP_COMMAND="/usr/local/bin/whisper_cpp_runner"
    const cmd = process.env.WHISPERCPP_COMMAND;
    if (!cmd || !uploaded) {
      return res.status(501).json({ ok: false, error: 'whispercpp-not-configured', message: 'WHISPERCPP_COMMAND not configured or no file uploaded. See server README.' });
    }

    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const { spawn } = require('child_process');

    // Write uploaded buffer to a temp file
    const tmpDir = os.tmpdir();
    const tmpName = `transcribe_${Date.now()}_${Math.random().toString(36).slice(2,8)}_${uploaded.originalname}`;
    const tmpPath = path.join(tmpDir, tmpName);
    try {
      fs.writeFileSync(tmpPath, uploaded.buffer);
    } catch (err) {
      console.error('Failed to write temp file for whispercpp', err);
      return res.status(500).json({ ok: false, error: 'whispercpp-tempfile-failed', message: String(err) });
    }

    // Spawn the configured command with the temp file path as final argument
    const parts = Array.isArray(cmd) ? cmd : cmd.split(' ');
    const proc = spawn(parts[0], parts.slice(1).concat([tmpPath]), { stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      // Clean up temp file
      try { fs.unlinkSync(tmpPath); } catch (e) { /* ignore */ }

      if (code !== 0) {
        console.error('whispercpp command failed', { code, stderr });
        return res.status(502).json({ ok: false, error: 'whispercpp-failed', code, stderr });
      }

      const transcript = stdout.trim();
      return res.json({ ok: true, mode: 'whispercpp', name: uploaded.originalname, transcript, raw: { stderr } });
    });

    // In case of spawn error
    proc.on('error', (err) => {
      try { fs.unlinkSync(tmpPath); } catch (e) { /* ignore */ }
      console.error('whispercpp spawn error', err);
      return res.status(500).json({ ok: false, error: 'whispercpp-spawn-error', message: String(err) });
    });

    return; // response will be sent from event handlers
  }

  // Fallback / mock behaviour: accept either multipart upload or JSON body with name
  const name = uploaded ? uploaded.originalname : (req.body && req.body.name) || 'unknown';
  const type = uploaded ? uploaded.mimetype : (req.body && req.body.type) || 'unknown';

  // Simulate processing latency for mock
  await new Promise((r) => setTimeout(r, 350));

  const transcript = `자동 전사(모의): 파일 ${name} (${type})의 요약/전사 결과입니다.`;
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
