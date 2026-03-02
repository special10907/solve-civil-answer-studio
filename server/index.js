const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

function stripWrappingQuotes(value) {
  const text = String(value || '').trim();
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    return text.slice(1, -1);
  }
  return text;
}

function loadEnvFile(envPath) {
  if (!envPath || !fs.existsSync(envPath)) {
    return false;
  }

  try {
    const raw = fs.readFileSync(envPath, 'utf8');
    raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .forEach((line) => {
        const eqIdx = line.indexOf('=');
        if (eqIdx <= 0) {
          return;
        }
        const key = line.slice(0, eqIdx).trim();
        const value = stripWrappingQuotes(line.slice(eqIdx + 1));
        const currentValue = String(process.env[key] || '').trim();
        if (key && (!currentValue || process.env[key] == null)) {
          process.env[key] = value;
        }
      });
    return true;
  } catch {
    return false;
  }
}

const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '.env'),
  path.resolve(__dirname, '..', '.env'),
  path.resolve(__dirname, '..', 'backend', '.env'),
];
[...new Set(envCandidates)].forEach((candidate) => {
  loadEnvFile(candidate);
});

function hasAnyEnvKey(keys = []) {
  return keys.some((key) => {
    const value = String(process.env[key] || '').trim();
    return value.length > 0;
  });
}

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
  const combined = items.map(it => it?.textExcerpt || '').join('\n\n');
  const questions = simpleParseQuestions(combined);

  // counts per file (rough)
  const countsByFile = items.map(it => ({
    name: it.name || 'unknown',
    count: simpleParseQuestions(it?.textExcerpt || '').length,
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
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }

      if (code !== 0) {
        console.error('whispercpp command failed', { code, stderr });
        return res.status(502).json({ ok: false, error: 'whispercpp-failed', code, stderr });
      }

      const transcript = stdout.trim();
      return res.json({ ok: true, mode: 'whispercpp', name: uploaded.originalname, transcript, raw: { stderr } });
    });

    // In case of spawn error
    proc.on('error', (err) => {
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
      console.error('whispercpp spawn error', err);
      return res.status(500).json({ ok: false, error: 'whispercpp-spawn-error', message: String(err) });
    });

    return; // response will be sent from event handlers
  }

  // Fallback / mock behaviour: accept either multipart upload or JSON body with name
  const name = uploaded ? uploaded.originalname : req.body?.name || 'unknown';
  const type = uploaded ? uploaded.mimetype : req.body?.type || 'unknown';

  // Simulate processing latency for mock
  await new Promise((r) => setTimeout(r, 350));

  const transcript = `자동 전사(모의): 파일 ${name} (${type})의 요약/전사 결과입니다.`;
  return res.json({ ok: true, mode: 'transcribe-mock', name, transcript });
});

app.get('/api/validate-keys', (_req, res) => {
  const openaiEnabled = hasAnyEnvKey(['OPENAI_API_KEY']);
  const geminiEnabled = hasAnyEnvKey(['GEMINI_API_KEY', 'GOOGLE_API_KEY']);
  const anthropicEnabled = hasAnyEnvKey(['ANTHROPIC_API_KEY']);

  return res.json({
    openai: { status: openaiEnabled ? 'configured' : 'missing' },
    gemini: { status: geminiEnabled ? 'configured' : 'missing' },
    anthropic: { status: anthropicEnabled ? 'configured' : 'missing' },
  });
});

app.post('/api/lmstudio-models', async (req, res) => {
  const rawBaseUrl = String(req.body?.baseUrl || process.env.LM_STUDIO_BASE_URL || 'http://127.0.0.1:1234').trim();
  const normalizedBaseUrl = rawBaseUrl.replace(/\/$/, '');

  const candidates = [];
  const pushCandidate = (url) => {
    const value = String(url || '').trim().replace(/\/$/, '');
    if (!value) return;
    if (!candidates.includes(value)) {
      candidates.push(value);
    }
  };

  pushCandidate(normalizedBaseUrl);
  pushCandidate(process.env.LM_STUDIO_BASE_URL);

  // Common LM Studio local API endpoints (legacy/new)
  pushCandidate(normalizedBaseUrl
    .replace(/127\.0\.0\.1:1234/gi, 'localhost:1234')
    .replace(/127\.0\.0\.1:5619/gi, 'localhost:5619'));
  pushCandidate(normalizedBaseUrl
    .replace(/localhost:1234/gi, '127.0.0.1:1234')
    .replace(/localhost:5619/gi, '127.0.0.1:5619'));
  pushCandidate('http://127.0.0.1:1234');
  pushCandidate('http://localhost:1234');
  pushCandidate('http://127.0.0.1:5619');
  pushCandidate('http://localhost:5619');

  const attempted = [];
  const probeResults = [];
  let reachableButNotOpenAi = false;
  for (const baseUrl of candidates) {
    const targetUrl = `${baseUrl}/v1/models`;
    attempted.push(targetUrl);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const response = await fetch(targetUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        probeResults.push({ targetUrl, status: response.status, ok: false });
        if (response.status === 404 || response.status === 405) {
          reachableButNotOpenAi = true;
        }
        continue;
      }

      const payload = await response.json();
      const models = Array.isArray(payload?.data) ? payload.data : [];
      return res.json({
        ok: true,
        models,
        targetUrl,
        resolvedBaseUrl: baseUrl,
        attempted,
        probeResults,
      });
    } catch (error) {
      probeResults.push({
        targetUrl,
        ok: false,
        error: String(error?.message || error || 'probe-failed'),
      });
      // try next candidate
    }
  }

  return res.status(503).json({
    ok: false,
    error: reachableButNotOpenAi
      ? 'LM Studio 프로세스는 응답하지만 OpenAI API(/v1/models)가 비활성입니다. LM Studio에서 Local Server(OpenAI 호환) 기능을 활성화하세요.'
      : 'LM Studio API unreachable. Check Local Server and port settings in LM Studio.',
    attempted,
    probeResults,
  });
});

app.get('/health', (_req, res) => {
  return res.json({
    ok: true,
    service: 'analyze-questions-mock',
    providers: {
      openai: hasAnyEnvKey(['OPENAI_API_KEY']),
      gemini: hasAnyEnvKey(['GEMINI_API_KEY', 'GOOGLE_API_KEY']),
      anthropic: hasAnyEnvKey(['ANTHROPIC_API_KEY']),
    },
  });
});

const PORT = process.env.PORT || 8787;
const server = app.listen(PORT, () => {
  console.log(`Analyze-questions mock server listening on http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`[server] Port ${PORT} is already in use. Stop the existing process or use a different PORT.`);
    process.exit(1);
  }

  console.error('[server] Failed to start:', err);
  process.exit(1);
});
