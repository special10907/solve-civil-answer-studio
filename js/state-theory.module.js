/**
 * State Theory Module
 * 담당: 이론 항목 CRUD, 병합 분석, 아카이브 AI 패널
 */
import { AppState } from './app-state.js';
import UIStatus from './ui-status.module.js';
const { setDataStatus } = UIStatus;
import { getCurrentAnswerData, syncJsonAndRender } from './state-storage.module.js';

// ──── 유사도 계산 ─────────────────────────────────────────────

export function tokenizeTheory(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\w가-힣\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

export function jaccardSimilarity(setA, setB) {
  const a = new Set(setA), b = new Set(setB);
  let inter = 0;
  a.forEach((v) => { if (b.has(v)) inter++; });
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function calculateTheorySimilarity(left, right) {
  const lTokens = tokenizeTheory(`${left.title || ""} ${left.category || ""} ${(left.tags || []).join(" ")}`);
  const rTokens = tokenizeTheory(`${right.title || ""} ${right.category || ""} ${(right.tags || []).join(" ")}`);
  return jaccardSimilarity(lTokens, rTokens);
}

// ──── 이론 항목 병합 ──────────────────────────────────────────

export function mergeTheoryContent(baseContent, supplementContent) {
  const baseLines = String(baseContent || "").split("\n").map((l) => l.trim()).filter(Boolean);
  const suppLines = String(supplementContent || "").split("\n").map((l) => l.trim()).filter(Boolean);
  const merged = [...baseLines];
  suppLines.forEach((line) => {
    const isDup = baseLines.some((bl) => jaccardSimilarity(tokenizeTheory(bl), tokenizeTheory(line)) > 0.6);
    if (!isDup) merged.push(line);
  });
  return merged.join("\n");
}

export function buildTheoryMergeDrafts(theories, reinforcements) {
  const drafts = [];
  const tArr = Array.isArray(theories) ? theories : [];
  const rArr = Array.isArray(reinforcements) ? reinforcements : [];

  rArr.forEach(([idxA, idxB]) => {
    const a = tArr[idxA], b = tArr[idxB];
    if (!a || !b) return;
    const mergedContent = mergeTheoryContent(a.content, b.content);
    const mergedTags = [...new Set([...(a.tags || []), ...(b.tags || [])])];
    drafts.push({
      sourceIds: [a.id, b.id],
      title: a.title,
      category: a.category || b.category,
      content: mergedContent,
      tags: mergedTags,
      source: a.source || b.source,
      examRound: a.examRound || b.examRound,
    });
  });
  return drafts;
}

export function generateTheoryMergeDrafts() {
  try {
    const data = getCurrentAnswerData();
    const theories = Array.isArray(data.theories) ? data.theories : [];
    if (theories.length < 2) {
      setDataStatus("병합 초안 생성 실패: 이론이 2개 이상 필요합니다.", "error");
      return;
    }
    const reinforcements = [];
    for (let i = 0; i < theories.length; i++) {
      for (let j = i + 1; j < theories.length; j++) {
        if (calculateTheorySimilarity(theories[i], theories[j]) > 0.4) {
          reinforcements.push([i, j]);
        }
      }
    }
    const drafts = buildTheoryMergeDrafts(theories, reinforcements);
    AppState.theoryMergeDrafts = drafts;
    if (typeof window.renderTheoryMergeDrafts === "function") window.renderTheoryMergeDrafts(drafts);
    setDataStatus(`병합 초안 ${drafts.length}개 생성 완료.`, "success");
  } catch (e) {
    setDataStatus(`병합 초안 생성 오류: ${e.message}`, "error");
  }
}

export function adoptMergedTheoryDraft(index) {
  const drafts = AppState.theoryMergeDrafts || [];
  const draft = drafts[index];
  if (!draft) return;

  const data = getCurrentAnswerData();
  // 기존 소스 이론 제거 후 병합 이론 추가
  data.theories = (data.theories || []).filter((t) => !draft.sourceIds.includes(t.id));
  const newId = `TH-MERGE-${Date.now()}`;
  data.theories.push({ ...draft, id: newId, sourceIds: draft.sourceIds });
  syncJsonAndRender(data, `${newId} 병합 이론 초안을 추가했습니다.`);
}

// ──── 이론 항목 CRUD ──────────────────────────────────────────

function getTheoryFieldValue(legacyId, studioId) {
  const el = document.getElementById(studioId) || document.getElementById(legacyId);
  return el ? el.value : "";
}
function setTheoryFieldValue(legacyId, studioId, value) {
  const el = document.getElementById(studioId) || document.getElementById(legacyId);
  if (el) el.value = value;
}

export function upsertTheoryEntry() {
  const title = getTheoryFieldValue("newTTitle", "studio-t-title");
  const category = getTheoryFieldValue("newTCategory", "studio-t-category");
  const content = getTheoryFieldValue("newTContent", "studio-t-content");
  const tags = getTheoryFieldValue("newTTags", "studio-t-tags").split(",").map((s) => s.trim()).filter(Boolean);
  const source = getTheoryFieldValue("newTSource", "studio-t-source");
  const examRound = getTheoryFieldValue("newTRound", "studio-t-round");
  const editingIdEl = document.getElementById("editingTheoryIndex") || document.getElementById("studio-t-editingIndex");
  const editingId = editingIdEl ? editingIdEl.value : "";

  if (!title) { alert("이론 제목을 입력하세요."); return; }

  const data = getCurrentAnswerData();
  if (editingId) {
    const idx = data.theories.findIndex((t) => t.id === editingId);
    if (idx !== -1) {
      data.theories[idx] = { ...data.theories[idx], title, category, content, tags, source, examRound };
      syncJsonAndRender(data, `${editingId} 이론이 수정되었습니다.`);
      if (editingIdEl) editingIdEl.value = "";
      return;
    }
  }
  const newId = `TH-${String((data.theories.length || 0) + 1).padStart(3, "0")}`;
  data.theories.push({ id: newId, title, category, content, tags, source, examRound });
  syncJsonAndRender(data, `${newId} 이론이 추가되었습니다.`);
}

export function editTheoryEntry(index) {
  const data = getCurrentAnswerData();
  const theory = data.theories[index];
  if (!theory) return;
  setTheoryFieldValue("newTTitle", "studio-t-title", theory.title || "");
  setTheoryFieldValue("newTCategory", "studio-t-category", theory.category || "");
  setTheoryFieldValue("newTContent", "studio-t-content", theory.content || "");
  setTheoryFieldValue("newTTags", "studio-t-tags", (theory.tags || []).join(", "));
  setTheoryFieldValue("newTSource", "studio-t-source", theory.source || "");
  setTheoryFieldValue("newTRound", "studio-t-round", theory.examRound || "");
  const editingIdEl = document.getElementById("editingTheoryIndex") || document.getElementById("studio-t-editingIndex");
  if (editingIdEl) editingIdEl.value = theory.id;
}

export function deleteTheoryEntry(index) {
  if (!confirm("정말 이 이론을 삭제하시겠습니까?")) return;
  const data = getCurrentAnswerData();
  const removed = data.theories.splice(index, 1)[0];
  syncJsonAndRender(data, `${removed?.id || "이론"} 항목을 삭제했습니다.`);
}

export function cancelTheoryEditMode() {
  const fields = ["newTTitle", "newTCategory", "newTContent", "newTTags", "newTSource", "newTRound"];
  fields.forEach((id) => { const el = document.getElementById(id); if (el) el.value = ""; });
  const editingIdEl = document.getElementById("editingTheoryIndex");
  if (editingIdEl) editingIdEl.value = "";
}

export function applyTheoryCleanup() {
  const data = getCurrentAnswerData();
  data.theories = (data.theories || []).map((t) => {
    t.content = String(t.content || "").replace(/\n{3,}/g, "\n\n").trim();
    t.tags = [...new Set((t.tags || []).map((tag) => tag.trim()).filter(Boolean))];
    return t;
  });
  syncJsonAndRender(data, "이론 정리 완료");
}

// ──── 이론 AI 아카이브 ─────────────────────────────────────────

export function setTheoryArchiveAiStatus(message, type = "info") {
  const el = document.getElementById("theoryArchiveAiStatus");
  if (el) el.textContent = message;
}

export function analyzeTheoryKnowledge() {
  setDataStatus("이론 분석 중...", "info");
  setTimeout(() => {
    const data = getCurrentAnswerData();
    const theories = data.theories || [];
    if (theories.length < 2) { setDataStatus("이론이 2개 이상 있어야 분석 가능합니다.", "error"); return; }
    generateTheoryMergeDrafts();
  }, 100);
}
