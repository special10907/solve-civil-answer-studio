import { AppState } from './app-state.js';
import UIStatus from './ui-status.module.js';
const { setPdfStatus, showToast } = UIStatus;
import { 
  groupTextItems, 
  classifyManualContentMode, 
  getContentModeLabel,
  getActiveCaptureImagePayload,
  getDesignatedReferenceImagePayload
} from './pdf-capture.module.js';

/**
 * PDF UI Module
 * Handles overlay rendering, list updates, reviewer controls,
 * focus, highlight synchronization, and box transformations (move/resize).
 */

// ──── 오버레이 박스 렌더링 ────────────────────────────────────────────────

export function updateVisualOverlayBoxes(pageNum, viewport) {
  if (!viewport || window._isUpdatingOverlay) return;
  window._isUpdatingOverlay = true;

  try {
    const overlay = document.getElementById("pdfVisualOverlay");
    if (!overlay) return;

    overlay.style.width = `${viewport.width}px`;
    overlay.style.height = `${viewport.height}px`;
    overlay.innerHTML = "";

    const questions = AppState.currentReviewingQuestions || [];
    questions.forEach((q, idx) => {
      if (!q.rect || q.rect.page !== pageNum) return;
      const isSelected = AppState.selectedBoxIds?.includes(q.id);

      const rect = document.createElement("div");
      rect.className = `absolute border-2 rounded transition-all group-box group animate-fade-in ${
        isSelected ? "border-orange-500 glass-selection glow-active ring-2 z-50 shadow-2xl" : "border-blue-600 bg-blue-500/10 hover:bg-blue-500/25 glass-selection cursor-move z-40"
      }`;
      rect.dataset.qId = q.id;

      const [vx1, vy1, vx2, vy2] = viewport.convertToViewportRectangle([
        q.rect.x, q.rect.y, q.rect.x + q.rect.w, q.rect.y + q.rect.h
      ]);
      const vx = Math.min(vx1, vx2), vy = Math.min(vy1, vy2);
      const vw = Math.abs(vx2 - vx1), vh = Math.abs(vy2 - vy1);

      rect.style.left = `${vx}px`; rect.style.top = `${vy}px`;
      rect.style.width = `${vw}px`; rect.style.height = `${vh}px`;

      rect.onclick = (e) => {
        e.stopPropagation();
        AppState.selectedBoxIds = [q.id];
        updateVisualOverlayBoxes(pageNum, viewport);
        scrollReviewerListItemIntoView(q.id);
      };

      if (isSelected) addResizeHandles(rect, q.id, viewport);
      
      rect.onmousedown = (e) => {
        if (e.button !== 0 || e.target !== rect) return;
        e.preventDefault(); e.stopPropagation();
        startBoxMove(e, q.id, viewport);
      };

      overlay.appendChild(rect);
    });
  } finally {
    window._isUpdatingOverlay = false;
  }
}

export function updateReviewerOverlayBoxes(pageNum, viewport) {
  if (!viewport || window._isUpdatingReviewerOverlay) return;
  window._isUpdatingReviewerOverlay = true;

  try {
    const overlay = document.getElementById("revPdfOverlay");
    if (!overlay) return;

    overlay.style.width = `${viewport.width}px`;
    overlay.style.height = `${viewport.height}px`;
    overlay.innerHTML = "";

    const questions = AppState.currentReviewingQuestions || [];
    questions.forEach((q) => {
      if (!q.rect || q.rect.page !== pageNum) return;
      
      const rect = document.createElement("div");
      rect.className = "absolute border-2 border-blue-600 bg-blue-500/10 rounded transition-all z-40";
      
      const [vx1, vy1, vx2, vy2] = viewport.convertToViewportRectangle([
        q.rect.x, q.rect.y, q.rect.x + q.rect.w, q.rect.y + q.rect.h
      ]);
      const vx = Math.min(vx1, vx2), vy = Math.min(vy1, vy2);
      const vw = Math.abs(vx2 - vx1), vh = Math.abs(vy2 - vy1);

      rect.style.left = `${vx}px`; rect.style.top = `${vy}px`;
      rect.style.width = `${vw}px`; rect.style.height = `${vh}px`;
      overlay.appendChild(rect);
    });
  } finally {
    window._isUpdatingReviewerOverlay = false;
  }
}

// ──── 문항 리스트 렌더링 ──────────────────────────────────────────────────

export function renderReviewerList(questions) {
  const container = document.getElementById("reviewer-list-container");
  if (!container) return;

  const lowConfidenceOnly = !!AppState.lowConfidenceOnly;
  const targetPage = AppState.visualCurrentPage;
  
  const filtered = questions.filter(q => !q.rect || q.rect.page === targetPage);
  const visible = lowConfidenceOnly ? filtered.filter(q => (q.analysisConfidence || 0) < 0.7) : filtered;

  container.innerHTML = visible.length ? visible.map((q, i) => `
    <div data-q-id="${q.id}" 
         class="group p-3 border rounded-lg mb-2 cursor-pointer transition-all reviewer-list-item ${AppState.selectedBoxIds?.includes(q.id) ? 'ring-2 ring-indigo-300 border-indigo-400 bg-indigo-50' : 'bg-white border-slate-200'}"
         onmouseenter="window.setHoverHighlight('${q.id}', true)" 
         onmouseleave="window.setHoverHighlight('${q.id}', false)"
         onclick="window.highlightQuestionOnPdf(${questions.indexOf(q)})">
      <div class="flex justify-between items-start">
        <h5 class="text-sm font-bold text-slate-800">${q.title || "제목없음"}</h5>
        <div class="flex items-center gap-2">
          <button onclick="event.stopPropagation(); window.deleteCapturedQuestion('${q.id}')" 
                  class="opacity-0 group-hover:opacity-100 p-1 text-rose-400 hover:text-rose-600 transition-all" 
                  title="삭제">
            <i class="fas fa-trash-alt text-[10px]"></i>
          </button>
          <span class="text-[10px] text-slate-400">#${questions.indexOf(q) + 1}</span>
        </div>
      </div>
      <div class="mt-1 text-[10px] text-indigo-600">${q.examRound || ""}</div>
    </div>
  `).join("") : `<p class="text-center text-slate-400 py-10 text-xs">문항이 없습니다.</p>`;

  if (typeof updateModalNavigation === 'function') updateModalNavigation();
}

// ──── 박스 조작 (Move/Resize) ──────────────────────────────────────────

export function addResizeHandles(box, qId, viewport) {
  const handles = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
  handles.forEach((type) => {
    const h = document.createElement("div");
    h.className = `absolute bg-orange-600 border border-white handle-${type} resizer z-50`;
    h.style.width = "10px"; h.style.height = "10px"; h.style.cursor = `${type}-resize`;
    
    if (type.includes("n")) h.style.top = "-5px";
    if (type.includes("s")) h.style.bottom = "-5px";
    if (type.includes("w")) h.style.left = "-5px";
    if (type.includes("e")) h.style.right = "-5px";
    if (type === "n" || type === "s") h.style.left = "calc(50% - 5px)";
    if (type === "w" || type === "e") h.style.top = "calc(50% - 5px)";

    h.onmousedown = (e) => {
      e.preventDefault(); e.stopPropagation();
      startBoxResize(e, qId, type, viewport);
    };
    box.appendChild(h);
  });
}

function startBoxMove(e, qId, viewport) {
  window.activeQuestionId = qId;
  window.activeHandleType = "move";
  window.activeViewport = viewport;
  window.mouseInitialPos = { x: e.clientX, y: e.clientY };
  const q = AppState.currentReviewingQuestions.find(it => it.id === qId);
  if (q) window.boxInitialPos = JSON.parse(JSON.stringify(q.rect));
  
  document.addEventListener("mousemove", handleMouseInteraction);
  document.addEventListener("mouseup", endMouseInteraction);
}

function startBoxResize(e, qId, type, viewport) {
  window.activeQuestionId = qId;
  window.activeHandleType = type;
  window.activeViewport = viewport;
  window.mouseInitialPos = { x: e.clientX, y: e.clientY };
  const q = AppState.currentReviewingQuestions.find(it => it.id === qId);
  if (q) window.boxInitialPos = JSON.parse(JSON.stringify(q.rect));

  document.addEventListener("mousemove", handleMouseInteraction);
  document.addEventListener("mouseup", endMouseInteraction);
}

function handleMouseInteraction(e) {
  if (!window.activeQuestionId || !window.activeViewport) return;
  const q = AppState.currentReviewingQuestions.find(it => it.id === window.activeQuestionId);
  if (!q?.rect) return;

  const dx = e.clientX - window.mouseInitialPos.x;
  const dy = e.clientY - window.mouseInitialPos.y;

  const [vStartX, vStartY] = window.activeViewport.convertToViewportPoint(window.boxInitialPos.x, window.boxInitialPos.y);
  const [newPdfX, newPdfY] = window.activeViewport.convertToPdfPoint(vStartX + dx, vStartY + dy);
  
  const pdfDx = newPdfX - window.boxInitialPos.x;
  const pdfDy = newPdfY - window.boxInitialPos.y;

  if (window.activeHandleType === "move") {
    q.rect.x = window.boxInitialPos.x + pdfDx;
    q.rect.y = window.boxInitialPos.y + pdfDy;
  } else {
    const type = window.activeHandleType;
    if (type.includes("n")) q.rect.h = Math.max(5, newPdfY - window.boxInitialPos.y);
    if (type.includes("s")) {
      const h = window.boxInitialPos.y + window.boxInitialPos.h - newPdfY;
      if (h > 5) { q.rect.y = newPdfY; q.rect.h = h; }
    }
    if (type.includes("e")) q.rect.w = Math.max(5, newPdfX - window.boxInitialPos.x);
    if (type.includes("w")) {
      const w = window.boxInitialPos.x + window.boxInitialPos.w - newPdfX;
      if (w > 5) { q.rect.x = newPdfX; q.rect.w = w; }
    }
  }

  const nodes = document.querySelectorAll(`[data-q-id="${window.activeQuestionId}"]`);
  const [vx1, vy1, vx2, vy2] = window.activeViewport.convertToViewportRectangle([q.rect.x, q.rect.y, q.rect.x+q.rect.w, q.rect.y+q.rect.h]);
  nodes.forEach(node => {
    if (!node.classList.contains("group-box")) return;
    node.style.left = `${Math.min(vx1, vx2)}px`; node.style.top = `${Math.min(vy1, vy2)}px`;
    node.style.width = `${Math.abs(vx2-vx1)}px`; node.style.height = `${Math.abs(vy2-vy1)}px`;
  });
}

function endMouseInteraction() {
  if (window.activeQuestionId) {
    if (typeof window.syncJsonAndRender === 'function') window.syncJsonAndRender(window.getCurrentAnswerData(), "영역 수정됨", true);
  }
  window.activeQuestionId = null;
  document.removeEventListener("mousemove", handleMouseInteraction);
  document.removeEventListener("mouseup", endMouseInteraction);
}

// ──── 기타 UI 제어 ────────────────────────────────────────────────────────

export function scrollReviewerListItemIntoView(qId) {
  const item = document.querySelector(`.reviewer-list-item[data-q-id="${qId}"]`);
  if (item) item.scrollIntoView({ behavior: "smooth", block: "center" });
}

export function setHoverHighlight(qId, isHover) {
  const boxes = document.querySelectorAll(`.group-box[data-q-id="${qId}"]`);
  boxes.forEach(b => b.classList.toggle("ring-4", isHover));
  const items = document.querySelectorAll(`.reviewer-list-item[data-q-id="${qId}"]`);
  items.forEach(it => it.classList.toggle("bg-blue-50", isHover));
}

export function syncAddAreaButtonState(btn, enabled) {
  if (!btn) return;
  btn.classList.toggle("bg-blue-600", enabled);
  btn.classList.toggle("text-white", enabled);
  const icon = btn.querySelector("i");
  if (icon) icon.className = enabled ? "fas fa-draw-polygon" : "fas fa-plus";
}

export function updateManualContentModeBadge(text = null) {
  const badge = document.getElementById("manualContentModeBadge");
  if (!badge) return;
  const t = text !== null ? text : document.getElementById("manualInputText")?.value || "";
  const media = getActiveCaptureImagePayload();
  const ref = getDesignatedReferenceImagePayload();
  const verdict = classifyManualContentMode(t, media, ref);
  badge.textContent = `모드: ${getContentModeLabel(verdict.mode)} (T:${verdict.textLen})`;
  badge.className = "text-[10px] px-2 py-1 rounded border " + (verdict.mode === 'text' ? "bg-sky-50" : verdict.mode === 'image' ? "bg-amber-50" : "bg-violet-50");
  badge.classList.remove("hidden");
}

// ───── 전역 노출 ──────────────────────────────────────────────────────────
window.setHoverHighlight = setHoverHighlight;
window.highlightQuestionOnPdf = (idx) => {
  const q = AppState.currentReviewingQuestions[idx];
  if (q?.rect) {
    AppState.visualCurrentPage = q.rect.page;
    if (typeof window.renderVisualPage === 'function') window.renderVisualPage(q.rect.page);
  }
};
