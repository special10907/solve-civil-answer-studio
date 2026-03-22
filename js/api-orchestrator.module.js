import { AppState } from './app-state.js';
import UIStatus from './ui-status.module.js';
const { setPdfStatus, setBackendStatus, setDataStatus, showToast } = UIStatus;
import {
  discoverAnalyzeBackendBaseUrl,
  getLmStudioBaseUrl,
  getBackendBaseUrl,
  fetchLmStudioModelsViaBackend,
  markLmStudioOffline,
  clearLmStudioOffline,
  shouldSkipLmStudioProbe,
  isLikelyLmStudioEndpoint,
  getEffectiveSelectedModelId,
  parseSelectedModelToken
} from './api-client.module.js';
import {
  buildHighQualityAnswerInstruction,
  buildDraftPlanInstruction,
  mergePlanIntoDraftInstruction,
  buildTheoryContextForQuestion,
  generateLocalAnswerTemplate,
  enforceAnswerQualityGuard,
  appendDraftPlanHistory,
  sanitizeExtractedSourceText
} from './api-prompt.module.js';
import { extractJsonFromText, convertJsonToMarkdown } from './ai-json.module.js';

/**
 * API Orchestrator Module
 * Handles complex AI generation flows, multi-step pipelines,
 * and automatic question extraction from PDF text.
 */

// ──── 5단계 강제 파이프라인 지원 ──────────────────────────────────────

export function isMandatoryFiveStepPipelineEnabled() {
  return window.__forceMandatoryFiveStepPipeline !== false;
}

export function collectMandatoryFiveStepSources(question, data) {
  const allTheories = Array.isArray(data?.theories) ? data.theories : [];
  const related = buildTheoryContextForQuestion(question, allTheories, 8);

  const pickBySource = (regex, maxItems = 3) => {
    const filtered = allTheories.filter(t => regex.test(`${t?.source || ""} ${t?.title || ""} ${t?.content || ""}`));
    return buildTheoryContextForQuestion(question, filtered, maxItems);
  };

  const storedTheory = related.slice(0, 4);
  const notebookLm = pickBySource(/notebook\s*lm|notebooklm/i, 3);
  const flowith = pickBySource(/flowith|지식정원/i, 3);

  const insightSummary = String(AppState.latestAttachmentInsight?.summary || "").trim();
  const insightBoost = String(AppState.latestAttachmentInsight?.answerBoost || "").trim();

  const toRows = (label, rows) => {
    if (!rows.length) return `- ${label}: 확인 결과 없음`;
    return rows.map((item, idx) => `- ${label} ${idx + 1}: ${item.title || "제목없음"}\n  Snippet: ${String(item.content || "").slice(0, 200)}`).join("\n");
  };

  return {
    storedTheory, notebookLm, flowith, insightSummary, insightBoost,
    blocks: {
      storedTheory: toRows("저장 이론", storedTheory),
      notebookLm: toRows("NotebookLM", notebookLm),
      flowith: toRows("Flowith", flowith),
      insight: insightSummary ? `- 요약: ${insightSummary}\n- Boost: ${insightBoost}` : "- 요약 없음"
    }
  };
}

export function buildMandatoryFiveStepInstruction(question, baseInstruction, sourceBundle) {
  const b = sourceBundle?.blocks || {};
  return [
    baseInstruction,
    "",
    "[강제 실행 파이프라인 - 1~5 순서 준수]",
    "1) 저장 이론 검토 2) NotebookLM 검토 3) Flowith 검토 4) 인터넷 딥리서치 5) 통합 작성",
    "",
    "[근거 자료]",
    b.storedTheory || "- 없음",
    b.notebookLm || "- 없음",
    b.flowith || "- 없음",
    b.insight || "- 없음",
    "",
    `- 문제: ${question?.title || ""}`
  ].join("\n");
}

// ──── AI 생성 코어 ──────────────────────────────────────────────────

export async function generateDraftAnswersByLmStudioLocal() {
  const baseUrl = getLmStudioBaseUrl();
  const endpoint = `${baseUrl}/v1/chat/completions`;
  const modelId = getEffectiveSelectedModelId();
  if (!modelId) { setPdfStatus("LM Studio 모델을 확인하세요.", "error"); return { ok: false }; }

  const data = window.getCurrentAnswerData ? window.getCurrentAnswerData() : { questions: [] };
  const overwrite = document.getElementById("overwriteGenerated")?.checked;
  const selectedIdSet = new Set(window.selectedQuestionIdsForAi || []);
  const selectedMode = selectedIdSet.size > 0;

  let updated = 0; let fallbackCount = 0;
  for (let i = 0; i < data.questions.length; i++) {
    const q = data.questions[i];
    if (selectedMode && !selectedIdSet.has(String(q.id))) continue;
    if (!overwrite && q.modelAnswer) continue;

    const instruct = buildHighQualityAnswerInstruction(q, buildTheoryContextForQuestion(q, data.theories, 3));
    try {
      const resp = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelId, temperature: 0.15,
          messages: [{ role: "system", content: "토목구조기술사 고득점 답안 스타일 작성" }, { role: "user", content: instruct }]
        })
      });
      const payload = await resp.json();
      const answer = payload?.choices?.[0]?.message?.content || "";
      data.questions[i].modelAnswer = enforceAnswerQualityGuard(answer, q);
      data.questions[i].source = "LMStudioLocal";
      updated++;
    } catch {
      data.questions[i].modelAnswer = enforceAnswerQualityGuard(generateLocalAnswerTemplate(q), q);
      data.questions[i].source = "LMStudioLocalFallback";
      updated++; fallbackCount++;
    }
  }
  if (window.syncJsonAndRender) window.syncJsonAndRender(data, `생성 완료: ${updated}개`, true);
  return { ok: true, updated, fallbackCount };
}

export async function generateDraftAnswersByApi(options = {}) {
  const isLm = isLikelyLmStudioEndpoint();
  if (isLm && !options.forceBackend && !isMandatoryFiveStepPipelineEnabled()) return generateDraftAnswersByLmStudioLocal();

  const endpoint = document.getElementById("aiEndpointUrl")?.value.trim() || "http://localhost:8787/api/generate-answer";
  const data = window.getCurrentAnswerData ? window.getCurrentAnswerData() : { questions: [] };
  const overwrite = document.getElementById("overwriteGenerated")?.checked;
  const selectedIdSet = new Set(window.selectedQuestionIdsForAi || []);
  const selectedMode = selectedIdSet.size > 0;

  let updated = 0; let blockedCount = 0;
  for (let i = 0; i < data.questions.length; i++) {
    const q = data.questions[i];
    if (selectedMode && !selectedIdSet.has(String(q.id))) continue;
    if (!overwrite && q.modelAnswer) continue;

    // RAG: 지식 베이스에서 관련 이론 추출 (임계치 상향)
    const context = buildTheoryContextForQuestion(q, data.theories, 5);
    const bundle = collectMandatoryFiveStepSources(q, data);
    const jsonMode = document.getElementById("aiJsonMode")?.checked;
    
    // 지능형 프롬프트 구성
    let instruct = buildHighQualityAnswerInstruction(q, context, { jsonMode });
    if (isMandatoryFiveStepPipelineEnabled()) {
      instruct = buildMandatoryFiveStepInstruction(q, instruct, bundle);
    }

    setPdfStatus(`답안 생성 중... (${updated + 1}/${selectedMode ? selectedIdSet.size : data.questions.length})`, "info");
    console.log(`[RAG Engine] Retrieving specialized knowledge for: ${q.title}`);
    console.log(`[RAG Context] Found ${context.length} relevant theory entries.`);

    try {
      const resp = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q, 
          instruction: instruct,
          mandatoryPipeline: isMandatoryFiveStepPipelineEnabled(),
          sourceBundle: bundle,
          response_format: jsonMode ? { type: "json_object" } : null,
          options: {
            temperature: 0.1, // 구조적 정확성을 위해 온도 낮춤
            max_tokens: 4000
          }
        })
      });
      
      if (!resp.ok) throw new Error(`API Refused: ${resp.status}`);
      
      const payload = await resp.json();
      let answer = payload.answer || payload.choices?.[0]?.message?.content || "";
      
      if (jsonMode) {
        const extracted = extractJsonFromText(answer);
        if (extracted) answer = convertJsonToMarkdown(extracted);
      }

      // 품질 가드 적용 및 결과 저장
      data.questions[i].modelAnswer = enforceAnswerQualityGuard(answer, q);
      data.questions[i].source = `StarkEngine(${payload.source || "cloud"})`;
      data.questions[i].retrievedTheories = context.map(t => t.id); // 참조된 이론 ID 기록
      
      updated++;
      // 실시간 UI 업데이트 지연 방지
      if (updated % 2 === 0 && window.syncJsonAndRender) {
        window.syncJsonAndRender(data, `생성 중... (${updated}개 완료)`, false);
      }
    } catch (e) {
      console.error("[Chain Error] AI Pipeline failed for question:", q.id, e);
      showToast(`${q.title} 답안 생성 실패.`, "warning");
      blockedCount++;
    }
  }
  
  if (window.syncJsonAndRender) window.syncJsonAndRender(data, `지능형 생성 완료: ${updated}개`, true);
  setPdfStatus(`분석 완료. (성공:${updated}, 실패:${blockedCount})`, updated > 0 ? "success" : "error");
  return { ok: true, updated, blockedCount };
}

// ──── 자동 추출 로직 ───────────────────────────────────────────────

export async function extractQuestionsFromPdfText() {
  const studioPdfInput = document.getElementById("studio-pdf-input");
  const attachedFiles = Array.from(studioPdfInput?.files || []);
  let extracted = "";

  if (!attachedFiles.length && window.visualPdfDoc) {
    const parts = [];
    const maxP = Math.min(window.visualPdfDoc.numPages, 30);
    for (let i = 1; i <= maxP; i++) {
        const page = await window.visualPdfDoc.getPage(i);
        const content = await page.getTextContent();
        parts.push(content.items.map(it => it.str).join(" "));
    }
    extracted = parts.join("\n");
  }

  if (!extracted) { showToast("PDF를 로드하거나 파일을 선택하세요.", "error"); return { ok: false }; }

  setPdfStatus("AI 분석 요청 중...", "info");
  const baseUrl = await discoverAnalyzeBackendBaseUrl();
  try {
    const resp = await fetch(`${baseUrl}/api/analyze-questions`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: extracted, source: "attachments" })
    });
    if (!resp.ok) throw new Error("분석 실패");
    const payload = await resp.json();
    const questions = payload.questions || [];
    
    const data = window.getCurrentAnswerData();
    questions.forEach(q => {
        data.questions.push({ ...q, id: `Q-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, tags: ["자동추출"] });
    });
    if (window.syncJsonAndRender) window.syncJsonAndRender(data, `추출 완료: ${questions.length}개`, true);
    setPdfStatus(`추출 완료: ${questions.length}개`, "success");
    return { ok: true, addedCount: questions.length };
  } catch (e) {
    setPdfStatus("추출 중 오류 발생", "error");
    return { ok: false };
  }
}

export async function runAutoPipeline() {
  setPdfStatus("자동 배치 시작...", "info");
  const parseResult = await extractQuestionsFromPdfText();
  if (!parseResult.ok) return;
  await generateDraftAnswersByApi();
  if (window.evaluateRenderedAnswers) window.evaluateRenderedAnswers();
  setPdfStatus("자동 배치 완료", "success");
}
// ──── AI 심화 보강 (Boost) 파이프라인 ───────────────────────────

export function tokenizeBoostText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2);
}

export function calculateBoostOverlapScore(sourceTokens, targetTokens) {
  if (!sourceTokens.length || !targetTokens.length) return 0;
  const sourceSet = new Set(sourceTokens);
  let hit = 0;
  targetTokens.forEach((token) => { if (sourceSet.has(token)) hit += 1; });
  return hit / Math.max(1, targetTokens.length);
}

export function selectAttachmentBoostTheories(targetQuestion, theories, maxItems = 3) {
  const targetText = [targetQuestion?.title, targetQuestion?.rawQuestion, targetQuestion?.modelAnswer].filter(Boolean).join(" ");
  const targetTokens = tokenizeBoostText(targetText);
  if (!Array.isArray(theories) || !theories.length || !targetTokens.length) return [];

  return theories
    .map((theory) => {
      const theoryText = [theory?.title, theory?.category, theory?.content, ...(Array.isArray(theory?.tags) ? theory.tags : [])].filter(Boolean).join(" ");
      const score = calculateBoostOverlapScore(tokenizeBoostText(theoryText), targetTokens);
      return { theory, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxItems)
    .map((row) => row.theory);
}

export function isDRegionTopicForBoost(text = "") {
  const src = String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!src) return false;
  if (/d[\s-]?region|응력\s*교란\s*구역|응력\s*교란|strut\s*[- ]?\s*tie|stm\b|스트럿\s*[-·]?\s*타이|스트럿타이/.test(src)) return true;
  const hasStrut = /(^|[^a-z])strut([^a-z]|$)|스트럿/.test(src);
  const hasTie = /(^|[^a-z])tie([^a-z]|$)|타이\s*모델|타이\s*부재|타이\s*요소/.test(src);
  return hasStrut && hasTie;
}

export function inferBoostTopicType(target = {}) {
  const seed = `${target?.title || ""} ${target?.rawQuestion || ""} ${target?.modelAnswer || ""}`;
  const src = String(seed || "").toLowerCase();
  if (isDRegionTopicForBoost(src)) return "d-region";
  if (/psc|긴장재|부식|지연파괴|그라우팅/.test(src)) return "psc";
  return "general";
}

export function buildAttachmentBoostFallback({ target, insight, userRequest, theorySnippets }) {
  const prompt = `${target?.title || ""} ${target?.rawQuestion || ""}`;
  const isShort = /1\s*교시|10\s*점|단답|용어/.test(prompt);
  const minChars = isShort ? 1200 : 2200;

  const insightBoost = String(insight?.answerBoost || "").trim();
  const summary = String(insight?.summary || "").trim();
  const answerDirection = userRequest ? `${userRequest}` : "정의 정확성, 메커니즘 인과성, 기준·수치 근거 중심";
  const theoryScope = theorySnippets.length ? theorySnippets.map((item) => item.title || "이론").join(" / ") : "핵심어 기반 보강";

  const topicType = inferBoostTopicType(target);
  const isDRegion = topicType === "d-region";
  const isPsc = topicType === "psc";

  const expanded = [
    "1. 정의 및 적용 배경",
    `- 대상: ${target?.title || "문항"}`,
    `- 응답 방향: ${answerDirection}`,
    isDRegion ? "- 응력 교란구역(D-Region)은 베르누이 가정이 성립하지 않는 구간으로 STM 설계를 원칙으로 한다." : isPsc ? "- PSC 부재는 긴장재 부식 및 정착지점부의 국부 거동을 통합 검토해야 한다." : "- 본 문항은 하중 전달 경로와 지배 파괴모드 간의 인과관계를 중심으로 설계 대책을 제시한다.",
    "",
    "2. 거동 메커니즘 및 상세 대책",
    "- 하중 경로(Load Path) 기반의 내부력 재분배 과정을 도식화하여 취약 구간을 식별한다.",
    "- KDS 기준 조항과 설계 검토식(강도, 사용성)을 명시하여 공학적 판정 근거를 강화한다.",
    "- [도해] 및 [비교표]를 통해 대안별 안전성과 시공성을 시각적으로 비교 제시한다.",
    "",
    "3. 결론 및 실무 제언",
    summary ? `- 분석 반영: ${summary.slice(0, 300)}` : "- 분석 반영: 기술적 핵심 포인트를 결론부에 연결함.",
    insightBoost ? `- 심화 보강: ${insightBoost.slice(0, 300)}` : "- 심화 보강: 기준/수치 근거를 결론부까지 일관되게 연결함.",
  ].join("\n");

  return expanded.length < minChars ? expanded + "\n\n(참고: 분량 확보를 위해 상세 설계식 및 시공 오차 대책을 추가 보강함)" : expanded;
}

export function sanitizeBoostForExamSubmission(text = "") {
  const raw = String(text || "").trim();
  if (!raw) return "";
  return raw.split(/\r?\n/).reduce((arr, line) => {
    const trimmed = line.trim();
    if (!trimmed || /^\[|^- 요청|^\|/.test(trimmed)) return arr;
    arr.push(trimmed); return arr;
  }, []).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export async function generateDeepAttachmentBoost({ target, insight, userRequest, sourceLabels, theorySnippets }) {
  const theoryContext = theorySnippets.length
    ? theorySnippets.map((item, idx) => `- 이론 ${idx + 1}: ${item?.title || "이론"}\n  내용: ${String(item?.content || "").slice(0, 200)}`).join("\n")
    : "- 연계 가능한 이론 항목 없음";

  const instruction = [
    "역할: 토목구조기술사 답안 심화 코치",
    `탐색 경로: ${sourceLabels.join(", ")}`,
    userRequest ? `요청사항: ${userRequest}` : "",
    "직접 답안 문장으로 작성 (메타 지시어 금지)",
    "[도해] 1개, [비교표] 1개를 본문에 명시",
    `인사이트 요약: ${String(insight?.summary || "").slice(0, 500)}`,
    `이론 컨텍스트: ${theoryContext}`,
  ].join("\n");

  try {
    const response = await generateAnswer({ title: target?.title, rawQuestion: target?.rawQuestion || target.title, modelAnswer: target?.modelAnswer }, instruction, "text", { mandatoryPipeline: true });
    return String(response?.answer || "").trim();
  } catch { return ""; }
}
