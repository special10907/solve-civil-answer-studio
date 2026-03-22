import { AppState } from './app-state.js';
import { extractRoundOnly } from './utils.js';

/**
 * State Analysis Module
 * 담당: 답안 평가(Evaluation), 이론 유사도 분석, 병합 품질 검토
 */

// ──── 답안 평가 (Evaluation) ───────────────────────────────────

export function inferQuestionType(question) {
  const fullText = `${question.id || ""} ${question.title || ""} ${question.modelAnswer || ""}`;
  if (/1\s*교시|10\s*점|용어|단답/.test(fullText)) return "short";
  if (/2\s*교시|3\s*교시|4\s*교시|25\s*점|서술/.test(fullText)) return "long";
  return "unknown";
}

export function evaluateOneAnswer(question, index) {
  const answer = String(question.modelAnswer || "");
  const type = inferQuestionType(question);
  const length = answer.replace(/\s+/g, "").length;
  const minLength = type === "short" ? 900 : type === "long" ? 2200 : 1300;

  const hasVisual = /(도해|모식도|그림|선도|그래프|표|상관도|메커니즘)/.test(answer);
  const hasComparisonTable = /(비교표|vs\b|대비\s*[:：]|허용응력설계법|한계상태설계법)/i.test(answer);
  const hasBilingual = /[가-힣][^\n]{0,12}\([A-Za-z][^)]+\)/.test(answer);
  const hasKds = /KDS\s*\d{2}\s*\d{2}\s*\d{2}|KDS\s*\d{2}\s*\d{2}\s*\d{2}\s*\d{2}/.test(answer);
  const hasNumbered = /(^|\n)\s*\d+\./.test(answer);
  const hasOpinion = /(결론|제언|본인(?:의)?\s*견해|실무\s*제안|유지관리\s*유의사항)/.test(answer);

  const breakdown = {
    length: Math.round(Math.min(1, length / minLength) * 30),
    visual: hasVisual ? 20 : 0,
    comparison: hasComparisonTable ? 10 : 0,
    bilingual: hasBilingual ? 10 : 0,
    kds: hasKds ? 20 : 0,
    structure: hasNumbered ? 10 : 0,
    opinion: hasOpinion ? 10 : 0
  };

  const score = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const feedback = [];
  if (length < minLength) feedback.push(`분량 보강 필요: 현재 ${length}자, 권장 ${minLength}자 이상`);
  if (!hasVisual) feedback.push("도해/표/그래프 항목을 본문에 명시해 시각화 근거를 강화하세요.");
  if (!hasComparisonTable) feedback.push("본론에 비교표를 추가하세요.");
  if (!hasBilingual) feedback.push("핵심 용어에 영어 병기를 추가하세요.");
  if (!hasKds) feedback.push("KDS 코드와 기준 번호를 본문에 직접 명시하세요.");
  if (!hasNumbered) feedback.push("개조식 넘버링 구조로 논리 흐름을 강화하세요.");
  if (!hasOpinion) feedback.push("결론부에 기술사 제언/본인 견해를 명시하세요.");

  return { index, id: question.id, title: question.title, type, score, breakdown, feedback };
}

// ──── 이론 유사도 및 병합 분석 ──────────────────────────────────

export function tokenizeTheory(text) {
  const stopwords = new Set(["그리고", "또한", "대한", "에서", "으로", "하는", "있는", "있다", "한다", "통해", "검토", "적용"]);
  return new Set(String(text || "").toLowerCase().replace(/[^a-z0-9가-힣\s]/g, " ").split(/\s+/).filter(t => t.length >= 2 && !stopwords.has(t)));
}

export function jaccardSimilarity(setA, setB) {
  const union = new Set([...setA, ...setB]);
  if (!union.size) return 0;
  let intersectionCount = 0;
  setA.forEach(t => { if (setB.has(t)) intersectionCount++; });
  return intersectionCount / union.size;
}

export function calculateTheorySimilarity(left, right) {
  const titleSim = jaccardSimilarity(tokenizeTheory(left.title), tokenizeTheory(right.title));
  const contentSim = jaccardSimilarity(tokenizeTheory(left.content), tokenizeTheory(right.content));
  const tagSim = jaccardSimilarity(new Set(left.tags || []), new Set(right.tags || []));
  
  let score = titleSim * 0.35 + contentSim * 0.45 + tagSim * 0.2;
  if (left.category && left.category === right.category) score += 0.06;
  if (extractRoundOnly(left.examRound) === extractRoundOnly(right.examRound)) score += 0.04;
  
  return Math.min(1, score);
}

export function evaluateMergedTheoryDraftQuality(draft) {
  const content = String(draft.content || "");
  const length = content.replace(/\s+/g, "").length;
  const hasKds = /KDS\s*\d{2}\s*\d{2}\s*\d{2}/.test(content);
  const hasVisual = /(도해|그래프|표|선도|모식도)/.test(content);
  const hasStructure = /(^|\n)\s*\d+\.|정의|결론/.test(content);
  const hasBilingual = /[가-힣][^\n]{0,12}\([A-Za-z][^)]+\)/.test(content);

  const breakdown = {
    length: Math.min(40, Math.round(length / 18)),
    kds: hasKds ? 20 : 0,
    visual: hasVisual ? 15 : 0,
    structure: hasStructure ? 15 : 0,
    bilingual: hasBilingual ? 10 : 0
  };

  const score = Object.values(breakdown).reduce((a, b) => a + b, 0);
  return { score, grade: score >= 85 ? "우수" : score >= 70 ? "양호" : "보강 필요", detail: breakdown };
}

export function evaluateRenderedAnswers(dataArg, notify = true) {
  const summaryEl = document.getElementById("evaluationSummary");
  const listEl = document.getElementById("evaluationList");
  if (!summaryEl || !listEl) return;

  const normalized = (dataArg && typeof dataArg === "object") ? dataArg : {};
  const questions = Array.isArray(normalized.questions) ? normalized.questions : [];
  
  if (!questions.length) {
    summaryEl.innerHTML = '<span class="text-slate-500">평가할 문제가 없습니다.</span>';
    listEl.innerHTML = "";
    return;
  }

  const results = questions.map((q, i) => evaluateOneAnswer(q, i));
  const avg = Math.round(results.reduce((a, b) => a + b.score, 0) / results.length);
  const grade = avg >= 85 ? "고득점권" : avg >= 70 ? "합격권" : "보강 필요";

  summaryEl.innerHTML = `
    <div class="p-3 rounded border ${avg >= 85 ? "border-emerald-200 bg-emerald-50" : avg >= 70 ? "border-blue-200 bg-blue-50" : "border-amber-200 bg-amber-50"}">
      <strong>종합평가:</strong> 평균 ${avg}점 (${grade}) · 총 ${results.length}문항
    </div>
  `;

  listEl.innerHTML = results.map(item => `
    <article class="border border-slate-200 rounded-lg p-3 bg-white mt-2">
      <div class="flex items-center justify-between">
        <h5 class="font-bold text-slate-800">${item.id}. ${item.title}</h5>
        <span class="text-xs px-2 py-1 rounded ${item.score >= 85 ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}">${item.score}점</span>
      </div>
      <ul class="mt-2 list-disc list-inside text-[11px] text-slate-600">
        ${item.feedback.map(f => `<li>${f}</li>`).join("")}
      </ul>
    </article>
  `).join("");

  if (notify && typeof window.setDataStatus === "function") {
    window.setDataStatus(`평가 완료: 평균 ${avg}점`, "success");
  }
}
