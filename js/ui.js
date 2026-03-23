import { getEl } from './dom-utils.js';
import { Debug, escapeHtml } from './utils.js';
import { AppState } from './app-state.js';

// 하위 모듈 임포트
import UIStatus from './ui-status.module.js';
import UINav from './ui-nav.module.js';
import UIChart from './ui-chart.module.js';
import UIBoost from './ui-boost.module.js';

/**
 * SolveCivil Answer Studio - Core UI Module (Entry Point)
 */

export function initUI() {
  console.log("UI Module init: Sub-module architecture");
  UINav.exposeGlobal();
  UIStatus.exposeGlobal();
  UIChart.exposeGlobal();
  UIBoost.exposeGlobal();
  
  // Expose local methods to window for Safety Bridge / Legacy support
  window.initAttachmentWebsiteControls = initAttachmentWebsiteControls;
  window.initReviewerControls = initReviewerControls;
  window.deleteSelectedGlobalRound = deleteSelectedGlobalRound;
  window.refreshModelList = refreshModelList;
  window.evaluateRoundQuality = evaluateRoundQuality;
  window.initUI = initUI;

  if (typeof window.initTheme === 'function') window.initTheme();
}

// ──── 개별 익스포트 (기존 import 문 대응) ──────────────────

export const { showSection, switchTab, toggleDarkMode, toggleViewMode, initTheme } = UINav;
export const { setDataStatus, setPdfStatus, setAttachmentStatus, showToast } = UIStatus;
export const { initVibrationChart, updateVibration, updateBuckling } = UIChart;
export const { 
  applyAttachmentInsightToQuestion, 
  updateAttachmentBoostButtonState, 
  initAttachmentBoostButtonStateSync,
  refreshAttachmentTargetOptions 
} = UIBoost;

// ──── 특정 UI 전용 헬퍼 (레거시 유지) ──────────────────

export function initAttachmentWebsiteControls() {
  const urlInput = getEl("attachmentWebsiteUrl");
  if (urlInput) {
    urlInput.addEventListener("input", () => {
      const websiteBtn = getEl("analyzeWebsiteBtn");
      if (!websiteBtn) return;
      const enabled = urlInput.value.startsWith("http");
      websiteBtn.disabled = !enabled;
      websiteBtn.classList.toggle("opacity-50", !enabled);
    });
  }
}

export function initReviewerControls() {
  const prevBtn = getEl("revPrevBtn");
  const nextBtn = getEl("revNextBtn");
  if (prevBtn) prevBtn.onclick = () => { 
    if (window.revCurrentPage > 1) { 
      window.revCurrentPage--; 
      if (window.renderReviewerPdf) window.renderReviewerPdf(window.revCurrentPage); 
      if (window.renderReviewerList) window.renderReviewerList(window.currentReviewingQuestions); 
    } 
  };
  if (nextBtn) nextBtn.onclick = () => { 
    if (window.visualPdfDoc && window.revCurrentPage < window.visualPdfDoc.numPages) { 
      window.revCurrentPage++; 
      if (window.renderReviewerPdf) window.renderReviewerPdf(window.revCurrentPage); 
      if (window.renderReviewerList) window.renderReviewerList(window.currentReviewingQuestions); 
    } 
  };
}

export function deleteSelectedGlobalRound() {
  const globalRoundSelect = getEl("globalRoundSelect");
  const selectedRound = globalRoundSelect ? globalRoundSelect.value : "";
  if (!selectedRound) {
    setDataStatus("삭제할 회차를 먼저 선택하세요.", "error");
    return;
  }
  if (!confirm(`${selectedRound} 회차 데이터를 삭제하시겠습니까?`)) return;

  const data = typeof window.getCurrentAnswerData === "function" ? window.getCurrentAnswerData() : {};
  if (!data) return;

  const roundOnly = (v) => String(v || "").replace(/[^0-9]/g, "");
  const target = roundOnly(selectedRound);

  data.questions = (data.questions || []).filter(q => roundOnly(q.examRound) !== target);
  data.theories = (data.theories || []).filter(t => roundOnly(t.examRound) !== target);

  if (window.syncJsonAndRender) {
    window.syncJsonAndRender(data, `${selectedRound} 회차 삭제 완료`);
  }
}

export async function refreshModelList() {
  const { refreshModelList: apiRefresh } = await import('./api-ui.module.js');
  return apiRefresh();
}

export function evaluateRoundQuality() {
  if (typeof window.evaluateRenderedAnswers === 'function') {
    return window.evaluateRenderedAnswers();
  }
  showToast("품질 분석 엔진을 로드할 수 없습니다.", "error");
}

const UI = {
  init: initUI,
  Nav: UINav,
  Status: UIStatus,
  Chart: UIChart,
  Boost: UIBoost,
  initAttachmentWebsiteControls,
  initReviewerControls,
  deleteSelectedGlobalRound,
  refreshModelList,
  evaluateRoundQuality,
  // UINav 메서드 - this 컨텍스트 바인딩 유지
  showSection: UINav.showSection.bind(UINav),
  switchTab: UINav.switchTab.bind(UINav),
  toggleDarkMode: UINav.toggleDarkMode.bind(UINav),
  toggleViewMode: UINav.toggleViewMode.bind(UINav),
  initTheme: UINav.initTheme.bind(UINav),
  // UIStatus 메서드
  showToast: UIStatus.showToast.bind(UIStatus),
  setDataStatus: UIStatus.setDataStatus.bind(UIStatus),
  setPdfStatus: UIStatus.setPdfStatus.bind(UIStatus),
  setAttachmentStatus: UIStatus.setAttachmentStatus.bind(UIStatus),
  // UIBoost 메서드 - this 컨텍스트 바인딩 유지
  initAttachmentBoostButtonStateSync: UIBoost.initAttachmentBoostButtonStateSync.bind(UIBoost),
  applyAttachmentInsightToQuestion: UIBoost.applyAttachmentInsightToQuestion.bind(UIBoost),
  updateAttachmentBoostButtonState: UIBoost.updateAttachmentBoostButtonState.bind(UIBoost),
  refreshAttachmentTargetOptions: UIBoost.refreshAttachmentTargetOptions.bind(UIBoost),
};

export default UI;
