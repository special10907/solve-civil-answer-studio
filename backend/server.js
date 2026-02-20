import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 8787;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

function splitQuestionsFromText(text) {
  const cleaned = String(text || '')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!cleaned) {
    return [];
  }

  const blocks = cleaned
    .split(/\n(?=\s*(?:Q\s*\d+|\d+\s*[.)]|문제\s*\d+|\d+\s*번))/g)
    .map((block) => block.trim())
    .filter((block) => block.length >= 25);

  const resultBlocks = blocks.length
    ? blocks
    : cleaned
        .split(/\n\n+/)
        .map((block) => block.trim())
        .filter((block) => block.length >= 40)
        .slice(0, 20);

  return resultBlocks.map((block, index) => {
    const compact = block.replace(/\s+/g, ' ').trim();
    const title = compact.length > 70 ? `${compact.slice(0, 70)}...` : compact;
    const idMatch = compact.match(/^(Q\s*\d+|\d+\s*[.)]|문제\s*\d+|\d+\s*번)/i);
    const normalizedId = idMatch ? idMatch[0].replace(/\s+/g, '') : `Q${index + 1}`;

    return {
      id: normalizedId.startsWith('Q') ? normalizedId : `Q${index + 1}`,
      title,
      rawQuestion: compact
    };
  });
}

function localDraftTemplate(question, context = '') {
  const prompt = `${question?.title || ''} ${question?.rawQuestion || ''} ${question?.modelAnswer || ''}`.toLowerCase();

  const base = [
    '1. 정의 및 핵심 개념',
    '- 문제의 핵심 개념을 영어 병기와 함께 명확히 정의합니다.',
    '2. 설계/해석 검토',
    '- 하중, 저항, 파괴모드를 개조식(1.,2.,3.)으로 전개합니다.',
    '- KDS 기준 코드와 근거 수치를 명시합니다.',
    '3. 시각화 전략',
    '- 도해 1개(메커니즘) + 비교표 1개(대안 비교)를 포함합니다.',
    '4. 결론 및 기술사 제언',
    '- 시공성과 유지관리 관점의 보강안을 제시합니다.'
  ];

  if (/d-region|stm|응력교란|스트럿|타이/.test(prompt)) {
    base.splice(1, 1, '- D-Region(Discontinuity Region)과 B-Region 구분을 우선 제시합니다.');
    base.splice(4, 1, '- Strut/Tie/Node 강도와 정착을 기준으로 검토합니다.');
  }

  if (/psc|긴장재|부식|지연파괴|그라우팅/.test(prompt)) {
    base.splice(1, 1, '- SCC/수소취성 메커니즘과 발생 조건을 구조적으로 설명합니다.');
    base.splice(4, 1, '- 설계-시공-유지관리 단계별 대책을 제시합니다.');
  }

  const contextBlock = context
    ? `\n[검색 컨텍스트 요약]\n${context.slice(0, 1000)}\n`
    : '';

  return `${base.join('\n')}${contextBlock}`;
}

async function fetchWebContext(query) {
  if (!query || String(query).trim().length < 2) {
    return '';
  }

  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url);
    if (!res.ok) {
      return '';
    }
    const json = await res.json();
    const segments = [json.AbstractText, json.Heading]
      .filter(Boolean)
      .join(' - ');
    return segments || '';
  } catch {
    return '';
  }
}

function parseJsonObjectFromText(content = '') {
  const raw = String(content || '').trim();
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
  }

  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
    }
  }

  return null;
}

async function callOpenAICompatible({ provider, baseUrl, apiKey, model, systemPrompt, userPrompt, temperature = 0.3 }) {
  if (!apiKey) {
    return null;
  }

  const response = await fetch(`${String(baseUrl || '').replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    })
  });

  if (!response.ok) {
    const body = (await response.text()).slice(0, 240);
    throw new Error(`${provider} API failed: ${response.status}${body ? ` ${body}` : ''}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) {
    return null;
  }

  return { text: String(content), provider, model };
}

async function callGemini({ apiKey, model, userPrompt, temperature = 0.3 }) {
  if (!apiKey) {
    return null;
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      generationConfig: {
        temperature
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }]
        }
      ]
    })
  });

  if (!response.ok) {
    const body = (await response.text()).slice(0, 240);
    throw new Error(`gemini API failed: ${response.status}${body ? ` ${body}` : ''}`);
  }

  const payload = await response.json();
  const content = payload?.candidates?.[0]?.content?.parts?.map((part) => part?.text || '').join('\n').trim();
  if (!content) {
    return null;
  }

  return { text: content, provider: 'gemini', model };
}

async function generateTextWithProviders({ systemPrompt = '', userPrompt = '', temperature = 0.3 }) {
  const diagnostics = [];
  const attempts = [
    {
      provider: 'openai',
      enabled: Boolean(process.env.OPENAI_API_KEY),
      run: async () => callOpenAICompatible({
      provider: 'openai',
      baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      systemPrompt,
      userPrompt,
      temperature
      })
    },
    {
      provider: 'gemini',
      enabled: Boolean(process.env.GEMINI_API_KEY),
      run: async () => callGemini({
      apiKey: process.env.GEMINI_API_KEY,
        model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
      userPrompt: `${systemPrompt}\n\n${userPrompt}`,
      temperature
      })
    }
  ];

  for (const attempt of attempts) {
    if (!attempt.enabled) {
      diagnostics.push({ provider: attempt.provider, status: 'skipped', reason: 'missing_api_key' });
      continue;
    }

    try {
      const generated = await attempt.run();
      if (generated?.text) {
        diagnostics.push({ provider: attempt.provider, status: 'success' });
        return { ...generated, diagnostics };
      }
      diagnostics.push({ provider: attempt.provider, status: 'empty' });
    } catch (error) {
      diagnostics.push({
        provider: attempt.provider,
        status: 'failed',
        reason: String(error?.message || 'provider_call_failed').slice(0, 280)
      });
    }
  }

  return { text: null, provider: null, model: null, diagnostics };
}

function getProviderConfigStatus() {
  return {
    openai: Boolean(process.env.OPENAI_API_KEY),
    gemini: Boolean(process.env.GEMINI_API_KEY)
  };
}

async function generateWithLLM({ question, instruction, context }) {

  const userPrompt = [
    `문제: ${question?.title || ''}`,
    `원문: ${question?.rawQuestion || ''}`,
    `요청: ${instruction || '토목구조기술사 고득점형 모범답안을 개조식으로 작성'}`,
    `검색컨텍스트: ${context || '없음'}`,
    '형식: 1)정의 2)핵심이론 3)설계/검토 4)도해/표 포인트 5)결론/제언'
  ].join('\n');

  return generateTextWithProviders({
    systemPrompt: '당신은 토목구조기술사 답안 코치입니다. 정확하고 구조화된 답안을 작성하세요.',
    userPrompt,
    temperature: 0.3
  });
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function extractPrimaryWebText(html = '') {
  const source = String(html || '');
  const mainMatch = source.match(/<main[\s\S]*?<\/main>/i);
  const articleMatch = source.match(/<article[\s\S]*?<\/article>/i);
  const bodyMatch = source.match(/<body[\s\S]*?<\/body>/i);
  const chosen = (mainMatch && mainMatch[0]) || (articleMatch && articleMatch[0]) || (bodyMatch && bodyMatch[0]) || source;

  const text = stripHtml(chosen)
    .replace(/\b(skip to main content|download microsoft edge|this browser is no longer supported)\b/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return text;
}

function extractTopKeywords(text, max = 8) {
  const stopwords = new Set(['그리고', '또한', '대한', '에서', '으로', '하는', '있는', '있다', '한다', '통해', '기준', '검토', '적용']);
  const freq = new Map();
  String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !stopwords.has(token))
    .forEach((token) => {
      freq.set(token, (freq.get(token) || 0) + 1);
    });

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([token]) => token);
}

function localInsightFromText({ title = '', text = '', focus = '' }) {
  const clean = String(text || '').trim();
  const summary = clean
    ? clean.slice(0, 500)
    : `${title || '자료'}에서 추출 가능한 텍스트가 부족합니다. 파일명/메타데이터 기반 분석을 제공합니다.`;

  const keywords = extractTopKeywords(`${title} ${clean} ${focus}`);
  const keyPoints = [
    '핵심 메커니즘을 정의-검토-결론 구조로 재정리',
    'KDS 코드와 수치 근거(하중계수, 허용값) 명시',
    '도해/비교표/그래프를 통해 채점 가독성 강화'
  ];

  const answerBoost = [
    '1. 문제 정의 및 배경(영어 병기 포함)',
    '2. 기준/식/검토 항목을 번호화해 전개',
    '3. 실무 제언(시공성·유지관리·리스크)으로 결론 강화'
  ].join('\n');

  return {
    summary,
    keywords,
    keyPoints,
    answerBoost,
    source: 'local-insight'
  };
}

async function generateInsightWithLLM({ title = '', text = '', focus = '' }) {

  const userPrompt = [
    `자료 제목: ${title}`,
    `분석 초점: ${focus || '토목구조기술사 답안 보강'}`,
    `자료 본문(일부): ${String(text || '').slice(0, 4000)}`,
    '출력 형식(JSON only):',
    '{"summary":"...","keywords":["..."],"keyPoints":["..."],"answerBoost":"..."}'
  ].join('\n');

  const generated = await generateTextWithProviders({
    systemPrompt: '당신은 토목구조기술사 학습 코치입니다. 반드시 JSON만 출력하세요.',
    userPrompt,
    temperature: 0.2
  });

  if (!generated?.text) {
    return {
      ok: false,
      diagnostics: Array.isArray(generated?.diagnostics) ? generated.diagnostics : []
    };
  }

  const parsed = parseJsonObjectFromText(generated.text);
  if (!parsed || typeof parsed !== 'object') {
    return {
      ok: false,
      diagnostics: [
        ...(Array.isArray(generated?.diagnostics) ? generated.diagnostics : []),
        { provider: generated.provider || 'llm', status: 'invalid_json' }
      ]
    };
  }

  return {
    ok: true,
    summary: parsed.summary || '',
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
    keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
    answerBoost: parsed.answerBoost || '',
    source: `${generated.provider || 'llm'}-insight`,
    provider: generated.provider || 'llm',
    model: generated.model || '',
    diagnostics: Array.isArray(generated?.diagnostics) ? generated.diagnostics : []
  };
}

app.get('/health', (_, res) => {
  res.json({ ok: true, service: 'civil-answer-backend', providers: getProviderConfigStatus() });
});

app.post('/api/analyze-questions', (req, res) => {
  const { text } = req.body || {};
  const questions = splitQuestionsFromText(text || '');
  res.json({ count: questions.length, questions });
});

app.post('/api/search-context', async (req, res) => {
  const { query } = req.body || {};
  const context = await fetchWebContext(query || '');
  res.json({ query: query || '', context });
});

app.post('/api/generate-answer', async (req, res) => {
  const { question, instruction } = req.body || {};
  const query = `${question?.title || ''} ${question?.rawQuestion || ''}`.trim();
  const context = await fetchWebContext(query);

  try {
    const aiAnswer = await generateWithLLM({ question, instruction, context });
    if (aiAnswer?.text) {
      return res.json({
        answer: aiAnswer.text,
        source: `${aiAnswer.provider || 'llm'}+web-context`,
        model: aiAnswer.model || '',
        llmDiagnostics: Array.isArray(aiAnswer.diagnostics) ? aiAnswer.diagnostics : [],
        context
      });
    }

    const fallback = localDraftTemplate(question, context);
    return res.json({
      answer: fallback,
      source: 'local-fallback',
      context,
      providers: getProviderConfigStatus(),
      llmDiagnostics: Array.isArray(aiAnswer?.diagnostics) ? aiAnswer.diagnostics : []
    });
  } catch {
  }

  const fallback = localDraftTemplate(question, context);
  return res.json({
    answer: fallback,
    source: 'local-fallback',
    context,
    providers: getProviderConfigStatus()
  });
});

app.post('/api/analyze-webpage', async (req, res) => {
  const { url, focus } = req.body || {};
  if (!url) {
    return res.status(400).json({ error: 'url is required' });
  }

  let text = '';
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const html = await response.text();
    text = extractPrimaryWebText(html).slice(0, 12000);
  } catch (error) {
    return res.status(400).json({ error: `failed to fetch url: ${error.message}` });
  }

  try {
    const ai = await generateInsightWithLLM({ title: url, text, focus });
    if (ai?.ok) {
      return res.json({ ...ai, url, mode: ai.provider || 'llm' });
    }

    const local = localInsightFromText({ title: url, text, focus });
    return res.json({
      ...local,
      url,
      mode: 'local',
      providers: getProviderConfigStatus(),
      llmDiagnostics: Array.isArray(ai?.diagnostics) ? ai.diagnostics : []
    });
  } catch {
  }

  const local = localInsightFromText({ title: url, text, focus });
  return res.json({ ...local, url, mode: 'local' });
});

app.post('/api/analyze-attachments', async (req, res) => {
  const { items, focus } = req.body || {};
  const files = Array.isArray(items) ? items : [];
  if (!files.length) {
    return res.status(400).json({ error: 'items is required' });
  }

  const textBody = files
    .map((item) => {
      const name = item?.name || 'unknown';
      const type = item?.type || 'unknown';
      const size = item?.size || 0;
      const extracted = item?.textExcerpt || '';
      return `[${name}] type=${type} size=${size}\n${extracted}`;
    })
    .join('\n\n')
    .slice(0, 16000);

  const title = `${files.length} files`;

  try {
    const ai = await generateInsightWithLLM({ title, text: textBody, focus });
    if (ai?.ok) {
      return res.json({ ...ai, mode: ai.provider || 'llm', fileCount: files.length });
    }

    const local = localInsightFromText({ title, text: textBody, focus });
    return res.json({
      ...local,
      mode: 'local',
      fileCount: files.length,
      providers: getProviderConfigStatus(),
      llmDiagnostics: Array.isArray(ai?.diagnostics) ? ai.diagnostics : []
    });
  } catch {
  }

  const local = localInsightFromText({ title, text: textBody, focus });
  return res.json({ ...local, mode: 'local', fileCount: files.length });
});

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
