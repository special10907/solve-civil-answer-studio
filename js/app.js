import { 
  runAutoPipeline, getSafeStorage, setBackendStatus, updateAiModeUx, 
  detectLmStudioModelId, AI_ENDPOINT_STORAGE_KEY, applyAiPreset, 
  isLikelyLmStudioEndpoint, loadAiPresets,
  extractQuestionsFromPdfText, generateDraftAnswersByApi, 
  generateDraftAnswersByLmStudioLocal,
  generateDraftAnswersLocal, checkBackendConnection,
  generateDraftAnswersByActiveModel,
  setLmStudioLocalPreset
} from './api.js';

import { CHART_LABELS, CHART_COLORS, CHART_DATA } from './app-config.js';
import { getEl } from './dom-utils.js';
import UI from './ui.js';
import { AppState } from './app-state.js';
import {
  applyAnswerFilters,
  updateGlobalRoundLabels,
  saveAnswerData,
  loadAnswerData,
  evaluateRenderedAnswers,
  analyzeTheoryKnowledge,
  exportAnswerDataToFile,
  openImportFileDialog,
  importAnswerDataFromFile,
  analyzeTheoryArchiveFiles,
  clearTheoryArchiveAiPanel
} from './state.js';
import {
  renderReviewerPdf,
  renderReviewerList,
  captureManualQuestion,
  markCurrentAreaAsImage,
  analyzeCurrentArea,
  commitAreaToList,
  generateDraftForCurrentArea,
  bindAddAreaButton,
  zoomIn,
  zoomOut
} from './pdf.js';
import {
  syncAddAreaButtonState,
} from './pdf-ui.module.js';
import Studio from './studio.js';

/**
 * SolveCivil Answer Studio - App Entry Point (app.js)
 */

window.Studio = Studio;

const safeAddListener = (id, event, handler) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener(event, handler);
};

// --- Initialization ---

function initDashboardMiniCharts() {
  const examDash = getEl("examDistChart-dash");
  if (examDash) {
    new Chart(examDash.getContext("2d"), {
      type: "doughnut",
      data: {
        labels: CHART_LABELS.examDist,
        datasets: [{ data: CHART_DATA.examDist, backgroundColor: CHART_COLORS.examDist, borderWidth: 0 }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
    });
  }
  
  const stratDash = getEl("strategyChart-dash");
  if (stratDash) {
    new Chart(stratDash.getContext("2d"), {
      type: "radar",
      data: {
        labels: CHART_LABELS.strategyDash,
        datasets: [
          {
            label: "나의 스탯",
            data: CHART_DATA.myStats,
            fill: true,
            backgroundColor: CHART_COLORS.myStats.background,
            borderColor: CHART_COLORS.myStats.border,
            pointBackgroundColor: CHART_COLORS.myStats.point,
            pointBorderColor: "#fff",
          },
          {
            label: "상위 10%",
            data: CHART_DATA.top10,
            fill: true,
            backgroundColor: CHART_COLORS.top10.background,
            borderColor: CHART_COLORS.top10.border,
            pointBackgroundColor: CHART_COLORS.top10.point,
            pointBorderColor: "#fff",
          }
        ],
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { r: { suggestedMin: 0, suggestedMax: 100 } }, plugins: { legend: { display: false } } },
    });
  }
}

function initEventListeners() {
  // Navigation
  ["navDash", "navAnalysis", "navStudio", "navTheory", "navAnswer"].forEach(id => {
    safeAddListener(id, "click", (e) => {
      const target = e.currentTarget.getAttribute("data-target");
      UI.showSection(target);
    });
  });

  // Utils
  safeAddListener("btnRefreshModels", "click", UI.refreshModelList);
  safeAddListener("btnUploadPdf", "click", () => getEl("studio-pdf-input").click());
  safeAddListener("extractBtn", "click", extractQuestionsFromPdfText);
  safeAddListener("btnToggleView", "click", UI.toggleViewMode);
  safeAddListener("btnToggleDark", "click", UI.toggleDarkMode);
  
  // PDF
  safeAddListener("btnZoomIn", "click", zoomIn);
  safeAddListener("btnZoomOut", "click", zoomOut);
  
  // Studio
  safeAddListener("btnStudioTabAnswers", "click", () => Studio.switchTab('answers'));
  safeAddListener("btnStudioTabTheory", "click", () => Studio.switchTab('theory'));
  safeAddListener("studio-questions-submit-btn", "click", () => Studio.saveEntry('questions'));
  safeAddListener("btnGenerateDocx", "click", () => Studio.generateProfessionalDocx());
  safeAddListener("applyAttachmentInsightBtn", "click", UI.applyAttachmentInsightToQuestion);
  
  // Analysis/Theory
  safeAddListener("btnEvaluateAnswers", "click", evaluateRenderedAnswers);
  safeAddListener("btnTheoryArchiveAnalyze", "click", analyzeTheoryArchiveFiles);
  safeAddListener("btnTheoryArchiveClear", "click", clearTheoryArchiveAiPanel);
  safeAddListener("btnTheorySave", "click", () => Studio.saveEntry('theories'));
  safeAddListener("btnTheoryDuplicateAnalyze", "click", analyzeTheoryKnowledge);
  
  // Area
  safeAddListener("btnAreaImage", "click", markCurrentAreaAsImage);
  safeAddListener("btnAreaAnalyze", "click", analyzeCurrentArea);
  safeAddListener("btnAreaCommit", "click", commitAreaToList);
  safeAddListener("btnAreaDraft", "click", generateDraftForCurrentArea);

  // Generic Tabs
  document.querySelectorAll('[data-action="switchTab"]').forEach(el => {
    el.addEventListener("click", (e) => UI.switchTab(e.currentTarget.getAttribute("data-target")));
  });

  // Modal Buttons (Shared)
  safeAddListener("btnDeleteConfirmClose", "click", () => {
    if (window.closeDeleteConfirmModal) window.closeDeleteConfirmModal();
    const modal = document.getElementById("deleteConfirmModal");
    if (modal) modal.classList.add("hidden");
  });

  safeAddListener("btnDeleteConfirmOk", "click", () => {
    // 1. Studio 삭제 건 확인
    if (window._pendingStudioDeleteType && typeof window.StudioModules?.UI?.deleteEntry === "function") {
      const type = window._pendingStudioDeleteType;
      const index = window._pendingStudioDeleteIndex;
      window._pendingStudioDeleteType = null; // Clear
      
      const data = typeof window.getCurrentAnswerData === "function" ? window.getCurrentAnswerData() : { questions: [], theories: [] };
      const removed = (data[type] || []).splice(index, 1)[0];
      if (window.syncJsonAndRender) window.syncJsonAndRender(data, `${removed.id} 삭제 완료`);
      
      const modal = document.getElementById("deleteConfirmModal");
      if (modal) modal.classList.add("hidden");
    } 
    // 2. 모범답안 매니저 삭제 건 확인
    else if (window.confirmDeleteModelAnswerEntry) {
      window.confirmDeleteModelAnswerEntry();
    }
  });

  UI.init();
  UI.initAttachmentWebsiteControls();
  UI.initAttachmentBoostButtonStateSync();
  UI.initReviewerControls();
  
  if (Studio && typeof Studio.init === "function") Studio.init();
  loadAnswerData();
}

// Global Events
safeAddListener("filterKeyword", "input", applyAnswerFilters);
safeAddListener("globalRoundSelect", "change", (e) => {
  const selected = e.target.value;
  const filterRound = getEl("filterRound");
  if (filterRound) {
    filterRound.value = selected;
    updateGlobalRoundLabels(selected);
    applyAnswerFilters();
  }
});

// Run
initDashboardMiniCharts();
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initEventListeners);
} else {
  initEventListeners();
}
