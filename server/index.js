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

function isDRegionTopic(text = "") {
  const src = String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  if (!src) return false;

  if (/d[\s-]?region|응력\s*교란\s*구역|응력\s*교란|strut\s*[- ]?\s*tie|stm\b|스트럿\s*[-·]?\s*타이|스트럿타이/.test(src)) {
    return true;
  }

  const hasStrut = /(^|[^a-z])strut([^a-z]|$)|스트럿/.test(src);
  const hasTie = /(^|[^a-z])tie([^a-z]|$)|타이\s*모델|타이\s*부재|타이\s*요소/.test(src);
  return hasStrut && hasTie;
}

function localDraftTemplate(question, context = "") {
  const promptRaw = `${question?.title || ""} ${question?.rawQuestion || ""} ${question?.modelAnswer || ""}`;
  const prompt = promptRaw.toLowerCase();
  const qTitle = String(question?.title || "문항").trim();
  const qRaw = String(question?.rawQuestion || "").replace(/\s+/g, " ").trim();
  const qHint = qRaw.slice(0, 180) || qTitle;

  const base = [
    "1. 정의 및 적용 배경",
    `- 대상: ${qTitle}`,
    `- 핵심 쟁점: ${qHint}`,
    "- 본 문항은 하중 전달 경로와 저항 메커니즘의 정합성을 중심으로 검토해야 하며, 단순 현상 서술보다 인과관계 제시가 중요하다.",
    "",
    "2. 거동 메커니즘 (Load Path → Internal Force → Failure Mode)",
    "- 외력은 작용점에서 지점으로 전달되며, 이 과정에서 휨·전단·부착/정착 거동이 상호작용한다.",
    "- 파괴모드는 ① 휨 ② 전단 ③ 정착/부착 ④ 사용성(균열·처짐) 순으로 스크리닝하고 지배모드를 기준으로 상세를 결정한다.",
    "",
    "3. 설계 검토 및 기준·수치 근거",
    "- KDS 관련 조항을 명시하고, 검토식(예: φMn ≥ Mu, Vn ≥ Vu, 정착길이 ld)을 본문에 병기한다.",
    "- 하중조합·저항계수·허용기준을 단위와 함께 제시하고, 기준값 대비 여유도(Margin)로 적정성을 판정한다.",
    "",
    "4. 상세·시공·유지관리 대책",
    "- 상세: 취약구간의 정착·배근 상세를 우선 보강하고, 전단 보강근 배치를 지배모드와 연계해 제시한다.",
    "- 시공: 피복·정착·다짐·시공이음 품질게이트를 설정해 취성적 파괴 리스크를 억제한다.",
    "- 유지관리: 균열폭·변위·누수 지표를 계측해 임계치 초과 시 즉시 보수 시나리오를 적용한다.",
    "",
    "5. 도해 및 비교표(첨부 이미지 참조)",
    "- [첨부 이미지-1] 메커니즘 도해(하중경로·취약부·경계조건)",
    "- [첨부 이미지-2] 대안 비교표(안전성·시공성·경제성·유지관리성)",
    "- 본문에는 도해/비교표의 핵심 판정 결과만 요약 기재한다.",
    "",
    "6. 결론 및 기술사 제언",
    "- 기준 적합성, 시공 리스크 저감, 유지관리 실행성을 동시에 만족하는 대안을 채택한다.",
    "- 운영 단계에서는 점검주기·계측항목·임계치 기반 대응 프로토콜을 사전에 설정해 성능 저하를 조기 차단한다.",
  ];

  if (isDRegionTopic(prompt)) {
    return [
      "1. 응력교란구역(D-Region)의 정의와 본질",
      "- 응력교란구역은 평면유지 가정(Bernoulli Hypothesis)이 성립하지 않는 불연속 구간으로, 하중 재하점·지점부·개구부·단면 급변부에 주로 발생함.",
      "- 따라서 B-Region의 보통 휨이론만으로는 안전측 평가가 어려우며, 별도의 힘 흐름 모델이 필요함.",
      "2. 해석 및 설계 접근(핵심: STM)",
      "- Strut-and-Tie Model(STM)로 내부 힘의 흐름을 압축재(Strut)·인장재(Tie)·절점(Node)으로 이상화함.",
      "- 검토 순서: ① 하중경로 설정 ② Strut/Tie 산정 ③ Node 응력검토 ④ 정착·상세 검토.",
      "- 설계 시 KDS 14 20 24 등 관련 기준을 근거로 정착길이, 절점 유효강도, 파괴모드(압축파괴/정착파괴)를 확인함.",
      "3. 도해 및 비교표(첨부 이미지 참조)",
      "- [도해] 하중점에서 지점까지의 하중경로를 화살표로 표시하고, Strut(압축)·Tie(인장)·Node를 도식화함.",
      "- [도해] D-Region과 B-Region 경계를 단면도에 함께 표시하여 적용 해석법의 차이를 제시함.",
      "- [비교표] B-Region(선형변형률 가정) vs D-Region(STM 적용)의 해석가정·설계절차·오류위험 비교.",
      "- 본문에는 이미지 해석 결과(지배모드·설계판정·보강결론)만 요약 기재함.",
      "4. 결론 및 기술사 제언",
      "- D-Region은 ‘상세설계 실패 시 취성파괴로 직결’되는 구간이므로, 배근 상세·정착·시공 오차 관리까지 통합 검토해야 함.",
      "- 유지관리 단계에서는 균열패턴 모니터링과 국부보강 계획을 사전에 포함하는 것이 바람직함.",
    ].join("\n");
  }

  if (/psc|긴장재|부식|지연파괴|그라우팅/.test(prompt)) {
    return [
      "1. PSC 부재 손상 메커니즘",
      "- PSC의 핵심 리스크는 긴장재의 응력부식균열(SCC) 및 수소취성(Hydrogen Embrittlement)에 따른 지연파괴임.",
      "- 그라우팅 불량·공극·염화물 유입이 결합되면 긴장재 부식과 단면 손실이 급격히 진행될 수 있음.",
      "2. 설계·시공·유지관리 검토",
      "- 설계: 노출환경 등급별 피복/방청 상세와 허용응력 수준을 명확히 반영함.",
      "- 시공: 쉬스 충전성, 블리딩, 그라우트 품질관리(배합·주입압·재주입 기준) 확보.",
      "- 유지관리: 비파괴검사(NDT), 케이블 상태점검, 누수·균열 연계 모니터링 체계를 운영.",
      "3. 도해/비교표",
      "- [도해] 쉬스 내부 결함(공극) → 수분/염화물 침투 → 긴장재 부식 진행 메커니즘을 단계도로 제시.",
      "- [비교표] 예방대책(설계/시공/유지관리)별 효과·비용·적용시기를 비교.",
      "4. 결론",
      "- PSC는 ‘사후보수’보다 ‘초기 결함 억제’가 경제적이므로, 설계-시공-유지관리 연계 품질체계를 선제적으로 구축해야 함.",
    ].join("\n");
  }

  const sanitizeLocalContext = (rawContext = "") => {
    const text = String(rawContext || "").trim();
    if (!text) return "";

    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !/^\[web_research\]$/i.test(line))
      .filter((line) => !/^query\s*:/i.test(line))
      .filter((line) => !/^status\s*:\s*warning\b/i.test(line))
      .filter((line) => !/^message\s*:/i.test(line))
      .filter((line) => !/검색\s*결과가\s*충분하지\s*않습니다/i.test(line));

    const joined = lines.join("\n").trim();
    return joined;
  };

  const cleanedContext = sanitizeLocalContext(context);
  const contextBlock = cleanedContext
    ? `\n[검색 컨텍스트 요약]\n${cleanedContext.slice(0, 1000)}\n`
    : "";

  return `${base.join("\n")}${contextBlock}`;
}

function sanitizeResearchNoise(rawContext = "") {
  const text = String(rawContext || "").trim();
  if (!text) return "";

  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^\[web_research\]$/i.test(line))
    .filter((line) => !/^query\s*:/i.test(line))
    .filter((line) => !/^status\s*:\s*warning\b/i.test(line))
    .filter((line) => !/^message\s*:/i.test(line))
    .filter((line) => !/검색\s*결과가\s*충분하지\s*않습니다/i.test(line))
    .join("\n")
    .trim();
}

function isGenericScaffoldAnswer(text = "") {
  const source = String(text || "").toLowerCase();
  if (!source) return false;
  const signals = [
    "정의 및 핵심 개념",
    "문제의 핵심 개념",
    "하중, 저항, 파괴모드",
    "도해 1개",
    "비교표 1개",
  ];
  const hit = signals.filter((s) => source.includes(s)).length;
  return hit >= 2;
}

function cleanGeneratedAnswerText(text = "") {
  const stripped = String(text || "")
    .split(/\r?\n/)
    .filter((line) => !/^\[web_research\]$/i.test(line.trim()))
    .filter((line) => !/^query\s*:/i.test(line.trim()))
    .filter((line) => !/^status\s*:\s*warning\b/i.test(line.trim()))
    .filter((line) => !/^message\s*:/i.test(line.trim()))
    .join("\n")
    .trim();

  return stripped;
}

function sanitizeExamAnswerText(text = "") {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^\[web_research\]$/i.test(line))
    .filter((line) => !/^\[mandatory_pipeline_context\]$/i.test(line))
    .filter((line) => !/^\[deep_research_parsed\]$/i.test(line))
    .filter((line) => !/^\[검색\s*컨텍스트\s*요약\]$/i.test(line))
    .filter((line) => !/^\[심화\s*보강/i.test(line))
    .filter((line) => !/^\[연계\s*이론\s*스니펫\]/i.test(line))
    .filter((line) => !/^\[분량\s*보강\s*블록\]/i.test(line))
    .filter((line) => !/^query\s*:/i.test(line))
    .filter((line) => !/^status\s*:/i.test(line))
    .filter((line) => !/^message\s*:/i.test(line))
    .filter((line) => !/^title\s*:/i.test(line))
    .filter((line) => !/^summary\s*:/i.test(line))
    .filter((line) => !/^url\s*:/i.test(line))
    .filter((line) => !/^references\s*:/i.test(line))
    .filter((line) => !/^참고\s*링크\s*없음$/i.test(line))
    .filter((line) => !/^근거첨부$/i.test(line))
    .filter((line) => !/시각화\s*요약/i.test(line))
    .filter((line) => !/^\d+\)\s*(그림|표|그래프)\s*:/i.test(line))
    .filter((line) => !/^[-–—]\s*(목적|작성\s*기준|채점\s*포인트)\s*:/i.test(line))
    .filter((line) => !/^-\s*요청사항\s*:/i.test(line))
    .filter((line) => !/^-\s*탐색소스\s*:/i.test(line))
    .filter((line) => !/^\|\s*단계\s*\|\s*소스\s*\|\s*핵심근거\s*\|\s*답안\s*적용\s*\|/i.test(line))
    .filter((line) => !/^\|---\|---\|---\|---\|/.test(line))
    .filter((line) => !/^\|\s*[1-5]\s*\|/.test(line));

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function sanitizeDocxBridgeText(text = "") {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^\[web_research\]$/i.test(line))
    .filter((line) => !/^\[mandatory_pipeline_context\]$/i.test(line))
    .filter((line) => !/^\[deep_research_parsed\]$/i.test(line))
    .filter((line) => !/^\[검색\s*컨텍스트\s*요약\]$/i.test(line))
    .filter((line) => !/^\[심화\s*보강/i.test(line))
    .filter((line) => !/^query\s*:/i.test(line))
    .filter((line) => !/^status\s*:/i.test(line))
    .filter((line) => !/^message\s*:/i.test(line))
    .filter((line) => !/^title\s*:/i.test(line))
    .filter((line) => !/^summary\s*:/i.test(line))
    .filter((line) => !/^url\s*:/i.test(line))
    .filter((line) => !/^references\s*:/i.test(line))
    .filter((line) => !/^참고\s*링크\s*없음$/i.test(line))
    .filter((line) => !/^근거첨부$/i.test(line))
    .filter((line) => !/^-\s*요청사항\s*:/i.test(line))
    .filter((line) => !/^-\s*탐색소스\s*:/i.test(line))
    .filter((line) => !/^\|\s*단계\s*\|\s*소스\s*\|\s*핵심근거\s*\|\s*답안\s*적용\s*\|/i.test(line))
    .filter((line) => !/^\|---\|---\|---\|---\|/.test(line))
    .filter((line) => !/^\|\s*[1-5]\s*\|/.test(line));

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function sanitizeDocxBridgePayload(inputPayload = {}) {
  const payload = inputPayload && typeof inputPayload === "object" ? { ...inputPayload } : {};
  const safe = {
    ...payload,
    title: sanitizeDocxBridgeText(payload.title || ""),
    raw_question: sanitizeDocxBridgeText(payload.raw_question || ""),
    answer_text: sanitizeDocxBridgeText(payload.answer_text || ""),
  };

  const llmData = payload.llm_data && typeof payload.llm_data === "object" ? payload.llm_data : {};

  safe.llm_data = {
    ...llmData,
    overview: sanitizeDocxBridgeText(llmData.overview || ""),
    keywords: sanitizeDocxBridgeText(llmData.keywords || "").replace(/\n+/g, ", "),
    strategy: sanitizeDocxBridgeText(llmData.strategy || ""),
    characteristics: (Array.isArray(llmData.characteristics) ? llmData.characteristics : [])
      .map((item) => ({
        name: sanitizeDocxBridgeText(item?.name || ""),
        desc1: sanitizeDocxBridgeText(item?.desc1 || ""),
        desc2: sanitizeDocxBridgeText(item?.desc2 || ""),
      }))
      .filter((item) => item.name || item.desc1 || item.desc2)
      .slice(0, 8),
    insights: (Array.isArray(llmData.insights) ? llmData.insights : [])
      .map((item) => ({
        title: sanitizeDocxBridgeText(item?.title || ""),
        content: sanitizeDocxBridgeText(item?.content || ""),
      }))
      .filter((item) => item.title || item.content)
      .slice(0, 8),
    diagrams: (Array.isArray(llmData.diagrams) ? llmData.diagrams : [])
      .map((item) => ({
        title: sanitizeDocxBridgeText(item?.title || ""),
        content: sanitizeDocxBridgeText(item?.content || ""),
      }))
      .filter((item) => item.title || item.content)
      .slice(0, 8),
    visuals: (Array.isArray(llmData.visuals) ? llmData.visuals : [])
      .map((item) => ({
        kind: String(item?.kind || "diagram").trim().toLowerCase(),
        title: sanitizeDocxBridgeText(item?.title || ""),
        purpose: sanitizeDocxBridgeText(item?.purpose || ""),
        spec: sanitizeDocxBridgeText(item?.spec || ""),
        scoringPoint: sanitizeDocxBridgeText(item?.scoringPoint || ""),
        imageData: String(item?.imageData || "").trim(),
        imageUrl: String(item?.imageUrl || "").trim(),
      }))
      .filter((item) => item.title || item.purpose || item.spec || item.scoringPoint || item.imageData || item.imageUrl)
      .slice(0, 8),
  };

  return safe;
}

function buildVisualsForQuestion(question = {}, answer = "") {
  const qTitle = String(question?.title || "문항").trim();
  const qRaw = String(question?.rawQuestion || "").replace(/\s+/g, " ").trim();
  const seed = `${qTitle} ${qRaw} ${String(answer || "")}`.toLowerCase();
  const merged = `${qTitle} ${qRaw}`.replace(/\s+/g, " ").trim();

  const pickTopic = () => {
    const clean = merged
      .replace(/\[[^\]]+\]/g, " ")
      .replace(/[(){}<>]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!clean) return "핵심 구조 메커니즘";
    const short = clean.slice(0, 40).trim();
    return short || "핵심 구조 메커니즘";
  };

  const topic = pickTopic();

  const isDRegion = isDRegionTopic(seed);
  const isDurability = /내구|균열|열화|부식|유지관리/.test(seed);

  if (isDRegion) {
    return [
      {
        kind: "diagram",
        title: "하중점→지점 하중경로 및 Strut·Tie·Node 도해",
        purpose: "하중 전달 경로와 Strut(압축)·Tie(인장)·Node의 역할을 시각적으로 제시",
        spec: [
          "요소: 하중점, 지점, Strut(압축), Tie(인장), Node",
          "표현: 하중/내부력 화살표(→), 주요 절점 라벨링",
          "판독 포인트: 지배 파괴모드와 보강상세의 연결",
        ].join(" | "),
        scoringPoint: "STM 핵심 메커니즘을 채점자가 즉시 판독 가능하도록 제시",
      },
      {
        kind: "image",
        title: "D-Region과 B-Region 경계 단면 도해",
        purpose: "단면도에서 D/B 경계를 동시에 표시해 적용 해석법 차이를 제시",
        spec: [
          "요소: 재하점, 지점, 단면 경계, D-Region/B-Region 구분",
          "표현: 경계선/해칭으로 영역 구분 + 적용 해석법 주석",
          "판독 포인트: 경계 설정에 따른 해석 접근 차이",
        ].join(" | "),
        scoringPoint: "B-Region(선형변형률)과 D-Region(STM) 적용 구분의 명확성",
      },
      {
        kind: "table",
        title: "B-Region vs D-Region 해석가정·절차·오류위험 비교표 이미지",
        purpose: "두 영역의 해석가정·설계절차·오류위험을 표 이미지로 비교 제시",
        spec: [
          "구분 | B-Region(선형변형률 가정) | D-Region(STM 적용)",
          "해석가정 | 단면 변형률 선형 분포 가정 | 불연속부 비선형 응력 재분배 고려",
          "설계절차 | 휨이론 중심 단면 검토 | Strut·Tie·Node 기반 STM 검토",
          "오류위험 | D-Region 누락 시 과소평가 가능 | 경계 오판 시 정착/절점 취약부 과소평가",
        ].join(" | "),
        scoringPoint: "적용 해석법 선택 근거를 비교표로 명확히 제시",
      },
    ];
  }

  const diagram = {
        kind: "diagram",
        title: `${topic} 메커니즘 도해`,
        purpose: `${topic}의 작용-저항-파괴 전이 경로를 시각화`,
        spec: [
          "요소: 작용하중, 지점반력, 주요 부재, 취약 구간",
          "표현: 단계별 화살표(Load Path → Internal Force → Failure Mode)",
          "판독 포인트: 결론 문단의 권고안과 도해 라벨 일치",
        ].join(" | "),
        scoringPoint: "답안 논리 흐름의 가시화로 채점 가독성 향상",
      };

  const table = {
    kind: "table",
    title: `${topic} 대안 비교표`,
    purpose: "안전성·시공성·경제성·유지관리성 기반 의사결정 근거 제시",
    spec: [
      "열: 항목 | 대안 A | 대안 B | 판정",
      "행: 안전성, 시공성, 경제성, 유지관리성, 리스크",
      "판정: 기준값 대비 여유도(Margin) 또는 정성등급(A/B/C) 병기",
    ].join(" | "),
    scoringPoint: "대안 선택 근거를 정량·정성으로 동시에 제시",
  };

  const graph = isDurability
    ? {
        kind: "graph",
        title: "열화지표-시간 추세 그래프",
        purpose: "균열폭/변위/누수 등 유지관리 지표의 임계치 도달 시점 제시",
        spec: [
          "X축: 시간, Y축: 성능지표(균열폭 또는 변위)",
          "표현: 관리한계선(Threshold)과 실측 추세선 동시 표시",
          "판독 포인트: 임계치 초과 시 보수 시점/방법 연결",
        ].join(" | "),
        scoringPoint: "유지관리 제언의 실행성 및 타이밍 근거 확보",
      }
    : {
        kind: "graph",
        title: `${topic} 성능-여유도 그래프`,
        purpose: `${topic}에서 하중 증가에 따른 저항 여유도 변화 제시`,
        spec: [
          "X축: 하중 수준, Y축: 저항 여유도(Margin)",
          "표현: 허용경계선과 해석값 곡선 동시 표시",
          "판독 포인트: 보강 전/후 곡선 비교로 개선효과 제시",
        ].join(" | "),
        scoringPoint: "결론의 정량 근거를 시각적으로 명확화",
      };

  return [diagram, table, graph];
}

function ensureVisualGuideInAnswer(answer = "", question = {}) {
  const base = String(answer || "").trim();
  if (!base) return { answer: base, visuals: buildVisualsForQuestion(question, base) };

  const visuals = buildVisualsForQuestion(question, base);
  return {
    answer: base,
    visuals,
  };
}

function buildMandatoryEvidenceSection(sourceBundle = {}) {
  const bundle = sourceBundle && typeof sourceBundle === "object" ? sourceBundle : {};
  const blocks = bundle.blocks && typeof bundle.blocks === "object" ? bundle.blocks : {};

  const oneLine = (text, fallback) => {
    const value = String(text || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 220);
    return value || fallback;
  };

  const stored = oneLine(blocks.storedTheory, "저장 학습/이론 자료 매칭 없음");
  const notebook = oneLine(blocks.notebookLm, "NotebookLM 매칭 없음");
  const flowith = oneLine(blocks.flowith, "Flowith 지식정원 매칭 없음");
  const insight = oneLine(
    blocks.insight,
    "딥리서치/첨부 인사이트는 기준·메커니즘·실무대책 관점으로 반영",
  );

  const esc = (value) =>
    String(value || "")
      .replace(/\|/g, "/")
      .replace(/\s+/g, " ")
      .trim();

  return [
    "근거첨부",
    "| 단계 | 소스 | 핵심근거 | 답안 적용 |",
    "|---|---|---|---|",
    `| 1 | 저장 학습/이론자료 | ${esc(stored)} | 정의/기본 메커니즘 근거로 반영 |`,
    `| 2 | NotebookLM | ${esc(notebook)} | 쟁점 해석 및 채점 키워드 반영 |`,
    `| 3 | Flowith 지식정원 | ${esc(flowith)} | 실무 대안·비교표 포인트 반영 |`,
    `| 4 | 인터넷 딥리서치 | ${esc(insight)} | 최신 기준/사례/리스크 근거 반영 |`,
    "| 5 | 통합정리 | 1~4 근거 교차검토 | 결론에 기술사 제언(시공성·유지관리·리스크) 명시 |",
  ].join("\n");
}

function enforceMandatoryPipelineAnswer(answer = "", sourceBundle = {}) {
  const body = String(answer || "").trim();
  const evidenceSection = buildMandatoryEvidenceSection(sourceBundle);

  if (!body) {
    return evidenceSection;
  }

  const hasEvidenceHeader = /근거첨부|출처근거/.test(body);
  const hasLegacySteps =
    /1\)\s*저장/.test(body) &&
    /2\)\s*NotebookLM/i.test(body) &&
    /3\)\s*Flowith/i.test(body) &&
    /4\)\s*인터넷\s*딥리서치/.test(body) &&
    /5\)\s*통합정리/.test(body);
  const hasTableSteps =
    /\|\s*단계\s*\|\s*소스\s*\|\s*핵심근거\s*\|\s*답안\s*적용\s*\|/.test(body) &&
    /\|\s*1\s*\|/.test(body) &&
    /\|\s*2\s*\|/.test(body) &&
    /\|\s*3\s*\|/.test(body) &&
    /\|\s*4\s*\|/.test(body) &&
    /\|\s*5\s*\|/.test(body);
  const hasFullSteps = hasLegacySteps || hasTableSteps;

  if (hasEvidenceHeader && hasFullSteps) {
    return body;
  }

  return `${body}\n\n${evidenceSection}`.trim();
}

function getMandatoryAnswerMinChars(question = {}) {
  const text = `${question?.title || ""} ${question?.rawQuestion || ""}`;
  return /1\s*교시|10\s*점|단답|용어/.test(text) ? 1200 : 2200;
}

function enforceMandatoryDepth(answer = "", question = {}, sourceBundle = {}, options = {}) {
  let out = String(answer || "").trim();
  const includeEvidenceSection = options.includeEvidenceSection !== false;
  const minChars = getMandatoryAnswerMinChars(question);

  const title = String(question?.title || "문항").trim();
  const raw = String(question?.rawQuestion || "").replace(/\s+/g, " ").trim();
  const keyHint = raw.slice(0, 220);

  const hasAnalysis = /문제\s*핵심\s*분석|지배\s*파괴모드|검토\s*순서/.test(out);
  const hasDiagram1 = /\[도해-?1\]|\[도해\]/.test(out);
  const hasDiagram2 = /\[도해-?2\]|변형률\s*선도|응력블록/.test(out);
  const hasTable = /\[비교표\]|\|\s*항목\s*\|\s*대안/.test(out);
  const hasConclusion = /기술사\s*제언|결론/.test(out);

  const blocks = [];
  if (!hasAnalysis) {
    blocks.push(
      [
        "문제 핵심 분석",
        `- 대상: ${title}`,
        `- 핵심 쟁점: ${keyHint || "문제 원문 기반 메커니즘/기준/실무 리스크를 통합 검토"}`,
        "- 지배 파괴모드 후보: 휨 → 전단 → 정착/부착 → 사용성(균열·처짐) 순으로 스크리닝한다.",
        "- 검토 순서: 하중조합 확정 → 내부력 산정 → 기준식 판정 → 상세/시공/유지관리 대책 수립.",
      ].join("\n"),
    );
  }
  if (!hasDiagram1) {
    blocks.push(
      [
        "[도해-1] 하중전달 경로(Load Path)",
        "- 구성: 작용하중, 지점반력, 내부력(휨/전단), 응력집중 구간",
        "- 작성순서: ① 외곽/경계조건 ② 하중·반력 ③ 내부력 화살표 ④ 취약부 강조",
      ].join("\n"),
    );
  }
  if (!hasDiagram2) {
    blocks.push(
      [
        "[도해-2] 단면 거동 및 취약상세",
        "- 구성: 압축연단/인장연단, 변형률 선도, 응력블록, 정착 취약부",
        "- 채점 포인트: 지배모드와 보강상세(스터럽/정착길이) 연결 제시",
      ].join("\n"),
    );
  }
  if (!hasTable) {
    blocks.push(
      [
        "[비교표] 대안별 의사결정",
        "| 항목 | 대안 A | 대안 B | 판단 |",
        "|---|---|---|---|",
        "| 안전성 | 우수/보통 | 우수/보통 | 지배모드 기준 판정 |",
        "| 시공성 | 공정 난이도 | 공정 난이도 | 현장 적용성 비교 |",
        "| 경제성 | 초기비용/생애비용 | 초기비용/생애비용 | LCC 관점 비교 |",
        "| 유지관리성 | 점검 용이성 | 점검 용이성 | 모니터링 계획 반영 |",
      ].join("\n"),
    );
  }
  if (!hasConclusion) {
    blocks.push(
      [
        "결론 및 기술사 제언",
        "- 기준 적합성 + 시공 리스크 저감 + 유지관리 모니터링 계획을 동시에 만족하는 대안을 채택한다.",
        "- 운영 단계에서는 균열·변위·누수 지표의 임계치를 설정하고 초과 시 보수 시나리오를 즉시 실행한다.",
      ].join("\n"),
    );
  }

  if (blocks.length) {
    out = `${out}\n\n${blocks.join("\n\n")}`.trim();
  }

  const compactLen = out.replace(/\s+/g, "").length;
  if (compactLen < minChars) {
    const padding = [
      "분량 보강(고득점 조건 충족)",
      "- 추가 검토 ①: 하중조합별 지배단면 재산정 및 여유도(Margin) 비교",
      "- 추가 검토 ②: 기준식(예: φMn ≥ Mu, Vn ≥ Vu, 정착길이 ld)과 판정 로직 명시",
      "- 추가 검토 ③: 시공 오차(피복·정착·다짐) 민감도와 품질게이트 설정",
      "- 추가 검토 ④: 유지관리 점검주기, 계측항목, 임계치 초과 대응 프로토콜",
      "- 추가 검토 ⑤: 대안별 트레이드오프와 최종 권고안의 근거를 정량/정성 병행 제시",
    ].join("\n");
    out = `${out}\n\n${padding}`.trim();
  }

  if (includeEvidenceSection) {
    return enforceMandatoryPipelineAnswer(out, sourceBundle);
  }
  return out;
}

function buildMandatorySourceBundleContext(sourceBundle = {}) {
  const bundle = sourceBundle && typeof sourceBundle === "object" ? sourceBundle : {};
  const blocks = bundle.blocks && typeof bundle.blocks === "object" ? bundle.blocks : {};

  const storedTheory = String(blocks.storedTheory || "").trim() || "- 저장 이론 매칭 없음";
  const notebookLm = String(blocks.notebookLm || "").trim() || "- NotebookLM 매칭 없음";
  const flowith = String(blocks.flowith || "").trim() || "- Flowith 매칭 없음";
  const insight = String(blocks.insight || "").trim() || "- 보조 인사이트 없음";

  return [
    "[MANDATORY_PIPELINE_CONTEXT]",
    "1) 저장된 학습/이론 자료",
    storedTheory,
    "",
    "2) NotebookLM 관련 자료",
    notebookLm,
    "",
    "3) Flowith 지식정원 관련 자료",
    flowith,
    "",
    "보조 인사이트",
    insight,
  ].join("\n");
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
    const run = (cmd) =>
      execSync(`${cmd} -X utf8 "${pythonScript}" "${query}"`, {
        encoding: "utf-8",
        timeout: 12000,
        windowsHide: true,
        env: {
          ...process.env,
          PYTHONUTF8: "1",
          PYTHONIOENCODING: "utf-8",
        },
      });

    try {
      const stdout = run("python");
      return stdout || "";
    } catch (firstError) {
      if (process.platform === "win32") {
        try {
          const stdout = run("py -3");
          return stdout || "";
        } catch {
          throw firstError;
        }
      }
      throw firstError;
    }
  } catch (error) {
    console.error("Python Web Research Error:", error);
    return "";
  }
}

function parseWebResearchContext(rawContext = "") {
  const raw = String(rawContext || "").trim();
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const parsed = {
    query: "",
    title: "",
    summary: "",
    url: "",
    status: "",
    message: "",
    references: [],
    hasStructuredData: false,
  };

  if (!lines.length) {
    return parsed;
  }

  let inReferences = false;
  for (const line of lines) {
    if (/^references\s*:/i.test(line)) {
      inReferences = true;
      continue;
    }

    if (/^query\s*:/i.test(line)) {
      parsed.query = line.replace(/^query\s*:/i, "").trim();
      continue;
    }
    if (/^title\s*:/i.test(line)) {
      parsed.title = line.replace(/^title\s*:/i, "").trim();
      continue;
    }
    if (/^summary\s*:/i.test(line)) {
      parsed.summary = line.replace(/^summary\s*:/i, "").trim();
      continue;
    }
    if (/^url\s*:/i.test(line)) {
      parsed.url = line.replace(/^url\s*:/i, "").trim();
      continue;
    }
    if (/^status\s*:/i.test(line)) {
      parsed.status = line.replace(/^status\s*:/i, "").trim();
      continue;
    }
    if (/^message\s*:/i.test(line)) {
      parsed.message = line.replace(/^message\s*:/i, "").trim();
      continue;
    }

    if (inReferences && /^\d+\.\s*/.test(line)) {
      const body = line.replace(/^\d+\.\s*/, "").trim();
      const parts = body.split("|").map((p) => p.trim());
      const title = parts[0] || "";
      const url = parts[1] || "";
      const summary = parts.slice(2).join(" | ") || "";
      parsed.references.push({ title, url, summary });
    }
  }

  parsed.hasStructuredData = Boolean(
    parsed.title ||
      parsed.summary ||
      parsed.url ||
      parsed.references.length ||
      parsed.status ||
      parsed.message,
  );
  return parsed;
}

function normalizeHttpUrl(raw = "") {
  const url = String(raw || "").trim();
  if (!url) return "";
  if (!/^https?:\/\//i.test(url)) return "";
  return url;
}

function looksLikeDirectImageUrl(url = "") {
  return /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(String(url || ""));
}

function absolutizeUrl(maybeUrl = "", baseUrl = "") {
  const raw = String(maybeUrl || "").trim();
  if (!raw) return "";
  try {
    if (/^https?:\/\//i.test(raw)) return raw;
    if (!baseUrl) return "";
    return new URL(raw, baseUrl).toString();
  } catch {
    return "";
  }
}

async function extractImageCandidatesFromReference(refUrl = "") {
  const src = normalizeHttpUrl(refUrl);
  if (!src) return [];
  if (looksLikeDirectImageUrl(src)) {
    return [src];
  }

  try {
    const response = await fetch(src, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) {
      return [];
    }

    const html = String(await response.text() || "");
    if (!html) return [];

    const candidates = [];
    const metaRegexes = [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/gi,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/gi,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["'][^>]*>/gi,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["'][^>]*>/gi,
    ];

    for (const rgx of metaRegexes) {
      for (const m of html.matchAll(rgx)) {
        const abs = absolutizeUrl(m[1], src);
        if (abs) candidates.push(abs);
      }
    }

    const imgTag = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
    if (imgTag?.[1]) {
      const abs = absolutizeUrl(imgTag[1], src);
      if (abs) candidates.push(abs);
    }

    const uniq = [];
    for (const c of candidates) {
      const safe = normalizeHttpUrl(c);
      if (!safe) continue;
      if (!uniq.includes(safe)) uniq.push(safe);
    }
    return uniq.slice(0, 3);
  } catch {
    return [];
  }
}

function isPreferredImageUrl(url = "") {
  const safe = normalizeHttpUrl(url);
  if (!safe) return false;
  return /\.(png|jpe?g|webp|gif)(\?|#|$)/i.test(safe);
}

function isStructuralImageCandidate(url = "") {
  const src = String(url || "").toLowerCase();
  if (!src) return false;

  const include = [
    "truss",
    "bridge",
    "beam",
    "column",
    "concrete",
    "reinforced",
    "bending",
    "shear",
    "moment",
    "stress",
    "strain",
    "load",
    "node",
    "diagram",
    "struct",
  ];
  const exclude = [
    "aircraft",
    "fighter",
    "rafale",
    "missile",
    "bird",
    "animal",
    "portrait",
    "celebrity",
  ];

  if (exclude.some((w) => src.includes(w))) return false;
  return include.some((w) => src.includes(w));
}

function isImageTitleRelevant(title = "", query = "") {
  const t = String(title || "").toLowerCase();
  const qTokens = String(query || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3)
    .filter((w) => !["and", "for", "with", "the", "model"].includes(w));

  if (!qTokens.length) return true;
  const hit = qTokens.filter((tk) => t.includes(tk)).length;
  return hit >= 1;
}

async function fetchWikipediaImageUrlsByQuery(query = "", max = 3) {
  const q = String(query || "").trim();
  if (!q) return [];

  try {
    const endpoint =
      "https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*" +
      `&generator=search&gsrsearch=${encodeURIComponent(q)}` +
      "&gsrlimit=8&prop=pageimages&piprop=original|thumbnail&pithumbsize=1400";

    const response = await fetch(endpoint, {
      signal: AbortSignal.timeout(7000),
      headers: {
        "User-Agent": "solve-civil-answer-studio/1.0 (image-fallback)",
      },
    });
    if (!response.ok) return [];
    const payload = await response.json().catch(() => null);
    const pages = payload?.query?.pages && typeof payload.query.pages === "object"
      ? Object.values(payload.query.pages)
      : [];

    const out = [];
    for (const p of pages) {
      const original = normalizeHttpUrl(p?.original?.source || "");
      const thumb = normalizeHttpUrl(p?.thumbnail?.source || "");
      const candidate = isPreferredImageUrl(original) ? original : thumb;
      if (!candidate || !isPreferredImageUrl(candidate)) continue;
      if (!out.includes(candidate)) out.push(candidate);
      if (out.length >= max) break;
    }
    return out;
  } catch {
    return [];
  }
}

async function fetchWikimediaCommonsImageUrlsByQuery(query = "", max = 3) {
  const q = String(query || "").trim();
  if (!q) return [];

  try {
    const endpoint =
      "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*" +
      `&generator=search&gsrsearch=${encodeURIComponent(q)}` +
      "&gsrnamespace=6&gsrlimit=10&prop=imageinfo&iiprop=url&iiurlwidth=1400";

    const response = await fetch(endpoint, {
      signal: AbortSignal.timeout(7000),
      headers: {
        "User-Agent": "solve-civil-answer-studio/1.0 (image-fallback)",
      },
    });
    if (!response.ok) return [];
    const payload = await response.json().catch(() => null);
    const pages = payload?.query?.pages && typeof payload.query.pages === "object"
      ? Object.values(payload.query.pages)
      : [];

    const out = [];
    for (const p of pages) {
      const title = String(p?.title || "").trim();
      if (!isImageTitleRelevant(title, q)) continue;

      const thumb = normalizeHttpUrl(p?.imageinfo?.[0]?.thumburl || "");
      const original = normalizeHttpUrl(p?.imageinfo?.[0]?.url || "");
      const picked = isPreferredImageUrl(thumb)
        ? thumb
        : isPreferredImageUrl(original)
          ? original
          : "";

      if (!picked) continue;
      if (!out.includes(picked)) out.push(picked);
      if (out.length >= max) break;
    }
    return out;
  } catch {
    return [];
  }
}

async function collectOpenKnowledgeImageUrls(question = {}, max = 3) {
  const queries = buildVisualImageFallbackQueries(question);
  const out = [];

  for (const q of queries) {
    const wiki = await fetchWikipediaImageUrlsByQuery(q, max);
    for (const url of wiki) {
      if (!out.includes(url)) out.push(url);
      if (out.length >= max) return out;
    }

    const commons = await fetchWikimediaCommonsImageUrlsByQuery(q, max);
    for (const url of commons) {
      if (!out.includes(url)) out.push(url);
      if (out.length >= max) return out;
    }
  }

  return out;
}

async function collectRelatedImageUrlsFromDeepResearch(parsed = {}, max = 3) {
  const refs = Array.isArray(parsed?.references) ? parsed.references : [];
  if (!refs.length) return [];

  const out = [];
  for (const ref of refs.slice(0, 4)) {
    const refUrl = normalizeHttpUrl(ref?.url || "");
    if (!refUrl) continue;
    const imgs = await extractImageCandidatesFromReference(refUrl);
    for (const img of imgs) {
      if (!out.includes(img)) out.push(img);
      if (out.length >= max) {
        return out;
      }
    }
  }
  return out;
}

function attachImageUrlsToVisuals(visuals = [], imageUrls = [], options = {}) {
  const rows = Array.isArray(visuals) ? visuals : [];
  const requireStructural = Boolean(options?.requireStructural);
  const imgs = Array.isArray(imageUrls)
    ? imageUrls
        .map((u) => normalizeHttpUrl(u))
        .filter(Boolean)
        .filter((u) => (requireStructural ? isStructuralImageCandidate(u) : true))
    : [];

  if (!rows.length || !imgs.length) return rows;

  const out = [];
  let cursor = 0;
  for (const item of rows) {
    if (!item || typeof item !== "object") continue;
    const kind = String(item.kind || "diagram").toLowerCase();
    if (["diagram", "graph", "image"].includes(kind) && cursor < imgs.length) {
      out.push({ ...item, imageUrl: imgs[cursor++] });
    } else {
      out.push(item);
    }
  }

  while (cursor < imgs.length && out.length < 6) {
    const imageUrl = imgs[cursor++];
    out.push({
      kind: "image",
      title: `인터넷 참고 이미지 ${cursor}`,
      purpose: "문제 관련 레퍼런스 이미지 첨부",
      spec: `출처 URL: ${imageUrl}`,
      scoringPoint: "출처 기반 시각자료",
      imageUrl,
    });
  }

  return out.slice(0, 6);
}

function hasUsableDeepResearchParsed(parsed = {}) {
  const row = parsed && typeof parsed === "object" ? parsed : {};
  const refs = Array.isArray(row.references) ? row.references : [];
  const hasRef = refs.length > 0;
  const summary = String(row.summary || "").trim();
  const message = String(row.message || "").trim();
  const blockedByWarning = /검색\s*결과가\s*충분하지\s*않습니다/i.test(message);
  return hasRef && !blockedByWarning && summary.length >= 12;
}

function isUsablePipelineBlock(value = "") {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return false;
  if (text.length < 12) return false;
  if (/^[-–—]$/.test(text)) return false;
  if (/매칭\s*없음|비활성|없음$/i.test(text)) return false;
  return true;
}

function analyzeMandatoryStepChecks(sourceBundle = {}, deepParsed = {}) {
  const blocks = sourceBundle?.blocks && typeof sourceBundle.blocks === "object"
    ? sourceBundle.blocks
    : {};

  const step1 = {
    ok: isUsablePipelineBlock(blocks.storedTheory),
    label: "저장 학습/이론자료",
    evidence: String(blocks.storedTheory || "").replace(/\s+/g, " ").trim().slice(0, 180),
  };
  const step2 = {
    ok: isUsablePipelineBlock(blocks.notebookLm),
    label: "NotebookLM",
    evidence: String(blocks.notebookLm || "").replace(/\s+/g, " ").trim().slice(0, 180),
  };
  const step3 = {
    ok: isUsablePipelineBlock(blocks.flowith),
    label: "Flowith 지식정원",
    evidence: String(blocks.flowith || "").replace(/\s+/g, " ").trim().slice(0, 180),
  };

  const refs = Array.isArray(deepParsed?.references) ? deepParsed.references : [];
  const step4 = {
    ok: hasUsableDeepResearchParsed(deepParsed),
    label: "인터넷 딥리서치",
    evidence: `refs=${refs.length}, title=${String(deepParsed?.title || "-").slice(0, 80)}`,
  };

  const step5 = {
    ok: step1.ok && step2.ok && step3.ok && step4.ok,
    label: "통합정리",
    evidence: "1~4단계 교차 검증 후 통합답안 작성",
  };

  return {
    step1,
    step2,
    step3,
    step4,
    step5,
    allPassed: step1.ok && step2.ok && step3.ok && step4.ok && step5.ok,
  };
}

function renderParsedWebResearchContext(parsed = {}, fallbackRaw = "") {
  const row = parsed && typeof parsed === "object" ? parsed : {};
  if (!row.hasStructuredData) {
    return String(fallbackRaw || "").trim();
  }

  const refs = Array.isArray(row.references) ? row.references : [];
  const refLines = refs.length
    ? refs
        .slice(0, 5)
        .map(
          (ref, idx) =>
            `${idx + 1}) ${ref.title || "(제목없음)"} | ${ref.url || ""} | ${String(ref.summary || "").slice(0, 220)}`,
        )
        .join("\n")
    : "참고 링크 없음";

  return [
    "[DEEP_RESEARCH_PARSED]",
    `query: ${row.query || ""}`,
    `status: ${row.status || "success"}`,
    `message: ${row.message || ""}`,
    `title: ${row.title || ""}`,
    `summary: ${row.summary || ""}`,
    `url: ${row.url || ""}`,
    "references:",
    refLines,
  ].join("\n");
}

function mergeSourceBundleWithDeepResearch(sourceBundle = null, parsed = {}) {
  const base =
    sourceBundle && typeof sourceBundle === "object"
      ? sourceBundle
      : { blocks: {} };
  const merged = {
    ...base,
    blocks: {
      ...(base.blocks && typeof base.blocks === "object" ? base.blocks : {}),
    },
  };

  const refs = Array.isArray(parsed?.references) ? parsed.references : [];
  const refSummary = refs
    .slice(0, 3)
    .map((item, idx) => {
      const rTitle = String(item?.title || "(제목없음)").slice(0, 90);
      const rUrl = String(item?.url || "").slice(0, 180);
      return `${idx + 1}) ${rTitle} ${rUrl ? `(${rUrl})` : ""}`.trim();
    })
    .join(" / ");

  const deepParsedLine = [
    `딥리서치 제목: ${parsed?.title || "-"}`,
    `딥리서치 요약: ${parsed?.summary || parsed?.message || "-"}`,
    refSummary ? `핵심 참고: ${refSummary}` : "핵심 참고: 없음",
  ].join(" | ");

  merged.blocks.insight = deepParsedLine;
  return merged;
}

function buildDeepResearchQueryCandidates(question = {}, sourceBundle = null) {
  const seed = [
    String(question?.title || "").trim(),
    String(question?.rawQuestion || "").trim().slice(0, 120),
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const bundle = sourceBundle && typeof sourceBundle === "object" ? sourceBundle : {};
  const blockText = Object.values(bundle.blocks || {})
    .map((row) => String(row || ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const picks = [seed];
  if (seed) picks.push(`${seed} KDS 구조설계 기준`);
  if (seed) picks.push(`${seed} 토목구조기술사 해설`);
  if (blockText) picks.push(`${seed} ${blockText.slice(0, 140)}`.trim());

  const uniq = [];
  picks
    .map((q) => String(q || "").trim())
    .filter((q) => q.length >= 2)
    .forEach((q) => {
      if (!uniq.includes(q)) uniq.push(q);
    });

  return uniq.slice(0, 4);
}

function buildVisualImageFallbackQueries(question = {}) {
  const seed = `${String(question?.title || "")} ${String(question?.rawQuestion || "")}`
    .replace(/\s+/g, " ")
    .trim();
  const probe = seed.toLowerCase();
  const isDRegion = isDRegionTopic(probe);

  if (isDRegion) {
    return [
      "reinforced concrete strut and tie model diagram",
      "D-region B-region reinforced concrete beam column joint",
      "load path strut tie node concrete structure",
    ];
  }

  if (seed.length >= 6) {
    return [
      `${seed} 구조해석 도해`,
      `${seed} 설계 비교표`,
    ];
  }

  return [];
}

function buildStructuralBackstopQueries() {
  return [
    "reinforced concrete beam bending diagram",
    "truss bridge load path structure",
    "shear force bending moment structural diagram",
  ];
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
      ? [
          "아래 입력을 기반으로 전문 서브노트용 JSON만 출력하세요.",
          "절대 마크다운 코드블록(```)이나 설명문을 출력하지 마세요.",
          "문제/모범답안/지시사항의 핵심 용어를 반드시 반영해 구체적으로 작성하세요.",
          "추상 템플릿 문구 반복(예: 정의 및 핵심 개념, 도해 1개 등)만으로 채우지 마세요.",
          "",
          `[문제 제목]\n${question?.title || ""}`,
          `[문제 원문]\n${question?.rawQuestion || ""}`,
          `[현재 모범답안 본문(우선 반영)]\n${question?.modelAnswer || ""}`,
          `[추가 작성 지시]\n${instruction || "없음"}`,
          `[검색/지식 컨텍스트]\n${enrichedContext || "없음"}`,
          "",
          "출력 JSON 스키마(키 이름 고정):",
          '{"overview":"...","characteristics":[{"name":"...","desc1":"...","desc2":"..."}],"insights":[{"title":"...","content":"..."}],"diagrams":[{"title":"...","content":"..."}],"keywords":"...","strategy":"..."}',
          "",
          "세부 규칙:",
          "- characteristics 최소 3개",
          "- insights 최소 2개",
          "- diagrams 최소 2개(실제 도해/도표 지시문)",
          "- 각 diagram.content에는 반드시 다음 라벨을 포함: 도해 목적:, 구성 요소:, 작성 순서:, 채점 포인트:",
          "- 최소 1개는 메커니즘 도해, 최소 1개는 비교표/의사결정표 형태로 작성",
          "- keywords는 콤마 구분 5개 이상",
          "- strategy는 답안 차별화 전략을 2문장 이상으로 작성",
        ].join("\n")
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

function scoreDecodedWebText(text = "") {
  const raw = String(text || "");
  if (!raw) return 0;

  const controlCount = Array.from(raw).reduce((acc, ch) => {
    const code = ch.charCodeAt(0);
    if ((code >= 0 && code <= 8) || code === 11 || code === 12 || (code >= 14 && code <= 31)) {
      return acc + 1;
    }
    return acc;
  }, 0);

  const replacementPenalty = (raw.match(/�/g) || []).length * 5;
  const controlPenalty = controlCount * 4;
  const hangulCount = (raw.match(/[가-힣]/g) || []).length;
  const printableCount = (raw.match(/[\p{L}\p{N}\p{P}\p{Zs}]/gu) || []).length;
  const mojibakePenalty = (raw.match(/[ÃÂâ€™â€œâ€â€˜]/g) || []).length * 3;

  return (
    printableCount +
    hangulCount * 2 -
    replacementPenalty -
    controlPenalty -
    mojibakePenalty
  );
}

function repairUtf8Latin1Mojibake(text = "") {
  const source = String(text || "");
  if (!source) return source;

  try {
    const bytes = Uint8Array.from(
      Array.from(source).map((ch) => ch.charCodeAt(0) & 0xff),
    );
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    return source;
  }
}

async function decodeWebResponseSmart(response) {
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const candidates = ["utf-8", "euc-kr", "windows-1252", "iso-8859-1"];

  let bestText = "";
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const encoding of candidates) {
    try {
      const decoded = new TextDecoder(encoding, { fatal: false }).decode(bytes);
      const repaired = repairUtf8Latin1Mojibake(decoded);
      const scoreDecoded = scoreDecodedWebText(decoded);
      const scoreRepaired = scoreDecodedWebText(repaired);
      const finalText = scoreRepaired > scoreDecoded ? repaired : decoded;
      const finalScore = Math.max(scoreDecoded, scoreRepaired);

      if (finalScore > bestScore) {
        bestScore = finalScore;
        bestText = finalText;
      }
    } catch {
      // ignore and continue
    }
  }

  if (bestText) return bestText;

  try {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    return "";
  }
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

  // Normalize and sanitize incoming base URL: strip trailing known LM Studio/OpenAI-compatible paths
  let normalizedBaseUrl = rawBaseUrl.replace(/\/$/, "");
  // Remove common LM Studio endpoints that may have been provided accidentally
  normalizedBaseUrl = normalizedBaseUrl.replace(/\/v1\/chat\/completions\/?$/i, "");
  normalizedBaseUrl = normalizedBaseUrl.replace(/\/v1\/responses\/?$/i, "");
  normalizedBaseUrl = normalizedBaseUrl.replace(/\/v1\/completions\/?$/i, "");
  normalizedBaseUrl = normalizedBaseUrl.replace(/\/v1\/models\/?$/i, "");
  normalizedBaseUrl = normalizedBaseUrl.replace(/\/api\/lmstudio-models\/?$/i, "");
  normalizedBaseUrl = normalizedBaseUrl.replace(/\/api\/v1\/chat\/?$/i, "");
  normalizedBaseUrl = normalizedBaseUrl.replace(/\/$/, "");

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
  const contextRaw = await fetchWebContext(query || "");
  const parsed = parseWebResearchContext(contextRaw);
  const context = renderParsedWebResearchContext(parsed, contextRaw);
  res.json({ query: query || "", context, parsed, rawContext: contextRaw });
});

app.post("/api/generate-answer", async (req, res) => {
  const {
    question,
    instruction,
    format = "text",
    mandatoryPipeline = false,
    sourceBundle = null,
    outputStyle = "default",
  } = req.body || {};
  const query =
    `${question?.title || ""} ${question?.rawQuestion || ""}`.trim();
  const strictMandatory = !!mandatoryPipeline;
  const queryCandidates = strictMandatory
    ? buildDeepResearchQueryCandidates(question, sourceBundle)
    : [query];

  let webContextRaw = "";
  let webContextParsed = {
    hasStructuredData: false,
    references: [],
  };
  let usedResearchQuery = "";

  for (const q of queryCandidates) {
    const candidateRaw = await fetchWebContext(q);
    const candidateParsed = parseWebResearchContext(candidateRaw);
    if (!webContextRaw) {
      webContextRaw = candidateRaw;
      webContextParsed = candidateParsed;
      usedResearchQuery = q;
    }

    const hasRefs = Array.isArray(candidateParsed?.references)
      ? candidateParsed.references.length > 0
      : false;
    if (candidateParsed?.hasStructuredData && hasRefs) {
      webContextRaw = candidateRaw;
      webContextParsed = candidateParsed;
      usedResearchQuery = q;
      break;
    }
  }

  const webContext = renderParsedWebResearchContext(webContextParsed, webContextRaw);
  const deepResearchUsable = hasUsableDeepResearchParsed(webContextParsed);

  const ragContext = getRagContext(query);
  const effectiveSourceBundle = mandatoryPipeline
    ? mergeSourceBundleWithDeepResearch(sourceBundle, webContextParsed)
    : sourceBundle;
  const stepChecks = mandatoryPipeline
    ? analyzeMandatoryStepChecks(effectiveSourceBundle, webContextParsed)
    : null;
  const relatedImageUrls = await collectRelatedImageUrlsFromDeepResearch(
    webContextParsed,
    3,
  );

  if (!relatedImageUrls.length) {
    const imageFallbackQueries = buildVisualImageFallbackQueries(question);
    for (const imageQuery of imageFallbackQueries) {
      const imgResearchRaw = await fetchWebContext(imageQuery);
      const imgResearchParsed = parseWebResearchContext(imgResearchRaw);
      const urls = await collectRelatedImageUrlsFromDeepResearch(imgResearchParsed, 3);
      for (const u of urls) {
        if (!relatedImageUrls.includes(u)) {
          relatedImageUrls.push(u);
        }
        if (relatedImageUrls.length >= 3) {
          break;
        }
      }
      if (relatedImageUrls.length >= 3) {
        break;
      }
    }
  }

  if (!relatedImageUrls.length) {
    const openSourceUrls = await collectOpenKnowledgeImageUrls(question, 3);
    for (const url of openSourceUrls) {
      if (!relatedImageUrls.includes(url)) {
        relatedImageUrls.push(url);
      }
      if (relatedImageUrls.length >= 3) break;
    }
  }

  const isDRegionQuestion = isDRegionTopic(
    `${String(question?.title || "")} ${String(question?.rawQuestion || "")}`,
  );

  if (isDRegionQuestion) {
    const structuralCount = relatedImageUrls.filter((u) =>
      isStructuralImageCandidate(u),
    ).length;

    if (structuralCount < 3) {
      for (const q of buildStructuralBackstopQueries()) {
        const wiki = await fetchWikipediaImageUrlsByQuery(q, 3);
        const commons = await fetchWikimediaCommonsImageUrlsByQuery(q, 3);
        for (const u of [...wiki, ...commons]) {
          const safe = normalizeHttpUrl(u);
          if (!safe || !isStructuralImageCandidate(safe)) continue;
          if (!relatedImageUrls.includes(safe)) {
            relatedImageUrls.push(safe);
          }
          if (relatedImageUrls.filter((x) => isStructuralImageCandidate(x)).length >= 3) {
            break;
          }
        }
        if (relatedImageUrls.filter((x) => isStructuralImageCandidate(x)).length >= 3) {
          break;
        }
      }
    }
  }

  const curatedRelatedImageUrls = Array.from(
    new Set(
      relatedImageUrls
        .map((u) => normalizeHttpUrl(u))
        .filter(Boolean)
        .filter((u) => (isDRegionQuestion ? isStructuralImageCandidate(u) : true)),
    ),
  ).slice(0, 6);

  if (strictMandatory && stepChecks && !stepChecks.allPassed) {
    return res.status(424).json({
      ok: false,
      error: "mandatory_pipeline_incomplete",
      message:
        "강제 5단계 중 실질 근거가 부족한 단계가 있습니다. 저장자료/NotebookLM/Flowith/딥리서치 근거를 보강 후 재시도하세요.",
      pipelineAudit: {
        deepResearchExecuted: true,
        deepResearchParsed: !!webContextParsed?.hasStructuredData,
        deepResearchUsable,
        deepResearchReferences: Array.isArray(webContextParsed?.references)
          ? webContextParsed.references.length
          : 0,
        researchQueriesTried: queryCandidates,
        researchQueryUsed: usedResearchQuery,
        stepChecks,
      },
    });
  }
  const mandatoryContext = mandatoryPipeline
    ? buildMandatorySourceBundleContext(effectiveSourceBundle)
    : "";
  const rawContext = [mandatoryContext, ragContext, webContext]
    .filter(Boolean)
    .join("\n\n");
  const context = sanitizeResearchNoise(rawContext);
  const examAnswerStyle = String(outputStyle || "").toLowerCase() === "exam-answer";

  const finalizeAnswer = (text) => {
    const cleaned = cleanGeneratedAnswerText(text);
    let result = cleaned;
    if (mandatoryPipeline) {
      const deepened = enforceMandatoryDepth(
        cleaned,
        question,
        effectiveSourceBundle,
        { includeEvidenceSection: !examAnswerStyle },
      );
      result = examAnswerStyle ? sanitizeExamAnswerText(deepened) : deepened;
    } else {
      result = examAnswerStyle ? sanitizeExamAnswerText(cleaned) : cleaned;
    }

    const visualized = ensureVisualGuideInAnswer(result, question);
    const withImages = attachImageUrlsToVisuals(visualized.visuals, curatedRelatedImageUrls, {
      requireStructural: isDRegionQuestion,
    });
    return {
      answer: visualized.answer,
      visuals: withImages,
      relatedImages: curatedRelatedImageUrls,
    };
  };

  const enforcedInstruction = mandatoryPipeline
    ? [
        String(instruction || ""),
        "",
        "[강제 규칙] 반드시 다음 순서로 수행: 1) 저장자료 2) NotebookLM 3) Flowith 4) 딥리서치 5) 통합작성.",
        examAnswerStyle
          ? "내부 근거(1~4)는 audit로 검증하고, 제출 본문에는 메타로그/근거표를 쓰지 말 것."
          : "답안 본문에 '근거첨부' 소제목을 두고 1~4번 근거를 요약 첨부할 것.",
      ]
        .filter(Boolean)
        .join("\n")
    : instruction;

  try {
    const isLocalRule = question?.model === "local-rule" || instruction?.includes("local-rule");
    
    let aiAnswer = null;
    if (!isLocalRule) {
      aiAnswer = await generateWithLLM({
        question,
        instruction: enforcedInstruction,
        context,
        format,
      });
    }

    if (aiAnswer?.text) {
      const finalized = finalizeAnswer(aiAnswer.text);
      if (isGenericScaffoldAnswer(finalized.answer)) {
        const fallback = localDraftTemplate(question, examAnswerStyle ? "" : context);
        const fallbackFinal = mandatoryPipeline
          ? enforceMandatoryDepth(fallback, question, effectiveSourceBundle, {
              includeEvidenceSection: !examAnswerStyle,
            })
          : fallback;
        const fallbackOut = examAnswerStyle
          ? sanitizeExamAnswerText(fallbackFinal)
          : fallbackFinal;
        const fallbackVisualized = ensureVisualGuideInAnswer(fallbackOut, question);
        return res.json({
          answer: fallbackVisualized.answer,
          visuals: attachImageUrlsToVisuals(fallbackVisualized.visuals, curatedRelatedImageUrls, {
            requireStructural: isDRegionQuestion,
          }),
          relatedImages: curatedRelatedImageUrls,
          source: "local-fallback",
          context,
          mandatoryPipeline: !!mandatoryPipeline,
          pipelineAudit: {
            deepResearchExecuted: true,
            deepResearchParsed: !!webContextParsed?.hasStructuredData,
            deepResearchUsable,
            deepResearchReferences: Array.isArray(webContextParsed?.references)
              ? webContextParsed.references.length
              : 0,
            researchQueriesTried: queryCandidates,
            researchQueryUsed: usedResearchQuery,
            stepChecks,
          },
          providers: getProviderConfigStatus(),
          llmDiagnostics: Array.isArray(aiAnswer?.diagnostics)
            ? aiAnswer.diagnostics
            : [],
        });
      }

      return res.json({
        answer: finalized.answer,
        visuals: finalized.visuals,
        relatedImages: finalized.relatedImages,
        source: `${aiAnswer.provider || "llm"}+web-context`,
        model: aiAnswer.model || "",
        mandatoryPipeline: !!mandatoryPipeline,
        pipelineAudit: {
          deepResearchExecuted: true,
          deepResearchParsed: !!webContextParsed?.hasStructuredData,
          deepResearchUsable,
          deepResearchReferences: Array.isArray(webContextParsed?.references)
            ? webContextParsed.references.length
            : 0,
          researchQueriesTried: queryCandidates,
          researchQueryUsed: usedResearchQuery,
          stepChecks,
        },
        llmDiagnostics: Array.isArray(aiAnswer.diagnostics)
          ? aiAnswer.diagnostics
          : [],
        context,
      });
    }

    const fallback = localDraftTemplate(question, examAnswerStyle ? "" : context);
    const fallbackFinal = mandatoryPipeline
      ? enforceMandatoryDepth(fallback, question, effectiveSourceBundle, {
          includeEvidenceSection: !examAnswerStyle,
        })
      : fallback;
    const fallbackOut = examAnswerStyle
      ? sanitizeExamAnswerText(fallbackFinal)
      : fallbackFinal;
    const fallbackVisualized = ensureVisualGuideInAnswer(fallbackOut, question);
    return res.json({
      answer: fallbackVisualized.answer,
      visuals: attachImageUrlsToVisuals(fallbackVisualized.visuals, curatedRelatedImageUrls, {
        requireStructural: isDRegionQuestion,
      }),
      relatedImages: curatedRelatedImageUrls,
      source: "local-fallback",
      context,
      mandatoryPipeline: !!mandatoryPipeline,
      pipelineAudit: {
        deepResearchExecuted: true,
        deepResearchParsed: !!webContextParsed?.hasStructuredData,
        deepResearchUsable,
        deepResearchReferences: Array.isArray(webContextParsed?.references)
          ? webContextParsed.references.length
          : 0,
        researchQueriesTried: queryCandidates,
        researchQueryUsed: usedResearchQuery,
        stepChecks,
      },
      providers: getProviderConfigStatus(),
      llmDiagnostics: Array.isArray(aiAnswer?.diagnostics)
        ? aiAnswer.diagnostics
        : [],
    });
  } catch (err) {
    console.error("Generate Answer Error:", err);
  }

  const fallback = localDraftTemplate(question, examAnswerStyle ? "" : context);
  const fallbackFinal = mandatoryPipeline
    ? enforceMandatoryDepth(fallback, question, effectiveSourceBundle, {
        includeEvidenceSection: !examAnswerStyle,
      })
    : fallback;
  const fallbackOut = examAnswerStyle
    ? sanitizeExamAnswerText(fallbackFinal)
    : fallbackFinal;
  const fallbackVisualized = ensureVisualGuideInAnswer(fallbackOut, question);
  return res.json({
    answer: fallbackVisualized.answer,
    visuals: attachImageUrlsToVisuals(fallbackVisualized.visuals, curatedRelatedImageUrls, {
      requireStructural: isDRegionQuestion,
    }),
    relatedImages: curatedRelatedImageUrls,
    source: "local-fallback",
    context,
    mandatoryPipeline: !!mandatoryPipeline,
    pipelineAudit: {
      deepResearchExecuted: true,
      deepResearchParsed: !!webContextParsed?.hasStructuredData,
      deepResearchUsable,
      deepResearchReferences: Array.isArray(webContextParsed?.references)
        ? webContextParsed.references.length
        : 0,
      researchQueriesTried: queryCandidates,
      researchQueryUsed: usedResearchQuery,
      stepChecks,
    },
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
    const sanitizedPayload = sanitizeDocxBridgePayload(payload);
    const payloadArg = JSON.stringify(sanitizedPayload);

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

  const unquotedTargetPath = rawTargetPath.replace(/^['"]|['"]$/g, "");
  const targetPath = path.normalize(
    path.isAbsolute(unquotedTargetPath)
      ? unquotedTargetPath
      : path.resolve(workspaceRoot, unquotedTargetPath),
  );

  if (!fs.existsSync(targetPath)) {
    return res.status(404).json({ ok: false, error: "target path not found" });
  }

  try {
    const stat = fs.statSync(targetPath);
    if (process.platform === "win32") {
      const normalized = targetPath.replace(/\//g, "\\");
      const explorerArgs = stat.isDirectory()
        ? [normalized]
        : [`/select,${normalized}`];
      const child = spawn("explorer.exe", explorerArgs, {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
    } else if (process.platform === "darwin") {
      const child = stat.isDirectory()
        ? spawn("open", [targetPath], {
            detached: true,
            stdio: "ignore",
          })
        : spawn("open", ["-R", targetPath], {
            detached: true,
            stdio: "ignore",
          });
      child.unref();
    } else {
      const openTarget = stat.isDirectory() ? targetPath : path.dirname(targetPath);
      const child = spawn("xdg-open", [openTarget], {
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

app.post("/api/open-in-default-app", (req, res) => {
  const rawTargetPath = String(req.body?.targetPath || "").trim();
  if (!rawTargetPath) {
    return res.status(400).json({ ok: false, error: "targetPath is required" });
  }

  const unquotedTargetPath = rawTargetPath.replace(/^['"]|['"]$/g, "");
  const targetPath = path.normalize(
    path.isAbsolute(unquotedTargetPath)
      ? unquotedTargetPath
      : path.resolve(workspaceRoot, unquotedTargetPath),
  );

  if (!fs.existsSync(targetPath)) {
    return res.status(404).json({ ok: false, error: "target path not found" });
  }

  try {
    if (process.platform === "win32") {
      const child = spawn("cmd.exe", ["/c", "start", "", targetPath], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
    } else if (process.platform === "darwin") {
      const child = spawn("open", [targetPath], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
    } else {
      const child = spawn("xdg-open", [targetPath], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
    }

    return res.json({ ok: true, opened: targetPath });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: String(error?.message || error || "open_failed"),
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
    const html = await decodeWebResponseSmart(response);
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
