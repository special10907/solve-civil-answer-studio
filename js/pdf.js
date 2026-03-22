import { AppState } from './app-state.js';
import UIStatus from './ui-status.module.js';
const { setPdfStatus, showToast } = UIStatus;

import {
  flashPdfMessage,
  extractTextFromPdfFile,
  renderVisualPage,
  renderReviewerPdf,
  openPdfVisualModal,
  zoomIn,
  zoomOut
} from './pdf-viewer.module.js';

import {
  groupTextItems,
  extractSelectionImagePayload,
  extractSelectionTextFromBlocks,
  initDragSelection,
  ensureTesseractAvailable,
  extractTextByOcrFromImage,
  captureManualQuestion,
  markCurrentAreaAsImage,
  analyzeCurrentArea,
  commitAreaToList,
  generateDraftForCurrentArea
} from './pdf-capture.module.js';

import {
  updateVisualOverlayBoxes,
  updateReviewerOverlayBoxes,
  renderReviewerList,
  scrollReviewerListItemIntoView,
  setHoverHighlight,
  syncAddAreaButtonState,
  updateManualContentModeBadge
} from './pdf-ui.module.js';

/**
 * PDF Module Entry Point (pdf.js)
 */

window.PdfModules = {
  viewer: { flashPdfMessage, extractTextFromPdfFile, renderVisualPage, renderReviewerPdf, openPdfVisualModal, zoomIn, zoomOut },
  capture: { groupTextItems, extractSelectionImagePayload, extractSelectionTextFromBlocks, initDragSelection, ensureTesseractAvailable, extractTextByOcrFromImage, captureManualQuestion, markCurrentAreaAsImage, analyzeCurrentArea, commitAreaToList, generateDraftForCurrentArea },
  ui: { updateVisualOverlayBoxes, updateReviewerOverlayBoxes, renderReviewerList, scrollReviewerListItemIntoView, setHoverHighlight, syncAddAreaButtonState, updateManualContentModeBadge }
};

window.flashPdfMessage = flashPdfMessage;
window.renderVisualPage = renderVisualPage;
window.renderReviewerPdf = renderReviewerPdf;
window.openPdfVisualModal = openPdfVisualModal;
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;

window.captureManualQuestion = captureManualQuestion;
window.markCurrentAreaAsImage = markCurrentAreaAsImage;
window.analyzeCurrentArea = analyzeCurrentArea;
window.commitAreaToList = commitAreaToList;
window.generateDraftForCurrentArea = generateDraftForCurrentArea;

window.updateVisualOverlayBoxes = updateVisualOverlayBoxes;
window.renderReviewerList = renderReviewerList;
window.setHoverHighlight = setHoverHighlight;
window.updateManualContentModeBadge = updateManualContentModeBadge;

window.bindAddAreaButton = internal_bindAddAreaButton;

/**
 * 지정된 인덱스의 캡처 문항 삭제
 */
window.deleteCapturedQuestion = (qId) => {
  if (!confirm("이 캡처 영역을 삭제하시겠습니까?")) return;
  AppState.currentReviewingQuestions = AppState.currentReviewingQuestions.filter(q => q.id !== qId);
  if (AppState.selectedBoxIds?.includes(qId)) AppState.selectedBoxIds = [];
  
  const page = AppState.visualCurrentPage;
  const viewport = AppState.currentVisualViewport;
  if (window.renderVisualPage) window.renderVisualPage(page); // Re-render overlay
  if (window.renderReviewerList) window.renderReviewerList(AppState.currentReviewingQuestions);
  showToast("캡처 영역 삭제됨", "info");
};

/**
 * 전역 영역 지정 버튼 활성화 함수 (pdf.js 고유 로직)
 */
function internal_bindAddAreaButton() {
  const btn = document.getElementById("addAreaBtn");
  if (!btn || btn.dataset.boundAddArea === "1") return;
  btn.dataset.boundAddArea = "1";
  
  btn.addEventListener("click", (e) => {
    e.preventDefault(); e.stopPropagation();
    AppState.isAddAreaMode = !AppState.isAddAreaMode;
    syncAddAreaButtonState(btn, AppState.isAddAreaMode);
    
    const overlay = document.getElementById("pdfVisualOverlay");
    if (overlay) overlay.style.cursor = AppState.isAddAreaMode ? "crosshair" : "default";
    
    flashPdfMessage(AppState.isAddAreaMode ? "영역 지정 모드 ON" : "영역 지정 모드 OFF", "info");
  });
}

// PDF 파일 입력 리스너 (IIFE)
(function pdfInputInit() {
  const setup = () => {
    internal_bindAddAreaButton();
    const input = document.getElementById("studio-pdf-input");
    if (!input || input.dataset.bound === "1") return;
    input.dataset.bound = "1";

    input.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file || !file.name.toLowerCase().endsWith(".pdf")) return;

      setPdfStatus(`'${file.name}' 로드 중...`, "info");
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfjsLib = AppState.pdfjsLib || window.pdfjsLib;
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
        
        AppState.visualPdfDoc = pdf;
        AppState.visualCurrentPage = 1;
        AppState.visualTextCache = [];
        
        if (typeof window.showSection === 'function') window.showSection("studio");
        openPdfVisualModal();
        setPdfStatus(`${file.name} 로드 완료`, "success");
      } catch (err) {
        console.error("PDF Load Error:", err);
        setPdfStatus("PDF 로드 실패", "error");
      }
      e.target.value = "";
    });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setup);
  else setup();
})();

// Named export mapping
export {
  renderReviewerPdf, renderReviewerList, openPdfVisualModal,
  captureManualQuestion, markCurrentAreaAsImage, analyzeCurrentArea,
  commitAreaToList, generateDraftForCurrentArea, 
  internal_bindAddAreaButton as bindAddAreaButton,
  zoomIn, zoomOut
};
