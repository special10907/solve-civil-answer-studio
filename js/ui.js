function showSection(sectionId) {
  const requestedSectionId = sectionId;
  const resolvedSectionId =
    requestedSectionId === "theory-manager" || requestedSectionId === "answer-manager"
      ? "studio"
      : requestedSectionId;
  window.__theoryManagerMode = requestedSectionId === "theory-manager";
  window.__answerManagerMode = requestedSectionId === "answer-manager";

  if (window.Debug) {
    window.Debug.log("nav", "showSection requested", {
      requestedSectionId,
      resolvedSectionId,
    });
  }
  // Hide all sections
  document.querySelectorAll(".content-section").forEach((el) => {
    el.classList.remove("active");
    el.classList.add("hidden"); // Explicitly hide
  });
  // Show target section
  const target = document.getElementById(resolvedSectionId);
  if (target) {
    target.classList.add("active");
    target.classList.remove("hidden");
    if (window.Debug) {
      window.Debug.log("nav", "section activated", {
        requestedSectionId,
        resolvedSectionId,
        className: target.className,
      });
    }
  } else if (window.Debug) {
    window.Debug.warn("nav", "section target not found", {
      requestedSectionId,
      resolvedSectionId,
    });
  }

  // Update Nav State
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    if (btn.dataset.target === requestedSectionId) {
      btn.classList.add("bg-indigo-600/20", "text-indigo-400", "border-indigo-500/30");
      btn.classList.remove("hover:bg-slate-700/50");
    } else {
      btn.classList.remove("bg-indigo-600/20", "text-indigo-400", "border-indigo-500/30");
      btn.classList.add("hover:bg-slate-700/50");
    }
  });

  // Knowledge Studio Specific: Initialize PDF Viewer
  if (resolvedSectionId === "studio") {
    if (typeof openPdfVisualModal === "function") {
      if (window.Debug) {
        window.Debug.log("nav", "opening studio pdf viewer", {
          hasPdf: !!window.visualPdfDoc,
        });
      }
      openPdfVisualModal();
    }

    // Theory Manager 진입 시 Theory 탭을 즉시 활성화
    if (
      requestedSectionId === "theory-manager" &&
      window.Studio &&
      typeof window.Studio.switchTab === "function"
    ) {
      window.Studio.switchTab("theory");
    } else if (
      requestedSectionId === "answer-manager" &&
      window.Studio &&
      typeof window.Studio.switchTab === "function"
    ) {
      window.Studio.switchTab("answers");
    } else if (
      window.Studio &&
      typeof window.Studio.updatePdfAreaView === "function"
    ) {
      window.Studio.updatePdfAreaView();
    }
  }
}

function switchTab(tabId) {
  // Hide all tab content
  document.querySelectorAll(".tab-content").forEach((el) => {
    el.classList.add("hidden");
  });
  // Show target tab content
  document.getElementById(tabId).classList.remove("hidden");
  // Update Tab Styles
  document.querySelectorAll(".exam-tab").forEach((t) => {
    t.classList.remove("active-tab", "border-indigo-600", "text-indigo-600");
    t.classList.add("border-transparent");
  });
  const activeBtn = document.querySelector(`button[data-tab="${tabId}"]`);
  if (activeBtn) {
    activeBtn.classList.add(
      "active-tab",
      "border-indigo-600",
      "text-indigo-600",
    );
    activeBtn.classList.remove("border-transparent");
  }
}

// deleteSelectedGlobalRound는 아래(데이터 동기화 포함)에 단일 정의됨. 중복 제거.

function initVibrationChart() {
  const vibCanvas = document.getElementById("vibrationChart");
  if (!vibCanvas) return;

  const ctxVib = vibCanvas.getContext("2d");
  const dataPoints = [];
  const labels = [];

  // Initial calc
  const zeta = 0.05;
  const Tn = 1.0;
  const wn = (2 * Math.PI) / Tn;
  const wd = wn * Math.sqrt(1 - zeta * zeta);

  for (let t = 0; t <= 5; t += 0.05) {
    const u = Math.exp(-zeta * wn * t) * Math.cos(wd * t);
    dataPoints.push(u);
    labels.push(t.toFixed(2));
  }

  vibrationChart = new Chart(ctxVib, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "변위 u(t)",
          data: dataPoints,
          borderColor: "rgb(147, 51, 234)",
          backgroundColor: "rgba(147, 51, 234, 0.1)",
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: "Time (sec)" } },
        y: {
          title: { display: true, text: "Displacement (normalized)" },
          min: -1,
          max: 1,
        },
      },
      animation: { duration: 0 }, // Disable animation for slider performance
    },
  });
}

function updateVibration() {
  const zeta = parseFloat(zetaInput.value);
  const Tn = parseFloat(tnInput.value);

  zetaValue.innerText = zeta;
  tnValue.innerText = Tn.toFixed(1);

  const wn = (2 * Math.PI) / Tn;
  const wd = wn * Math.sqrt(1 - zeta * zeta);

  const newData = [];
  for (let t = 0; t <= 5; t += 0.05) {
    const u = Math.exp(-zeta * wn * t) * Math.cos(wd * t);
    newData.push(u);
  }

  vibrationChart.data.datasets[0].data = newData;
  vibrationChart.update();
}

// utils.js의 전역 함수 사용 (중복 제거)

function setDataStatus(message, type = "info") {
  if (window.Debug) {
    window.Debug.log("status", "data status", { message, type });
  }
  const statusEl = document.getElementById("dataStatus");
  if (!statusEl) return;
  const colorMap = {
    info: "text-slate-600",
    success: "text-emerald-700",
    error: "text-rose-700",
    warning: "text-amber-600",
  };
  statusEl.className = `mt-3 text-sm ${colorMap[type] || colorMap.info}`;
  statusEl.textContent = message;
}

function setPdfStatus(message, type = "info") {
  if (window.Debug) {
    window.Debug.log("pdf", "pdf status", { message, type });
  }
  const statusEl = document.getElementById("pdfVisualStatus");
  if (!statusEl) return;
  const colorMap = {
    info: "text-slate-400 font-medium italic",
    success: "text-emerald-500 font-bold",
    error: "text-rose-500 font-bold",
  };
  statusEl.className = `text-[10px] ${colorMap[type] || colorMap.info} transition-all duration-300 transform scale-100`;
  statusEl.textContent = message;
}

function getChatEndpoint() {
  const input = document.getElementById("aiEndpointUrl");
  return input
    ? input.value.trim()
    : "http://127.0.0.1:1234/v1/chat/completions";
}

function setAttachmentStatus(message, type = "info") {
  const statusEl = document.getElementById("attachmentStatus");
  if (!statusEl) {
    return;
  }
  const colorMap = {
    info: "text-slate-500",
    success: "text-emerald-700",
    error: "text-rose-700",
  };
  statusEl.className = `mt-2 text-xs ${colorMap[type] || colorMap.info}`;
  statusEl.textContent = message;
}

// isValidWebUrl is defined in utils.js — using global version

function updateAnalyzeWebsiteButtonState() {
  const urlInput = document.getElementById("attachmentWebsiteUrl");
  const websiteBtn = document.getElementById("analyzeWebsiteBtn");
  if (!urlInput || !websiteBtn) {
    return;
  }

  const enabled = isValidWebUrl(urlInput.value);
  websiteBtn.disabled = !enabled;
  websiteBtn.classList.toggle("opacity-50", !enabled);
  websiteBtn.classList.toggle("cursor-not-allowed", !enabled);
  websiteBtn.title = enabled
    ? "웹사이트 분석 실행"
    : "http(s) URL을 입력하면 활성화됩니다.";
}

function initAttachmentWebsiteControls() {
  const urlInput = document.getElementById("attachmentWebsiteUrl");
  if (!urlInput) {
    return;
  }

  urlInput.addEventListener("input", updateAnalyzeWebsiteButtonState);
  urlInput.addEventListener("change", updateAnalyzeWebsiteButtonState);
  updateAnalyzeWebsiteButtonState();
}

function renderAttachmentInsight(insight) {
  const summaryEl = document.getElementById("attachmentInsightSummary");
  const pointsEl = document.getElementById("attachmentInsightPoints");
  const boostEl = document.getElementById("attachmentInsightBoost");

  if (!summaryEl || !pointsEl || !boostEl) {
    return;
  }

  if (!insight) {
    summaryEl.textContent = "아직 분석 결과가 없습니다.";
    pointsEl.innerHTML = "";
    boostEl.textContent = "";
    updateAttachmentBoostButtonState();
    return;
  }

  summaryEl.textContent = insight.summary || "요약 결과 없음";
  const keyPoints = Array.isArray(insight.keyPoints) ? insight.keyPoints : [];
  const keywordPoints =
    !keyPoints.length && Array.isArray(insight.keywords)
      ? insight.keywords.slice(0, 5).map((keyword) => `핵심 키워드: ${keyword}`)
      : [];
  const points = keyPoints.length ? keyPoints : keywordPoints;
  pointsEl.innerHTML = points
    .map((point) => `<li>${escapeHtml(point)}</li>`)
    .join("");
  boostEl.textContent = insight.answerBoost || "";
  updateAttachmentBoostButtonState();
}

function refreshAttachmentTargetOptions(questions) {
  const select = document.getElementById("attachmentTargetQuestion");
  if (!select) {
    updateAttachmentBoostButtonState();
    return;
  }

  const currentValue = select.value;
  const list = Array.isArray(questions) ? questions : [];
  const options = ['<option value="">보강 적용할 문제 선택</option>'];
  list.forEach((item, index) => {
    const label = `${item.id || `Q${index + 1}`} · ${item.title || "제목 없음"} (${item.examRound || "미지정"})`;
    options.push(`<option value="${index}">${escapeHtml(label)}</option>`);
  });
  select.innerHTML = options.join("");

  if (
    currentValue &&
    Number.isInteger(Number(currentValue)) &&
    list[Number(currentValue)]
  ) {
    select.value = currentValue;
  }

  updateAttachmentBoostButtonState();
}

function resolveAttachmentTargetContext(data) {
  const select = document.getElementById("attachmentTargetQuestion");
  if (select && select.value !== "") {
    const fromSelect = Number(select.value);
    if (Number.isInteger(fromSelect) && fromSelect >= 0) {
      const id = String(data?.questions?.[fromSelect]?.id || `Q${fromSelect + 1}`);
      return {
        index: fromSelect,
        source: "manual-select",
        sourceLabel: "선택 타겟",
        targetId: id,
      };
    }
  }

  const editingIndexEl = document.getElementById("editing-questions-index");
  const editingIndex = Number(editingIndexEl?.value);
  if (Number.isInteger(editingIndex) && editingIndex >= 0) {
    const id = String(data?.questions?.[editingIndex]?.id || `Q${editingIndex + 1}`);
    return {
      index: editingIndex,
      source: "editing-index",
      sourceLabel: "편집 인덱스",
      targetId: id,
    };
  }

  const currentId = String(
    document.getElementById("studio-q-id")?.value || "",
  ).trim();
  if (currentId && Array.isArray(data?.questions)) {
    const idxById = data.questions.findIndex(
      (q) => String(q?.id || "").trim() === currentId,
    );
    if (idxById >= 0) {
      return {
        index: idxById,
        source: "editing-id",
        sourceLabel: "ID 매칭",
        targetId: currentId,
      };
    }
  }

  return {
    index: -1,
    source: "none",
    sourceLabel: "타겟 없음",
    targetId: "",
  };
}

function resolveAttachmentTargetQuestionIndex(data) {
  return resolveAttachmentTargetContext(data).index;
}

function getAttachmentBoostUserRequest() {
  const el = document.getElementById("attachmentBoostUserRequest");
  return String(el?.value || "").trim();
}

function getAttachmentBoostSourcePreferences() {
  const options = [
    { id: "boostSourceWebDeep", label: "웹 딥리서치", key: "webDeep" },
    { id: "boostSourceTheory", label: "이론 자료", key: "theory" },
    { id: "boostSourceNotebookLm", label: "Notebook LM", key: "notebookLm" },
    { id: "boostSourceFlowith", label: "Flowith 지식정원", key: "flowith" },
    { id: "boostSourceInternet", label: "인터넷 검색", key: "internet" },
  ];

  const selected = options
    .map((opt) => {
      const checked = !!document.getElementById(opt.id)?.checked;
      return { ...opt, checked };
    })
    .filter((opt) => opt.checked);

  return {
    selected,
    labels: selected.map((opt) => opt.label),
  };
}

function tokenizeBoostText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2);
}

function calculateBoostOverlapScore(sourceTokens, targetTokens) {
  if (!sourceTokens.length || !targetTokens.length) {
    return 0;
  }
  const sourceSet = new Set(sourceTokens);
  let hit = 0;
  targetTokens.forEach((token) => {
    if (sourceSet.has(token)) hit += 1;
  });
  return hit / Math.max(1, targetTokens.length);
}

function selectAttachmentBoostTheories(targetQuestion, theories, maxItems = 3) {
  const targetText = [
    targetQuestion?.title,
    targetQuestion?.rawQuestion,
    targetQuestion?.modelAnswer,
  ]
    .filter(Boolean)
    .join(" ");
  const targetTokens = tokenizeBoostText(targetText);

  if (!Array.isArray(theories) || !theories.length || !targetTokens.length) {
    return [];
  }

  return theories
    .map((theory) => {
      const theoryText = [
        theory?.title,
        theory?.category,
        theory?.content,
        ...(Array.isArray(theory?.tags) ? theory.tags : []),
      ]
        .filter(Boolean)
        .join(" ");
      const score = calculateBoostOverlapScore(
        tokenizeBoostText(theoryText),
        targetTokens,
      );
      return { theory, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxItems)
    .map((row) => row.theory);
}

function buildAttachmentBoostFallback({
  target,
  insight,
  userRequest,
  sourceLabels,
  theorySnippets,
}) {
  const insightBoost = String(insight?.answerBoost || "").trim();
  const summary = String(insight?.summary || "").trim();
  const requestLine = userRequest
    ? `- 요청 반영: ${userRequest}`
    : "- 요청 반영: 기본 심화 보강(근거 강화 + 결론 명확화)";
  const sourceLine = sourceLabels.length
    ? `- 탐색 경로: ${sourceLabels.join(", ")}`
    : "- 탐색 경로: 웹/이론/학습자료 통합";
  const theoryLine = theorySnippets.length
    ? `- 이론 연계: ${theorySnippets.map((item) => item.title || "이론").join(" / ")}`
    : "- 이론 연계: 관련 이론 미매칭";

  return [
    "1. 핵심 쟁점 재정의",
    `- 대상: ${target?.title || "문항"}`,
    requestLine,
    sourceLine,
    theoryLine,
    "2. 보강 근거",
    summary ? `- 자료 요약: ${summary.slice(0, 280)}` : "- 자료 요약: 첨부/웹 기반 일반 심화",
    insightBoost
      ? `- 기존 인사이트: ${insightBoost.slice(0, 320)}`
      : "- 기존 인사이트: 없음(직접 심화 생성)",
    "3. 답안 추가 문단",
    "- 기준·메커니즘·실무 대책(시공/유지관리) 순으로 결론을 강화한다.",
  ].join("\n");
}

async function generateDeepAttachmentBoost({
  target,
  insight,
  userRequest,
  sourceLabels,
  theorySnippets,
}) {
  if (typeof window.generateAnswer !== "function") {
    return "";
  }

  const theoryContext = theorySnippets.length
    ? theorySnippets
        .map((item, idx) => {
          const tags = Array.isArray(item?.tags) ? item.tags.join(", ") : "";
          return [
            `- 이론 ${idx + 1}: ${item?.title || "이론"}`,
            `  태그: ${tags || "-"}`,
            `  내용: ${String(item?.content || "").slice(0, 260)}`,
          ].join("\n");
        })
        .join("\n")
    : "- 연계 가능한 이론 항목 없음";

  const insightSummary = String(insight?.summary || "").trim();
  const insightBoost = String(insight?.answerBoost || "").trim();

  const instruction = [
    "역할: 토목구조기술사 답안 심화 코치",
    "목표: 기존 답안이 만족스럽지 않을 때, 추가 보강 문단을 생성한다.",
    `탐색 경로(우선): ${sourceLabels.length ? sourceLabels.join(", ") : "웹 딥리서치, 이론 자료, Notebook LM, Flowith, 인터넷 검색"}`,
    userRequest
      ? `사용자 요청사항(최우선 반영): ${userRequest}`
      : "사용자 요청사항: 없음(기본 심화 보강)",
    "작성 규칙:",
    "- 불필요한 서론 없이 바로 보강 본문 작성",
    "- 기준/메커니즘/실무대책/결론의 4단 구조",
    "- 수험 답안에 바로 붙여넣기 가능한 개조식",
    "- 기존 답안과 중복 최소화",
    "",
    "[첨부/웹 인사이트 요약]",
    insightSummary || "없음",
    "",
    "[기존 인사이트 answerBoost]",
    insightBoost || "없음",
    "",
    "[연계 이론 스니펫]",
    theoryContext,
  ].join("\n");

  const questionPayload = {
    title: target?.title || "",
    rawQuestion: target?.rawQuestion || target?.title || "",
    modelAnswer: target?.modelAnswer || "",
  };

  try {
    const response = await window.generateAnswer(questionPayload, instruction, "text");
    return String(response?.answer || "").trim();
  } catch {
    return "";
  }
}

function updateAttachmentBoostButtonState() {
  const btn = document.getElementById("applyAttachmentInsightBtn");
  const chip = document.getElementById("attachmentBoostStateChip");
  const checklist = document.getElementById("attachmentBoostChecklist");
  if (!btn) {
    return;
  }

  const hasInsight =
    !!window.latestAttachmentInsight &&
    !!String(window.latestAttachmentInsight?.answerBoost || "").trim();
  const hasUserRequest = !!getAttachmentBoostUserRequest();
  const isBusy = Boolean(window.__attachmentBoostBusy);
  const data =
    typeof window.getCurrentAnswerData === "function"
      ? window.getCurrentAnswerData()
      : window.App?.State?.data;
  const targetInfo = resolveAttachmentTargetContext(data || {});
  const targetIndex = targetInfo.index;
  const hasTarget =
    Number.isInteger(targetIndex) &&
    targetIndex >= 0 &&
    Array.isArray(data?.questions) &&
    !!data.questions[targetIndex];

  const enabled = hasTarget && !isBusy;
  btn.disabled = !enabled;
  btn.classList.toggle("opacity-50", !enabled);
  btn.classList.toggle("cursor-not-allowed", !enabled);
  btn.classList.toggle("hover:bg-teal-700", enabled);

  let chipText = "보강 준비 확인 중";
  let chipTitle = "보강 준비 상태";
  let chipClassName =
    "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold border-slate-200 bg-slate-50 text-slate-600";

  if (isBusy) {
    btn.title = "보강 생성 중입니다...";
    chipText = "보강 생성 중";
    chipTitle = "AI 심화 보강을 생성하고 있습니다.";
    chipClassName =
      "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold border-indigo-200 bg-indigo-50 text-indigo-700";
  } else if (!hasTarget) {
    btn.title = "보강할 문항을 선택하거나 답안 편집 항목을 지정하세요.";
    chipText = "타겟 문항 필요";
    chipTitle = "답안 편집 항목 또는 대상 문항을 지정하세요.";
    chipClassName =
      "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold border-violet-200 bg-violet-50 text-violet-700";
  } else {
    const targetId = String(data.questions[targetIndex]?.id || `Q${targetIndex + 1}`);
    btn.title = hasInsight
      ? `선택 대상(${targetId})에 심화 보강을 적용합니다.`
      : `선택 대상(${targetId})에 신규 심화 보강을 생성합니다.`;
    chipText = hasInsight
      ? `심화 보강 준비 완료 (${targetId})`
      : `직접 보강 생성 준비 (${targetId})`;
    chipTitle = hasInsight
      ? "인사이트+요청사항 기반 심화 보강"
      : "인사이트 없이도 대상 선택 후 보강 가능";
    chipClassName =
      "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (chip) {
    chip.className = chipClassName;
    chip.title = chipTitle;
    chip.innerHTML = `<i class="fas fa-circle text-[8px]"></i>${escapeHtml(chipText)}`;
  }

  if (checklist) {
    const doneIcon = '<i class="fas fa-check-circle text-emerald-500"></i>';
    const pendingIcon = '<i class="far fa-circle text-slate-400"></i>';
    const traceIcon = hasTarget
      ? '<i class="fas fa-location-crosshairs text-indigo-500"></i>'
      : '<i class="fas fa-location-crosshairs text-slate-300"></i>';
    const traceText = hasTarget
      ? `자동 타겟: ${escapeHtml(targetInfo.sourceLabel)} · ${escapeHtml(targetInfo.targetId || `Q${targetIndex + 1}`)}`
      : "자동 타겟: 탐색 대기";
    checklist.innerHTML = `
      <div class="inline-flex items-center gap-1 ${hasInsight ? "text-emerald-700" : "text-slate-600"}">${hasInsight ? doneIcon : pendingIcon}인사이트</div>
      <div class="inline-flex items-center gap-1 ${hasTarget ? "text-emerald-700" : "text-slate-600"}">${hasTarget ? doneIcon : pendingIcon}타겟 문항</div>
      <div class="inline-flex items-center gap-1 ${hasUserRequest ? "text-emerald-700" : "text-slate-600"}">${hasUserRequest ? doneIcon : pendingIcon}사용자 요청</div>
      <div class="inline-flex items-center gap-1 col-span-2 ${hasTarget ? "text-indigo-700" : "text-slate-500"}">${traceIcon}${traceText}</div>
    `;
  }
}

function initAttachmentBoostButtonStateSync() {
  const select = document.getElementById("attachmentTargetQuestion");
  if (select) {
    select.addEventListener("change", updateAttachmentBoostButtonState);
    select.addEventListener("input", updateAttachmentBoostButtonState);
  }

  ["editing-questions-index", "studio-q-id"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) {
      return;
    }
    el.addEventListener("change", updateAttachmentBoostButtonState);
    el.addEventListener("input", updateAttachmentBoostButtonState);
  });

  const userRequest = document.getElementById("attachmentBoostUserRequest");
  if (userRequest) {
    userRequest.addEventListener("input", updateAttachmentBoostButtonState);
    userRequest.addEventListener("change", updateAttachmentBoostButtonState);
  }

  [
    "boostSourceWebDeep",
    "boostSourceTheory",
    "boostSourceNotebookLm",
    "boostSourceFlowith",
    "boostSourceInternet",
  ].forEach((id) => {
    const sourceEl = document.getElementById(id);
    if (!sourceEl) return;
    sourceEl.addEventListener("change", updateAttachmentBoostButtonState);
  });

  updateAttachmentBoostButtonState();
}

let attachmentOcrBootstrapPromise = null;

async function ensureAttachmentOcrEngine() {
  if (window.Tesseract && typeof window.Tesseract.recognize === "function") {
    return true;
  }

  if (attachmentOcrBootstrapPromise) {
    return attachmentOcrBootstrapPromise;
  }

  attachmentOcrBootstrapPromise = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "vendor/js/tesseract.min.js";
    script.async = true;
    script.onload = () => {
      resolve(
        !!(
          window.Tesseract && typeof window.Tesseract.recognize === "function"
        ),
      );
    };
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });

  return attachmentOcrBootstrapPromise;
}

// normalizeOcrText is defined in utils.js — using global version

async function runAttachmentOcr(source) {
  const ready = await ensureAttachmentOcrEngine();
  if (!ready) {
    return "";
  }

  try {
    const langPath = `${window.location.origin}/`;
    const result = await window.Tesseract.recognize(source, "kor+eng", {
      langPath,
    });
    return normalizeOcrText(result?.data?.text || "", 50000);
  } catch {
    return "";
  }
}

async function extractPdfPageTextWithOcr(page) {
  try {
    const viewport = page.getViewport({ scale: 2.2 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    await page.render({ canvasContext: context, viewport }).promise;
    return runAttachmentOcr(canvas);
  } catch {
    return "";
  }
}

async function readAttachmentTextExcerpt(file) {
  const ext = (file.name || "").toLowerCase().split(".").pop() || "";
  const type = file.type || "";

  if (type.startsWith("text/") || ["txt", "md", "csv", "json"].includes(ext)) {
    const text = await file.text();
    return text.slice(0, 50000); // 5000 -> 50000 확장
  }

  if ((type === "application/pdf" || ext === "pdf") && window.pdfjsLib) {
    const buffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;
    window.visualPdfDoc = pdf; // 시각화를 위해 문서 저장
    const pages = Math.min(pdf.numPages, 30); // 10 -> 30페이지까지 분석 (기술사 시험지 대응)
    const parts = [];
    window.visualTextCache = []; // 초기화

    for (let pageNum = 1; pageNum <= pages; pageNum += 1) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();

      // 좌표 정보 포함하여 캐싱
      const pageTexts = content.items.map((item) => {
        const tx = item.transform; // [scaleX, skewY, skewX, scaleY, transX, transY]
        return {
          str: item.str,
          x: tx[4],
          y: tx[5],
          w: item.width,
          h: item.height,
          transform: tx,
        };
      });

      window.visualTextCache.push({ page: pageNum, texts: pageTexts });
      const pageText = content.items.map((item) => item.str).join(" ");

      const compactPageText = normalizeOcrText(pageText, 20000);
      if (compactPageText.length >= 60) {
        parts.push(compactPageText + "\n");
      } else {
        const ocrText = await extractPdfPageTextWithOcr(page);
        if (ocrText.length >= 20) {
          parts.push(`[OCR:${pageNum}p] ${ocrText}\n`);
        } else {
          parts.push(pageText + "\n");
        }
      }
    }

    let fullText = parts.join("\n");
    // 텍스트 세정 (Cleaning): 깨진 특수 유니코드(\uf000 계열) 및 불필요한 컨트롤 문자 제거
    // \u0000(NUL)은 제어문자이므로 별도 이스케이프; PUA 영역 제거
    fullText = fullText.replace(/[\uE000-\uF8FF]/g, "").replace(/\0/g, "");

    return fullText.slice(0, 150000);
  }

  if (type.startsWith("image/")) {
    const imageUrl = URL.createObjectURL(file);
    try {
      const ocrText = await runAttachmentOcr(imageUrl);
      if (ocrText.length >= 20) {
        return `[이미지 OCR] ${ocrText}`;
      }
      return `이미지 파일 메타정보: ${file.name}, ${Math.round(file.size / 1024)}KB (OCR 텍스트 미검출)`;
    } finally {
      URL.revokeObjectURL(imageUrl);
    }
  }

  if (type.startsWith("video/")) {
    return `동영상 파일 메타정보: ${file.name}, ${Math.round(file.size / (1024 * 1024))}MB`;
  }

  return `파일 메타정보: ${file.name}, type=${type || "unknown"}, size=${file.size}`;
}

function initReviewerControls() {
  document.getElementById("revPrevBtn").onclick = () => {
    if (revCurrentPage > 1) {
      revCurrentPage--;
      renderReviewerPdf(revCurrentPage);
      renderReviewerList(window.currentReviewingQuestions);
    }
  };
  document.getElementById("revNextBtn").onclick = () => {
    if (visualPdfDoc && revCurrentPage < visualPdfDoc.numPages) {
      revCurrentPage++;
      renderReviewerPdf(revCurrentPage);
      renderReviewerList(window.currentReviewingQuestions);
    }
  };
}

function buildLocalAttachmentInsight(items, focus, title = "첨부자료") {
  const rawText = items
    .map((item) => item.textExcerpt || "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  const fallback =
    rawText || `${title} 분석 결과를 기반으로 핵심 포인트를 정리합니다.`;
  const firstChunk = fallback.slice(0, 240);
  const words = fallback
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2)
    .slice(0, 120);

  const freq = new Map();
  words.forEach((word) => {
    freq.set(word, (freq.get(word) || 0) + 1);
  });
  const keyPoints = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => `핵심 키워드: ${word}`);

  return {
    summary: `${title} 요약: ${firstChunk}${fallback.length > 240 ? "..." : ""}`,
    keyPoints: keyPoints.length
      ? keyPoints
      : ["핵심 포인트를 추출할 텍스트가 부족합니다."],
    answerBoost: [
      `- 첨부자료 분석 초점: ${focus || "일반"} 관점에서 근거를 보강함.`,
      "- 기준/정의 → 원인/메커니즘 → 대책/결론 순으로 답안을 구조화함.",
      "- 수치·도해·비교표 제시 시 채점 가독성이 향상됨.",
    ].join("\n"),
  };
}

function shouldAutoAttachTheoryKnowledge(focusText) {
  const focus = String(focusText || "").toLowerCase();
  return /(이론|지식|개념|서브노트|theory|knowledge|concept)/.test(focus);
}

function makeTheoryTitleFromFileName(name, fallbackIndex = 1) {
  const base = String(name || "")
    .replace(/\.[^./\\]+$/, "")
    .replace(/[._-]+/g, " ")
    .trim();
  return base || `첨부 이론 ${fallbackIndex}`;
}

function extractTopTheoryTags(text, maxCount = 5) {
  const stop = new Set([
    "그리고",
    "또한",
    "대한",
    "기준",
    "설계",
    "검토",
    "적용",
    "구조",
    "문제",
    "정리",
  ]);

  const words = String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !stop.has(token));

  const freq = new Map();
  words.forEach((word) => {
    freq.set(word, (freq.get(word) || 0) + 1);
  });
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxCount)
    .map(([word]) => word);
}

function buildTheoryEntriesFromAnalyzedFiles(items, insight, focus) {
  const keyPoints = Array.isArray(insight?.keyPoints) ? insight.keyPoints : [];
  const entries = [];

  (Array.isArray(items) ? items : []).forEach((item, idx) => {
    const excerpt = String(item?.textExcerpt || "")
      .replace(/\s+/g, " ")
      .trim();
    if (excerpt.length < 50) {
      return;
    }

    const title = makeTheoryTitleFromFileName(item?.name, idx + 1);
    const tags = extractTopTheoryTags(excerpt);
    const roundRaw =
      typeof inferExamRoundFromText === "function"
        ? inferExamRoundFromText(excerpt)
        : "미지정";
    const round =
      typeof normalizeExamRound === "function"
        ? normalizeExamRound(roundRaw || "미지정", "미지정")
        : roundRaw || "미지정";

    const content = [
      `[첨부 원문 요약] ${excerpt.slice(0, 1200)}${excerpt.length > 1200 ? "..." : ""}`,
      keyPoints.length
        ? `[핵심 포인트] ${keyPoints.slice(0, 3).join(" / ")}`
        : "",
      `[분석 초점] ${focus || "일반"}`,
    ]
      .filter(Boolean)
      .join("\n");

    entries.push({
      title,
      category: "첨부이론",
      examRound: round || "미지정",
      tags: [...new Set(["첨부자동", ...tags])],
      source: `AttachmentAuto:${item?.name || "unknown"}`,
      content,
    });
  });

  return entries;
}

function appendTheoryEntriesToKnowledgeBase(entries) {
  const list = Array.isArray(entries) ? entries : [];
  if (!list.length) {
    return 0;
  }

  let data;
  try {
    data = getCurrentAnswerData();
  } catch {
    return 0;
  }

  const exists = new Set(
    (data.theories || []).map(
      (row) =>
        `${String(row.title || "").trim()}|${String(row.source || "").trim()}`,
    ),
  );

  let added = 0;
  list.forEach((entry) => {
    const key = `${String(entry.title || "").trim()}|${String(entry.source || "").trim()}`;
    if (exists.has(key)) {
      return;
    }
    const nextId = `TH-${String((data.theories || []).length + 1).padStart(3, "0")}`;
    data.theories.push({
      id: nextId,
      title: entry.title || "첨부 이론",
      category: entry.category || "첨부이론",
      examRound: entry.examRound || "미지정",
      tags: Array.isArray(entry.tags) ? entry.tags : ["첨부자동"],
      source: entry.source || "AttachmentAuto",
      content: entry.content || "",
    });
    exists.add(key);
    added += 1;
  });

  if (added > 0) {
    syncJsonAndRender(
      data,
      `첨부 이론 자동 등록 완료: ${added}개 (이론 지식베이스 반영)`,
    );
  }

  return added;
}

function openPdfVisualModal() {
  // 실제 구현은 js/pdf.js에 있습니다. 이 래퍼는 pdf.js 로드 전 호출을 안전하게 처리합니다.
  if (typeof window._openPdfVisualModalImpl === "function") {
    window._openPdfVisualModalImpl();
  } else if (!window.visualPdfDoc) {
    setDataStatus("먼저 PDF 파일을 첨부하고 추출 버튼을 눌러주세요.", "info");
  }
}

// analyzeAttachedFiles() 및 analyzeAttachedWebsite()는 js/ingestion.js의 runUnifiedIngestion()으로 통합되었습니다.

async function applyAttachmentInsightToQuestion() {
  if (window.__attachmentBoostBusy) {
    return;
  }

  const data =
    typeof window.getCurrentAnswerData === "function"
      ? window.getCurrentAnswerData()
      : window.App.State.data;

  const selectedIndex = resolveAttachmentTargetQuestionIndex(data || {});
  if (selectedIndex < 0) {
    setAttachmentStatus(
      "보강할 문항이 없습니다. 답안을 선택/편집 후 다시 시도하세요.",
      "error",
    );
    updateAttachmentBoostButtonState();
    return;
  }

  if (!data || !data.questions || !data.questions[selectedIndex]) {
    setAttachmentStatus("선택한 문제를 찾지 못했습니다.", "error");
    updateAttachmentBoostButtonState();
    return;
  }

  window.__attachmentBoostBusy = true;
  updateAttachmentBoostButtonState();

  const target = data.questions[selectedIndex];
  const insight = window.latestAttachmentInsight || {};
  const userRequest = getAttachmentBoostUserRequest();
  const sourcePrefs = getAttachmentBoostSourcePreferences();
  const sourceLabels = sourcePrefs.labels;
  const theorySnippets = selectAttachmentBoostTheories(target, data?.theories || [], 3);

  try {
    setAttachmentStatus("심화 보강 생성 중... (AI + 선택 소스 반영)", "info");

    const generatedBoost = await generateDeepAttachmentBoost({
      target,
      insight,
      userRequest,
      sourceLabels,
      theorySnippets,
    });

    const finalBoost = String(generatedBoost || "").trim() ||
      buildAttachmentBoostFallback({
        target,
        insight,
        userRequest,
        sourceLabels,
        theorySnippets,
      });

    const requestLine = userRequest ? `요청사항: ${userRequest}` : "요청사항: 기본 심화";
    const sourceLine = sourceLabels.length
      ? `탐색소스: ${sourceLabels.join(", ")}`
      : "탐색소스: 기본(웹/이론/학습자료)";
    const timestamp = new Date().toLocaleString("ko-KR");
    const boostHeader = `[심화 보강 ${timestamp}]\n- ${requestLine}\n- ${sourceLine}`;
    const boostBlock = `\n\n${boostHeader}\n${finalBoost}`;
    const currentAnswer = String(target.modelAnswer || "").trim();

    target.modelAnswer = `${currentAnswer}${boostBlock}`.trim();

    if (!target.source || target.source === "-") {
      target.source = "Intelligence Hub DeepBoost";
    } else if (!/Hub|DeepBoost/i.test(target.source)) {
      target.source = `${target.source} + HubDeepBoost`;
    }

    if (typeof window.syncJsonAndRender === "function") {
      window.syncJsonAndRender(
        data,
        `${target.id || `Q${selectedIndex + 1}`} 문항 심화 보강 완료`,
      );
    }

    const statusDetail = sourceLabels.length
      ? ` (${sourceLabels.join(", ")})`
      : "";
    setAttachmentStatus(`문항 심화 보강이 반영되었습니다.${statusDetail}`, "success");
  } catch (error) {
    setAttachmentStatus(
      `보강 생성 중 오류가 발생했습니다: ${error?.message || "unknown"}`,
      "error",
    );
  } finally {
    window.__attachmentBoostBusy = false;
    updateAttachmentBoostButtonState();
  }
}

function setTheoryStatus(message, type = "info") {
  const statusEl = document.getElementById("theoryStatus");
  if (!statusEl) return;
  const colorMap = {
    info: "text-slate-500",
    success: "text-emerald-700",
    error: "text-rose-700",
  };
  statusEl.className = `mt-2 text-xs ${colorMap[type] || colorMap.info}`;
  statusEl.textContent = message;
}

function setPipelineReport(reportText, type = "success") {
  const el = document.getElementById("pipelineReport");
  if (!el) return;
  const styleMap = {
    success:
      "mt-3 text-xs rounded border border-emerald-200 bg-emerald-50 p-3 text-emerald-800",
    info: "mt-3 text-xs rounded border border-slate-200 bg-slate-50 p-3 text-slate-700",
    error:
      "mt-3 text-xs rounded border border-rose-200 bg-rose-50 p-3 text-rose-800",
  };
  el.className = styleMap[type] || styleMap.info;
  el.textContent = reportText;
  el.classList.remove("hidden");
}

function deleteSelectedGlobalRound() {
  const globalRoundSelect = document.getElementById("globalRoundSelect");
  const selectedRound = globalRoundSelect ? globalRoundSelect.value : "";

  if (!selectedRound) {
    setDataStatus("삭제할 회차를 먼저 선택하세요.", "error");
    return;
  }

  if (!confirm(`${selectedRound} 회차 데이터를 삭제하시겠습니까?`)) return;

  const data =
    typeof window.getCurrentAnswerData === "function"
      ? window.getCurrentAnswerData()
      : window.App.State.data;
  if (!data) return;

  data.questions = data.questions.filter(
    (q) => window.utils.extractRoundOnly(q.examRound) !== selectedRound,
  );
  data.theories = data.theories.filter(
    (t) => window.utils.extractRoundOnly(t.examRound) !== selectedRound,
  );

  if (typeof window.syncJsonAndRender === "function") {
    window.syncJsonAndRender(data, `${selectedRound} 회차 삭제 완료`);
  }

  if (typeof window.updateGlobalRoundLabels === "function") {
    window.updateGlobalRoundLabels("");
  }
  const filterRound = document.getElementById("filterRound");
  if (filterRound) filterRound.value = "";
}

// ==========================================
// DROPZONE UI INTEGRATION (Python Daemon)
// ==========================================

// uploadToDropzone() 및 refreshDropzoneStatus()는 js/ingestion.js의 통합 로직으로 대체되었거나 백라운드 폴링만 유지합니다.

async function refreshDropzoneStatus() {
  const icon = document.getElementById("dropzoneSpinIcon");
  if (icon) icon.classList.add("fa-spin");
  try {
    const baseUrl =
      typeof window.getAnalyzeBackendUrl === "function"
        ? window.getAnalyzeBackendUrl()
        : "http://localhost:8787";
    const res = await fetch(`${baseUrl}/api/dropzone-status`);
    if (res.ok) {
      const data = await res.json();
      const qCount = document.getElementById("dzQueueCount");
      const sCount = document.getElementById("dzStoredCount");
      if (qCount) {
        qCount.textContent = data.pendingCount || 0;
        if (data.pendingCount > 0) {
          qCount.classList.add("animate-pulse", "text-rose-400");
        } else {
          qCount.classList.remove("animate-pulse", "text-rose-400");
        }
      }
      if (sCount) {
        sCount.textContent = data.storedCount || 0;
      }
    }
  } catch (err) {
    // 백엔드 미연결 시 불필요한 콘솔 오류 노이즈 감소
    if (err.name !== "AbortError") {
      console.debug("Dropzone status refresh skipped: backend unreachable");
    }
  } finally {
    if (icon) setTimeout(() => icon.classList.remove("fa-spin"), 500);
  }
}

// 배경 상태 폴링
setInterval(refreshDropzoneStatus, 15000);
setTimeout(refreshDropzoneStatus, 2000);

/**
 * Modern Toast Notification System
 * type: 'success' | 'error' | 'info'
 */
function showToast(message, type = "info", duration = 4000) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  let icon = "info";
  if (type === "success") icon = "check-circle";
  if (type === "error") icon = "x-circle";

  toast.innerHTML = `
    <div class="flex items-center gap-2">
      <i class="fas fa-${icon}"></i>
      <span>${message}</span>
    </div>
    <button class="opacity-50 hover:opacity-100" onclick="this.parentElement.remove()">
      <i class="fas fa-times"></i>
    </button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("fade-out");
    setTimeout(() => {
      if (toast.parentElement) toast.remove();
    }, 300);
  }, duration);
}

/**
 * Toggle Dark Mode
 */
function toggleDarkMode() {
  const isDark = document.documentElement.classList.toggle("dark");
  const storage = window.safeLocalStorage || localStorage;
  if (storage && typeof storage.setItem === "function") {
    storage.setItem("solve_theme", isDark ? "dark" : "light");
  }
  
  // Update icons if necessary
  const icon = document.querySelector('button[onclick="toggleDarkMode()"] i');
  if (icon) {
    if (isDark) {
      icon.classList.remove("fa-moon");
      icon.classList.add("fa-sun");
    } else {
      icon.classList.remove("fa-sun");
      icon.classList.add("fa-moon");
    }
  }
}

/**
 * Toggle between List and Grid view
 */
function toggleViewMode() {
  console.log("[UI] View mode toggle clicked");
  const container = document.getElementById("answerList");
  if (!container) {
    console.warn("[UI] answerList container not found for view toggle.");
    return;
  }
  
  const isGrid = container.classList.toggle("grid-view");
  if (isGrid) {
    container.classList.add("grid", "grid-cols-1", "md:grid-cols-2", "gap-4");
    window.showToast("카드 그리드 뷰로 전환되었습니다.", "info");
  } else {
    container.classList.remove("grid", "grid-cols-1", "md:grid-cols-2", "gap-4");
    window.showToast("리스트 뷰로 전환되었습니다.", "info");
  }
}

// Initialize Theme on Load
(function initTheme() {
  const storage = window.safeLocalStorage || localStorage;
  const savedTheme = storage && typeof storage.getItem === "function" ? storage.getItem("solve_theme") : null;
  if (savedTheme === "dark") {
    document.documentElement.classList.add("dark");
    const icon = document.querySelector('button[onclick="toggleDarkMode()"] i');
    if (icon) {
      icon.classList.remove("fa-moon");
      icon.classList.add("fa-sun");
    }
  }
})();

/**
 * Refresh AI Model List
 */
async function refreshModelList() {
  if (window.Debug) {
    window.Debug.log("ai", "refresh model list start", {
      provider: document.getElementById("aiProvider")?.value || "",
    });
  }
  console.log("[UI] Refresh model list requested");
  const icon = document.getElementById("modelRefreshIcon");
  if (icon) icon.classList.add("fa-spin");
  
  try {
    if (typeof window.App?.initAiModels === "function") {
      await window.App.initAiModels();
      if (window.Debug) {
        window.Debug.log("ai", "refresh model list success", {
          selected: document.getElementById("aiAvailableModelSelect")?.value || "",
        });
      }
      window.showToast("모델 목록을 새로고침했습니다.", "success");
    } else {
      if (window.Debug) {
        window.Debug.warn("ai", "App.initAiModels missing");
      }
      console.warn("App.initAiModels not found.");
      window.showToast("모델 초기화 기능을 찾을 수 없습니다.", "error");
    }
  } catch (err) {
    if (window.Debug) {
      window.Debug.error("ai", "refresh model list failed", {
        message: err?.message || String(err),
      });
    }
    window.showToast("모델 목록 갱신 실패", "error");
  } finally {
    if (icon) setTimeout(() => icon.classList.remove("fa-spin"), 500);
  }
}

/**
 * Evaluate Round Quality (Stub)
 */
function evaluteRoundQuality() {
  console.log("Round evaluation clicked - Functional in specific views.");
  window.showToast("현재 뷰에서는 품질 분석이 지원되지 않습니다.", "info");
}

/**
 * Update Buckling Chart from slider
 */
function updateBuckling() {
  const kInput = document.getElementById("kInput");
  if (!kInput) return;
  const K = parseFloat(kInput.value) || 1.0;

  const kValueEl = document.getElementById("kValue");
  if (kValueEl) kValueEl.innerText = K.toFixed(1);

  const chart = window.bucklingChartInstance;
  if (!chart) return;

  const E = 205000;
  const Fy = 235;
  const newEuler = [];
  const newDesign = [];

  chart.data.labels.forEach((lam) => {
    const kLam = K * lam;
    let Fe = kLam === 0 ? Fy : (Math.PI * Math.PI * E) / (kLam * kLam);
    newEuler.push(Math.min(Fe, Fy * 1.5));
    let Fcr = Fe >= 0.44 * Fy ? Fy * Math.pow(0.658, Fy / Fe) : 0.877 * Fe;
    newDesign.push(Fcr);
  });

  chart.data.datasets[0].data = newEuler;
  chart.data.datasets[1].data = newDesign;
  chart.update();
}


/**
 * Aliases for compatibility with HTML
 */
window.refreshAvailableModels = refreshModelList;
window.updateVibration = updateVibration;
window.updateBuckling = updateBuckling;
window.switchTab = switchTab;

window.toggleDarkMode = toggleDarkMode;
window.toggleViewMode = toggleViewMode;
window.refreshModelList = refreshModelList;
window.evaluteRoundQuality = evaluteRoundQuality;
window.showToast = showToast;
window.applyAttachmentInsightToQuestion = applyAttachmentInsightToQuestion;
window.updateAttachmentBoostButtonState = updateAttachmentBoostButtonState;
window.deleteSelectedGlobalRound = deleteSelectedGlobalRound;

document.addEventListener("DOMContentLoaded", initAttachmentBoostButtonStateSync);
