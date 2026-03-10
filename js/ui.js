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

function isDRegionTopicForBoost(text = "") {
  const src = String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  if (!src) return false;

  if (/d[\s-]?region|응력\s*교란\s*구역|응력\s*교란|strut\s*[- ]?\s*tie|stm\b|스트럿\s*[-·]?\s*타이|스트럿타이/.test(src)) {
    return true;
  }

  const hasStrut = /(^|[^a-z])strut([^a-z]|$)|스트럿/.test(src);
  const hasTie = /(^|[^a-z])tie([^a-z]|$)|타이\s*모델|타이\s*부재|타이\s*요소/.test(src);
  return hasStrut && hasTie;
}

function inferBoostTopicType(target = {}) {
  const seed = `${target?.title || ""} ${target?.rawQuestion || ""} ${target?.modelAnswer || ""}`;
  const src = String(seed || "").toLowerCase();

  if (isDRegionTopicForBoost(src)) {
    return "d-region";
  }
  if (/psc|긴장재|부식|지연파괴|그라우팅/.test(src)) {
    return "psc";
  }
  return "general";
}

function buildAttachmentBoostFallback({
  target,
  insight,
  userRequest,
  sourceLabels: _sourceLabels,
  theorySnippets,
}) {
  const prompt = `${target?.title || ""} ${target?.rawQuestion || ""}`;
  const isShort = /1\s*교시|10\s*점|단답|용어/.test(prompt);
  const minChars = isShort ? 1200 : 2200;

  const insightBoost = String(insight?.answerBoost || "").trim();
  const summary = String(insight?.summary || "").trim();
  const answerDirection = userRequest
    ? `${userRequest}`
    : "정의 정확성, 메커니즘 인과성, 기준·수치 근거 중심";
  const theoryScope = theorySnippets.length
    ? theorySnippets.map((item) => item.title || "이론").join(" / ")
    : "핵심어 기반 보강";

  const topicType = inferBoostTopicType(target);
  const isDRegion = topicType === "d-region";
  const isPsc = topicType === "psc";

  const expanded = [
    "1. 정의 및 적용 배경",
    `- 대상: ${target?.title || "문항"}`,
    `- 응답 방향: ${answerDirection}`,
    isDRegion
      ? "- 응력 교란구역(D-Region, Discontinuity Region)은 베르누이 평면유지 가정이 성립하지 않는 불연속 구간으로, 재하점·지점부·단면 급변부·개구부 인근에서 지배적으로 나타난다."
      : isPsc
        ? "- PSC 부재는 긴장재 정착·부식·그라우팅 결함에 따라 구조성능 저하가 급격히 진행될 수 있으므로, 하중저항 메커니즘과 내구 리스크를 통합 검토해야 한다."
        : "- 본 문항은 하중 경로(Load Path), 내부력(Internal Force), 지배 파괴모드(Failure Mode)의 인과관계를 중심으로 해석·설계·시공·유지관리 대책을 일관되게 제시해야 한다.",
    isDRegion
      ? "- 따라서 단면해석 중심의 B-Region 접근만으로는 안전측 검토가 부족할 수 있으며, 하중 경로 기반의 국부 거동 검토가 필요하다."
      : isPsc
        ? "- 따라서 단순 강도 검토뿐 아니라 정착/부식/시공품질에 의한 성능저하 경로를 함께 점검해야 실무 안전성을 확보할 수 있다."
        : "- 따라서 기준식 판정뿐 아니라 상세·시공 오차·운영단계 모니터링을 함께 고려해 실효성 있는 결론을 도출해야 한다.",
    `- 관련 이론은 ${theoryScope}를 축으로 연계하여 기준·상세·시공 대책까지 일관되게 제시한다.`,
    "",
    "2. 거동 메커니즘 (Load Path → Internal Force → Failure Mode)",
    isDRegion
      ? "- 하중(Load)은 작용점에서 단면 내 압축연단/인장연단으로 전달되며, 전단지배 구간에서는 스트럿-타이(압축지주-인장타이) 거동을 동반한다."
      : isPsc
        ? "- 하중 전달 중 긴장재의 유효프리스트레스가 감소하면 균열 제어 및 내하력이 저하되고, 정착부/부식 취약 구간에서 파괴 위험이 증폭된다."
        : "- 하중(Load)은 작용점에서 지점으로 전달되며, 이 과정에서 휨·전단·정착/부착 거동이 상호작용한다.",
    isDRegion
      ? "- 내부력 재분배 과정에서 응력집중이 발생하는 구간(재하점, 지점부, 단면 급변부)을 D-Region 후보로 식별하고, B-Region 가정과 분리해 검토한다."
      : isPsc
        ? "- 시공결함(그라우팅 공극·누수·염화물 유입)이 결합되면 긴장재 단면 손실과 국부 취약부가 확대되므로, 원인-결과 경로를 단계적으로 식별한다."
        : "- 내부력 재분배 과정에서 취약 구간을 식별하고, 지배모드에 맞는 보강 상세를 우선순위화한다.",
    "- 지배 파괴모드는 ① 휨 ② 전단 ③ 정착/부착 ④ 사용성(균열·처짐) 순으로 스크리닝하고, 최종 지배모드를 기준으로 보강 상세를 선정한다.",
    "",
    "3. 설계 검토 및 기준·수치 근거",
    "- 코드 근거: KDS 관련 조항을 직접 명시하고, 설계 검토식(예: φMn ≥ Mu, Vn ≥ Vu, 정착길이 ld 검토)을 답안 본문에 병기한다.",
    "- 수치 제시: 하중조합, 안전율/저항계수, 허용기준(균열폭·처짐)을 단위와 함께 표기한다.",
    "- 판정 로직: 기준값 대비 여유도(Margin)를 제시하고, 여유도 부족 시 단면증대/배근보강/상세개선 대안을 제시한다.",
    "",
    "4. 상세·시공·유지관리 대책",
    isDRegion
      ? "- 상세 설계: D-Region 경계부의 정착 취약구간을 우선 식별하고 스터럽/정착길이/배근 정착상세를 보강한다."
      : isPsc
        ? "- 상세 설계: 긴장재 정착부, 쉬스 접합부, 그라우팅 품질 항목을 핵심 품질게이트로 설정하고 취약 상세를 우선 보강한다."
        : "- 상세 설계: 취약 단면의 정착·전단·균열 제어 상세를 우선 식별하고 보강한다.",
    "- 시공 관리: 배근 간섭, 피복두께, 다짐 품질, 타설 조인트를 품질게이트로 관리하여 취성파괴 위험을 억제한다.",
    "- 유지관리: 균열폭·변위·누수 지표를 계측하고 임계치 초과 시 보수 시나리오를 즉시 적용한다.",
    "",
    "5. 도해 및 비교표",
    "- [도해-1] 단면 기준 하중경로(Load Path), 내부력(휨모멘트/전단력), 취약 구간을 화살표 및 음영으로 표현",
    isDRegion
      ? "- [도해-2] D-Region과 B-Region 경계, 정착 취약부, 보강 상세(스터럽/정착길이) 배치도를 함께 제시"
      : isPsc
        ? "- [도해-2] PSC 정착부/그라우팅 취약부와 균열·부식 전이 경로를 단계도로 제시"
        : "- [도해-2] 지배 파괴모드와 보강 상세(전단보강/정착/균열제어) 연계 배치도를 제시",
    "- [비교표] 대안 A/B를 안전성·시공성·경제성·유지관리성·리스크(균열/내구) 항목으로 정량·정성 비교",
    "",
    "6. 결론 및 기술사 제언",
    summary
      ? `- 출처 요약 반영: ${summary.slice(0, 420)}`
      : "- 출처 요약 반영: 첨부/웹 자료 핵심 포인트를 구조화하여 결론부에 연결함.",
    insightBoost
      ? `- 추가 근거: ${insightBoost.slice(0, 420)}`
      : "- 추가 근거: 기준/수치/KDS 근거를 결론부까지 연결하고, 점검주기·모니터링 항목을 운영계획으로 명시함.",
    "- 제언: 시공 단계 품질게이트(배근·정착·타설)와 유지관리 단계 모니터링(균열폭, 변위, 누수)을 연동한 폐루프 관리체계를 적용한다.",
  ].join("\n");

  const compact = expanded.replace(/\s+/g, "").length;
  if (compact >= minChars) {
    return expanded;
  }

  const padding = [
    "",
    "[분량 보강 블록]",
    "- 추가 검토: 하중조합별 지배 단면을 재산정하고, 취약 단면의 보강 전/후 여유도 변화를 정리한다.",
    "- 추가 검토: 시공 단계 오차(피복두께, 정착길이, 다짐 품질)가 내구성·균열 제어에 미치는 영향을 사례 기반으로 기술한다.",
    "- 추가 검토: 유지관리 단계에서 점검주기, 계측항목, 임계치 초과 시 대응 프로토콜을 제시한다.",
  ].join("\n");

  return `${expanded}${padding}`.trim();
}

function sanitizeBoostForExamSubmission(text = "") {
  const raw = String(text || "").trim();
  if (!raw) return "";

  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^\[심화\s*보강/i.test(line))
    .filter((line) => !/^-\s*요청사항\s*:/i.test(line))
    .filter((line) => !/^-\s*탐색소스\s*:/i.test(line))
    .filter((line) => !/^\[연계\s*이론\s*스니펫\]/i.test(line))
    .filter((line) => !/^\[분량\s*보강\s*블록\]/i.test(line))
    .filter((line) => !/^\[검색\s*컨텍스트\s*요약\]/i.test(line))
    .filter((line) => !/^근거첨부$/i.test(line))
    .filter((line) => !/본\s*답안은.*원칙으로\s*작성/i.test(line))
    .filter((line) => !/근거\s*반영\s*범위/i.test(line))
    .filter((line) => !/연계\s*이론\s*축/i.test(line))
    .filter((line) => !/^[-–—]\s*응답\s*방향\s*:/i.test(line))
    .filter((line) => !/^-\s*요청\s*반영\s*:/i.test(line))
    .filter((line) => !/^-\s*탐색\s*경로\s*:/i.test(line))
    .filter((line) => !/^-\s*탐색소스\s*:/i.test(line))
    .filter((line) => !/^-\s*이론\s*연계\s*:/i.test(line))
    .filter((line) => !/^-\s*채점관\s*관점\s*핵심\s*:/i.test(line))
    .filter((line) => !/^\d+\.\s*문제\s*재정의\s*및\s*채점\s*포인트/.test(line))
    .filter((line) => !/^4\.\s*근거\s*통합/.test(line))
    .filter((line) => !/^\|\s*단계\s*\|\s*소스\s*\|\s*핵심근거\s*\|\s*답안\s*적용\s*\|/i.test(line))
    .filter((line) => !/^\|---\|---\|---\|---\|/.test(line))
    .filter((line) => !/^\|\s*[1-5]\s*\|/.test(line))
    .filter((line) => !/^\|\s*#\s*\|\s*이론명\s*\|/.test(line))
    .filter((line) => !/^\|\s*\d+\s*\|/.test(line));

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
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
    "목표: 기존 답안에 바로 붙일 수 있는 '직접 답안형 보강 문단'을 생성한다.",
    `탐색 경로(우선): ${sourceLabels.length ? sourceLabels.join(", ") : "웹 딥리서치, 이론 자료, Notebook LM, Flowith, 인터넷 검색"}`,
    userRequest
      ? `사용자 요청사항(최우선 반영): ${userRequest}`
      : "사용자 요청사항: 없음(기본 심화 보강)",
    "작성 규칙:",
    "- 절대 메타 지시문(예: 작성합니다/포함합니다) 금지, 직접 답안 문장으로 작성",
    "- 번호형 개조식(예: 5., 5.1, 5.2)으로 바로 제출 가능한 본문 작성",
    "- 기준/메커니즘/실무대책/결론의 4단 구조",
    "- 최소 분량: 1교시는 1200자 이상, 2~4교시는 2200자 이상",
    "- 제출 본문에는 탐색 로그/타임스탬프/근거첨부 표를 쓰지 않는다(내부 audit로만 관리)",
    "- [도해] 1개, [비교표] 1개를 본문에 명시",
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

  const sourceBundle = {
    blocks: {
      storedTheory: theorySnippets.length
        ? theorySnippets
            .map((item, idx) => {
              const body = String(item?.content || "")
                .replace(/\s+/g, " ")
                .trim()
                .slice(0, 180);
              return `- 저장 이론 ${idx + 1}: ${item?.title || "이론"} | ${body}`;
            })
            .join("\n")
        : "- 저장 이론 매칭 없음",
      notebookLm: sourceLabels.includes("Notebook LM")
        ? `- Notebook LM 활성 | ${insightSummary.slice(0, 180) || "요약 없음"}`
        : "- Notebook LM 비활성",
      flowith: sourceLabels.includes("Flowith 지식정원")
        ? `- Flowith 활성 | ${insightBoost.slice(0, 180) || "보강 없음"}`
        : "- Flowith 비활성",
      insight: `- 웹/첨부 인사이트: ${insightSummary.slice(0, 260) || "없음"}`,
    },
  };

  try {
    const response = await window.generateAnswer(
      questionPayload,
      instruction,
      "text",
      {
        mandatoryPipeline: true,
        sourceBundle,
        outputStyle: "exam-answer",
      },
    );
    return String(response?.answer || "").trim();
  } catch (err) {
    // If backend returned a structured payload (e.g., 424 mandatory_pipeline_incomplete), show details
    const payload = err && err.payload ? err.payload : null;
    if (payload && payload.pipelineAudit) {
      const audit = payload.pipelineAudit;
      const refs = `딥리서치 참조 수: ${audit.deepResearchReferences || 0}`;
      const missingSteps = [];
      if (!audit.deepResearchParsed) missingSteps.push("딥리서치(구조화) 부족");
      if (!audit.stepChecks || !audit.stepChecks.allPassed) missingSteps.push("강제 단계 미통과");
      const msg = `강제 파이프라인 불충분: ${missingSteps.join(", ")}. ${refs}. 자세한 내용은 서버의 pipelineAudit를 확인하세요.`;
      if (typeof window.showToast === "function") {
        window.showToast(msg, "error");
      } else {
        setBackendStatus(msg, "error");
      }
      // open modal with full audit details if available
      if (typeof window.openPipelineAuditModal === "function") {
        try {
          window.openPipelineAuditModal(payload.pipelineAudit);
        } catch (e) {
          console.error("Failed to open pipeline audit modal:", e);
        }
      }
    } else {
      if (typeof window.showToast === "function") {
        window.showToast("강제 파이프라인 검증 실패: 저장자료/NotebookLM/Flowith/딥리서치 중 근거가 부족합니다.", "error");
      } else {
        setBackendStatus("강제 파이프라인 검증 실패: 저장자료/NotebookLM/Flowith/딥리서치 중 근거가 부족합니다.", "error");
      }
    }
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

function scoreDecodedAttachmentText(text) {
  const raw = String(text || "");
  if (!raw) return 0;

  const controlCount = Array.from(raw).reduce((acc, ch) => {
    const code = ch.charCodeAt(0);
    if ((code >= 0 && code <= 8) || code === 11 || code === 12 || (code >= 14 && code <= 31)) {
      return acc + 1;
    }
    return acc;
  }, 0);

  const replacementPenalty = (raw.match(/�/g) || []).length * 5;
  const controlPenalty = controlCount * 4;
  const hangulBonus = (raw.match(/[가-힣]/g) || []).length * 2;
  const printable = (raw.match(/[\p{L}\p{N}\p{P}\p{Zs}]/gu) || []).length;
  const mojibakePenalty = (raw.match(/[ÃÂâ€™â€œâ€â€˜]/g) || []).length * 3;

  return printable + hangulBonus - replacementPenalty - controlPenalty - mojibakePenalty;
}

function repairUtf8FromLatin1LikeText(text) {
  const source = String(text || "");
  if (!source) return source;

  try {
    const bytes = Uint8Array.from(
      Array.from(source).map((ch) => ch.charCodeAt(0) & 0xff),
    );
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    return source;
  }
}

async function decodeTextFileSmart(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const candidates = ["utf-8", "euc-kr", "windows-1252", "iso-8859-1"];

  let best = "";
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const encoding of candidates) {
    try {
      const decoded = new TextDecoder(encoding, { fatal: false }).decode(bytes);
      const repaired = repairUtf8FromLatin1LikeText(decoded);
      const scoreDecoded = scoreDecodedAttachmentText(decoded);
      const scoreRepaired = scoreDecodedAttachmentText(repaired);
      const candidate = scoreRepaired > scoreDecoded ? repaired : decoded;
      const candidateScore = Math.max(scoreDecoded, scoreRepaired);

      if (candidateScore > bestScore) {
        bestScore = candidateScore;
        best = candidate;
      }
    } catch {
      // continue
    }
  }

  if (best) return best;

  try {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
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
    const text = await decodeTextFileSmart(file);
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

    const looksLikeWeakBoost = (text) => {
      const src = String(text || "").toLowerCase();
      if (!src) return true;
      const genericPatterns = [
        "핵심 개념은 하중(load) 전달 경로와 저항(resistance) 메커니즘의 정합성",
        "설계 검토는 1) 지배 하중조합",
        "도해는 하중 작용점",
        "최종 제언은 시공 오차 저감",
        "정의 및 핵심 개념",
        "도해 1개",
        "비교표 1개",
      ];
      const genericHit = genericPatterns.filter((p) => src.includes(p)).length;
      const hasDiagram = /\[도해-?1\]|\[도해-?2\]|\[도해\]/.test(src);
      const hasQuestionAnalysis = /문제\s*핵심\s*분석|지배\s*파괴모드|검토\s*순서/.test(src);
      const hasConclusion = /결론|기술사\s*제언/.test(src);
      const compactLen = src.replace(/\s+/g, "").length;
      return (
        genericHit >= 2 ||
        compactLen < 1200 ||
        !hasDiagram ||
        !hasQuestionAnalysis ||
        !hasConclusion
      );
    };

    const generatedTrimmed = String(generatedBoost || "").trim();
    const finalBoost =
      generatedTrimmed && !looksLikeWeakBoost(generatedTrimmed)
        ? generatedTrimmed
        : buildAttachmentBoostFallback({
            target,
            insight,
            userRequest,
            sourceLabels,
            theorySnippets,
          });

    const sanitizedBoost = sanitizeBoostForExamSubmission(finalBoost);
    const boostBlock = `\n\n${sanitizedBoost}`;
    const currentAnswer = String(target.modelAnswer || "").trim();

    const looksLikeGenericScaffold = (text) => {
      const src = String(text || "").toLowerCase();
      if (!src) return true;
      const patterns = [
        "정의 및 핵심 개념",
        "문제의 핵심 개념을 영어 병기",
        "하중, 저항, 파괴모드를",
        "도해 1개",
        "비교표 1개",
      ];
      const hit = patterns.filter((p) => src.includes(p)).length;
      const compactLen = src.replace(/\s+/g, "").length;
      return hit >= 2 || compactLen < 350;
    };

    if (looksLikeGenericScaffold(currentAnswer)) {
      target.modelAnswer = sanitizedBoost;
    } else {
      target.modelAnswer = `${currentAnswer}${boostBlock}`.trim();
    }

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

    if (typeof window.editModelAnswerEntry === "function") {
      try {
        window.editModelAnswerEntry(selectedIndex);
      } catch {
        // 편집 폼 동기화 실패 시에도 보강 반영 자체는 유지
      }
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
