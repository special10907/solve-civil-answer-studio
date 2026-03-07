import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import fs from "fs";

dotenv.config();

const app = express();
const port = process.env.PORT || 8787;

app.use(cors());
app.use(express.json({ limit: "5mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
});

function splitQuestionsFromText(text) {
  const cleaned = String(text || "")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
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
    const compact = block.replace(/\s+/g, " ").trim();
    const title = compact.length > 70 ? `${compact.slice(0, 70)}...` : compact;
    const idMatch = compact.match(/^(Q\s*\d+|\d+\s*[.)]|문제\s*\d+|\d+\s*번)/i);
    const normalizedId = idMatch
      ? idMatch[0].replace(/\s+/g, "")
      : `Q${index + 1}`;

    return {
      id: normalizedId.startsWith("Q") ? normalizedId : `Q${index + 1}`,
      title,
      rawQuestion: compact,
    };
  });
}

function normalizeContentMode(mode) {
  const normalized = String(mode || "")
    .trim()
    .toLowerCase();

  if (["text", "image", "mixed"].includes(normalized)) {
    return normalized;
  }

  return "text";
}

function inferAnalyzeContentMode(payload = {}, rawText = "") {
  const requested = normalizeContentMode(payload.contentMode);
  const textLen = Number(payload.textLength) || String(rawText || "").replace(/\s+/g, "").length;
  const hasText = typeof payload.hasText === "boolean" ? payload.hasText : textLen > 0;
  const hasImage =
    typeof payload.hasImage === "boolean"
      ? payload.hasImage
      : Boolean(payload.imageDataUrl || payload.referenceImageDataUrl);

  if (requested !== "text") {
    return {
      mode: requested,
      hasText,
      hasImage,
      textLength: textLen,
    };
  }

  if (!hasText && hasImage) {
    return { mode: "image", hasText, hasImage, textLength: textLen };
  }

  if (hasText && hasImage) {
    return { mode: "mixed", hasText, hasImage, textLength: textLen };
  }

  return { mode: "text", hasText, hasImage, textLength: textLen };
}

function deriveQuestionTitle(text, maxLen = 64) {
  const line = String(text || "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .find((s) => s.length > 0);

  if (!line) {
    return "선택 영역 분석";
  }

  const compact = line.replace(/\s+/g, " ").trim();
  return compact.length > maxLen ? `${compact.slice(0, maxLen)}...` : compact;
}

function buildModeAwareQuestions(rawText, meta = {}, payload = {}) {
  const sourceText = String(rawText || "").trim();
  const baseQuestions = splitQuestionsFromText(sourceText);
  const focus = String(payload.focus || "").trim();

  if (meta.mode === "text") {
    if (baseQuestions.length) {
      return baseQuestions;
    }
    if (!sourceText) {
      return [];
    }

    return [
      {
        id: "Q1",
        title: deriveQuestionTitle(sourceText),
        rawQuestion: sourceText,
      },
    ];
  }

  const modeLabel =
    meta.mode === "image" ? "이미지 중심 문항" : "혼합(텍스트+이미지) 문항";
  const normalizedText = sourceText.replace(/\s+/g, " ").trim();

  let rawQuestion = normalizedText;
  if (!rawQuestion) {
    rawQuestion =
      meta.mode === "image"
        ? "[이미지 중심 분석] 도면/표/그래프 요소를 우선 해석해 핵심 쟁점, 설계·시공·유지관리 포인트를 정리합니다."
        : "[혼합 분석] 텍스트와 이미지 정보를 결합해 문항 핵심, 메커니즘, 실무 포인트를 도출합니다.";
  }

  if (focus) {
    rawQuestion += `\n\n[분석 초점] ${focus}`;
  }

  return [
    {
      id: "Q1",
      title: `${modeLabel}: ${deriveQuestionTitle(normalizedText || focus || modeLabel, 52)}`,
      rawQuestion,
    },
  ];
}

function estimateAnalyzeConfidence(meta = {}, questions = []) {
  const qCount = Array.isArray(questions) ? questions.length : 0;
  const textLen = Number(meta.textLength) || 0;

  if (meta.mode === "image") {
    return textLen >= 12 ? 0.78 : 0.66;
  }
  if (meta.mode === "mixed") {
    if (textLen >= 80 && qCount >= 1) return 0.86;
    if (textLen >= 20) return 0.79;
    return 0.72;
  }

  if (textLen >= 250 && qCount >= 2) return 0.9;
  if (textLen >= 80 && qCount >= 1) return 0.84;
  if (textLen >= 20) return 0.76;
  return 0.65;
}

function localDraftTemplate(question, context = "") {
  const prompt =
    `${question?.title || ""} ${question?.rawQuestion || ""} ${question?.modelAnswer || ""}`.toLowerCase();

  const base = [
    "1. 정의 및 핵심 개념",
    "- 문제의 핵심 개념을 영어 병기와 함께 명확히 정의합니다.",
    "2. 설계/해석 검토",
    "- 하중, 저항, 파괴모드를 개조식(1.,2.,3.)으로 전개합니다.",
    "- KDS 기준 코드와 근거 수치를 명시합니다.",
    "3. 시각화 전략",
    "- 도해 1개(메커니즘) + 비교표 1개(대안 비교)를 포함합니다.",
    "4. 결론 및 기술사 제언",
    "- 시공성과 유지관리 관점의 보강안을 제시합니다.",
  ];

  if (/d-region|stm|응력교란|스트럿|타이/.test(prompt)) {
    base.splice(
      1,
      1,
      "- D-Region(Discontinuity Region)과 B-Region 구분을 우선 제시합니다.",
    );
    base.splice(4, 1, "- Strut/Tie/Node 강도와 정착을 기준으로 검토합니다.");
  }

  if (/psc|긴장재|부식|지연파괴|그라우팅/.test(prompt)) {
    base.splice(
      1,
      1,
      "- SCC/수소취성 메커니즘과 발생 조건을 구조적으로 설명합니다.",
    );
    base.splice(4, 1, "- 설계-시공-유지관리 단계별 대책을 제시합니다.");
  }

  const contextBlock = context
    ? `\n[검색 컨텍스트 요약]\n${context.slice(0, 1000)}\n`
    : "";

  return `${base.join("\n")}${contextBlock}`;
}

import { execSync, spawn, spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..");

app.use(express.static(workspaceRoot));

function getKnowledgeCorrections() {
  try {
    const corrPath = path.resolve(
      __dirname,
      "..",
      "solution",
      "memory",
      "KNOWLEDGE_CORRECTIONS.md",
    );
    if (fs.existsSync(corrPath)) {
      return fs.readFileSync(corrPath, "utf-8").trim();
    }
  } catch (e) {
    console.error("Failed to load KNOWLEDGE_CORRECTIONS:", e);
  }
  return "";
}

function getRagContext(query) {
  let context = "";
  try {
    const indexPath = path.resolve(
      __dirname,
      "..",
      "solution",
      "master_knowledge_index.json",
    );
    if (fs.existsSync(indexPath)) {
      const raw = fs.readFileSync(indexPath, "utf8");
      const idx = JSON.parse(raw);

      const qTokens = query
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length > 1);
      // Fix: idx가 배열이 아니라 { documents: [...] } 형태임을 반영
      const docs = Array.isArray(idx) ? idx : idx.documents || [];

      const scoredDocs = docs.map((doc) => {
        let score = 0;
        const titleLower = (doc.title || "").toLowerCase();
        const contentLower = (doc.content || "").toLowerCase();

        for (const t of qTokens) {
          if (titleLower.includes(t)) score += 5; // Title match weighted higher
          if (contentLower.includes(t)) score += 1;
        }
        return { ...doc, score };
      });

      const topDocs = scoredDocs
        .filter((d) => d.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(
          (x) =>
            `[${x.title || x.source || "첨부문서"}] ${String(x.content || "").substring(0, 1000)}...`,
        );
      if (topDocs.length > 0) {
        context += `\n[Universal Knowledge DB 검색 결과]\n${topDocs.join("\n\n")}\n`;
      }
    }
  } catch (e) {
    console.error("Failed to load master_knowledge_index:", e);
  }

  return context.trim();
}

async function fetchWebContext(query) {
  if (!query || String(query).trim().length < 2) {
    return "";
  }

  try {
    const pythonScript = path.join(
      __dirname,
      "..",
      "solution",
      "skills",
      "research",
      "web_research.py",
    );
    const stdout = execSync(`python "${pythonScript}" "${query}"`, {
      encoding: "utf-8",
    });
    return stdout || "";
  } catch (error) {
    console.error("Python Web Research Error:", error);
    return "";
  }
}

function parseJsonObjectFromText(content = "") {
  const raw = String(content || "").trim();
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {}

  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {}
  }

  return null;
}

async function callOpenAICompatible({
  provider,
  baseUrl,
  apiKey,
  model,
  systemPrompt,
  userPrompt,
  temperature = 0.3,
}) {
  if (!apiKey) {
    return null;
  }

  const response = await fetch(
    `${String(baseUrl || "").replace(/\/$/, "")}/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    },
  );

  if (!response.ok) {
    const body = (await response.text()).slice(0, 240);
    throw new Error(
      `${provider} API failed: ${response.status}${body ? ` ${body}` : ""}`,
    );
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
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      generationConfig: {
        temperature,
      },
      contents: [
        {
          role: "user",
          parts: [{ text: userPrompt }],
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = (await response.text()).slice(0, 240);
    throw new Error(
      `gemini API failed: ${response.status}${body ? ` ${body}` : ""}`,
    );
  }

  const payload = await response.json();
  const content = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text || "")
    .join("\n")
    .trim();
  if (!content) {
    return null;
  }

  return { text: content, provider: "gemini", model };
}

async function callAnthropic({ apiKey, model, userPrompt, temperature = 0.3 }) {
  if (!apiKey) {
    return null;
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: model || "claude-3-5-sonnet-20240620",
      max_tokens: 4000,
      temperature,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const body = (await response.text()).slice(0, 240);
    throw new Error(
      `anthropic API failed: ${response.status}${body ? ` ${body}` : ""}`,
    );
  }

  const payload = await response.json();
  const content = payload?.content?.[0]?.text;
  if (!content) {
    return null;
  }

  return { text: String(content), provider: "anthropic", model };
}

const isValidKey = (key) => Boolean(key && !String(key).includes("your_"));

/**
 * AI Provider 우선순위 정책 (Sir의 요청에 따름):
 * 1. Gemini (유효한 키가 있는 경우 최우선 시도)
 * 2. OpenAI
 * 3. Anthropic
 * 4. 모든 클라우드 AI가 실패하거나 키가 없는 경우에만 '로컬 규칙 템플릿' 적용
 */
async function generateTextWithProviders({
  systemPrompt = "",
  userPrompt = "",
  temperature = 0.3,
}) {
  const diagnostics = [];
  const attempts = [
    {
      provider: "gemini",
      enabled: isValidKey(process.env.GEMINI_API_KEY),
      run: async () =>
        callGemini({
          apiKey: process.env.GEMINI_API_KEY,
          model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
          userPrompt: `${systemPrompt}\n\n${userPrompt}`,
          temperature,
        }),
    },
    {
      provider: "openai",
      enabled: isValidKey(process.env.OPENAI_API_KEY),
      run: async () =>
        callOpenAICompatible({
          provider: "openai",
          baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
          apiKey: process.env.OPENAI_API_KEY,
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          systemPrompt,
          userPrompt,
          temperature,
        }),
    },
    {
      provider: "anthropic",
      enabled: isValidKey(process.env.ANTHROPIC_API_KEY),
      run: async () =>
        callAnthropic({
          apiKey: process.env.ANTHROPIC_API_KEY,
          model: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20240620",
          userPrompt: `${systemPrompt}\n\n${userPrompt}`,
          temperature,
        }),
    },
    {
      provider: "lmstudio",
      enabled: isValidKey(process.env.LMSTUDIO_BASE_URL),
      run: async () =>
        callOpenAICompatible({
          provider: "lmstudio",
          baseUrl: process.env.LMSTUDIO_BASE_URL,
          apiKey: "lm-studio", // LM Studio usually doesn't require a real key
          model: process.env.LMSTUDIO_MODEL || "local-model",
          systemPrompt,
          userPrompt,
          temperature,
        }),
    },
  ];

  for (const attempt of attempts) {
    if (!attempt.enabled) {
      diagnostics.push({
        provider: attempt.provider,
        status: "skipped",
        reason: "missing_api_key",
      });
      continue;
    }

    try {
      const generated = await attempt.run();
      if (generated?.text) {
        diagnostics.push({ provider: attempt.provider, status: "success" });
        return { ...generated, diagnostics };
      }
      diagnostics.push({ provider: attempt.provider, status: "empty" });
    } catch (error) {
      diagnostics.push({
        provider: attempt.provider,
        status: "failed",
        reason: String(error?.message || "provider_call_failed").slice(0, 280),
      });
    }
  }

  return { text: null, provider: null, model: null, diagnostics };
}

function getProviderConfigStatus() {
  return {
    openai: isValidKey(process.env.OPENAI_API_KEY),
    gemini: isValidKey(process.env.GEMINI_API_KEY),
    anthropic: isValidKey(process.env.ANTHROPIC_API_KEY),
    lmstudio: isValidKey(process.env.LMSTUDIO_BASE_URL),
  };
}

async function generateWithLLM({
  question,
  instruction,
  context,
  format = "text",
}) {
  const correctionsText = getKnowledgeCorrections();

  let enrichedContext = context;
  if (correctionsText) {
    enrichedContext +=
      `\n\n[SYSTEM DIRECTIVE / 사용자 교정 메모리]\n` +
      `다음은 당신이 과거에 답안을 작성할 때 발생했던 오류나 보스가 직접 내린 지시사항입니다.\n` +
      `절대 아래 규칙을 어기지 마십시오:\n` +
      `-----------------------------------\n${correctionsText}\n-----------------------------------\n`;
  }

  const systemPrompt =
    format === "json"
      ? "당신은 토목구조기술사 시험의 전문 강사입니다. 반드시 아래 JSON 포맷에 정확히 맞추어 응답해주십시오. 백틱(```json)이나 다른 설명 없이 오직 JSON만 반환해야 합니다."
      : "당신은 토목구조기술사 답안 코치입니다. 정확하고 구조화된 답안을 작성하세요.";

  const userPrompt =
    format === "json"
      ? `다음 기출문제: "${question?.title || ""}" 에 대한 전문 서브노트 초안을 작성해주세요.\n\n${enrichedContext}\n\n` +
        `{\n  "overview": "이 문제에 대한 개요 및 핵심 원리 1~2문장",\n  "characteristics": [\n    {"name": "특성1 이름", "desc1": "설명 1줄", "desc2": "보조 설명"},\n    {"name": "특성2 이름", "desc1": "설명 1줄", "desc2": "보조 설명"}\n  ],\n  "insights": [\n    {"title": "실무 경험", "content": "실제 현장/설계 시 주의사항 1줄"},\n    {"title": "최신 동향", "content": "관련 KDS 기준 혹은 최신 기술 트렌드 1줄"}\n  ],\n  "diagrams": [\n    {"title": "시스템 구성도", "content": "어떤 구성 요소들을 어떤 흐름으로 그려야 하는지 상세 가이드 1줄"}\n  ],\n  "keywords": "키워드1 | 키워드2 | 키워드3",\n  "strategy": "고득점을 위한 차별화 답안 작성 전략 1줄"\n}`
      : [
          `문제: ${question?.title || ""}`,
          `원문: ${question?.rawQuestion || ""}`,
          `요청: ${instruction || "토목구조기술사 고득점형 모범답안을 개조식으로 작성"}`,
          `검색컨텍스트: ${enrichedContext || "없음"}`,
          "형식: 1)정의 2)핵심이론 3)설계/검토 4)도해/표 포인트 5)결론/제언",
        ].join("\n");

  return generateTextWithProviders({
    systemPrompt,
    userPrompt,
    temperature: 0.3,
  });
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractPrimaryWebText(html = "") {
  const source = String(html || "");
  const mainMatch = source.match(/<main[\s\S]*?<\/main>/i);
  const articleMatch = source.match(/<article[\s\S]*?<\/article>/i);
  const bodyMatch = source.match(/<body[\s\S]*?<\/body>/i);
  const chosen =
    mainMatch?.[0] || articleMatch?.[0] || bodyMatch?.[0] || source;

  const text = stripHtml(chosen)
    .replace(
      /\b(skip to main content|download microsoft edge|this browser is no longer supported)\b/gi,
      " ",
    )
    .replace(/\s{2,}/g, " ")
    .trim();

  return text;
}

function extractTopKeywords(text, max = 8) {
  const stopwords = new Set([
    "그리고",
    "또한",
    "대한",
    "에서",
    "으로",
    "하는",
    "있는",
    "있다",
    "한다",
    "통해",
    "기준",
    "검토",
    "적용",
  ]);
  const freq = new Map();
  String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, " ")
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

function localInsightFromText({ title = "", text = "", focus = "" }) {
  const clean = String(text || "").trim();
  const summary = clean
    ? clean.slice(0, 500)
    : `${title || "자료"}에서 추출 가능한 텍스트가 부족합니다. 파일명/메타데이터 기반 분석을 제공합니다.`;

  const keywords = extractTopKeywords(`${title} ${clean} ${focus}`);
  const keyPoints = [
    "핵심 메커니즘을 정의-검토-결론 구조로 재정리",
    "KDS 코드와 수치 근거(하중계수, 허용값) 명시",
    "도해/비교표/그래프를 통해 채점 가독성 강화",
  ];

  const answerBoost = [
    "1. 문제 정의 및 배경(영어 병기 포함)",
    "2. 기준/식/검토 항목을 번호화해 전개",
    "3. 실무 제언(시공성·유지관리·리스크)으로 결론 강화",
  ].join("\n");

  return {
    summary,
    keywords,
    keyPoints,
    answerBoost,
    source: "local-insight",
  };
}

async function generateInsightWithLLM({ title = "", text = "", focus = "" }) {
  const userPrompt = [
    `자료 제목: ${title}`,
    `분석 초점: ${focus || "토목구조기술사 답안 보강"}`,
    `자료 본문(일부): ${String(text || "").slice(0, 4000)}`,
    "출력 형식(JSON only):",
    '{"summary":"...","keywords":["..."],"keyPoints":["..."],"answerBoost":"..."}',
  ].join("\n");

  const generated = await generateTextWithProviders({
    systemPrompt:
      "당신은 토목구조기술사 학습 코치입니다. 반드시 JSON만 출력하세요.",
    userPrompt,
    temperature: 0.2,
  });

  if (!generated?.text) {
    return {
      ok: false,
      diagnostics: Array.isArray(generated?.diagnostics)
        ? generated.diagnostics
        : [],
    };
  }

  const parsed = parseJsonObjectFromText(generated.text);
  if (!parsed || typeof parsed !== "object") {
    return {
      ok: false,
      diagnostics: [
        ...(Array.isArray(generated?.diagnostics) ? generated.diagnostics : []),
        { provider: generated.provider || "llm", status: "invalid_json" },
      ],
    };
  }

  return {
    ok: true,
    summary: parsed.summary || "",
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
    keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
    answerBoost: parsed.answerBoost || "",
    source: `${generated.provider || "llm"}-insight`,
    provider: generated.provider || "llm",
    model: generated.model || "",
    diagnostics: Array.isArray(generated?.diagnostics)
      ? generated.diagnostics
      : [],
  };
}

app.get("/health", (_, res) => {
  res.json({
    ok: true,
    service: "civil-answer-backend",
    providers: getProviderConfigStatus(),
  });
});

app.post("/api/transcribe", upload.single("file"), async (req, res) => {
  const uploaded = req.file;
  if (!uploaded) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    const dropzone = path.resolve(
      __dirname,
      "..",
      "solution",
      "knowledge_dropzone",
      "private",
    );
    if (!fs.existsSync(dropzone)) {
      fs.mkdirSync(dropzone, { recursive: true });
    }
    const safeName = `${Date.now()}_${uploaded.originalname}`;
    const filePath = path.join(dropzone, safeName);
    fs.writeFileSync(filePath, uploaded.buffer);

    return res.json({
      ok: true,
      mode: "solution_daemon",
      name: uploaded.originalname,
      transcript: `[시스템] 파일 '${uploaded.originalname}'이(가) Python Universal Ingestion 엔진(Dropzone)으로 전송되었습니다.\n백그라운드에서 지식화가 진행됩니다.`,
    });
  } catch (error) {
    console.error("Dropzone Forward Error:", error);
    return res.status(500).json({
      ok: false,
      error: "dropzone_forward_failed",
      message: String(error),
    });
  }
});

app.get("/api/dropzone-status", (req, res) => {
  try {
    const rootDir = path.resolve(__dirname, "..", "solution");
    const privateDir = path.join(rootDir, "knowledge_dropzone", "private");
    const processedDir = path.join(rootDir, "knowledge_dropzone", "processed");
    const jsonDir = path.join(rootDir, "json_subnotes");

    const getFiles = (dir) => {
      if (!fs.existsSync(dir)) return [];
      return fs
        .readdirSync(dir)
        .filter((f) => fs.statSync(path.join(dir, f)).isFile());
    };

    const privateFiles = getFiles(privateDir);
    const processedFiles = getFiles(processedDir);
    const jsonFiles = getFiles(jsonDir);

    res.json({
      ok: true,
      pending: privateFiles.length,
      processed: processedFiles.length,
      knowledgeItems: jsonFiles.length,
      pendingFiles: privateFiles,
      processedFiles: processedFiles,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// [REMOVED] Redundant /api/validate-keys (Merged logic below)

app.post("/api/lmstudio-models", async (req, res) => {
  const rawBaseUrl = String(
    req.body?.baseUrl ||
      process.env.LM_STUDIO_BASE_URL ||
      "http://127.0.0.1:1234",
  ).trim();
  const normalizedBaseUrl = rawBaseUrl.replace(/\/$/, "");

  const candidates = [];
  const pushCandidate = (url) => {
    const value = String(url || "")
      .trim()
      .replace(/\/$/, "");
    if (!value) return;
    if (!candidates.includes(value)) {
      candidates.push(value);
    }
  };

  pushCandidate(normalizedBaseUrl);
  pushCandidate(process.env.LM_STUDIO_BASE_URL);

  // Common LM Studio local API endpoints (legacy/new)
  pushCandidate(
    normalizedBaseUrl
      .replace(/127\.0\.0\.1:1234/gi, "localhost:1234")
      .replace(/127\.0\.0\.1:5619/gi, "localhost:5619"),
  );
  pushCandidate(
    normalizedBaseUrl
      .replace(/localhost:1234/gi, "127.0.0.1:1234")
      .replace(/localhost:5619/gi, "127.0.0.1:5619"),
  );
  pushCandidate("http://127.0.0.1:1234");
  pushCandidate("http://localhost:1234");
  pushCandidate("http://127.0.0.1:5619");
  pushCandidate("http://localhost:5619");

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
        error: String(error?.message || error || "probe-failed"),
      });
      // try next candidate
    }
  }

  return res.status(503).json({
    ok: false,
    error: reachableButNotOpenAi
      ? "LM Studio 프로세스는 응답하지만 OpenAI API(/v1/models)가 비활성입니다. LM Studio에서 Local Server(OpenAI 호환) 기능을 활성화하세요."
      : "LM Studio API unreachable. Check Local Server and port settings in LM Studio.",
    attempted,
    probeResults,
  });
});

app.get("/api/validate-keys", async (req, res) => {
  const providers = getProviderConfigStatus();
  const results = {};

  const testPrompt = 'Hi, please reply with "OK".';

  if (providers.openai) {
    try {
      await callOpenAICompatible({
        provider: "openai",
        baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        systemPrompt: "System",
        userPrompt: testPrompt,
        temperature: 0,
      });
      results.openai = { status: "valid" };
    } catch (e) {
      results.openai = { status: "invalid", error: e.message };
    }
  } else {
    results.openai = { status: "missing" };
  }

  if (providers.gemini) {
    try {
      await callGemini({
        apiKey: process.env.GEMINI_API_KEY,
        model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
        userPrompt: testPrompt,
        temperature: 0,
      });
      results.gemini = { status: "valid" };
    } catch (e) {
      results.gemini = { status: "invalid", error: e.message };
    }
  } else {
    results.gemini = { status: "missing" };
  }

  if (providers.anthropic) {
    try {
      await callAnthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20240620",
        userPrompt: testPrompt,
        temperature: 0,
      });
      results.anthropic = { status: "valid" };
    } catch (e) {
      results.anthropic = { status: "invalid", error: e.message };
    }
  } else {
    results.anthropic = { status: "missing" };
  }

  res.json({ ok: true, results });
});

app.post("/api/analyze-questions", (req, res) => {
  const payload = req.body || {};
  const rawText = String(payload.text || "").trim();
  const meta = inferAnalyzeContentMode(payload, rawText);
  const questions = buildModeAwareQuestions(rawText, meta, payload);
  const confidence = estimateAnalyzeConfidence(meta, questions);

  res.json({
    count: questions.length,
    questions,
    analysisMode: meta.mode,
    confidence,
    meta: {
      hasText: meta.hasText,
      hasImage: meta.hasImage,
      textLength: meta.textLength,
    },
  });
});

app.post("/api/search-context", async (req, res) => {
  const { query } = req.body || {};
  const context = await fetchWebContext(query || "");
  res.json({ query: query || "", context });
});

app.post("/api/generate-answer", async (req, res) => {
  const { question, instruction, format = "text" } = req.body || {};
  const query =
    `${question?.title || ""} ${question?.rawQuestion || ""}`.trim();
  const webContext = await fetchWebContext(query);
  const ragContext = getRagContext(query);
  const context = [ragContext, webContext].filter(Boolean).join("\n\n");

  try {
    const isLocalRule = question?.model === "local-rule" || instruction?.includes("local-rule");
    
    let aiAnswer = null;
    if (!isLocalRule) {
      aiAnswer = await generateWithLLM({
        question,
        instruction,
        context,
        format,
      });
    }

    if (aiAnswer?.text) {
      return res.json({
        answer: aiAnswer.text,
        source: `${aiAnswer.provider || "llm"}+web-context`,
        model: aiAnswer.model || "",
        llmDiagnostics: Array.isArray(aiAnswer.diagnostics)
          ? aiAnswer.diagnostics
          : [],
        context,
      });
    }

    const fallback = localDraftTemplate(question, context);
    return res.json({
      answer: fallback,
      source: "local-fallback",
      context,
      providers: getProviderConfigStatus(),
      llmDiagnostics: Array.isArray(aiAnswer?.diagnostics)
        ? aiAnswer.diagnostics
        : [],
    });
  } catch (err) {
    console.error("Generate Answer Error:", err);
  }

  const fallback = localDraftTemplate(question, context);
  return res.json({
    answer: fallback,
    source: "local-fallback",
    context,
    providers: getProviderConfigStatus(),
  });
});

app.post("/api/generate-docx", async (req, res) => {
  const { payload } = req.body || {};
  if (!payload || !payload.title) {
    return res.status(400).json({ error: "Payload with title is required" });
  }

  try {
    const bridgeScript = path.join(
      __dirname,
      "..",
      "solution",
      "core",
      "bridge_generate_docx.py",
    );
    const payloadArg = JSON.stringify(payload);

    const runBridge = (command, args) =>
      spawnSync(command, args, {
        encoding: "utf-8",
        windowsHide: true,
        env: {
          ...process.env,
          PYTHONUTF8: "1",
          PYTHONIOENCODING: "utf-8",
        },
      });

    let proc = runBridge("python", ["-X", "utf8", bridgeScript, payloadArg]);
    if ((proc.error || proc.status !== 0) && process.platform === "win32") {
      proc = runBridge("py", ["-3", "-X", "utf8", bridgeScript, payloadArg]);
    }

    if (proc.error || proc.status !== 0) {
      const stderr = String(proc.stderr || "").trim();
      const stdout = String(proc.stdout || "").trim();
      throw new Error(
        [
          `DOCX bridge process failed (status=${proc.status ?? "unknown"})`,
          stderr ? `stderr: ${stderr}` : "",
          stdout ? `stdout: ${stdout}` : "",
          proc.error ? `error: ${proc.error.message}` : "",
        ]
          .filter(Boolean)
          .join(" | "),
      );
    }

    const result = JSON.parse(String(proc.stdout || "{}"));

    if (result.ok) {
      return res.json(result);
    } else {
      return res.status(500).json(result);
    }
  } catch (error) {
    console.error("DOCX Bridge Error:", error);
    return res.status(500).json({ ok: false, error: String(error) });
  }
});

app.post("/api/reveal-in-explorer", (req, res) => {
  const rawTargetPath = String(req.body?.targetPath || "").trim();
  if (!rawTargetPath) {
    return res.status(400).json({ ok: false, error: "targetPath is required" });
  }

  const targetPath = path.isAbsolute(rawTargetPath)
    ? rawTargetPath
    : path.resolve(workspaceRoot, rawTargetPath);

  if (!fs.existsSync(targetPath)) {
    return res.status(404).json({ ok: false, error: "target path not found" });
  }

  try {
    if (process.platform === "win32") {
      const normalized = targetPath.replace(/\//g, "\\");
      const child = spawn("explorer.exe", [`/select,${normalized}`], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
    } else if (process.platform === "darwin") {
      const child = spawn("open", ["-R", targetPath], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
    } else {
      const child = spawn("xdg-open", [path.dirname(targetPath)], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
    }

    return res.json({ ok: true, revealed: targetPath });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: String(error?.message || error || "reveal_failed"),
    });
  }
});

app.post("/api/analyze-webpage", async (req, res) => {
  const { url, focus } = req.body || {};
  if (!url) {
    return res.status(400).json({ error: "url is required" });
  }

  let text = "";
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const html = await response.text();
    text = extractPrimaryWebText(html).slice(0, 12000);
  } catch (error) {
    return res
      .status(400)
      .json({ error: `failed to fetch url: ${error.message}` });
  }

  try {
    const ai = await generateInsightWithLLM({ title: url, text, focus });
    if (ai?.ok) {
      return res.json({ ...ai, url, mode: ai.provider || "llm" });
    }

    const local = localInsightFromText({ title: url, text, focus });
    return res.json({
      ...local,
      url,
      mode: "local",
      providers: getProviderConfigStatus(),
      llmDiagnostics: Array.isArray(ai?.diagnostics) ? ai.diagnostics : [],
    });
  } catch {}

  const local = localInsightFromText({ title: url, text, focus });
  return res.json({ ...local, url, mode: "local" });
});

app.post("/api/analyze-attachments", async (req, res) => {
  const { items, focus } = req.body || {};
  const files = Array.isArray(items) ? items : [];
  if (!files.length) {
    return res.status(400).json({ error: "items is required" });
  }

  const textBody = files
    .map((item) => {
      const name = item?.name || "unknown";
      const type = item?.type || "unknown";
      const size = item?.size || 0;
      const extracted = item?.textExcerpt || "";
      return `[${name}] type=${type} size=${size}\n${extracted}`;
    })
    .join("\n\n")
    .slice(0, 16000);

  const title = `${files.length} files`;

  try {
    const ai = await generateInsightWithLLM({ title, text: textBody, focus });
    if (ai?.ok) {
      return res.json({
        ...ai,
        mode: ai.provider || "llm",
        fileCount: files.length,
      });
    }

    const local = localInsightFromText({ title, text: textBody, focus });
    return res.json({
      ...local,
      mode: "local",
      fileCount: files.length,
      providers: getProviderConfigStatus(),
      llmDiagnostics: Array.isArray(ai?.diagnostics) ? ai.diagnostics : [],
    });
  } catch {}

  const local = localInsightFromText({ title, text: textBody, focus });
  return res.json({ ...local, mode: "local", fileCount: files.length });
});

app.post(
  "/api/ingest-intelligence",
  upload.array("files"),
  async (req, res) => {
    const uploadedFiles = req.files || [];
    const { focus, items: itemsRaw } = req.body || {};

    let items = [];
    try {
      items =
        typeof itemsRaw === "string"
          ? JSON.parse(itemsRaw)
          : Array.isArray(itemsRaw)
            ? itemsRaw
            : [];
    } catch (e) {
      items = [];
    }

    if (!uploadedFiles.length && !items.length) {
      return res.status(400).json({ error: "No files or items provided" });
    }

    const results = {
      ok: true,
      savedToDropzone: 0,
      intelligence: null,
      mode: "backend",
    };

    try {
      // 1. Dropzone 저장 (Python RAG 엔진용)
      const dropzone = path.resolve(
        __dirname,
        "..",
        "solution",
        "knowledge_dropzone",
        "private",
      );
      if (!fs.existsSync(dropzone)) {
        fs.mkdirSync(dropzone, { recursive: true });
      }

      for (const file of uploadedFiles) {
        const safeName = `${Date.now()}_${file.originalname}`;
        const filePath = path.join(dropzone, safeName);
        fs.writeFileSync(filePath, file.buffer);
        results.savedToDropzone++;
      }

      // 2. Intelligence 분석 (LLM 활용)
      const textBody = items
        .map((item) => {
          const name = item?.name || "unknown";
          const extracted = item?.textExcerpt || "";
          return `[${name}]\n${extracted}`;
        })
        .join("\n\n")
        .slice(0, 16000);

      const title =
        uploadedFiles.length > 0
          ? `${uploadedFiles[0].originalname}${uploadedFiles.length > 1 ? ` 외 ${uploadedFiles.length - 1}건` : ""}`
          : items.length > 0
            ? items[0].name
            : "지식 주입";

      const ai = await generateInsightWithLLM({ title, text: textBody, focus });
      if (ai?.ok) {
        results.intelligence = { ...ai, mode: ai.provider || "llm" };
      } else {
        const local = localInsightFromText({ title, text: textBody, focus });
        results.intelligence = { ...local, mode: "local" };
      }

      return res.json(results);
    } catch (error) {
      console.error("Ingest Intelligence Error:", error);
      return res
        .status(500)
        .json({ ok: false, error: "ingest_failed", message: String(error) });
    }
  },
);

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
