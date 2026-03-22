// 상태 관리 모듈 (ESM)
// 기존 window.App.State를 대체

const State = {
  rawAnswerData: null,
  questions: [],
  theories: [],
  lastEvaluationResults: [],
  theoryAnalysisCache: {
    duplicates: [],
    reinforcements: [],
    mergedDrafts: [],
  },
  pdf: {
    // ...기존 pdf 관련 상태 필요시 여기에 추가
  },
};

export default State;
