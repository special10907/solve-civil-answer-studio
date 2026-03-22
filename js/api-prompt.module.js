/**
 * API Prompt Module
 * 담당: AI 프롬프트 빌더, 이론 컨텍스트 생성, 답변 스펙 추론
 */

// ──── 텍스트 전처리 ───────────────────────────────────────────

export function sanitizeExtractedSourceText(rawText) {
  const text = String(rawText || "");
  if (!text.trim()) return "";
  return text
    .replace(/\0/g, "")
    .replace(/^\s*=+\s*[^\n]*\s*=+\s*$/gm, "")
    .replace(/^[ \t]*[|¦]{2,}.*$/gm, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ──── 토큰화 및 유사도 계산 ────────────────────────────────────

export function tokenizeForSimilarity(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2);
}

const TECHNICAL_KEYWORDS = new Set([
  "구조", "해석", "설계", "검토", "안전", "내구성", "강도", "모멘트", "전단", "축력", "비틀림",
  "응력", "변형", "변위", "하중", "고해상", "슬래브", "보", "기둥", "기초", "옹벽", "교량",
  "콘크리트", "rc", "강재", "steel", "psc", "prestressed", "마찰", "정착", "부착", "균열",
  "처짐", "해석", "동역학", "진동", "내진", "제진", "면진", "응답", "스펙트럼", "매트릭스",
  "유한요소", "fem", "극한", "사용성", "계수", "조합", "안정", "좌굴", "피로", "부식", "보수", "보강",
]);

export function calculateTokenOverlapScore(sourceTokens, targetTokens) {
  if (!sourceTokens.length || !targetTokens.length) return 0;
  const sourceSet = new Set(sourceTokens);
  let weightedHit = 0;
  let weightedTotal = 0;

  targetTokens.forEach((token) => {
    const weight = TECHNICAL_KEYWORDS.has(token) ? 3.0 : 1.0;
    if (sourceSet.has(token)) {
      weightedHit += weight;
    }
    weightedTotal += weight;
  });

  return weightedTotal === 0 ? 0 : weightedHit / weightedTotal;
}

// ──── 이론 컨텍스트 빌더 ──────────────────────────────────────

export function buildTheoryContextForQuestion(question, theories, maxItems = 3) {
  const questionText = [question?.title, question?.rawQuestion, ...(question?.tags || [])]
    .filter(Boolean).join(" ");
  const questionTokens = tokenizeForSimilarity(questionText);

  if (!Array.isArray(theories) || !theories.length || !questionTokens.length) return [];

  return theories
    .map((theory) => {
      const theoryText = [
        theory?.title, theory?.category,
        ...(Array.isArray(theory?.tags) ? theory.tags : []), theory?.content,
      ].filter(Boolean).join(" ");
      const theoryTokens = tokenizeForSimilarity(theoryText);
      return { theory, score: calculateTokenOverlapScore(theoryTokens, questionTokens) };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxItems)
    .map((row) => row.theory);
}

// ──── 답안 스펙 추론 ──────────────────────────────────────────

export function inferAnswerWritingSpec(question) {
  const text = `${question?.title || ""} ${question?.rawQuestion || ""}`;
  const isShort = /1\s*교시|10\s*점|용어|단답/.test(text);
  if (isShort) {
    return {
      type: "short",
      pageTarget: "1.0~1.2페이지",
      minChars: 900,
      sectionGuide: [
        "1) 정의/배경 (핵심 용어 영문 병기 포함)",
        "2) 메커니즘 도해 지시 (단면+선도/응력블록/힘의 흐름 중 최소 1개)",
        "3) 특징·핵심 검토항목 (개조식 넘버링)",
        "4) 기준·수치(KDS 코드/계수/단위) + 결론",
      ],
    };
  }
  return {
    type: "long",
    pageTarget: "최소 2.5페이지, 권장 3페이지",
    minChars: 2200,
    sectionGuide: [
      "[1 page] 1) 개요 2) 기본 원리/메커니즘 (핵심 도해 1/3 비중)",
      "[2 page] 3) 상세 해석/설계 검토 (비교표 + 수식/단위 + KDS 근거)",
      "[3 page] 4) 시공/유지관리 유의사항 5) 결론/기술사 제언(본인 견해 3~4줄)",
    ],
  };
}

// ──── 프롬프트 빌더 ───────────────────────────────────────────

import { ANSWER_JSON_SCHEMA_PROMPT } from './ai-json.module.js';

export function buildHighQualityAnswerInstruction(question, relatedTheories = [], options = {}) {
  const spec = inferAnswerWritingSpec(question);
  const jsonMode = !!options.jsonMode;

  const theoryBlock = relatedTheories.length
    ? relatedTheories.map((theory, idx) => {
        const tags = Array.isArray(theory.tags) ? theory.tags.join(", ") : "";
        return [
          `### [참조 전문지식 ${idx + 1}: ${theory.title || "이론"}]`,
          `- 분류: ${theory.category || "일반분류"}${tags ? ` | 키워드: ${tags}` : ""}`,
          `- 근거 및 메타데이터: ${theory.source || "Local Knowledge Base"}`,
          `- 핵심 지식 요약:`,
          `${String(theory.content || "").slice(0, 1500)}${theory.content?.length > 1500 ? "... (중략)" : ""}`,
        ].join("\n");
      }).join("\n\n")
    : "- 참조 가능한 직접적 전문 지식 없음 (일반 기술 기준 중심으로 작성)";

  const instruct = [
    "## [Role: Senior Structural Engineer & Technical Evaluator]",
    "당신은 대한민국 토목구조기술사 채점위원 급의 시니어 엔지니어다.",
    "채점관이 답안지 3페이지를 넘길 때 '논리적 완결성'과 '가독성'에 압도될 수 있도록 작성하라.",
    "",
    "## [Target Answer Specification]",
    `- 목표 분량: ${spec.pageTarget} (최소 ${spec.minChars}자 이상)`,
    "- 답안 형식: 개조식(Numbered Lists) + 전문 용어(English in brackets) + 시각화 지시",
    "",
    "## [Operational Guide]",
    "1. 수식 중심: 모든 물리/수학 수식은 반드시 LaTeX 형식($...$ 또는 $$...$$)으로 작성하라 (KaTeX 엔진 대응).",
    "2. 단위 준수: SI 단위를 원칙으로 하며, 모든 계산 결과에 단위 기호(kN, MPa, mm 등)를 반드시 병기하라.",
    "3. 지식 활용: 제공된 [참조 전문지식 컨텍스트]를 최우선 근거로 활용하고 KDS/KCS 코드 번호를 인용하라.",
    "4. 도해 지시: 하중 경로, 모멘트도 등 메커니즘 도해 지시사항을 최소 2개 구체적으로 삽입하라.",
    "5. 비교표 구성: 대안 또는 공법 비교표(Comparison Table)를 반드시 1개 이상 구성하라.",
    "6. 문체 정규화: '~함', '~임' 식의 간결한 전문 명사형 종결 어미를 사용하여 가독성을 높여라.",
    "",
    jsonMode ? "## [Output Format: JSON Mode]" : "## [Output Format: Markdown Draft]",
    jsonMode ? "반드시 지정된 JSON 스키마를 100% 준수하여 유효한 JSON으로만 출력하라." : "바로 답안지에 전사할 수 있는 마크다운 형식으로 출력하라.",
    "",
    jsonMode ? ANSWER_JSON_SCHEMA_PROMPT : "",
    "",
    "## [Current Question Metadata]",
    `- 문항 제목: ${question?.title || "미지정"}`,
    `- 문항 원문: ${question?.rawQuestion || "내용 없음"}`,
    "",
    "## [Retrieved Specialized Knowledge Context]",
    theoryBlock,
    "",
    "## [Final Quality Guard]",
    "- 서론(개요)과 결론(기술사 제언)은 각각 4~5줄 이내로 핵심만 서술하라.",
    "- 기술사 제언 파트에서는 '경제성', '시공성', '유지관리' 측면의 본인 견해를 강력히 제시하라.",
  ].filter(line => line !== null && line !== undefined).join("\n");

  return instruct;
}


export function buildDraftPlanInstruction(question, relatedTheories = []) {
  const theoryBlock = relatedTheories.length
    ? relatedTheories.map((theory, idx) =>
        `- 이론 ${idx + 1}: ${theory?.title || "이론"} | ${String(theory?.content || "").replace(/\s+/g, " ").slice(0, 180)}`
      ).join("\n")
    : "- 연관 이론 없음";

  return [
    "역할: 토목구조기술사 답안 설계자",
    "요구: 답안을 바로 쓰지 말고, 먼저 작성 계획(Plan)만 출력",
    "출력 형식(반드시 준수):",
    "1) 문제 인식 요약(2~3줄)",
    "2) 답안 구조(번호형 5~6개 섹션)",
    "3) 각 섹션 핵심 포인트(섹션당 2~3개)",
    "4) 도해 계획(최소 2개: 제목/목적/핵심요소)",
    "5) 비교표 계획(최소 1개: 비교항목/대안축)",
    "6) 기준·수치·코드(KDS) 삽입 계획",
    "금지: 완성 답안 본문 작성, 메타 잡담",
    "",
    `[문제 제목] ${question?.title || ""}`,
    `[문제 원문] ${question?.rawQuestion || ""}`,
    "[연관 이론]",
    theoryBlock,
  ].join("\n");
}

export function mergePlanIntoDraftInstruction(baseInstruction, planText) {
  const plan = String(planText || "").trim();
  if (!plan) return baseInstruction;
  return [
    baseInstruction,
    "",
    "[사전 작성 계획 - 반드시 반영]",
    plan,
    "",
    "[작성 규칙] 위 계획의 섹션 순서/도해/비교표 계획을 본문에 반드시 반영할 것.",
  ].join("\n");
}

export function appendDraftPlanHistory(question, planText, maxItems = 5) {
  const plan = String(planText || "").trim();
  const existing = Array.isArray(question?.draftPlanHistory) ? question.draftPlanHistory : [];
  const normalizedExisting = existing
    .map((item) => {
      if (typeof item === "string") {
        const text = String(item || "").trim();
        return text ? { text, createdAt: "" } : null;
      }
      if (!item || typeof item !== "object") return null;
      const text = String(item.text || item.plan || "").trim();
      return text ? { text, createdAt: String(item.createdAt || "").trim() } : null;
    })
    .filter(Boolean);

  if (!plan) return normalizedExisting.slice(0, maxItems);
  if (normalizedExisting[0]?.text === plan) return normalizedExisting.slice(0, maxItems);
  return [{ text: plan, createdAt: new Date().toISOString() }, ...normalizedExisting].slice(0, maxItems);
}

// ──── 로컬 템플릿 및 품질 보강 ────────────────────────────────────

export function isDRegionTopic(text = "") {
  const src = String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!src) return false;
  if (/d[\s-]?region|응력\s*교란\s*구역|응력\s*교란|strut\s*[- ]?\s*tie|stm\b|스트럿\s*[-·]?\s*타이|스트럿타이/.test(src)) return true;
  const hasStrut = /(^|[^a-z])strut([^a-z]|$)|스트럿/.test(src);
  const hasTie = /(^|[^a-z])tie([^a-z]|$)|타이\s*모델|타이\s*부재|타이\s*요소/.test(src);
  return hasStrut && hasTie;
}

export function generateLocalAnswerTemplate(question) {
  const prompt = `${question.title || ""} ${question.rawQuestion || ""}`;
  const lower = prompt.toLowerCase();

  if (isDRegionTopic(lower)) {
    return [
      "1. 정의 및 적용 배경",
      "- 응력교란구역(D-Region, Discontinuity Region)은 평면유지 가정이 성립하지 않는 구간임.",
      "- 하중 작용점/지점부/단면 급변부에서 집중응력으로 인해 Bernoulli 가정이 붕괴됨.",
      "2. 해석 및 설계 원칙",
      "- 스트럿-타이 모델(Strut-and-Tie Model)로 힘의 흐름을 압축대/인장대/절점으로 이상화함.",
      "- KDS 14 20 24 기준에 따라 Strut, Tie, Node 강도와 정착길이를 검토함.",
      "3. 도해/표 작성 포인트",
      "- 도해: 하중-스트럿-타이-절점의 하중경로를 화살표로 제시.",
      "- 비교표: B-Region vs D-Region 적용 이론과 검토항목 대비.",
      "4. 기술사 제언",
      "- 시공성/유지관리/품질관리(정착, 배근 간섭, 균열제어)까지 결론에서 제시.",
    ].join("\n");
  }

  if (/psc|긴장재|지연파괴|부식|그라우팅/.test(lower)) {
    return [
      "1. 손상 메커니즘 개요",
      "- 염소이온(Chloride) 및 수분 환경에서 PS 강재의 응력부식균열(SCC) 위험이 증가함.",
      "- 고응력 상태에서 수소취성(Hydrogen Embrittlement)으로 지연파괴 가능.",
      "2. 설계/시공/유지관리 대책",
      "- 설계: 노출환경 등급에 따른 피복 및 방청 상세를 명시.",
      "- 시공: 그라우팅 충전성 확보, 블리딩 제어, 공극 최소화.",
      "- 유지관리: 비파괴검사(NDT) 및 모니터링 주기 수립.",
      "3. 기준 연계",
      "- KDS 관련 조항을 답안에 직접 표기하고 수치 근거를 제시.",
      "4. 결론",
      "- 사고사례와 연계하여 예방 중심의 유지관리 체계를 제언.",
    ].join("\n");
  }

  if (/좌굴|강구조|lsd|한계상태/.test(lower)) {
    return [
      "1. 핵심 개념 정의",
      "- 한계상태설계법(LSD, Limit State Design)은 확률론적 신뢰성 기반의 설계체계임.",
      "2. 검토 흐름",
      "- 하중조합 설정 → 단면강도 산정 → 좌굴/국부좌굴/접합부 파괴 모드 검토.",
      "- KDS 기준 코드와 부분안전계수 적용 근거를 명시.",
      "3. 시각화 전략",
      "- 그래프: 세장비(KL/r)-임계응력(Fcr) 곡선 제시.",
      "- 표: ASD vs LSD 비교표로 차별화.",
      "4. 기술사 제언",
      "- 시공성과 경제성을 포함한 선택 기준을 결론에 제시.",
    ].join("\n");
  }

  return [
    "1. 문제 핵심 및 정의",
    "- 본 문항은 구조물의 하중 전달 메커니즘과 파괴 지배요인을 검토하여 안전성과 사용성을 동시에 확보하는 것이 핵심임.",
    "- 핵심 용어는 영문 병기를 병행함(Ductility, Redundancy, Limit State).",
    "2. 메커니즘 및 설계 검토",
    "- 검토 흐름: ① 하중조건 정리 ② 내부력/응력경로 확인 ③ 지배 파괴모드 판단 ④ 기준식 대입 및 안전성 확인.",
    "- KDS 관련 조항과 단위·계수(예: 하중계수, 저항계수)를 함께 명시하여 근거를 분명히 함.",
    "3. 도해 및 비교표(본문 포함)",
    "- [도해] 하중 작용점에서 지점까지의 Load Path와 응력집중 구간을 화살표로 표시함.",
    "- [비교표] 대안 A/B의 안전성·시공성·경제성·유지관리성을 항목별로 비교하여 최적안을 도출함.",
    "4. 결론 및 기술사 제언",
    "- 결론은 구조성능 확보 + 시공 리스크 저감 + 유지관리 모니터링 계획까지 포함한 실무형 권고로 정리함.",
  ].join("\n");
}

export function enforceAnswerQualityGuard(rawAnswer, question) {
  const answer = String(rawAnswer || "").trim();
  if (!answer) return answer;

  const spec = inferAnswerWritingSpec(question || {});
  const compactLength = answer.replace(/\s+/g, "").length;
  const needsLengthBoost = compactLength < spec.minChars;
  const hasVisual = /(도해|모식도|그림|선도|그래프|표|상관도|메커니즘)/.test(answer);
  const hasComparison = /(비교표|vs\b|대비\s*[:：]|허용응력설계법|한계상태설계법)/i.test(answer);
  const hasBilingual = /[가-힣][^\n]{0,12}\([A-Za-z][^)]+\)/.test(answer);
  const hasKds = /KDS\s*\d{2}\s*\d{2}\s*\d{2}|KDS\s*\d{2}\s*\d{2}\s*\d{2}\s*\d{2}/.test(answer);
  const hasSymbol = /[→↑↓Δσφ∑]|>=|<=|=|\bP\/?M\b|\bN\/?M\b|\bS\/?N\b/.test(answer);

  const addon = [];
  if (needsLengthBoost) addon.push("- 본론 보강: 해석·설계검토·시공·유지관리 파트를 추가해 답안 완성도를 높임");
  if (!hasVisual) addon.push("- [도해] 하중 흐름(Load Path) 화살표(→)와 응력블록/변형률 선도를 본문 중간에 명시");
  if (!hasComparison) addon.push("- [비교표] 허용응력설계법(ASD) vs 한계상태설계법(LSD)를 항목별로 대비");
  if (!hasBilingual) addon.push("- 용어 병기: 연성(Ductility), 여유도(Redundancy) 등 최소 3개 포함");
  if (!hasKds) addon.push("- 기준 근거: KDS 14 20 00 또는 관련 코드 번호를 적용 근거와 함께 명시");
  if (!hasSymbol) addon.push("- 기호/식 보강: φMn ≥ Mu, Δ ≤ L/240 중 1개 이상 본문에 삽입");

  if (!addon.length) return answer;

  const severeLengthGap = compactLength < Math.floor(spec.minChars * 0.5);
  const hasNumberedSections = /^\s*\d+\.\s/m.test(answer);
  const guardHeading = severeLengthGap ? (hasNumberedSections ? "5. 답안 보강 포인트" : "[답안 보강 포인트]") : "[보강 포인트]";
  
  if (answer.includes("[보강 포인트]") || answer.includes("보강 포인트")) return answer;

  const bridgeLine = severeLengthGap ? "- 아래 항목을 반영해 채점 포인트를 보강" : "- 누락된 채점요소 보강";
  return `${answer}\n\n${guardHeading}\n${bridgeLine}\n${addon.join("\n")}`;
}
