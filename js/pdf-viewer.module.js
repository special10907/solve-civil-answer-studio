import { Debug } from './utils.js';
import { AppState } from './app-state.js';
import UIStatus from './ui-status.module.js';
const { setPdfStatus, showToast } = UIStatus;
import { updateVisualOverlayBoxes, updateReviewerOverlayBoxes, renderReviewerList } from './pdf-ui.module.js';
import { initDragSelection } from './pdf-capture.module.js';

/**
 * PDF Viewer Module
 * Handles PDF document loading, page rendering (Visual & Reviewer),
 * zoom, and modal state management.
 */

export function flashPdfMessage(message, type = "info", duration = 1800) {
  const container = document.getElementById("pdfFlashMessageContainer") || document.body;
  const el = document.createElement("div");
  el.className = `fixed top-20 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 rounded-full shadow-2xl font-bold text-sm transform transition-all duration-300 scale-90 opacity-0 ${
    type === "success" ? "bg-emerald-600 text-white" : type === "error" ? "bg-rose-600 text-white" : "bg-slate-800 text-white"
  }`;
  el.innerHTML = `<i class="fas ${type === "success" ? "fa-check-circle" : type === "error" ? "fa-exclamation-triangle" : "fa-info-circle"} mr-2"></i>${message}`;
  container.appendChild(el);
  requestAnimationFrame(() => { el.classList.remove("scale-90", "opacity-0"); el.classList.add("scale-100", "opacity-100"); });
  setTimeout(() => {
    el.classList.add("scale-95", "opacity-0");
    setTimeout(() => el.remove(), 400);
  }, duration);
}

export async function extractTextFromPdfFile(file) {
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = async (e) => {
      try {
        const typedarray = new Uint8Array(e.target.result);
        const pdfjsLib = AppState.pdfjsLib || window.pdfjsLib;
        const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
        let fullText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          fullText += content.items.map(item => item.str).join(" ") + "\n\n";
        }
        resolve(fullText);
      } catch (err) { reject(err); }
    };
    reader.readAsArrayBuffer(file);
  });
}

export async function renderVisualPage(pageNum) {
  if (!AppState.visualPdfDoc || pageNum < 1 || pageNum > AppState.visualPdfDoc.numPages) return;
  AppState.visualCurrentPage = pageNum;
  
  const canvas = document.getElementById("pdfVisualCanvas");
  const overlay = document.getElementById("pdfVisualOverlay");
  if (!canvas || !overlay) return;

  try {
    const page = await AppState.visualPdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: AppState.pdfZoomLevel || 1.5 });
    AppState.currentVisualViewport = viewport;

    canvas.width = viewport.width; canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    
    if (AppState.visualRenderTask) AppState.visualRenderTask.cancel();
    AppState.visualRenderTask = page.render({ canvasContext: ctx, viewport });
    await AppState.visualRenderTask.promise;
    AppState.visualRenderTask = null;

    // 텍스트 캐싱
    if (!AppState.visualTextCache.find(c => c.page === pageNum)) {
      const textContent = await page.getTextContent();
      AppState.visualTextCache.push({
        page: pageNum,
        texts: textContent.items.map(it => ({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, h: it.height })),
        viewport: viewport
      });
    }

    updateVisualOverlayBoxes(pageNum, viewport);
    
    // 영역 지정(드래그) 리스너 초기화
    initDragSelection(overlay, viewport, pageNum);

    const pageInfo = document.getElementById("pdfVisualPageInfo");
    if (pageInfo) pageInfo.textContent = `${pageNum} / ${AppState.visualPdfDoc.numPages}`;
  } catch (err) {
    if (err.name !== "RenderingCancelledException") console.error("Render visual error:", err);
  }
}

export async function renderReviewerPdf(pageNum) {
  if (!AppState.visualPdfDoc) return;
  AppState.revCurrentPage = pageNum;
  const canvas = document.getElementById("revPdfCanvas");
  if (!canvas) return;

  try {
    const page = await AppState.visualPdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.2 });
    AppState.currentReviewerViewport = viewport;
    canvas.width = viewport.width; canvas.height = viewport.height;
    
    if (AppState.reviewerRenderTask) AppState.reviewerRenderTask.cancel();
    AppState.reviewerRenderTask = page.render({ canvasContext: canvas.getContext("2d"), viewport });
    await AppState.reviewerRenderTask.promise;
    AppState.reviewerRenderTask = null;

    updateReviewerOverlayBoxes(pageNum, viewport);
  } catch (err) { if (err.name !== "RenderingCancelledException") console.error("Render reviewer error:", err); }
}

export function openPdfVisualModal() {
  const modal = document.getElementById("pdfVisualModal");
  if (modal) {
    modal.classList.remove("hidden");
    if (AppState.visualPdfDoc) renderVisualPage(AppState.visualCurrentPage || 1);
  }
}

export function zoomIn() {
  AppState.pdfZoomLevel = Math.min(3.0, (AppState.pdfZoomLevel || 1.5) + 0.2);
  renderVisualPage(AppState.visualCurrentPage);
}

export function zoomOut() {
  AppState.pdfZoomLevel = Math.max(0.5, (AppState.pdfZoomLevel || 1.5) - 0.2);
  renderVisualPage(AppState.visualCurrentPage);
}

// ───── 전역 노출 ──────────────────────────────────────────────────────────
window.renderVisualPage = renderVisualPage;
window.renderReviewerPdf = renderReviewerPdf;
window.openPdfVisualModal = openPdfVisualModal;
