function showSection(sectionId) {
  // Hide all sections
  document.querySelectorAll(".content-section").forEach((el) => {
    el.classList.remove("active");
  });
  // Show target section
  document.getElementById(sectionId).classList.add("active");

  // Update Nav State
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    if (btn.dataset.target === sectionId) {
      btn.classList.add("bg-slate-700");
    } else {
      btn.classList.remove("bg-slate-700");
    }
  });
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

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setDataStatus(message, type = "info") {
  const statusEl = document.getElementById("dataStatus");
  const colorMap = {
    info: "text-slate-600",
    success: "text-emerald-700",
    error: "text-rose-700",
  };
  statusEl.className = `mt-3 text-sm ${colorMap[type] || colorMap.info}`;
  statusEl.textContent = message;
}

function setPdfStatus(message, type = "info") {
  const statusEl = document.getElementById("pdfStatus");
  const colorMap = {
    info: "text-slate-500",
    success: "text-emerald-700",
    error: "text-rose-700",
  };
  statusEl.className = `mt-2 text-xs ${colorMap[type] || colorMap.info}`;
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

function isValidWebUrl(value) {
  const text = String(value || "").trim();
  if (!text) {
    return false;
  }
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

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
}

function refreshAttachmentTargetOptions(questions) {
  const select = document.getElementById("attachmentTargetQuestion");
  if (!select) {
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
      parts.push(pageText + "\n");
    }

    let fullText = parts.join("\n");
    // 텍스트 세정 (Cleaning): 깨진 특수 유니코드(\uf000 계열) 및 불필요한 컨트롤 문자 제거
    // \u0000(NUL)은 제어문자이므로 별도 이스케이프; PUA 영역 제거
    fullText = fullText.replace(/[\uE000-\uF8FF]/g, "").replace(/\0/g, "");

    return fullText.slice(0, 150000);
  }

  if (type.startsWith("image/")) {
    return `이미지 파일 메타정보: ${file.name}, ${Math.round(file.size / 1024)}KB`;
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

async function analyzeAttachedFiles() {
  const input = document.getElementById("attachmentFiles");
  const files = Array.from(input.files || []);
  const focus = document.getElementById("attachmentFocus").value.trim();

  if (!files.length) {
    setAttachmentStatus("분석할 파일을 먼저 첨부하세요.", "error");
    return;
  }

  setAttachmentStatus("첨부 파일 분석 준비 중...", "info");

  const items = [];
  const baseUrl = isLikelyLmStudioEndpoint()
    ? window.__ANALYZE_BACKEND__ || "http://localhost:8787"
    : getBackendBaseUrl();

  for (const file of files) {
    try {
      let textExcerpt;
      // For audio/video try backend transcription endpoint first (mock)
      if (
        file.type &&
        (file.type.startsWith("video/") || file.type.startsWith("audio/"))
      ) {
        const asrMode =
          document.getElementById("asrModeSelect")?.value || "auto";
        if (asrMode === "disabled") {
          textExcerpt = await readAttachmentTextExcerpt(file);
        } else {
          // Try to upload the actual file to the backend transcribe endpoint (multipart/form-data)
          try {
            const fd = new FormData();
            fd.append("file", file, file.name);
            const tResp = await fetch(`${baseUrl}/api/transcribe`, {
              method: "POST",
              body: fd,
            });

            if (tResp.ok) {
              const tj = await tResp.json();
              textExcerpt =
                tj.transcript ||
                tj.text ||
                `동영상 파일 메타정보: ${file.name}, ${Math.round(file.size / (1024 * 1024))}MB`;
            } else {
              // Fallback to client-side metadata if backend fails
              textExcerpt = await readAttachmentTextExcerpt(file).catch(
                () =>
                  `동영상 파일 메타정보: ${file.name}, ${Math.round(file.size / (1024 * 1024))}MB`,
              );
            }
          } catch {
            // Network/backend failure -> fallback
            textExcerpt = await readAttachmentTextExcerpt(file).catch(
              () =>
                `동영상 파일 메타정보: ${file.name}, ${Math.round(file.size / (1024 * 1024))}MB`,
            );
          }
        }
      } else {
        textExcerpt = await readAttachmentTextExcerpt(file);
      }

      items.push({
        name: file.name,
        type: file.type,
        size: file.size,
        textExcerpt,
      });
    } catch {
      items.push({
        name: file.name,
        type: file.type,
        size: file.size,
        textExcerpt: `파일 읽기 실패: ${file.name}`,
      });
    }
  }
  try {
    setAttachmentStatus("백엔드 파일 분석 실행 중...", "info");
    const response = await fetch(`${baseUrl}/api/analyze-attachments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, focus }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const insight = await response.json();
    latestAttachmentInsight = insight;
    renderAttachmentInsight(insight);
    setAttachmentStatus(
      `첨부 파일 분석 완료 (${insight.mode || "backend"} 모드)`,
      "success",
    );
    return;
  } catch {
    const localInsight = buildLocalAttachmentInsight(
      items,
      focus,
      `${files.length}개 파일`,
    );
    latestAttachmentInsight = { ...localInsight, mode: "local" };
    renderAttachmentInsight(latestAttachmentInsight);
    setAttachmentStatus(
      "백엔드 연결 실패로 로컬 분석 결과를 표시했습니다.",
      "info",
    );
  }
}

async function analyzeAttachedWebsite() {
  const url = document.getElementById("attachmentWebsiteUrl").value.trim();
  const focus = document.getElementById("attachmentFocus").value.trim();
  if (!url) {
    setAttachmentStatus("분석할 웹사이트 URL을 입력하세요.", "error");
    return;
  }

  const baseUrl = isLikelyLmStudioEndpoint()
    ? window.__ANALYZE_BACKEND__ || "http://localhost:8787"
    : getBackendBaseUrl();
  try {
    setAttachmentStatus("웹사이트 분석 실행 중...", "info");
    const response = await fetch(`${baseUrl}/api/analyze-webpage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, focus }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const insight = await response.json();
    latestAttachmentInsight = insight;
    renderAttachmentInsight(insight);
    setAttachmentStatus(
      `웹사이트 분석 완료 (${insight.mode || "backend"} 모드)`,
      "success",
    );
    return;
  } catch {
    const localInsight = buildLocalAttachmentInsight(
      [{ textExcerpt: url }],
      focus,
      "웹사이트",
    );
    latestAttachmentInsight = { ...localInsight, mode: "local" };
    renderAttachmentInsight(latestAttachmentInsight);
    setAttachmentStatus(
      "웹사이트 원문 분석 실패로 로컬 템플릿 결과를 표시했습니다.",
      "info",
    );
  }
}

function applyAttachmentInsightToQuestion() {
  if (!latestAttachmentInsight || !latestAttachmentInsight.answerBoost) {
    setAttachmentStatus(
      "적용할 분석 결과가 없습니다. 먼저 분석을 실행하세요.",
      "error",
    );
    return;
  }

  const select = document.getElementById("attachmentTargetQuestion");
  const selectedIndex = Number(select.value);
  if (!Number.isInteger(selectedIndex) || selectedIndex < 0) {
    setAttachmentStatus("보강을 적용할 문제를 선택하세요.", "error");
    return;
  }

  let data;
  try {
    data = getCurrentAnswerData();
  } catch (error) {
    setAttachmentStatus(`JSON 파싱 오류: ${error.message}`, "error");
    return;
  }

  const target = data.questions[selectedIndex];
  if (!target) {
    setAttachmentStatus("선택한 문제를 찾지 못했습니다.", "error");
    return;
  }

  const boostBlock = `\n\n[첨부자료 보강]\n${latestAttachmentInsight.answerBoost}`;
  const currentAnswer = target.modelAnswer || "";
  target.modelAnswer = currentAnswer.includes("[첨부자료 보강]")
    ? `${currentAnswer}\n${latestAttachmentInsight.answerBoost}`
    : `${currentAnswer}${boostBlock}`.trim();

  if (!target.source || target.source === "-") {
    target.source = "Attachment Studio";
  } else if (!target.source.includes("Attachment")) {
    target.source = `${target.source} + Attachment`;
  }

  syncJsonAndRender(
    data,
    `${target.id || `Q${selectedIndex + 1}`} 문제에 첨부자료 보강을 반영했습니다.`,
  );
  setAttachmentStatus("선택 문제에 보강 내용을 반영했습니다.", "success");
}

function setTheoryStatus(message, type = "info") {
  const statusEl = document.getElementById("theoryStatus");
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

function setPipelineReport(reportText, type = "success") {
  const el = document.getElementById("pipelineReport");
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

  let data;
  try {
    data = getCurrentAnswerData();
  } catch (error) {
    setDataStatus(`JSON 파싱 오류: ${error.message}`, "error");
    return;
  }

  const questionCount = data.questions.filter(
    (item) => extractRoundOnly(item.examRound) === selectedRound,
  ).length;
  const theoryCount = data.theories.filter(
    (item) => extractRoundOnly(item.examRound) === selectedRound,
  ).length;

  if (!questionCount && !theoryCount) {
    setDataStatus(
      `${selectedRound} 데이터가 없어 삭제할 항목이 없습니다.`,
      "info",
    );
    return;
  }

  const confirmed = window.confirm(
    `${selectedRound} 회차 데이터를 삭제할까요?\n문제 ${questionCount}개, 이론 ${theoryCount}개가 제거됩니다.`,
  );
  if (!confirmed) {
    return;
  }

  data.questions = data.questions.filter(
    (item) => extractRoundOnly(item.examRound) !== selectedRound,
  );
  data.theories = data.theories.filter(
    (item) => extractRoundOnly(item.examRound) !== selectedRound,
  );

  syncJsonAndRender(
    data,
    `${selectedRound} 회차 삭제 완료: 문제 ${questionCount}개, 이론 ${theoryCount}개`,
  );

  // 삭제 후 UI 레이블 초기화 (v20.1)
  updateGlobalRoundLabels("");
  const filterRound = document.getElementById("filterRound");
  if (filterRound) filterRound.value = "";

  setTheoryStatus(
    `${selectedRound} 회차 데이터(문제 ${questionCount}, 이론 ${theoryCount})를 삭제했습니다.`,
    "success",
  );
}
