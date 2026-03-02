// --- Navigation Logic ---

// --- 첨부파일 분석 파이프라인 ---

// analyzeAttachedFiles 함수는 중복 선언 금지. 위에서 이미 선언된 경우 아래 선언을 제거하거나 통합해야 함.

// PDF.js를 활용한 PDF 텍스트 추출 (1~2페이지만)

// --- Navigation Logic (중복/문법 오류 수정) ---

// --- 전역 회차 삭제 함수 (임시 구현) ---

// --- Chart Initialization ---

// 1. Strategy Radar Chart
const strategyCanvas = document.getElementById("strategyChart");
if (strategyCanvas) {
  const ctxStrategy = strategyCanvas.getContext("2d");
  new Chart(ctxStrategy, {
    type: "radar",
    data: {
      labels: [
        "이론 이해도",
        "계산 정확성",
        "답안 형식/가독성",
        "시간 관리",
        "응용력",
      ],
      datasets: [
        {
          label: "나의 스탯 (My Stats)",
          data: [85, 70, 90, 80, 65],
          fill: true,
          backgroundColor: "rgba(59, 130, 246, 0.2)",
          borderColor: "rgb(59, 130, 246)",
          pointBackgroundColor: "rgb(59, 130, 246)",
          pointBorderColor: "#fff",
          pointHoverBackgroundColor: "#fff",
          pointHoverBorderColor: "rgb(59, 130, 246)",
        },
        {
          label: "상위 10% (Top 10%)",
          data: [95, 85, 90, 95, 80],
          fill: true,
          backgroundColor: "rgba(148, 163, 184, 0.2)",
          borderColor: "rgb(148, 163, 184)",
          pointBackgroundColor: "rgb(148, 163, 184)",
          pointBorderColor: "#fff",
          pointHoverBackgroundColor: "#fff",
          pointHoverBorderColor: "rgb(148, 163, 184)",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          angleLines: { display: false },
          suggestedMin: 0,
          suggestedMax: 100,
        },
      },
    },
  });
}

// 2. Exam Distribution Chart (Doughnut)
const examCanvas = document.getElementById("examDistChart");
if (examCanvas) {
  const ctxExam = examCanvas.getContext("2d");
  new Chart(ctxExam, {
    type: "doughnut",
    data: {
      labels: [
        "구조역학 (Matrix/Dynamics)",
        "철근콘크리트 (RC/PSC)",
        "강구조 (Steel)",
        "교량/유지관리",
        "기타",
      ],
      datasets: [
        {
          data: [30, 25, 20, 15, 10],
          backgroundColor: [
            "rgba(59, 130, 246, 0.8)", // Blue
            "rgba(20, 184, 166, 0.8)", // Teal
            "rgba(249, 115, 22, 0.8)", // Orange
            "rgba(168, 85, 247, 0.8)", // Purple
            "rgba(148, 163, 184, 0.8)", // Grey
          ],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "right" },
      },
    },
  });
}

// 3. Vibration Chart (Interactive Line)
let vibrationChart;

// 4. Buckling Chart (Column Strength)
const bucklingCanvas = document.getElementById("bucklingChart");
if (bucklingCanvas) {
  const ctxBuckling = bucklingCanvas.getContext("2d");
  const slenderness = [];
  const eulerStress = [];
  const designStress = [];

  for (let lam = 0; lam <= 200; lam += 5) {
    slenderness.push(lam);
    // Euler: Fe = pi^2 * E / (KL/r)^2. Assume E=205000, Fy=235
    const E = 205000;
    const Fy = 235;
    let Fe = (Math.PI * Math.PI * E) / (lam * lam);
    if (lam === 0) Fe = Fy; // Prevent infinity

    eulerStress.push(Math.min(Fe, Fy * 1.5)); // Cap for graph

    // Simplified Inelastic (Concept)
    let Fcr;
    if (Fe >= 0.44 * Fy) {
      Fcr = Fy * Math.pow(0.658, Fy / Fe);
    } else {
      Fcr = 0.877 * Fe;
    }
    designStress.push(Fcr);
  }

  new Chart(ctxBuckling, {
    type: "line",
    data: {
      labels: slenderness,
      datasets: [
        {
          label: "오일러 탄성좌굴 (Euler Elastic)",
          data: eulerStress,
          borderColor: "rgb(148, 163, 184)",
          borderDash: [5, 5],
          borderWidth: 2,
          pointRadius: 0,
        },
        {
          label: "설계 강도 (Design Strength - Inelastic)",
          data: designStress,
          borderColor: "rgb(220, 38, 38)",
          borderWidth: 3,
          pointRadius: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: {
            display: true,
            text: "세장비 (Slenderness Ratio, KL/r)",
          },
        },
        y: {
          title: {
            display: true,
            text: "임계 응력 (Critical Stress, MPa)",
          },
        },
      },
    },
  });
}

initVibrationChart();

// --- Interaction Logic ---

const zetaInput = document.getElementById("zetaInput");

const tnInput = document.getElementById("tnInput");

const zetaValue = document.getElementById("zetaValue");

const tnValue = document.getElementById("tnValue");

if (zetaInput) zetaInput.addEventListener("input", updateVibration);

if (tnInput) tnInput.addEventListener("input", updateVibration);

const ANSWER_STORAGE_KEY = "solve120_answer_data_v1";

const AI_ENDPOINT_STORAGE_KEY = "solve120_ai_endpoint_v1";

const AI_FOUNDRY_MODEL_STORAGE_KEY = "solve120_ai_foundry_model_v1";

let lastEvaluationResults = [];

let pendingDeleteIndex = -1;

let roundStatsChart = null;

let pipelineRunning = false;

let theoryAnalysisCache = {
  duplicates: [],

  reinforcements: [],

  mergedDrafts: [],
};

window.latestAttachmentInsight = null;
window.revCurrentPage = 1;
window.visualRenderTask = null;
window.reviewerRenderTask = null;
window.currentReviewerViewport = null;
window.isAddAreaMode = false;
window.pendingAssignIndex = null; // 좌표 할당 대기 중인 문항 인덱스 (v18.4)

let hideAllVisualCandidates = false; // 모든 자동인식 후보 영역 숨김 여부 (v18.1)

window.currentHighlightedBoxIndex = -1;

window.currentHighlightedBoxPage = -1;

if (window.pdfjsLib?.GlobalWorkerOptions) {
  // Use CDN worker for maximum compatibility when local worker file is missing.

  const cdnWorker =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  window.pdfjsLib.GlobalWorkerOptions.workerSrc = cdnWorker;
}

const sampleAnswerData = {
  meta: {
    exam: "토목구조기술사 120회",

    source: "NotebookLM/Flowith",

    version: "v1.0",
  },

  questions: [
    {
      id: "Q1",

      title: "응력교란구역(D-Region)의 정의 및 설계 원칙",

      examRound: "120회",

      tags: ["RC", "STM", "KDS 14 20 24"],

      modelAnswer:
        "D-Region은 평면유지 가정이 성립하지 않는 불연속 영역으로, 스트럿-타이 모델을 통해 힘의 흐름을 이상화하여 설계한다. 설계 시 strut, tie, node 강도와 정착 길이를 종합 검토한다.",

      source: "Flowith Draft",

      reviewed: false,
    },

    {
      id: "Q2",

      title: "PS 긴장재 부식 및 지연파괴 대책",

      examRound: "120회",

      tags: ["PSC", "유지관리", "그라우팅"],

      modelAnswer:
        "염소이온과 수분 환경에서 수소취성이 가속될 수 있으므로, 그라우팅 품질관리와 피복 두께 확보, 정기 점검 및 비파괴검사를 병행한다.",

      source: "NotebookLM Notes",

      reviewed: true,
    },
  ],

  theories: [
    {
      id: "TH-001",

      title: "응력교란구역(D-Region) 기본 개념",

      category: "RC",

      examRound: "120회",

      tags: ["RC", "STM", "D-Region"],

      source: "Subnote",

      content:
        "D-Region은 평면유지 가정이 성립하지 않는 불연속 구간이며 STM으로 힘의 전달 경로를 이상화하여 설계한다. KDS 14 20 24 기준으로 Strut/Tie/Node 강도를 검토한다.",
    },

    {
      id: "TH-002",

      title: "D-Region 설계 보강 포인트",

      category: "RC",

      examRound: "121회",

      tags: ["RC", "정착", "절점"],

      source: "PDF Upload",

      content:
        "STM 적용 시 절점(Nodal Zone)의 지압강도와 인장 철근 정착길이 확보를 우선 검토한다. 도해와 비교표를 활용하면 채점 가독성이 높아진다.",
    },
  ],
};

// ──── 사이드-바이-사이드 리뷰어 전용 함수 ────

/**

       * ──────────── v4.0: PDF 시각화 모달 지원 함수 ────────────

       */

// ──── 드래그 앤 드롭 리스트 순서 변경 (v21.0 추가) ────

let draggedItemIndex = null;
let dragStart = null;
let dragRect = null;

// NOTE: PDF 모달 키보드(Delete/Escape) 처리는 pdf.js의 단일 리스너에서 담당한다.
// app.js의 중복 리스너는 이중 처리/중복 confirm을 유발할 수 있어 제거함.

const AI_PRESETS_STORAGE_KEY = "solve_ai_presets_v1";

// Initialize PDF.js worker

if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

function parseQuestionsFromText(text) {
  const cleaned = String(text || "").replace(/\r/g, "\n");
  if (!cleaned.trim()) return [];

  const sessionRegex =
    /(?:제?\s*([1-4])\s*(?:교시|부)|([1-4])\s*(?:교시|부))/gi;
  const sessionMatches = [...cleaned.matchAll(sessionRegex)];
  const sessions = [];

  if (sessionMatches.length > 0) {
    sessionMatches.forEach((m, i) => {
      const start = m.index;
      const end = sessionMatches[i + 1]
        ? sessionMatches[i + 1].index
        : cleaned.length;
      sessions.push({
        round: (m[1] || m[2]) + "교시",
        content: cleaned.slice(start, end),
      });
    });
  } else {
    sessions.push({ round: "미지정", content: cleaned });
  }

  const parsedResult = [];
  sessions.forEach((session) => {
    let content = session.content.trim();

    // 메타데이터 헤더나 파일 정보만 있는 경우 필터링 (강화)
    if (
      content.startsWith("===== ") ||
      (content.includes("===== ") &&
        content.length < 500 &&
        !/\d+\s*[.)]/.test(content))
    ) {
      return;
    }

    // Enhanced marker detection for technical exams (v16.0)
    const questionMarkers = [
      ...content.matchAll(
        /(?:\n|^|\s{2,})\s*(?:Q\s*[.:]?\s*\d+|\d+\s*[.\-:)]\s*|문제\s*\d+|\d+\s*번|\[\d+\]|【\d+】)/gi,
      ),
    ];

    if (questionMarkers.length > 0) {
      questionMarkers.forEach((m, idx) => {
        const start = m.index;
        const end = questionMarkers[idx + 1]
          ? questionMarkers[idx + 1].index
          : content.length;
        const block = content.slice(start, end).trim();

        const compact = block.replace(/\s+/g, " ").trim();

        // 실제 문제 내용 유효성 검사 강화 (v2.5)
        if (compact.length < 10 || compact.startsWith("===== ")) return;
        if (compact.includes("시험시간: 100분") && compact.length < 100) return;

        const idMatch = compact.match(
          /^(?:Q\s*[.:]?\s*(\d+)|(\d+)\s*[.\-:)]\s*|문제\s*(\d+)|(\d+)\s*번)/i,
        );
        let rawNum = "0";
        if (idMatch) {
          rawNum = idMatch[1] || idMatch[2] || idMatch[3] || idMatch[4];
        } else {
          rawNum = idx + 1;
        }

        const uniqueId =
          session.round !== "미지정"
            ? `${session.round}-${rawNum}`
            : `Q${rawNum}`;

        // 제목 추출 시 마커 제거 및 가독성 개선
        let cleanTitle = compact;
        if (idMatch) cleanTitle = compact.slice(idMatch[0].length).trim();
        const titleSnippet =
          cleanTitle.length > 100
            ? cleanTitle.slice(0, 100) + "..."
            : cleanTitle;

        parsedResult.push({
          id: uniqueId,
          title: titleSnippet,
          examRound: session.round,
          rawQuestion: block,
        });
      });
    }
  });

  // 로컬 파서만 0건이면 이후 AI 파서에서 인식할 수 있으므로 경고 대신 디버그 수준으로
  if (parsedResult.length === 0) {
    if (typeof console.debug === "function") {
      console.debug(
        "[Local Parser] No valid questions from text; AI parser may still find some.",
      );
    }
  }

  return parsedResult;
}

Object.assign(window, {
  showSection,

  switchTab,

  analyzeAttachedFiles,

  analyzeAttachedWebsite,

  applyAttachmentInsightToQuestion,

  setLmStudioLocalPreset,
  setFoundryLocalPreset,

  runAutoPipeline,

  generateTheoryMergeDrafts,

  adoptMergedTheoryDraft,

  applyTheoryCleanup,

  upsertTheoryEntry,

  editTheoryEntry,

  deleteTheoryEntry,

  cancelTheoryEditMode,

  openDeleteConfirmModal,

  confirmDeleteModelAnswerEntry,

  cancelEditMode,

  editModelAnswerEntry,

  saveAnswerData,

  exportAnswerDataToFile,

  openImportFileDialog,

  importAnswerDataFromFile,

  addModelAnswerEntry,

  deleteSelectedGlobalRound,

  applyAnswerFilters,

  getFilteredEntries,

  // ──── 이하 onclick에서 호출되나 누락된 함수 추가 ────

  loadAnswerData,

  loadSampleData,

  checkBackendConnection,
  refreshAvailableModels,
  generateDraftAnswersByActiveModel,

  detectLmStudioModelId,
  detectFoundryModelId,

  evaluateRenderedAnswers,

  extractPdfText,

  extractQuestionsFromPdfText,

  generateDraftAnswersByApi,

  generateDraftAnswersByLmStudioLocal,
  generateDraftAnswersByFoundryLocal,

  generateDraftAnswersLocal,

  analyzeTheoryKnowledge,

  // ──── 리뷰어 관련 함수 ────

  renderReviewerPdf,

  renderReviewerList,

  initReviewerControls,

  findAndGoToPage,

  captureManualQuestion,

  deleteCapturedQuestion,
});

document

  .getElementById("filterKeyword")

  .addEventListener("input", applyAnswerFilters);

document

  .getElementById("filterRound")

  .addEventListener("change", applyAnswerFilters);

document

  .getElementById("filterTag")

  .addEventListener("change", applyAnswerFilters);

document

  .getElementById("filterLowScore")

  .addEventListener("change", applyAnswerFilters);

document

  .getElementById("mergeQualityThreshold")

  .addEventListener("change", () => {
    renderTheoryMergeDrafts(theoryAnalysisCache.mergedDrafts || []);
  });

document

  .getElementById("globalRoundSelect")

  .addEventListener("change", (event) => {
    const selected = event.target.value;

    const filterRound = document.getElementById("filterRound");

    filterRound.value = selected;

    updateGlobalRoundLabels(selected);

    applyAnswerFilters();
  });

(async function initAiEndpoint() {
  const input = document.getElementById("aiEndpointUrl");

  const modelInput = document.getElementById("aiFoundryModelId");
  const modelSelect = document.getElementById("aiAvailableModelSelect");

  const storage = window.safeLocalStorage || localStorage;
  const stored = storage.getItem(AI_ENDPOINT_STORAGE_KEY);
  const upgradedStored = String(stored || "")
    .replace(/127\.0\.0\.1:5619/gi, "127.0.0.1:1234")
    .replace(/localhost:5619/gi, "localhost:1234");

  input.value = upgradedStored || "http://127.0.0.1:1234/v1/chat/completions";
  if (upgradedStored && upgradedStored !== stored) {
    storage.setItem(AI_ENDPOINT_STORAGE_KEY, upgradedStored);
  }

  modelInput.value = storage.getItem(AI_FOUNDRY_MODEL_STORAGE_KEY) || "";

  updateAiModeUx();

  input.addEventListener("change", () => {
    storage.setItem(AI_ENDPOINT_STORAGE_KEY, input.value.trim());

    updateAiModeUx();
    refreshAvailableModels(true);

    if (isLikelyLmStudioEndpoint() && !modelInput.value.trim()) {
      detectLmStudioModelId();
    }
  });

  modelInput.addEventListener("change", () => {
    storage.setItem(
      AI_FOUNDRY_MODEL_STORAGE_KEY,

      modelInput.value.trim(),
    );
    if (typeof renderAvailableModelOptions === "function") {
      renderAvailableModelOptions(
        modelInput.value.trim() ? [modelInput.value.trim()] : [],
        modelInput.value.trim(),
      );
    }
  });

  if (modelSelect) {
    modelSelect.addEventListener("change", () => {
      const selectedToken = String(modelSelect.value || "").trim();
      const parsed =
        typeof parseSelectedModelToken === "function"
          ? parseSelectedModelToken(selectedToken)
          : { provider: "", modelId: selectedToken };

      modelInput.value = parsed.modelId || "";
      storage.setItem(AI_FOUNDRY_MODEL_STORAGE_KEY, parsed.modelId || "");
      storage.setItem("solve120_ai_selected_model_v1", selectedToken);

      const providerEl = document.getElementById("aiProvider");
      if (providerEl && parsed.provider && parsed.provider !== "lmstudio") {
        providerEl.value = parsed.provider;
      }
    });
  }

  const presetSelect = document.getElementById("aiModelPresets");

  presetSelect.addEventListener("change", (e) => applyAiPreset(e.target.value));

  loadAiPresets();

  // 실행 안정성 우선: 앱 시작 시 LM Studio 자동 프로브를 하지 않는다.
  // (오프라인 상태에서 /api/lmstudio-models 503 콘솔 노이즈 방지)
  const initialModel = String(modelInput.value || "").trim();
  if (typeof renderAvailableModelOptions === "function") {
    renderAvailableModelOptions(
      initialModel ? [initialModel] : [],
      initialModel,
    );
  }
})();

// 실행 안정성 우선: 초기 로드 시 자동 연결 체크를 생략하고,
// 사용자가 "백엔드 연결 확인" 또는 "모델 목록 새로고침"을 눌렀을 때만 프로브한다.

loadAnswerData();

if (typeof initAttachmentWebsiteControls === "function") {
  initAttachmentWebsiteControls();
}

// 수동 JSON 편집 시 자동 저장 (v20.0)

let saveTimeout;

document

  .getElementById("answerJsonInput")

  .addEventListener("input", () => {
    clearTimeout(saveTimeout);

    saveTimeout = setTimeout(() => saveAnswerData(true), 1000);
  });
