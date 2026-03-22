// SPA 전체 상태/캐시/작업 전역을 ESM 객체로 통합 관리
// 기존 window.* 변수 대체용

export const AppState = {
  bucklingChartInstance: null,
  lastEvaluationResults: [],
  theoryAnalysisCache: {
    duplicates: [],
    reinforcements: [],
    mergedDrafts: [],
  },
  latestAttachmentInsight: null,
  revCurrentPage: 1,
  visualCurrentPage: 1,
  visualPdfDoc: null,
  visualTextCache: [],
  ignoredVisualBlocks: [],
  currentReviewingQuestions: [],
  selectedQuestionIdsForAi: [],
  selectedBoxIds: [],
  selectedCandidateRects: [],
  pendingManualRect: null,
  pendingManualCaptureMedia: null,
  pendingManualReferenceImage: null,
  pendingManualContentMode: null,
  pendingManualAnalysisFeedback: null,
  pdfZoomLevel: 1.5,
  visualRenderTask: null,
  reviewerRenderTask: null,
  currentVisualViewport: null,
  currentReviewerViewport: null,
  isAddAreaMode: false,
  pendingAssignIndex: null,
  currentHighlightedBoxIndex: -1,
  currentHighlightedBoxPage: -1,
  lowConfidenceOnly: null,
  
  // ──── Networking / Registry ─────────────────────────────────
  analyzeBackendDiscoveredBase: null,
  lmStudioOfflineUntil: 0,
  configOverrides: {},

  pdfjsLib: (typeof window !== 'undefined' && window.pdfjsLib) ? window.pdfjsLib : undefined,
  safeLocalStorage: (typeof window !== 'undefined' && window.safeLocalStorage) ? window.safeLocalStorage : undefined,
  renderTheoryMergeDrafts: (typeof window !== 'undefined' && window.renderTheoryMergeDrafts) ? window.renderTheoryMergeDrafts : undefined,
};
