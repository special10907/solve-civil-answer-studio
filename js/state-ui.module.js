import { AppState } from './app-state.js';
import { escapeHtml, extractRoundOnly } from './utils.js';
import { renderMath } from './math-renderer.module.js';
import { evaluateOneAnswer } from './state-analysis.module.js';
import { normalizeData, getCurrentAnswerData } from './state-storage.module.js';
import UIStatus from './ui-status.module.js';
import UIBoost from './ui-boost.module.js';
const { setDataStatus } = UIStatus;
const { refreshAttachmentTargetOptions } = UIBoost;

/**
 * State UI Module
 * 담당: 답변/이론 목록 렌더링, 매니저 패널 UI, 필터/정렬 상태 관리
 */

// ──── 전역 상태 (UI용) ──────────────────────────────────────────

let lastEvaluationResults = []; // 로컬 캐싱

export function setLastEvaluationResults(results) {
  lastEvaluationResults = results;
  AppState.lastEvaluationResults = results;
}

// ──── 답변 목록 렌더링 ──────────────────────────────────────────

export function renderAnswerData(data) {
  const container = document.getElementById("answerList");
  if (!container) return;

  const normalized = normalizeData(data);
  const questions = normalized.questions;
  
  // 연관 UI 업데이트
  renderAnswerDataForManagerPanel(questions);
  renderTheoryData(normalized.theories);
  refreshAttachmentTargetOptions(questions);
  
  if (typeof window.updateFilterOptions === "function") window.updateFilterOptions(questions, normalized.theories);
  if (typeof window.updateRoundDashboard === "function") window.updateRoundDashboard(questions, normalized.theories);

  const filtered = (typeof window.getFilteredEntries === "function") 
    ? window.getFilteredEntries(questions) 
    : questions.map((q, i) => ({ item: q, index: i }));

  if (!filtered.length) {
    container.innerHTML = '<div class="text-sm text-slate-500 p-4">표시할 문제가 없습니다.</div>';
    return;
  }

  container.innerHTML = filtered.map(({ item, index }) => {
    const tags = Array.isArray(item.tags) ? item.tags : [];
    const safeAnswer = escapeHtml(item.modelAnswer || "").replaceAll("\n", "<br>");
    const hasImage = !!item.imageUrl;
    
    return `
      <article class="border border-slate-200 rounded-lg p-4 bg-white shadow-sm hover:border-indigo-300 transition-colors">
        <div class="flex items-center justify-between gap-3">
          <h4 class="font-bold text-slate-800">${escapeHtml(item.id)}. ${escapeHtml(item.title)}</h4>
          <span class="text-[10px] px-2 py-1 rounded ${item.reviewed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"} font-medium">
            ${item.reviewed ? "검토완료" : "검토필요"}
          </span>
        </div>
        <div class="mt-1 text-[11px] text-indigo-500 font-medium">회차: ${escapeHtml(item.examRound || "미지정")}</div>
        <div class="mt-2 flex flex-wrap gap-1">
          ${tags.map(t => `<span class="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">${escapeHtml(t)}</span>`).join("")}
        </div>
        <div class="mt-3 text-sm text-slate-700 leading-relaxed math-container">${safeAnswer}</div>
        ${hasImage ? `<div class="mt-3"><img src="${escapeHtml(item.imageUrl)}" class="max-w-full rounded border border-slate-200"></div>` : ""}
        <div class="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between">
          <div class="text-[10px] text-slate-400">Source: ${escapeHtml(item.source || "-")}</div>
          <div class="flex gap-2">
            <button onclick="editModelAnswerEntry(${index})" class="text-[11px] text-blue-600 hover:text-blue-800">수정</button>
            <button onclick="openDeleteConfirmModal(${index})" class="text-[11px] text-rose-600 hover:text-rose-800">삭제</button>
          </div>
        </div>
      </article>
    `;
  }).join("");

  // 수식 렌더링
  renderMath(container);
  
  if (typeof window.evaluateRenderedAnswers === "function") window.evaluateRenderedAnswers(normalized, false);
}

// ──── 이론 목록 렌더링 ──────────────────────────────────────────

export function renderTheoryData(theories) {
  const container = document.getElementById("theoryList");
  renderTheoryDataForPdfPanel(theories);
  if (!container) return;

  if (!Array.isArray(theories) || !theories.length) {
    container.innerHTML = '<div class="text-sm text-slate-500 p-4">등록된 이론이 없습니다.</div>';
    return;
  }

  container.innerHTML = theories.map((t, idx) => {
    const tags = Array.isArray(t.tags) ? t.tags : [];
    return `
      <article class="border border-slate-200 rounded-lg p-4 bg-white hover:border-indigo-200 transition-all">
        <div class="flex items-center justify-between">
          <h4 class="font-bold text-slate-800">${escapeHtml(t.id)}. ${escapeHtml(t.title)}</h4>
          <div class="flex gap-2">
            <button onclick="editTheoryEntry(${idx})" class="p-1 hover:bg-slate-100 rounded"><i class="fas fa-edit text-slate-400 hover:text-blue-500"></i></button>
            <button onclick="deleteTheoryEntry(${idx})" class="p-1 hover:bg-slate-100 rounded"><i class="fas fa-trash text-slate-400 hover:text-rose-500"></i></button>
          </div>
        </div>
        <div class="text-[11px] text-indigo-500 flex gap-2 mt-1">
          <span>${escapeHtml(t.examRound || "미지정")}</span>
          <span class="text-slate-300">|</span>
          <span>${escapeHtml(t.category || "일반")}</span>
        </div>
        <div class="mt-2 flex flex-wrap gap-1">
          ${tags.map(tag => `<span class="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">${escapeHtml(tag)}</span>`).join("")}
        </div>
        <p class="mt-3 text-sm text-slate-600 leading-relaxed">${escapeHtml(t.content || "").replaceAll("\n", "<br>")}</p>
      </article>
    `;
  }).join("");
  
  // 수식 렌더링
  renderMath(container);
}

export function renderTheoryDataForPdfPanel(theories) {
    // PDF 패널 내 이론 리스트 렌더링 (단순화 버전)
    const listEl = document.getElementById("theoryManagerPdfTheoryList");
    if (!listEl) return;
    listEl.innerHTML = theories.slice(0, 10).map(t => `<div class="p-2 border-b text-xs">${t.title}</div>`).join("");
}

// ──── 폼 리셋 및 모달 제어 ──────────────────────────────────────

export function resetEntryForm() {
  const safeSet = (id, val) => {
    const el = document.getElementById(id);
    if (el) {
      if (el.type === "checkbox") el.checked = !!val;
      else el.value = val;
    }
  };
  ["newQRound", "newQId", "newQTitle", "newQTags", "newQSource", "newQAnswer", "newQDraftPlan", "studio-q-draftPlan", "editingIndex"].forEach(id => safeSet(id, ""));
  safeSet("newQReviewed", false);

  const submitBtn = document.getElementById("entrySubmitBtn") || document.getElementById("studio-questions-submit-btn");
  if (submitBtn) submitBtn.textContent = "모범답안 추가";
}

let pendingDeleteIndex = -1;
export function openDeleteConfirmModal(index) {
  pendingDeleteIndex = index;
  const modal = document.getElementById("deleteConfirmModal");
  if (modal) { modal.classList.remove("hidden"); modal.classList.add("flex"); }
}

export function closeDeleteConfirmModal() {
  pendingDeleteIndex = -1;
  const modal = document.getElementById("deleteConfirmModal");
  if (modal) { modal.classList.add("hidden"); modal.classList.remove("flex"); }
}

export function confirmDeleteModelAnswerEntry() {
  if (pendingDeleteIndex < 0) { closeDeleteConfirmModal(); return; }
  // 실제 삭제는 storage/storage-theory 등에서 함 (여기선 UI 클로저만)
  if (typeof window.deleteModelAnswerEntry === "function") window.deleteModelAnswerEntry(pendingDeleteIndex);
  closeDeleteConfirmModal();
}

export function editModelAnswerEntry(index) {
  const data = getCurrentAnswerData();
  const target = data.questions[index];
  if (!target) return;

  const setValue = (lId, sId, val) => {
    const el = document.getElementById(lId) || document.getElementById(sId);
    if (el) el.value = val;
  };

  setValue("newQId", "studio-q-id", target.id || "");
  setValue("newQRound", "studio-q-examRound", target.examRound || "");
  setValue("newQTitle", "studio-q-title", target.title || "");
  setValue("newQTags", "studio-q-tags", (target.tags || []).join(", "));
  setValue("newQSource", "studio-q-source", target.source || "");
  setValue("newQAnswer", "studio-q-modelAnswer", target.modelAnswer || "");
  setValue("newQDraftPlan", "studio-q-draftPlan", target.draftPlan || "");

  const editingIdxEl = document.getElementById("editingIndex") || document.getElementById("editing-questions-index");
  if (editingIdxEl) editingIdxEl.value = String(index);

  const submitBtn = document.getElementById("entrySubmitBtn") || document.getElementById("studio-questions-submit-btn");
  if (submitBtn) submitBtn.textContent = "모범답안 수정 저장";

  setDataStatus(`수정 모드: ${target.id} 항목을 편집 중입니다.`, "info");
}
