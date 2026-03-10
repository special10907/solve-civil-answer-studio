// SolveCivil Global Application State
window.App = window.App || {};
window.App.State = {
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
    visualDoc: null,
    textCache: [],
    currentPage: 1,
    currentViewport: null,
    ignoredBlocks: [],
  },
};

// 추적 방지(Tracking Prevention) 등으로 localStorage 차단 시 메모리 폴백
window.safeLocalStorage = {
  _mem: {},
  _checked: false,
  _enabled: false,
  _ensure() {
    if (this._checked) return this._enabled;
    this._checked = true;
    try {
      // Accessing window.localStorage itself can throw in some strict environments
      if (typeof window === "undefined" || !window.localStorage) {
        this._enabled = false;
        return false;
      }
      const testKey = "__solve120_storage_test__";
      window.localStorage.setItem(testKey, "1");
      window.localStorage.removeItem(testKey);
      this._enabled = true;
    } catch (e) {
      console.warn("Storage access blocked by browser. Using memory fallback.", e);
      this._enabled = false;
    }
    return this._enabled;
  },
  getItem(k) {
    try {
      return this._ensure() ? window.localStorage.getItem(k) : (this._mem[k] ?? null);
    } catch {
      return this._mem[k] ?? null;
    }
  },
  setItem(k, v) {
    try {
      if (this._ensure()) {
        window.localStorage.setItem(k, v);
      } else {
        this._mem[k] = v;
      }
    } catch {
      this._mem[k] = v;
    }
  },
};

const ANSWER_MANAGER_PIN_STORAGE_KEY = "solve_answer_manager_pins_v1";
const LAST_DOCX_META_STORAGE_KEY = "solve_last_generated_docx_v1";
let answerManagerPinnedIds = new Set();

function loadAnswerManagerPinnedIds() {
  try {
    const raw = (window.safeLocalStorage || localStorage).getItem(
      ANSWER_MANAGER_PIN_STORAGE_KEY,
    );
    if (!raw) {
      return new Set();
    }
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) {
      return new Set();
    }
    return new Set(arr.map((item) => String(item || "")).filter(Boolean));
  } catch {
    return new Set();
  }
}

function saveAnswerManagerPinnedIds() {
  try {
    (window.safeLocalStorage || localStorage).setItem(
      ANSWER_MANAGER_PIN_STORAGE_KEY,
      JSON.stringify([...answerManagerPinnedIds]),
    );
  } catch {
    // no-op (storage blocked)
  }
}

function getAnswerManagerPinKey(question, index) {
  const id = String(question?.id || `Q${index + 1}`).trim();
  const title = String(question?.title || "").trim();
  return `${id}::${title}`;
}

function isAnswerManagerPinned(question, index) {
  return answerManagerPinnedIds.has(getAnswerManagerPinKey(question, index));
}

function toggleAnswerManagerPinned(index) {
  let data;
  try {
    data = getCurrentAnswerData();
  } catch {
    return;
  }

  const question = data?.questions?.[index];
  if (!question) {
    return;
  }

  const key = getAnswerManagerPinKey(question, index);
  if (answerManagerPinnedIds.has(key)) {
    answerManagerPinnedIds.delete(key);
  } else {
    answerManagerPinnedIds.add(key);
  }

  saveAnswerManagerPinnedIds();
  renderAnswerDataForManagerPanel(data.questions || []);
}

answerManagerPinnedIds = loadAnswerManagerPinnedIds();

function calculateAverageScore(questions) {
  if (!Array.isArray(questions) || !questions.length) {
    return 0;
  }
  const scores = questions.map((q, i) => evaluateOneAnswer(q, i).score);
  const sum = scores.reduce((acc, cur) => acc + cur, 0);
  return Math.round(sum / scores.length);
}

function inferExamRoundFromText(text) {
  const match = String(text || "").match(/(\d{2,3})\s*회/);
  return match ? `${match[1]}회` : "미지정";
}

// utils.js에서 제공하는 공통 함수로 대체 (중복 제거)

function normalizeExamRound(value, fallback = "미지정") {
  const text = String(value || "").trim();
  const roundOnly = extractRoundOnly(text);
  if (roundOnly) {
    return roundOnly;
  }

  const fallbackRound = extractRoundOnly(fallback);
  if (/\d\s*교시/.test(text)) {
    return fallbackRound || "미지정";
  }

  if (!text || text === "미지정") {
    return fallbackRound || "미지정";
  }

  return text;
}

function normalizeDraftPlanHistory(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .map((entry) => {
      if (typeof entry === "string") {
        const text = String(entry || "").trim();
        return text ? { text, createdAt: "" } : null;
      }
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const text = String(entry.text || entry.plan || "").trim();
      if (!text) {
        return null;
      }
      return {
        text,
        createdAt: String(entry.createdAt || "").trim(),
      };
    })
    .filter(Boolean)
    .slice(0, 5);
}

function normalizeData(data) {
  const normalized = data && typeof data === "object" ? data : {};
  if (!Array.isArray(normalized.questions)) {
    normalized.questions = [];
  }

  normalized.questions = normalized.questions.map((item, index) => {
    const question = item && typeof item === "object" ? { ...item } : {};
    question.id = question.id || `Q${index + 1}`;
    question.title = question.title || "제목 없음";
    question.modelAnswer = question.modelAnswer || "";
    question.tags = Array.isArray(question.tags) ? question.tags : [];
    question.source = question.source || "-";
    question.draftPlan = question.draftPlan || "";
    question.draftPlanHistory = normalizeDraftPlanHistory(
      question.draftPlanHistory,
    );
    question.reviewed = !!question.reviewed;
    const fallbackRound = normalized.meta?.exam
      ? String(normalized.meta.exam).replace(/[^0-9가-힣회]/g, "") || "미지정"
      : "미지정";
    question.examRound = normalizeExamRound(
      question.examRound || fallbackRound,
      fallbackRound,
    );
    return question;
  });

  if (!Array.isArray(normalized.theories)) {
    normalized.theories = [];
  }

  normalized.theories = normalized.theories.map((item, index) => {
    const theory = item && typeof item === "object" ? { ...item } : {};
    theory.id = theory.id || `TH-${String(index + 1).padStart(3, "0")}`;
    theory.title = theory.title || "이론 제목 없음";
    theory.category = theory.category || "일반";
    theory.content = theory.content || "";
    theory.tags = Array.isArray(theory.tags) ? theory.tags : [];
    theory.source = theory.source || "-";
    const fallbackRound = normalized.meta?.exam
      ? String(normalized.meta.exam).replace(/[^0-9가-힣회]/g, "") || "미지정"
      : "미지정";
    theory.examRound = normalizeExamRound(
      theory.examRound || fallbackRound,
      fallbackRound,
    );
    return theory;
  });

  return normalized;
}

function updateFilterOptions(questions, theories = []) {
  const roundSelect = document.getElementById("filterRound");
  const tagSelect = document.getElementById("filterTag");
  const globalRoundSelect = document.getElementById("globalRoundSelect");

  if (!roundSelect || !tagSelect) {
    // console.debug("Filter elements not found in current view. Skipping updateFilterOptions.");
    return;
  }

  const rounds = [
    ...new Set(
      [
        ...questions.map((q) => extractRoundOnly(q.examRound)),
        ...theories.map((t) => extractRoundOnly(t.examRound)),
      ].filter(Boolean),
    ),
  ].sort((a, b) => {
    const an = Number((a.match(/\d+/) || [0])[0]);
    const bn = Number((b.match(/\d+/) || [0])[0]);
    return bn - an;
  });
  const tags = [
    ...new Set(
      questions
        .flatMap((q) => (Array.isArray(q.tags) ? q.tags : []))
        .filter(Boolean),
    ),
  ];

  const prevRound = roundSelect.value;
  const prevTag = tagSelect.value;
  const prevGlobalRound = globalRoundSelect ? globalRoundSelect.value : "";

  roundSelect.innerHTML =
    '<option value="">전체 회차</option>' +
    rounds
      .map((r) => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`)
      .join("");
  tagSelect.innerHTML =
    '<option value="">전체 태그</option>' +
    tags
      .map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`)
      .join("");
  if (globalRoundSelect) {
    globalRoundSelect.innerHTML =
      '<option value="">전체 회차</option>' +
      rounds
        .map(
          (r) => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`,
        )
        .join("");
  }

  if (rounds.includes(prevRound)) roundSelect.value = prevRound;
  if (tags.includes(prevTag)) tagSelect.value = prevTag;
  if (globalRoundSelect) {
    if (rounds.includes(prevGlobalRound))
      globalRoundSelect.value = prevGlobalRound;
    if (roundSelect.value && !globalRoundSelect.value) {
      globalRoundSelect.value = roundSelect.value;
    }
  }

  const activeRound =
    roundSelect.value || (globalRoundSelect ? globalRoundSelect.value : "");
  updateGlobalRoundLabels(activeRound);

  const roundCount = rounds
    .map(
      (r) =>
        `${r}:${questions.filter((q) => extractRoundOnly(q.examRound) === r).length}`,
    )
    .join(" · ");
  const summaryEl = document.getElementById("roundSummary");
  if (summaryEl) {
    summaryEl.textContent = roundCount
      ? `회차별 누적 현황: ${roundCount}`
      : "회차 데이터가 없습니다.";
  }
}

function updateGlobalRoundLabels(round) {
  const label = round ? `${round}` : "전체 회차";
  document.querySelectorAll(".global-round-label").forEach((el) => {
    el.textContent = label;
  });
}

function getFilteredEntries(questions) {
  const keywordEl = document.getElementById("filterKeyword");
  const roundEl = document.getElementById("filterRound");
  const tagEl = document.getElementById("filterTag");
  const lowScoreEl = document.getElementById("filterLowScore");

  const keyword = keywordEl ? keywordEl.value.trim().toLowerCase() : "";
  const selectedRound = roundEl ? roundEl.value : "";
  const selectedTag = tagEl ? tagEl.value : "";
  const lowScoreOnly = lowScoreEl ? lowScoreEl.checked : false;

  const scoreMap = new Map(
    lastEvaluationResults.map((result) => [result.index, result.score]),
  );

  return questions
    .map((item, index) => ({ item, index }))
    .filter(({ item, index }) => {
      const fullText =
        `${item.id} ${item.title} ${item.modelAnswer} ${item.source} ${item.examRound}`.toLowerCase();
      if (keyword && !fullText.includes(keyword)) return false;
      if (selectedRound && extractRoundOnly(item.examRound) !== selectedRound)
        return false;
      if (
        selectedTag &&
        !(Array.isArray(item.tags) && item.tags.includes(selectedTag))
      )
        return false;
      if (lowScoreOnly && (scoreMap.get(index) ?? 100) >= 70) return false;
      return true;
    });
}

function applyAnswerFilters() {
  const inputEl = document.getElementById("answerJsonInput");
  const raw = inputEl ? inputEl.value.trim() : "";
  if (!raw) {
    const listEl = document.getElementById("answerList");
    if (listEl)
      listEl.innerHTML =
        '<div class="text-sm text-slate-500">표시할 문제가 없습니다.</div>';
    return;
  }
  try {
    const data = normalizeData(JSON.parse(raw));
    renderAnswerData(data);
  } catch {
    const listEl = document.getElementById("answerList");
    if (listEl)
      listEl.innerHTML =
        '<div class="text-sm text-rose-700">JSON 형식 오류로 필터를 적용할 수 없습니다.</div>';
  }
}

function setDashboardStatText(candidateIds, text) {
  const ids = Array.isArray(candidateIds) ? candidateIds : [candidateIds];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = String(text);
    }
  });
}

function classifyQuestionCategory(question) {
  const tags = Array.isArray(question?.tags) ? question.tags.join(" ") : "";
  const text = `${question?.title || ""} ${question?.modelAnswer || ""} ${tags}`.toLowerCase();

  if (/(구조역학|matrix|동역학|진동|고유진동|응답스펙트럼|해석)/i.test(text)) {
    return "구조역학";
  }
  if (/(rc|콘크리트|psc|철근|d-region|stm|응력교란)/i.test(text)) {
    return "RC/PSC";
  }
  if (/(강구조|steel|좌굴|용접|볼트|세장비)/i.test(text)) {
    return "강구조";
  }
  if (/(교량|유지관리|점검|보수|보강|내구성)/i.test(text)) {
    return "교량/유지관리";
  }
  return "기타";
}

function updateDashboardExamDistribution(questions) {
  if (typeof Chart === "undefined") {
    return;
  }

  const canvas = document.getElementById("examDistChart-dash");
  if (!canvas) {
    return;
  }

  const labels = ["구조역학", "RC/PSC", "강구조", "교량/유지관리", "기타"];
  const counts = {
    "구조역학": 0,
    "RC/PSC": 0,
    "강구조": 0,
    "교량/유지관리": 0,
    기타: 0,
  };

  (Array.isArray(questions) ? questions : []).forEach((question) => {
    const category = classifyQuestionCategory(question);
    counts[category] = (counts[category] || 0) + 1;
  });

  const data = labels.map((label) => counts[label] || 0);
  const chart =
    typeof Chart.getChart === "function" ? Chart.getChart(canvas) : null;

  if (chart) {
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.update();
    return;
  }

  new Chart(canvas.getContext("2d"), {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: [
            "rgba(59,130,246,0.8)",
            "rgba(20,184,166,0.8)",
            "rgba(249,115,22,0.8)",
            "rgba(168,85,247,0.8)",
            "rgba(148,163,184,0.8)",
          ],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
    },
  });
}

function updateDashboardLearningProgress(questions, theories) {
  const safeQuestions = Array.isArray(questions) ? questions : [];
  const safeTheories = Array.isArray(theories) ? theories : [];

  const questionCount = safeQuestions.length;
  const theoryCount = safeTheories.length;
  const scoreMap = new Map(
    lastEvaluationResults.map((result) => [result.index, result.score]),
  );

  const avgScore = questionCount
    ? Math.round(
        safeQuestions
          .map((question, index) =>
            scoreMap.has(index)
              ? scoreMap.get(index)
              : evaluateOneAnswer(question, index).score,
          )
          .reduce((acc, cur) => acc + cur, 0) / questionCount,
      )
    : 0;

  const questionProgress = Math.min(1, questionCount / 120); // 120문항을 1차 목표로 사용
  const theoryProgress = Math.min(1, theoryCount / 80); // 80개 이론 카드 목표
  const qualityProgress = Math.min(1, avgScore / 100);

  const progress = Math.round(
    (questionProgress * 0.5 + theoryProgress * 0.2 + qualityProgress * 0.3) * 100,
  );

  const progressEl = document.getElementById("stat-learning-progress");
  if (progressEl) {
    progressEl.textContent = `${progress}%`;
  }

  const barEl = document.getElementById("stat-learning-progress-bar");
  if (barEl) {
    barEl.style.width = `${Math.max(0, Math.min(100, progress))}%`;
  }

  const metaEl = document.getElementById("stat-learning-progress-meta");
  if (metaEl) {
    metaEl.textContent = `답안 ${questionCount} · 이론 ${theoryCount} · 평균점수 ${avgScore}`;
  }
}

function updateRoundDashboard(questions, theories = []) {
  const totalQuestions = questions.length;
  const totalTheories = Array.isArray(theories) ? theories.length : 0;

  setDashboardStatText(
    ["statTotalQuestions", "stat-total-questions"],
    totalQuestions,
  );
  setDashboardStatText(
    ["statTotalTheories", "stat-total-theories"],
    totalTheories,
  );
  updateDashboardLearningProgress(questions, theories);
  updateDashboardExamDistribution(questions);

  if (!totalQuestions) {
    const statsIds = [
      "statTotalRounds",
      "statTotalQuestions",
      "statAvgScore",
      "statLowScoreRate",
    ];
    statsIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = id.endsWith("Rate") ? "0%" : "0";
    });
    const bodyEl = document.getElementById("roundStatsBody");
    if (bodyEl) {
      bodyEl.innerHTML =
        '<tr><td colspan="5" class="px-3 py-3 text-slate-500">통계 데이터가 없습니다.</td></tr>';
    }
    if (roundStatsChart) {
      roundStatsChart.destroy();
      roundStatsChart = null;
    }
    return;
  }

  const scoreMap = new Map(
    lastEvaluationResults.map((result) => [result.index, result.score]),
  );
  const rows = questions.map((question, index) => {
    const score = scoreMap.has(index)
      ? scoreMap.get(index)
      : evaluateOneAnswer(question, index).score;
    return {
      round: extractRoundOnly(question.examRound) || "미지정",
      score,
    };
  });

  const grouped = new Map();
  rows.forEach((row) => {
    if (!grouped.has(row.round)) {
      grouped.set(row.round, { count: 0, sum: 0, low: 0 });
    }
    const g = grouped.get(row.round);
    g.count += 1;
    g.sum += row.score;
    if (row.score < 70) g.low += 1;
  });

  const roundStats = [...grouped.entries()]
    .map(([round, stat]) => {
      const avg = Math.round(stat.sum / stat.count);
      const priority = stat.low >= 3 ? "높음" : stat.low >= 1 ? "중간" : "낮음";
      return {
        round,
        count: stat.count,
        avg,
        low: stat.low,
        priority,
      };
    })
    .sort((a, b) => b.round.localeCompare(a.round, "ko"));

  const totalRounds = roundStats.length;
  const totalLow = roundStats.reduce((acc, row) => acc + row.low, 0);
  const totalScore = roundStats.reduce(
    (acc, row) => acc + row.avg * row.count,
    0,
  );
  const avgScore = Math.round(totalScore / totalQuestions);
  const lowRate = Math.round((totalLow / totalQuestions) * 100);

  const rEl = document.getElementById("statTotalRounds");
  if (rEl) rEl.textContent = String(totalRounds);

  const qEl = document.getElementById("statTotalQuestions");
  if (qEl) qEl.textContent = String(totalQuestions);

  const aEl = document.getElementById("statAvgScore");
  if (aEl) aEl.textContent = String(avgScore);

  const lEl = document.getElementById("statLowScoreRate");
  if (lEl) lEl.textContent = `${lowRate}%`;

  const bodyEl = document.getElementById("roundStatsBody");
  if (bodyEl) {
    bodyEl.innerHTML = roundStats
      .map(
        (row) => `
                        <tr>
                            <td class="px-3 py-2 font-medium text-slate-800">${escapeHtml(row.round)}</td>
                            <td class="px-3 py-2 text-slate-700">${row.count}</td>
                            <td class="px-3 py-2 text-slate-700">${row.avg}</td>
                            <td class="px-3 py-2 text-slate-700">${row.low}</td>
                            <td class="px-3 py-2">
                                <span class="text-xs px-2 py-1 rounded ${row.priority === "높음" ? "bg-rose-100 text-rose-700" : row.priority === "중간" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}">${row.priority}</span>
                            </td>
                        </tr>
                    `,
      )
      .join("");
  }

  const chartCanvas = document.getElementById("roundStatsChart");
  if (chartCanvas) {
    const chartLabels = roundStats.map((row) => row.round);
    const avgScores = roundStats.map((row) => row.avg);
    const lowCounts = roundStats.map((row) => row.low);

    if (roundStatsChart) {
      roundStatsChart.destroy();
    }

    roundStatsChart = new Chart(chartCanvas.getContext("2d"), {
      type: "bar",
      data: {
        labels: chartLabels,
        datasets: [
          {
            label: "평균 점수",
            type: "line",
            data: avgScores,
            borderColor: "rgb(79, 70, 229)",
            backgroundColor: "rgba(79, 70, 229, 0.2)",
            yAxisID: "y",
            tension: 0.3,
            pointRadius: 3,
          },
          {
            label: "저득점 문항 수",
            data: lowCounts,
            backgroundColor: "rgba(244, 63, 94, 0.6)",
            borderColor: "rgb(244, 63, 94)",
            borderWidth: 1,
            yAxisID: "y1",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            min: 0,
            max: 100,
            title: { display: true, text: "평균 점수" },
          },
          y1: {
            beginAtZero: true,
            position: "right",
            grid: { drawOnChartArea: false },
            title: { display: true, text: "저득점 문항 수" },
          },
        },
        plugins: {
          legend: { position: "top" },
        },
      },
    });
  }
}

function renderAnswerData(data) {
  const container = document.getElementById("answerList");
  const normalized = normalizeData(data);
  const questions = normalized.questions;
  renderAnswerDataForManagerPanel(questions);
  renderTheoryData(normalized.theories);
  refreshAttachmentTargetOptions(questions);

  updateFilterOptions(questions, normalized.theories);
  updateRoundDashboard(questions, normalized.theories);
  const filteredEntries = getFilteredEntries(questions);

  if (!filteredEntries.length) {
    container.innerHTML =
      '<div class="text-sm text-slate-500">표시할 문제가 없습니다.</div>';
    return;
  }

  container.innerHTML = filteredEntries
    .map(({ item, index }) => {
      const tags = Array.isArray(item.tags) ? item.tags : [];
      const safeAnswer = escapeHtml(item.modelAnswer).replaceAll("\n", "<br>");
      return `
                          <article class="border border-slate-200 rounded-lg p-4 bg-white">
                              <div class="flex items-center justify-between gap-3">
                                  <h4 class="font-bold text-slate-800">${escapeHtml(item.id || `Q${index + 1}`)}. ${escapeHtml(item.title || "제목 없음")}</h4>
                                  <span class="text-xs px-2 py-1 rounded ${item.reviewed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}">${item.reviewed ? "검토완료" : "검토필요"}</span>
                              </div>
                              <div class="mt-1 text-xs text-indigo-700">회차: ${escapeHtml(item.examRound || "미지정")}</div>
                              <div class="mt-2 flex flex-wrap gap-1">
                                  ${tags.map((tag) => `<span class="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700">${escapeHtml(tag)}</span>`).join("")}
                              </div>
                              <p class="mt-3 text-sm text-slate-700 leading-relaxed">${safeAnswer}</p>
                              <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
                                  <div class="text-xs text-slate-500">source: ${escapeHtml(item.source || "-")}</div>
                                  <div class="flex gap-2">
                                      <button type="button" onclick="editModelAnswerEntry(${index})" class="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 hover:bg-blue-200">수정</button>
                                      <button type="button" onclick="openDeleteConfirmModal(${index})" class="px-2 py-1 text-xs rounded bg-rose-100 text-rose-700 hover:bg-rose-200">삭제</button>
                                  </div>
                              </div>
                          </article>
                      `;
    })
    .join("");

  evaluateRenderedAnswers(normalized, false);
}

function renderAnswerDataForManagerPanel(questions) {
  const listEl = document.getElementById("answerManagerPdfQuestionList");
  const countEl = document.getElementById("answerManagerPdfQuestionCount");
  const searchEl = document.getElementById("answerManagerPdfSearch");
  const roundEl = document.getElementById("answerManagerPdfRoundFilter");
  const sortEl = document.getElementById("answerManagerPdfSort");
  const pinnedOnlyEl = document.getElementById("answerManagerPdfPinnedOnly");
  const pinnedFirstEl = document.getElementById("answerManagerPdfPinnedFirst");
  if (!listEl) {
    return;
  }

  const safeQuestions = Array.isArray(questions) ? questions : [];

  // 회차 필터 옵션 동기화
  if (roundEl) {
    const prevRound = roundEl.value || "";
    const rounds = [
      ...new Set(
        safeQuestions
          .map((question) => extractRoundOnly(question?.examRound || ""))
          .filter(Boolean),
      ),
    ].sort((a, b) => {
      const an = Number((String(a).match(/\d+/) || [0])[0]);
      const bn = Number((String(b).match(/\d+/) || [0])[0]);
      return bn - an;
    });

    roundEl.innerHTML =
      '<option value="">전체 회차</option>' +
      rounds
        .map(
          (round) =>
            `<option value="${escapeHtml(round)}">${escapeHtml(round)}</option>`,
        )
        .join("");
    if (rounds.includes(prevRound)) {
      roundEl.value = prevRound;
    }
  }

  const keyword = String(searchEl?.value || "")
    .trim()
    .toLowerCase();
  const selectedRound = String(roundEl?.value || "").trim();
  const sortMode = String(sortEl?.value || "lowScore").trim();
  const pinnedOnly = !!pinnedOnlyEl?.checked;
  const pinnedFirst = pinnedFirstEl ? !!pinnedFirstEl.checked : true;

  const scoreMap = new Map(
    lastEvaluationResults.map((result) => [result.index, result.score]),
  );

  const filteredEntries = safeQuestions
    .map((question, index) => ({ question, index }))
    .filter(({ question, index }) => {
      const questionRound = extractRoundOnly(question?.examRound || "");
      if (selectedRound && questionRound !== selectedRound) {
        return false;
      }

      if (pinnedOnly && !isAnswerManagerPinned(question, index)) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const tags = Array.isArray(question?.tags) ? question.tags : [];
      const haystack = [
        question?.id,
        question?.title,
        question?.examRound,
        question?.source,
        question?.modelAnswer,
        ...tags,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    })
    .map((entry) => {
      const score = scoreMap.has(entry.index)
        ? scoreMap.get(entry.index)
        : evaluateOneAnswer(entry.question, entry.index).score;
      const roundNum = Number(
        (extractRoundOnly(entry.question?.examRound || "").match(/\d+/) || [0])[0],
      );
      return {
        ...entry,
        score,
        roundNum,
        pinned: isAnswerManagerPinned(entry.question, entry.index),
      };
    })
    .sort((a, b) => {
      if (pinnedFirst && a.pinned !== b.pinned) {
        return a.pinned ? -1 : 1;
      }

      if (sortMode === "highScore") {
        if (b.score !== a.score) return b.score - a.score;
      } else if (sortMode === "latestRound") {
        if (b.roundNum !== a.roundNum) return b.roundNum - a.roundNum;
      } else {
        if (a.score !== b.score) return a.score - b.score;
      }

      if (b.roundNum !== a.roundNum) {
        return b.roundNum - a.roundNum;
      }

      return a.index - b.index;
    });

  const pinnedCount = safeQuestions.filter((question, idx) =>
    isAnswerManagerPinned(question, idx),
  ).length;

  if (countEl) {
    countEl.textContent =
      filteredEntries.length === safeQuestions.length
        ? `${safeQuestions.length}건 · 핀 ${pinnedCount}개`
        : `${filteredEntries.length} / ${safeQuestions.length}건 · 핀 ${pinnedCount}개`;
  }

  if (!filteredEntries.length) {
    listEl.innerHTML =
      '<div class="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">필터 조건에 맞는 답안이 없습니다.</div>';
    return;
  }

  listEl.innerHTML = filteredEntries
    .map(({ question, index, score, pinned }) => {
      const tags = Array.isArray(question.tags) ? question.tags : [];
      const scoreClass =
        score >= 85
          ? "bg-emerald-100 text-emerald-700"
          : score >= 70
            ? "bg-blue-100 text-blue-700"
            : "bg-rose-100 text-rose-700";
      return `
        <article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h5 class="text-sm font-bold text-slate-800">${escapeHtml(question.id || `Q${index + 1}`)} · ${escapeHtml(question.title || "제목 없음")}</h5>
              <div class="mt-1 text-[11px] text-slate-500">회차: ${escapeHtml(question.examRound || "미지정")} · 출처: ${escapeHtml(question.source || "-")}</div>
            </div>
            <div class="flex gap-1.5 shrink-0">
              <span class="px-2 py-1 text-[10px] rounded ${scoreClass}">${score}점</span>
              <button type="button" onclick="toggleAnswerManagerPinned(${index})" class="px-2 py-1 text-[10px] rounded ${pinned ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"} hover:bg-amber-200">${pinned ? "★ 핀" : "☆ 핀"}</button>
              <button type="button" onclick="editModelAnswerEntry(${index})" class="px-2 py-1 text-[10px] rounded bg-blue-100 text-blue-700 hover:bg-blue-200">수정</button>
              <button type="button" onclick="openDeleteConfirmModal(${index})" class="px-2 py-1 text-[10px] rounded bg-rose-100 text-rose-700 hover:bg-rose-200">삭제</button>
            </div>
          </div>
          <div class="mt-2 flex flex-wrap gap-1">${tags
            .map(
              (tag) =>
                `<span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">${escapeHtml(tag)}</span>`,
            )
            .join("")}</div>
          <p class="mt-2 text-xs text-slate-700 leading-relaxed">${escapeHtml(question.modelAnswer || "").replaceAll("\n", "<br>")}</p>
        </article>
      `;
    })
    .join("");
}

function renderTheoryData(theories) {
  const container = document.getElementById("theoryList");
  renderTheoryDataForPdfPanel(theories);
  if (!container) {
    return;
  }

  if (!Array.isArray(theories) || theories.length === 0) {
    container.innerHTML =
      '<div class="text-sm text-slate-500">등록된 이론이 없습니다.</div>';
    return;
  }

  container.innerHTML = theories
    .map((theory, index) => {
      const tags = Array.isArray(theory.tags) ? theory.tags : [];
      return `
                          <article class="border border-slate-200 rounded-lg p-4 bg-white">
                              <div class="flex items-center justify-between gap-2">
                                  <h4 class="font-bold text-slate-800">${escapeHtml(theory.id)}. ${escapeHtml(theory.title)}</h4>
                                  <div class="flex gap-2">
                                      <button type="button" onclick="editTheoryEntry(${index})" class="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 hover:bg-blue-200">수정</button>
                                      <button type="button" onclick="deleteTheoryEntry(${index})" class="px-2 py-1 text-xs rounded bg-rose-100 text-rose-700 hover:bg-rose-200">삭제</button>
                                  </div>
                              </div>
                              <div class="mt-1 text-xs text-indigo-700">회차: ${escapeHtml(theory.examRound || "미지정")} · 분류: ${escapeHtml(theory.category || "일반")}</div>
                              <div class="mt-2 flex flex-wrap gap-1">${tags.map((tag) => `<span class="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700">${escapeHtml(tag)}</span>`).join("")}</div>
                              <p class="mt-2 text-sm text-slate-700 leading-relaxed">${escapeHtml(theory.content || "").replaceAll("\n", "<br>")}</p>
                              <div class="mt-2 text-xs text-slate-500">source: ${escapeHtml(theory.source || "-")}</div>
                          </article>
                      `;
    })
    .join("");
}

function renderTheoryDataForPdfPanel(theories) {
  const listEl = document.getElementById("theoryManagerPdfTheoryList");
  const countEl = document.getElementById("theoryManagerPdfTheoryCount");
  const searchEl = document.getElementById("theoryManagerPdfSearch");
  const roundEl = document.getElementById("theoryManagerPdfRoundFilter");
  if (!listEl) {
    return;
  }

  const safeTheories = Array.isArray(theories) ? theories : [];

  // 회차 필터 옵션 동기화
  if (roundEl) {
    const prevRound = roundEl.value || "";
    const rounds = [
      ...new Set(
        safeTheories
          .map((theory) => extractRoundOnly(theory?.examRound || ""))
          .filter(Boolean),
      ),
    ].sort((a, b) => {
      const an = Number((String(a).match(/\d+/) || [0])[0]);
      const bn = Number((String(b).match(/\d+/) || [0])[0]);
      return bn - an;
    });

    roundEl.innerHTML =
      '<option value="">전체 회차</option>' +
      rounds
        .map(
          (round) =>
            `<option value="${escapeHtml(round)}">${escapeHtml(round)}</option>`,
        )
        .join("");
    if (rounds.includes(prevRound)) {
      roundEl.value = prevRound;
    }
  }

  const keyword = String(searchEl?.value || "")
    .trim()
    .toLowerCase();
  const selectedRound = String(roundEl?.value || "").trim();

  const filteredEntries = safeTheories
    .map((theory, index) => ({ theory, index }))
    .filter(({ theory }) => {
      const theoryRound = extractRoundOnly(theory?.examRound || "");
      if (selectedRound && theoryRound !== selectedRound) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const tags = Array.isArray(theory?.tags) ? theory.tags : [];
      const haystack = [
        theory?.id,
        theory?.title,
        theory?.category,
        theory?.examRound,
        theory?.content,
        ...tags,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });

  if (countEl) {
    countEl.textContent =
      filteredEntries.length === safeTheories.length
        ? `${safeTheories.length}건`
        : `${filteredEntries.length} / ${safeTheories.length}건`;
  }

  if (!filteredEntries.length) {
    listEl.innerHTML =
      '<div class="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">필터 조건에 맞는 이론이 없습니다.</div>';
    return;
  }

  listEl.innerHTML = filteredEntries
    .map(({ theory, index }) => {
      const tags = Array.isArray(theory.tags) ? theory.tags : [];
      return `
        <article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h5 class="text-sm font-bold text-slate-800">${escapeHtml(theory.id || `TH-${String(index + 1).padStart(3, "0")}`)} · ${escapeHtml(theory.title || "이론 제목 없음")}</h5>
              <div class="mt-1 text-[11px] text-slate-500">회차: ${escapeHtml(theory.examRound || "미지정")} · 분류: ${escapeHtml(theory.category || "일반")}</div>
            </div>
            <div class="flex gap-1.5 shrink-0">
              <button type="button" onclick="editTheoryEntry(${index})" class="px-2 py-1 text-[10px] rounded bg-blue-100 text-blue-700 hover:bg-blue-200">수정</button>
              <button type="button" onclick="deleteTheoryEntry(${index})" class="px-2 py-1 text-[10px] rounded bg-rose-100 text-rose-700 hover:bg-rose-200">삭제</button>
            </div>
          </div>
          <div class="mt-2 flex flex-wrap gap-1">${tags
            .map(
              (tag) =>
                `<span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">${escapeHtml(tag)}</span>`,
            )
            .join("")}</div>
          <p class="mt-2 text-xs text-slate-700 leading-relaxed">${escapeHtml(theory.content || "").replaceAll("\n", "<br>")}</p>
        </article>
      `;
    })
    .join("");
}

function initTheoryManagerPdfFilters() {
  const searchEl = document.getElementById("theoryManagerPdfSearch");
  const roundEl = document.getElementById("theoryManagerPdfRoundFilter");

  const rerender = () => {
    if (typeof getCurrentAnswerData !== "function") {
      return;
    }
    const data = getCurrentAnswerData();
    renderTheoryDataForPdfPanel(data.theories || []);
  };

  if (searchEl && !searchEl.dataset.boundFilter) {
    searchEl.dataset.boundFilter = "1";
    searchEl.addEventListener("input", rerender);
  }

  if (roundEl && !roundEl.dataset.boundFilter) {
    roundEl.dataset.boundFilter = "1";
    roundEl.addEventListener("change", rerender);
  }
}

function initAnswerManagerPdfFilters() {
  const searchEl = document.getElementById("answerManagerPdfSearch");
  const roundEl = document.getElementById("answerManagerPdfRoundFilter");
  const sortEl = document.getElementById("answerManagerPdfSort");
  const pinnedOnlyEl = document.getElementById("answerManagerPdfPinnedOnly");
  const pinnedFirstEl = document.getElementById("answerManagerPdfPinnedFirst");

  const rerender = () => {
    if (typeof getCurrentAnswerData !== "function") {
      return;
    }
    const data = getCurrentAnswerData();
    renderAnswerDataForManagerPanel(data.questions || []);
  };

  if (searchEl && !searchEl.dataset.boundFilter) {
    searchEl.dataset.boundFilter = "1";
    searchEl.addEventListener("input", rerender);
  }

  if (roundEl && !roundEl.dataset.boundFilter) {
    roundEl.dataset.boundFilter = "1";
    roundEl.addEventListener("change", rerender);
  }

  if (sortEl && !sortEl.dataset.boundFilter) {
    sortEl.dataset.boundFilter = "1";
    sortEl.addEventListener("change", rerender);
  }

  if (pinnedOnlyEl && !pinnedOnlyEl.dataset.boundFilter) {
    pinnedOnlyEl.dataset.boundFilter = "1";
    pinnedOnlyEl.addEventListener("change", rerender);
  }

  if (pinnedFirstEl && !pinnedFirstEl.dataset.boundFilter) {
    pinnedFirstEl.dataset.boundFilter = "1";
    pinnedFirstEl.addEventListener("change", rerender);
  }
}

function initDashboardActions() {
  const openLastDocxBtn = document.getElementById("dashboardOpenLastDocxBtn");
  const exportBtn = document.getElementById("dashboardExportBtn");
  const configBtn = document.getElementById("dashboardConfigBtn");

  const readLastDocxMeta = () => {
    try {
      const storage = window.safeLocalStorage || localStorage;
      const raw = storage.getItem(LAST_DOCX_META_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      if (!String(parsed.path || "").trim()) return null;
      return parsed;
    } catch {
      return null;
    }
  };

  const refreshLastDocxButtonState = () => {
    if (!openLastDocxBtn) return;
    const meta = readLastDocxMeta();
    const enabled = !!meta?.path;
    openLastDocxBtn.disabled = !enabled;
    openLastDocxBtn.title = enabled
      ? `최근 파일 열기: ${meta.filename || "전문 서브노트"}`
      : "생성된 전문 서브노트가 없습니다";
  };

  if (openLastDocxBtn && !openLastDocxBtn.dataset.boundAction) {
    openLastDocxBtn.dataset.boundAction = "1";
    openLastDocxBtn.addEventListener("click", async () => {
      const meta = readLastDocxMeta();
      if (!meta?.path) {
        if (typeof showToast === "function") {
          showToast("최근 생성된 전문 서브노트가 없습니다.", "info");
        }
        refreshLastDocxButtonState();
        return;
      }

      if (typeof window.requestOpenInDefaultApp === "function") {
        try {
          await window.requestOpenInDefaultApp(meta.path);
          if (typeof showToast === "function") {
            showToast(`파일 열기: ${meta.filename || "DOCX"}`, "success");
          }
        } catch (error) {
          if (typeof showToast === "function") {
            showToast(
              `파일 열기 실패: ${error?.message || "unknown"}`,
              "error",
            );
          }
        }
      }
    });
  }

  if (exportBtn && !exportBtn.dataset.boundAction) {
    exportBtn.dataset.boundAction = "1";
    exportBtn.addEventListener("click", () => {
      if (typeof exportAnswerDataToFile === "function") {
        exportAnswerDataToFile();
      }
    });
  }

  if (configBtn && !configBtn.dataset.boundAction) {
    configBtn.dataset.boundAction = "1";
    configBtn.addEventListener("click", () => {
      if (typeof showSection === "function") {
        showSection("studio");
      }
      if (window.Studio && typeof window.Studio.switchTab === "function") {
        window.Studio.switchTab("answers");
      }
    });
  }

  if (!window.__dashboardLastDocxEventBound) {
    window.__dashboardLastDocxEventBound = true;
    window.addEventListener("solve:last-docx-updated", refreshLastDocxButtonState);
  }

  refreshLastDocxButtonState();
}

function tokenizeTheory(text) {
  const stopwords = new Set([
    "그리고",
    "또한",
    "대한",
    "에서",
    "으로",
    "하는",
    "있는",
    "있다",
    "한다",
    "통해",
    "대한",
    "검토",
    "적용",
  ]);
  const tokens = String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !stopwords.has(token));
  return new Set(tokens);
}

function jaccardSimilarity(setA, setB) {
  const union = new Set([...setA, ...setB]);
  if (!union.size) {
    return 0;
  }
  let intersectionCount = 0;
  setA.forEach((token) => {
    if (setB.has(token)) {
      intersectionCount += 1;
    }
  });
  return intersectionCount / union.size;
}

function calculateTheorySimilarity(left, right) {
  const leftTitleTokens = tokenizeTheory(left.title || "");
  const rightTitleTokens = tokenizeTheory(right.title || "");
  const leftContentTokens = tokenizeTheory(left.content || "");
  const rightContentTokens = tokenizeTheory(right.content || "");

  const titleSim = jaccardSimilarity(leftTitleTokens, rightTitleTokens);
  const contentSim = jaccardSimilarity(leftContentTokens, rightContentTokens);

  const leftTags = new Set(Array.isArray(left.tags) ? left.tags : []);
  const rightTags = new Set(Array.isArray(right.tags) ? right.tags : []);
  const tagSim = jaccardSimilarity(leftTags, rightTags);

  const sameCategory =
    String(left.category || "").trim() &&
    String(left.category || "").trim() === String(right.category || "").trim();
  const sameRound =
    extractRoundOnly(left.examRound) &&
    extractRoundOnly(left.examRound) === extractRoundOnly(right.examRound);

  let score = titleSim * 0.35 + contentSim * 0.45 + tagSim * 0.2;
  if (sameCategory) {
    score += 0.06;
  }
  if (sameRound) {
    score += 0.04;
  }

  return Math.min(1, score);
}

function splitTheoryLines(content) {
  return String(content || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 6);
}

function mergeTheoryContent(baseContent, supplementContent) {
  const merged = [];
  const seen = new Set();

  [
    ...splitTheoryLines(baseContent),
    ...splitTheoryLines(supplementContent),
  ].forEach((line) => {
    const key = line.toLowerCase().replace(/\s+/g, " ");
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(line);
    }
  });

  return merged.join("\n");
}

function evaluateMergedTheoryDraftQuality(draft) {
  const content = String(draft.content || "");
  const length = content.replace(/\s+/g, "").length;
  const hasKds =
    /KDS\s*\d{2}\s*\d{2}\s*\d{2}|KDS\s*\d{2}\s*\d{2}\s*\d{2}\s*\d{2}/.test(
      content,
    );
  const hasVisual = /(도해|그래프|표|선도|모식도|상관도)/.test(content);
  const hasStructure = /(^|\n)\s*\d+\.|정의|결론|제언|검토/.test(content);
  const hasBilingual = /[가-힣][^\n]{0,12}\([A-Za-z][^)]+\)/.test(content);

  const lengthScore = Math.min(40, Math.round(length / 18));
  const kdsScore = hasKds ? 20 : 0;
  const visualScore = hasVisual ? 15 : 0;
  const structureScore = hasStructure ? 15 : 0;
  const bilingualScore = hasBilingual ? 10 : 0;

  const score =
    lengthScore + kdsScore + visualScore + structureScore + bilingualScore;

  let grade = "보강 필요";
  if (score >= 85) grade = "우수";
  else if (score >= 70) grade = "양호";

  return {
    score,
    grade,
    detail: {
      lengthScore,
      kdsScore,
      visualScore,
      structureScore,
      bilingualScore,
    },
  };
}

function getMergeQualityThreshold() {
  const select = document.getElementById("mergeQualityThreshold");
  if (!select) {
    return 0;
  }
  const value = Number(select.value);
  return Number.isFinite(value) ? value : 0;
}

function renderTheoryMergeDrafts(drafts) {
  const summaryEl = document.getElementById("theoryMergeSummary");
  const listEl = document.getElementById("theoryMergeList");

  if (!drafts || !drafts.length) {
    if (summaryEl)
      summaryEl.innerHTML =
        '<span class="text-slate-500">생성된 병합 초안이 없습니다.</span>';
    if (listEl) listEl.innerHTML = "";
    return;
  }

  const threshold = getMergeQualityThreshold();

  const scoredDrafts = drafts
    .map((draft) => ({
      ...draft,
      quality: evaluateMergedTheoryDraftQuality(draft),
    }))
    .sort((a, b) => b.quality.score - a.quality.score);

  const filteredDrafts = scoredDrafts.filter(
    (draft) => draft.quality.score >= threshold,
  );
  theoryAnalysisCache.mergedDrafts = scoredDrafts;

  if (!filteredDrafts.length) {
    if (summaryEl)
      summaryEl.innerHTML = `<div class="p-3 rounded border border-amber-200 bg-amber-50"><strong>병합 초안:</strong> 임계값 ${threshold}점 이상 항목이 없습니다.</div>`;
    if (listEl) listEl.innerHTML = "";
    return;
  }

  const avgScore = Math.round(
    filteredDrafts.reduce((acc, cur) => acc + cur.quality.score, 0) /
      filteredDrafts.length,
  );
  summaryEl.innerHTML = `<div class="p-3 rounded border border-blue-200 bg-blue-50"><strong>병합 초안:</strong> ${filteredDrafts.length}개 (임계값 ${threshold}점) · 평균 품질점수 ${avgScore}점</div>`;
  listEl.innerHTML = filteredDrafts
    .map((draft) => {
      const cacheIndex = theoryAnalysisCache.mergedDrafts.findIndex(
        (item) =>
          item.id === draft.id &&
          item.baseTheoryId === draft.baseTheoryId &&
          item.suppTheoryId === draft.suppTheoryId,
      );
      return `
                      <article class="border border-slate-200 rounded-lg p-3 bg-white">
                          <div class="flex items-center justify-between gap-2">
                              <h4 class="font-bold text-slate-800">${escapeHtml(draft.id)}. ${escapeHtml(draft.title)}</h4>
                              <button type="button" onclick="adoptMergedTheoryDraft(${cacheIndex})" class="px-2 py-1 text-xs rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200">초안 추가</button>
                          </div>
                          <div class="text-xs text-slate-500 mt-1">기반: ${escapeHtml(draft.baseTheoryId)} + ${escapeHtml(draft.suppTheoryId)} · 회차: ${escapeHtml(draft.examRound)}</div>
                          <div class="mt-1 text-xs">
                              <span class="px-2 py-1 rounded ${draft.quality.score >= 85 ? "bg-emerald-100 text-emerald-700" : draft.quality.score >= 70 ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}">품질 ${draft.quality.score}점 (${draft.quality.grade})</span>
                          </div>
                          <div class="mt-1 text-[11px] text-slate-500">길이 ${draft.quality.detail.lengthScore}/40 · KDS ${draft.quality.detail.kdsScore}/20 · 시각화 ${draft.quality.detail.visualScore}/15 · 구조화 ${draft.quality.detail.structureScore}/15 · 영어병기 ${draft.quality.detail.bilingualScore}/10</div>
                          <p class="text-sm text-slate-700 mt-2 leading-relaxed">${escapeHtml(draft.content).replaceAll("\n", "<br>")}</p>
                      </article>
                  `;
    })
    .join("");
}

function buildTheoryMergeDrafts(theories, reinforcements) {
  const drafts = [];
  const maxDrafts = 12;

  reinforcements.slice(0, maxDrafts).forEach((pair, idx) => {
    const left = theories[pair.aIndex];
    const right = theories[pair.bIndex];
    if (!left || !right) {
      return;
    }

    const base =
      (left.content || "").length >= (right.content || "").length
        ? left
        : right;
    const supplement = base === left ? right : left;
    const mergedContent = mergeTheoryContent(base.content, supplement.content);

    drafts.push({
      id: `TH-M-${String(idx + 1).padStart(3, "0")}`,
      title: `${base.title} (보강통합)`,
      category: base.category || supplement.category || "일반",
      examRound: base.examRound || supplement.examRound || "미지정",
      tags: [
        ...new Set([
          ...(base.tags || []),
          ...(supplement.tags || []),
          "보강통합",
        ]),
      ],
      source: `${base.source || "-"} + ${supplement.source || "-"}`,
      content: mergedContent,
      baseTheoryId: base.id,
      suppTheoryId: supplement.id,
    });
  });

  return drafts;
}

function setTheoryAnalysisCache(duplicates = [], reinforcements = [], mergedDrafts = []) {
  const cache =
    window.theoryAnalysisCache && typeof window.theoryAnalysisCache === "object"
      ? window.theoryAnalysisCache
      : {
          duplicates: [],
          reinforcements: [],
          mergedDrafts: [],
        };

  cache.duplicates = Array.isArray(duplicates) ? duplicates : [];
  cache.reinforcements = Array.isArray(reinforcements) ? reinforcements : [];
  cache.mergedDrafts = Array.isArray(mergedDrafts) ? mergedDrafts : [];
  window.theoryAnalysisCache = cache;
  return cache;
}

function analyzeTheoryKnowledge() {
  let data;
  try {
    data = getCurrentAnswerData();
  } catch (error) {
    setTheoryStatus(`JSON 파싱 오류: ${error.message}`, "error");
    return;
  }

  const theories = Array.isArray(data.theories) ? data.theories : [];
  const summaryEl = document.getElementById("theoryAnalysisSummary");
  const listEl = document.getElementById("theoryAnalysisList");

  if (!theories.length) {
    summaryEl.innerHTML =
      '<span class="text-slate-500">분석할 이론 데이터가 없습니다.</span>';
    listEl.innerHTML = "";
    setTheoryStatus("분석 대상이 없습니다.", "info");
    setTheoryAnalysisCache([], [], []);
    renderTheoryMergeDrafts([]);
    return;
  }

  const duplicates = [];
  const reinforcements = [];

  for (let i = 0; i < theories.length; i += 1) {
    for (let j = i + 1; j < theories.length; j += 1) {
      const left = theories[i];
      const right = theories[j];
      const sim = calculateTheorySimilarity(left, right);

      if (sim >= 0.58) {
        duplicates.push({
          aIndex: i,
          bIndex: j,
          aTitle: left.title,
          bTitle: right.title,
          similarity: sim,
          recommendation: `${left.id}와 ${right.id}는 내용 중복도가 높습니다. 품질점수 낮은 항목을 병합/정리 권장`,
        });
      } else if (sim >= 0.3) {
        const longer =
          (left.content || "").length >= (right.content || "").length
            ? left
            : right;
        const shorter = longer === left ? right : left;
        reinforcements.push({
          aIndex: i,
          bIndex: j,
          aTitle: left.title,
          bTitle: right.title,
          similarity: sim,
          recommendation: `${shorter.id}의 차별 포인트(태그/기준/사례)를 ${longer.id} 본문에 통합하여 강화 권장`,
        });
      }
    }
  }

  const mergedDrafts = buildTheoryMergeDrafts(theories, reinforcements);
  setTheoryAnalysisCache(duplicates, reinforcements, mergedDrafts);

  summaryEl.innerHTML = `
                      <div class="p-3 rounded border border-slate-200 bg-slate-50">
                          <strong>분석 결과:</strong> 중복 후보 ${duplicates.length}쌍 · 보강 후보 ${reinforcements.length}쌍
                      </div>
                  `;

  const items = [
    ...duplicates.map((item) => ({
      ...item,
      kind: "중복 후보",
      tone: "rose",
    })),
    ...reinforcements.map((item) => ({
      ...item,
      kind: "보강 후보",
      tone: "emerald",
    })),
  ];

  if (!items.length) {
    listEl.innerHTML =
      '<div class="text-sm text-slate-500">현재 중복/보강 후보가 없습니다.</div>';
    setTheoryStatus("중복/보강 후보 없음", "success");
    return;
  }

  listEl.innerHTML = items
    .map(
      (item) => `
                      <article class="border border-slate-200 rounded-lg p-3 bg-white">
                          <div class="flex items-center justify-between gap-2">
                              <div class="font-medium ${item.tone === "rose" ? "text-rose-700" : "text-emerald-700"}">${item.kind}</div>
                              <span class="text-xs text-slate-500">유사도 ${(item.similarity * 100).toFixed(1)}%</span>
                          </div>
                          <div class="text-sm text-slate-700 mt-1">${escapeHtml(item.aTitle)} ↔ ${escapeHtml(item.bTitle)}</div>
                          <div class="text-xs text-slate-600 mt-1">${escapeHtml(item.recommendation)}</div>
                      </article>
                  `,
    )
    .join("");

  renderTheoryMergeDrafts(mergedDrafts);

  setTheoryStatus("이론 분석을 완료했습니다.", "success");
}

function setTheoryArchiveAiStatus(message, type = "info") {
  const el = document.getElementById("theoryArchiveAiStatus");
  if (!el) return;
  const colorMap = {
    info: "text-slate-500",
    success: "text-emerald-700",
    error: "text-rose-700",
    warning: "text-amber-700",
  };
  el.className = `text-[11px] ${colorMap[type] || colorMap.info}`;
  el.textContent = message;
}

function renderTheoryArchiveAiInsight(insight) {
  const summaryEl = document.getElementById("theoryArchiveAiSummary");
  const pointsEl = document.getElementById("theoryArchiveAiPoints");
  const boostEl = document.getElementById("theoryArchiveAiBoost");
  if (!summaryEl || !pointsEl || !boostEl) {
    return;
  }

  if (!insight) {
    summaryEl.textContent = "분석 결과가 없습니다.";
    pointsEl.innerHTML = "";
    boostEl.textContent = "";
    return;
  }

  summaryEl.textContent = String(insight.summary || "요약 결과 없음");
  const points = Array.isArray(insight.keyPoints) ? insight.keyPoints : [];
  pointsEl.innerHTML = points
    .map((point) => `<li>${escapeHtml(String(point || ""))}</li>`)
    .join("");
  boostEl.textContent = String(insight.answerBoost || "");
}

function clearTheoryArchiveAiPanel() {
  const filesEl = document.getElementById("theoryArchiveFiles");
  const urlEl = document.getElementById("theoryArchiveUrl");
  if (filesEl) filesEl.value = "";
  if (urlEl) urlEl.value = "";
  renderTheoryArchiveAiInsight(null);
  setTheoryArchiveAiStatus("대기 중", "info");
}

async function analyzeTheoryArchiveFiles() {
  if (window.__theoryArchiveAiBusy) {
    return;
  }

  const filesEl = document.getElementById("theoryArchiveFiles");
  const urlEl = document.getElementById("theoryArchiveUrl");
  const focusEl = document.getElementById("theoryArchiveFocus");

  const files = Array.from(filesEl?.files || []);
  const url = String(urlEl?.value || "").trim();
  const focus = String(focusEl?.value || "").trim() || "이론 지식화 요약";

  const buildMandatoryTheorySummaryFocus = (baseFocusText) => {
    let data;
    try {
      data = getCurrentAnswerData();
    } catch {
      data = { theories: [] };
    }

    const theories = Array.isArray(data?.theories) ? data.theories : [];
    const pick = (regex, limit = 2) =>
      theories
        .filter((item) =>
          regex.test(
            `${item?.source || ""} ${item?.title || ""} ${item?.content || ""}`,
          ),
        )
        .slice(0, limit)
        .map((item, idx) => {
          const snippet = String(item?.content || "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 180);
          return `- ${idx + 1}) ${item?.title || "(제목없음)"} / ${item?.source || "-"} / ${snippet}`;
        })
        .join("\n");

    const stored = theories
      .slice(0, 3)
      .map((item, idx) => {
        const snippet = String(item?.content || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 160);
        return `- ${idx + 1}) ${item?.title || "(제목없음)"} / ${snippet}`;
      })
      .join("\n");

    const notebook = pick(/notebook\s*lm|notebooklm/i) || "- NotebookLM 매칭 없음";
    const flowith = pick(/flowith|지식정원/i) || "- Flowith 매칭 없음";
    const storedBlock = stored || "- 저장 이론 없음";

    return [
      baseFocusText,
      "",
      "[강제 파이프라인]",
      "1) 저장 학습/이론 자료 확인 및 첨부",
      storedBlock,
      "2) NotebookLM 관련 내용 확인 및 첨부",
      notebook,
      "3) Flowith 지식정원 관련 내용 확인 및 첨부",
      flowith,
      "4) 인터넷 딥리서치 확인 및 첨부",
      "5) 1~4를 통합해 이론 요약 작성",
      "출력 시 1~5 단계 근거를 반드시 명시",
    ]
      .filter(Boolean)
      .join("\n");
  };

  const effectiveFocus = buildMandatoryTheorySummaryFocus(focus);

  if (!files.length && !url) {
    setTheoryArchiveAiStatus("파일 또는 URL을 입력하세요.", "error");
    return;
  }

  window.__theoryArchiveAiBusy = true;
  setTheoryArchiveAiStatus("이론 아카이브 AI 분석 중...", "info");

  try {
    let insight = null;
    let sourceItems = [];

    if (url) {
      const baseUrl =
        typeof window.getAnalyzeBackendUrl === "function"
          ? window.getAnalyzeBackendUrl()
          : "http://localhost:8787";

      const response = await fetch(`${baseUrl}/api/analyze-webpage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, focus: effectiveFocus }),
      });

      if (!response.ok) {
        throw new Error(`웹 분석 실패 (HTTP ${response.status})`);
      }

      insight = await response.json();
      sourceItems = [
        {
          name: url,
          textExcerpt: String(insight?.summary || ""),
        },
      ];
    } else {
      const items = [];
      for (const file of files) {
        const textExcerpt =
          typeof window.readAttachmentTextExcerpt === "function"
            ? await window.readAttachmentTextExcerpt(file)
            : `파일 메타정보: ${file.name}, size=${file.size}`;
        items.push({
          name: file.name,
          type: file.type,
          size: file.size,
          textExcerpt,
        });
      }

      sourceItems = items;

      const baseUrl =
        typeof window.getAnalyzeBackendUrl === "function"
          ? window.getAnalyzeBackendUrl()
          : "http://localhost:8787";

      const response = await fetch(`${baseUrl}/api/analyze-attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, focus: effectiveFocus }),
      });

      if (response.ok) {
        insight = await response.json();
      } else {
        const fallbackTitle = files.length ? `${files.length}개 파일` : "이론 아카이브";
        insight =
          typeof window.buildLocalAttachmentInsight === "function"
            ? window.buildLocalAttachmentInsight(items, effectiveFocus, fallbackTitle)
            : {
                summary: "로컬 요약 생성",
                keyPoints: [],
                answerBoost: "",
              };
      }
    }

    renderTheoryArchiveAiInsight(insight);

    const autoEntries =
      typeof window.buildTheoryEntriesFromAnalyzedFiles === "function"
        ? window.buildTheoryEntriesFromAnalyzedFiles(sourceItems, insight, effectiveFocus)
        : [];
    const addedCount =
      typeof window.appendTheoryEntriesToKnowledgeBase === "function"
        ? window.appendTheoryEntriesToKnowledgeBase(autoEntries)
        : 0;

    if (addedCount > 0) {
      analyzeTheoryKnowledge();
      setTheoryArchiveAiStatus(
        `AI 분석 완료 · 이론 아카이브 ${addedCount}건 등록`,
        "success",
      );
      setTheoryStatus(
        `AI 분석 결과를 이론 아카이브에 ${addedCount}건 반영했습니다.`,
        "success",
      );
    } else {
      setTheoryArchiveAiStatus("AI 분석 완료 · 신규 등록 항목 없음", "warning");
      setTheoryStatus("AI 분석 완료 (신규 등록 없음)", "info");
    }
  } catch (error) {
    console.error("Theory archive AI analyze error:", error);
    setTheoryArchiveAiStatus(
      `분석 실패: ${error?.message || "unknown error"}`,
      "error",
    );
    setTheoryStatus("이론 아카이브 AI 분석에 실패했습니다.", "error");
  } finally {
    window.__theoryArchiveAiBusy = false;
  }
}

function initTheoryArchiveAiPanel() {
  const filesEl = document.getElementById("theoryArchiveFiles");
  const urlEl = document.getElementById("theoryArchiveUrl");
  if (!filesEl && !urlEl) {
    return;
  }

  filesEl?.addEventListener("change", () => {
    if ((filesEl.files || []).length > 0 && urlEl) {
      urlEl.value = "";
    }
  });
  urlEl?.addEventListener("input", () => {
    if (String(urlEl.value || "").trim() && filesEl) {
      filesEl.value = "";
    }
  });

  renderTheoryArchiveAiInsight(null);
  setTheoryArchiveAiStatus("대기 중", "info");
}

function generateTheoryMergeDrafts() {
  if (!(theoryAnalysisCache.reinforcements || []).length) {
    analyzeTheoryKnowledge();
  }
  const drafts = theoryAnalysisCache.mergedDrafts || [];
  renderTheoryMergeDrafts(drafts);
  if (!drafts.length) {
    setTheoryStatus(
      "보강 병합 초안이 없습니다. 분석 대상을 늘려보세요.",
      "info",
    );
    return;
  }
  setTheoryStatus(
    `보강 병합 초안 ${drafts.length}개를 생성했습니다.`,
    "success",
  );
}

function adoptMergedTheoryDraft(index) {
  const draft = (theoryAnalysisCache.mergedDrafts || [])[index];
  if (!draft) {
    setTheoryStatus("선택한 병합 초안을 찾지 못했습니다.", "error");
    return;
  }

  let data;
  try {
    data = getCurrentAnswerData();
  } catch (error) {
    setTheoryStatus(`JSON 파싱 오류: ${error.message}`, "error");
    return;
  }

  const nextIndex = data.theories.length + 1;
  const adopted = {
    id: `TH-${String(nextIndex).padStart(3, "0")}`,
    title: draft.title,
    category: draft.category,
    examRound: draft.examRound,
    tags: draft.tags,
    source: `${draft.source} + MergeDraft`,
    content: draft.content,
  };

  data.theories.push(adopted);
  syncJsonAndRender(data, `${adopted.id} 병합 이론 초안을 추가했습니다.`);
  analyzeTheoryKnowledge();
  setTheoryStatus("병합 초안을 이론 목록에 추가했습니다.", "success");
}

function applyTheoryCleanup() {
  let data;
  try {
    data = getCurrentAnswerData();
  } catch (error) {
    setTheoryStatus(`JSON 파싱 오류: ${error.message}`, "error");
    return;
  }

  if (!theoryAnalysisCache.duplicates.length) {
    analyzeTheoryKnowledge();
  }

  const duplicates = theoryAnalysisCache.duplicates || [];
  if (!duplicates.length) {
    setTheoryStatus("정리할 중복 후보가 없습니다.", "info");
    return;
  }

  const removeIndexes = new Set();
  duplicates.forEach((pair) => {
    const left = data.theories[pair.aIndex];
    const right = data.theories[pair.bIndex];
    if (!left || !right) {
      return;
    }
    const removeIndex =
      (left.content || "").length >= (right.content || "").length
        ? pair.bIndex
        : pair.aIndex;
    removeIndexes.add(removeIndex);
  });

  const before = data.theories.length;
  data.theories = data.theories.filter((_, index) => !removeIndexes.has(index));
  const removed = before - data.theories.length;

  syncJsonAndRender(
    data,
    `이론 중복 정리를 적용했습니다. ${removed}개 항목 삭제`,
  );
  analyzeTheoryKnowledge();
  setTheoryStatus(`중복 정리 완료: ${removed}개 항목 정리`, "success");
}

function getTheoryFieldElement(legacyId, studioId) {
  return document.getElementById(legacyId) || document.getElementById(studioId);
}

function getTheoryFieldValue(legacyId, studioId) {
  return (getTheoryFieldElement(legacyId, studioId)?.value || "").trim();
}

function setTheoryFieldValue(legacyId, studioId, value) {
  const el = getTheoryFieldElement(legacyId, studioId);
  if (el) {
    el.value = value;
  }
  return el;
}

function upsertTheoryEntry() {
  const id = getTheoryFieldValue("theoryId", "studio-t-id");
  const title = getTheoryFieldValue("theoryTitle", "studio-t-title");
  const category = getTheoryFieldValue("theoryCategory", "studio-t-category");
  const examRound = getTheoryFieldValue("theoryRound", "studio-t-examRound");
  const tagsRaw = getTheoryFieldValue("theoryTags", "studio-t-tags");
  const source = getTheoryFieldValue("theorySource", "studio-t-source");
  const content = getTheoryFieldValue("theoryContent", "studio-t-content");

  if (!title || !content) {
    setTheoryStatus("이론 제목과 내용은 필수입니다.", "error");
    return;
  }

  let data;
  try {
    data = getCurrentAnswerData();
  } catch (error) {
    setTheoryStatus(`현재 JSON이 올바르지 않습니다: ${error.message}`, "error");
    return;
  }

  const entry = {
    id: id || `TH-${String(data.theories.length + 1).padStart(3, "0")}`,
    title,
    category: category || "일반",
    examRound: examRound || "미지정",
    tags: tagsRaw
      ? tagsRaw
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
      : [],
    source: source || "-",
    content,
  };

  const editingRaw =
    getTheoryFieldElement("editingTheoryIndex", "editing-theories-index")
      ?.value || "";
  const editingIndex = editingRaw === "" ? -1 : Number(editingRaw);

  if (
    Number.isInteger(editingIndex) &&
    editingIndex >= 0 &&
    data.theories[editingIndex]
  ) {
    data.theories[editingIndex] = entry;
    syncJsonAndRender(
      data,
      `이론 항목을 수정했습니다. 현재 ${data.theories.length}개`,
    );
    setTheoryStatus("이론 수정 완료", "success");
  } else {
    data.theories.push(entry);
    syncJsonAndRender(
      data,
      `이론 항목을 추가했습니다. 현재 ${data.theories.length}개`,
    );
    setTheoryStatus("이론 추가 완료", "success");
  }

  resetTheoryForm();
  analyzeTheoryKnowledge();
}

function editTheoryEntry(index) {
  let data;
  try {
    data = getCurrentAnswerData();
  } catch (error) {
    setTheoryStatus(`JSON 파싱 오류: ${error.message}`, "error");
    return;
  }

  const item = data.theories[index];
  if (!item) {
    setTheoryStatus("수정할 이론 항목을 찾지 못했습니다.", "error");
    return;
  }

  setTheoryFieldValue("theoryId", "studio-t-id", item.id || "");
  setTheoryFieldValue("theoryTitle", "studio-t-title", item.title || "");
  setTheoryFieldValue(
    "theoryCategory",
    "studio-t-category",
    item.category || "",
  );
  setTheoryFieldValue("theoryRound", "studio-t-examRound", item.examRound || "");
  setTheoryFieldValue(
    "theoryTags",
    "studio-t-tags",
    Array.isArray(item.tags) ? item.tags.join(", ") : "",
  );
  setTheoryFieldValue("theorySource", "studio-t-source", item.source || "");
  setTheoryFieldValue("theoryContent", "studio-t-content", item.content || "");
  setTheoryFieldValue("editingTheoryIndex", "editing-theories-index", String(index));

  const submitBtn = getTheoryFieldElement("theorySubmitBtn", "studio-theory-submit-btn");
  if (submitBtn) {
    submitBtn.textContent = "이론 수정 저장";
  }
  setTheoryStatus(`${item.id} 수정 모드`, "info");
}

function deleteTheoryEntry(index) {
  let data;
  try {
    data = getCurrentAnswerData();
  } catch (error) {
    setTheoryStatus(`JSON 파싱 오류: ${error.message}`, "error");
    return;
  }

  if (!data.theories[index]) {
    setTheoryStatus("삭제할 이론 항목이 없습니다.", "error");
    return;
  }

  const removed = data.theories.splice(index, 1)[0];
  syncJsonAndRender(data, `${removed.id || "이론"} 항목을 삭제했습니다.`);
  resetTheoryForm();
  analyzeTheoryKnowledge();
  setTheoryStatus("이론 삭제 완료", "success");
}

function resetTheoryForm() {
  setTheoryFieldValue("theoryId", "studio-t-id", "");
  setTheoryFieldValue("theoryTitle", "studio-t-title", "");
  setTheoryFieldValue("theoryCategory", "studio-t-category", "");
  setTheoryFieldValue("theoryRound", "studio-t-examRound", "");
  setTheoryFieldValue("theoryTags", "studio-t-tags", "");
  setTheoryFieldValue("theorySource", "studio-t-source", "");
  setTheoryFieldValue("theoryContent", "studio-t-content", "");
  setTheoryFieldValue("editingTheoryIndex", "editing-theories-index", "");

  const submitBtn = getTheoryFieldElement("theorySubmitBtn", "studio-theory-submit-btn");
  if (submitBtn) {
    submitBtn.textContent = "이론 추가";
  }
}

function cancelTheoryEditMode() {
  resetTheoryForm();
  setTheoryStatus("이론 수정 모드를 취소했습니다.", "info");
}

function inferQuestionType(question) {
  const fullText = `${question.id || ""} ${question.title || ""} ${question.modelAnswer || ""}`;
  if (/1\s*교시|10\s*점|용어|단답/.test(fullText)) {
    return "short";
  }
  if (/2\s*교시|3\s*교시|4\s*교시|25\s*점|서술/.test(fullText)) {
    return "long";
  }
  return "unknown";
}

function evaluateOneAnswer(question, index) {
  const answer = String(question.modelAnswer || "");
  const type = inferQuestionType(question);
  const length = answer.replace(/\s+/g, "").length;
  const minLength = type === "short" ? 900 : type === "long" ? 2200 : 1300;

  const hasVisual = /(도해|모식도|그림|선도|그래프|표|상관도|메커니즘)/.test(
    answer,
  );
  const hasComparisonTable =
    /(비교표|vs\b|대비\s*[:：]|허용응력설계법|한계상태설계법)/i.test(answer);
  const hasBilingual = /[가-힣][^\n]{0,12}\([A-Za-z][^)]+\)/.test(answer);
  const hasKds =
    /KDS\s*\d{2}\s*\d{2}\s*\d{2}|KDS\s*\d{2}\s*\d{2}\s*\d{2}\s*\d{2}/.test(
      answer,
    );
  const hasNumbered = /(^|\n)\s*\d+\./.test(answer);
  const hasOpinion =
    /(결론|제언|본인(?:의)?\s*견해|실무\s*제안|유지관리\s*유의사항)/.test(
      answer,
    );

  const breakdown = {
    length: 0, // 30
    visual: 0, // 20
    comparison: 0, // 10
    bilingual: 0, // 10
    kds: 0, // 20
    structure: 0, // 10
    opinion: 0, // 10
  };

  let score = 0;
  const feedback = [];

  const lengthRatio = Math.min(1, length / minLength);
  breakdown.length = Math.round(lengthRatio * 30);
  score += breakdown.length;
  if (length < minLength) {
    feedback.push(`분량 보강 필요: 현재 ${length}자, 권장 ${minLength}자 이상`);
  } else {
    feedback.push(`분량 적정: 현재 ${length}자`);
  }

  breakdown.visual = hasVisual ? 20 : 0;
  score += breakdown.visual;
  if (!hasVisual) {
    feedback.push(
      "도해/표/그래프 항목을 본문에 명시해 시각화 근거를 강화하세요.",
    );
  }

  breakdown.comparison = hasComparisonTable ? 10 : 0;
  score += breakdown.comparison;
  if (!hasComparisonTable) {
    feedback.push(
      "본론에 비교표(예: 허용응력설계법 vs 한계상태설계법)를 추가하세요.",
    );
  }

  breakdown.bilingual = hasBilingual ? 10 : 0;
  score += breakdown.bilingual;
  if (!hasBilingual) {
    feedback.push("핵심 용어에 영어 병기(예: 연성(Ductility))를 추가하세요.");
  }

  breakdown.kds = hasKds ? 20 : 0;
  score += breakdown.kds;
  if (!hasKds) {
    feedback.push("KDS 코드와 기준 번호를 본문에 직접 명시하세요.");
  }

  breakdown.structure = hasNumbered ? 10 : 0;
  score += breakdown.structure;
  if (!hasNumbered) {
    feedback.push("개조식 넘버링(1., 2., 3.) 구조로 논리 흐름을 강화하세요.");
  }

  breakdown.opinion = hasOpinion ? 10 : 0;
  score += breakdown.opinion;
  if (!hasOpinion) {
    feedback.push(
      "결론부에 기술사 제언/본인 견해(3~4줄)를 명시해 차별화를 만드세요.",
    );
  }

  return {
    index,
    id: question.id || "-",
    title: question.title || "제목 없음",
    type,
    score,
    breakdown,
    feedback,
  };
}

function evaluateRenderedAnswers(dataArg, notify = true) {
  let data = dataArg;
  if (!data) {
    const raw = document.getElementById("answerJsonInput").value.trim();
    if (!raw) {
      document.getElementById("evaluationSummary").innerHTML =
        '<span class="text-slate-500">평가할 데이터가 없습니다.</span>';
      document.getElementById("evaluationList").innerHTML = "";
      if (notify) {
        setDataStatus("평가할 JSON 데이터가 없습니다.", "error");
      }
      return;
    }
    try {
      data = JSON.parse(raw);
    } catch (error) {
      document.getElementById("evaluationSummary").innerHTML =
        `<span class="text-rose-700">JSON 파싱 오류: ${escapeHtml(error.message)}</span>`;
      document.getElementById("evaluationList").innerHTML = "";
      if (notify) {
        setDataStatus("평가를 중단했습니다. JSON 형식을 확인하세요.", "error");
      }
      return;
    }
  }

  const normalized = normalizeData(data);
  const questions = normalized.questions;
  if (!questions.length) {
    document.getElementById("evaluationSummary").innerHTML =
      '<span class="text-slate-500">평가할 문제가 없습니다.</span>';
    document.getElementById("evaluationList").innerHTML = "";
    return;
  }

  const results = questions.map((question, index) =>
    evaluateOneAnswer(question, index),
  );
  lastEvaluationResults = results;
  const total = results.reduce((acc, item) => acc + item.score, 0);
  const avg = Math.round(total / results.length);

  let grade = "보강 필요";
  if (avg >= 85) grade = "고득점권";
  else if (avg >= 70) grade = "합격권";

  document.getElementById("evaluationSummary").innerHTML = `
                      <div class="p-3 rounded border ${avg >= 85 ? "border-emerald-200 bg-emerald-50" : avg >= 70 ? "border-blue-200 bg-blue-50" : "border-amber-200 bg-amber-50"}">
                          <strong>종합평가:</strong> 평균 ${avg}점 / 100 (${grade}) · 총 ${results.length}문항
                      </div>
                  `;

  document.getElementById("evaluationList").innerHTML = results
    .map(
      (item) => `
                      <article class="border border-slate-200 rounded-lg p-4 bg-white">
                          <div class="flex items-center justify-between gap-2">
                              <h4 class="font-bold text-slate-800">${escapeHtml(item.id)}. ${escapeHtml(item.title)}</h4>
                              <span class="text-xs px-2 py-1 rounded ${item.score >= 85 ? "bg-emerald-100 text-emerald-700" : item.score >= 70 ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}">${item.score}점</span>
                          </div>
                          <div class="mt-2 text-xs text-slate-500">판정 기준: ${item.type === "short" ? "1교시/단답형" : item.type === "long" ? "2~4교시/서술형" : "일반형(자동 추정)"}</div>
                              <div class="mt-2 text-[11px] text-slate-600 bg-slate-50 border border-slate-100 rounded px-2 py-1" title="분량30 / 시각화20 / 비교표10 / 영어병기10 / KDS20 / 구조화10 / 제언10">
                              배점: 분량 ${item.breakdown?.length ?? 0}/30 · 시각화 ${item.breakdown?.visual ?? 0}/20 · 비교표 ${item.breakdown?.comparison ?? 0}/10 · 영어병기 ${item.breakdown?.bilingual ?? 0}/10 · KDS ${item.breakdown?.kds ?? 0}/20 · 구조화 ${item.breakdown?.structure ?? 0}/10 · 제언 ${item.breakdown?.opinion ?? 0}/10
                              </div>
                          <ul class="mt-3 list-disc list-inside text-sm text-slate-700 space-y-1">
                              ${item.feedback.map((row) => `<li>${escapeHtml(row)}</li>`).join("")}
                          </ul>
                      </article>
                  `,
    )
    .join("");

  if (notify) {
    setDataStatus(
      `자동 평가 완료: 평균 ${avg}점 (${grade})`,
      avg >= 70 ? "success" : "info",
    );
  }
}

function getCurrentAnswerData() {
  const inputEl = document.getElementById("answerJsonInput");
  const raw = inputEl ? inputEl.value.trim() : "";
  if (!raw) {
    return { questions: [], theories: [] };
  }
  const parsed = JSON.parse(raw);
  return normalizeData(parsed);
}

function syncJsonAndRender(data, statusMessage) {
  const updatedJson = JSON.stringify(data, null, 2);
  const inputEl = document.getElementById("answerJsonInput");
  if (inputEl) inputEl.value = updatedJson;
  renderAnswerData(data);
  if (typeof refreshAutoExtractSummary === "function") {
    refreshAutoExtractSummary(); // 요약 레포트 상시 동기화 (v6.0)
  }

  // 자동 저장 실행 (v20.0)
  saveAnswerData(true); // silent mode

  if (statusMessage) {
    setDataStatus(statusMessage, "success");
  }
}

function resetEntryForm() {
  const safeSet = (id, val) => {
    const el = document.getElementById(id);
    if (el) {
      if (el.type === "checkbox") el.checked = val;
      else el.value = val;
    }
  };
  safeSet("newQRound", "");
  safeSet("newQId", "");
  safeSet("newQTitle", "");
  safeSet("newQTags", "");
  safeSet("newQSource", "");
  safeSet("newQAnswer", "");
  safeSet("newQDraftPlan", "");
  safeSet("studio-q-draftPlan", "");
  safeSet("newQReviewed", false);
  safeSet("editingIndex", "");
  const submitBtn = document.getElementById("entrySubmitBtn");
  if (submitBtn) submitBtn.textContent = "모범답안 추가";
  if (typeof window.updateAttachmentBoostButtonState === "function") {
    window.updateAttachmentBoostButtonState();
  }
  if (window.Studio && typeof window.Studio.refreshDraftPlanUi === "function") {
    window.Studio.refreshDraftPlanUi();
  }
}

function openDeleteConfirmModal(index) {
  pendingDeleteIndex = index;
  const modal = document.getElementById("deleteConfirmModal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function closeDeleteConfirmModal() {
  pendingDeleteIndex = -1;
  const modal = document.getElementById("deleteConfirmModal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

function confirmDeleteModelAnswerEntry() {
  // Studio.deleteEntry()에서 세팅된 타입 기반 삭제 처리
  const studioType = window._pendingStudioDeleteType;
  const studioIdx = window._pendingStudioDeleteIndex;
  if (studioType !== undefined && studioIdx !== undefined) {
    window._pendingStudioDeleteType = undefined;
    window._pendingStudioDeleteIndex = undefined;
    const removed = window.App.State[studioType]?.splice(studioIdx, 1)?.[0];
    if (removed) {
      window.syncJsonAndRender(window.App.State, `${removed.id} 삭제 완료`);
    }
    closeDeleteConfirmModal();
    return;
  }
  // 기존 답안 단순 삭제
  if (pendingDeleteIndex < 0) {
    closeDeleteConfirmModal();
    return;
  }
  deleteModelAnswerEntry(pendingDeleteIndex);
  closeDeleteConfirmModal();
}

function openPipelineAuditModal(payload) {
  try {
    const modal = document.getElementById("pipelineAuditModal");
    const content = document.getElementById("pipelineAuditContent");
    if (!modal || !content) return;
    const pretty = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
    content.textContent = pretty;

    // If there's a dedicated guide container, populate summary guidance based on audit
    try {
      const guideEl = document.getElementById("pipelineAuditGuide");
      if (guideEl && payload && typeof payload === "object") {
        // build a short checklist status
        const audit = payload;
        const parts = [];
        parts.push(`<div class=\"text-sm font-medium mb-2\">파이프라인 상태 요약</div>`);
        parts.push(`<ul class=\"ml-4 list-disc text-sm\">`);
        parts.push(`<li>딥리서치 실행: ${audit.deepResearchExecuted ? "예" : "아니오"}</li>`);
        parts.push(`<li>딥리서치 구조화(Parsed): ${audit.deepResearchParsed ? "예" : "아니오"}</li>`);
        parts.push(`<li>딥리서치 활용 가능성: ${audit.deepResearchUsable ? "예" : "아니오"}</li>`);
        parts.push(`<li>참조 수: ${audit.deepResearchReferences || 0}</li>`);
        parts.push(`</ul>`);
        parts.push(`<div class=\"mt-2 text-xs text-slate-500\">권장: "아니오" 항목을 우선 보강하세요. 저장자료/NotebookLM/Flowith/웹딥리서치 중 하나 이상을 추가하면 재시도 가능합니다.</div>`);
        guideEl.innerHTML = parts.join("");
      }
    } catch (e) {
      console.error("pipeline guide render failed", e);
    }

    modal.classList.remove("hidden");
    modal.classList.add("flex");
  } catch (e) {
    console.error("openPipelineAuditModal error:", e);
  }
}

function closePipelineAuditModal() {
  const modal = document.getElementById("pipelineAuditModal");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

function cancelEditMode() {
  resetEntryForm();
  setDataStatus("수정 모드를 취소했습니다.", "info");
}

function editModelAnswerEntry(index) {
  let data;
  try {
    data = getCurrentAnswerData();
  } catch (error) {
    setDataStatus(`JSON 파싱 오류: ${error.message}`, "error");
    return;
  }

  const target = data.questions[index];
  if (!target) {
    setDataStatus("수정할 항목을 찾지 못했습니다.", "error");
    return;
  }

  const getEl = (legacyId, studioId) =>
    document.getElementById(legacyId) || document.getElementById(studioId);
  const setValue = (legacyId, studioId, value) => {
    const el = getEl(legacyId, studioId);
    if (el) el.value = value;
    return el;
  };

  const idEl = setValue("newQId", "studio-q-id", target.id || "");
  setValue("newQRound", "studio-q-examRound", target.examRound || "");
  setValue("newQTitle", "studio-q-title", target.title || "");
  setValue(
    "newQTags",
    "studio-q-tags",
    Array.isArray(target.tags) ? target.tags.join(", ") : "",
  );
  setValue("newQSource", "studio-q-source", target.source || "");
  setValue("newQAnswer", "studio-q-modelAnswer", target.modelAnswer || "");
  setValue("newQDraftPlan", "studio-q-draftPlan", target.draftPlan || "");

  const reviewedEl =
    document.getElementById("newQReviewed") ||
    document.getElementById("studio-q-reviewed");
  if (reviewedEl && reviewedEl.type === "checkbox") {
    reviewedEl.checked = !!target.reviewed;
  }

  const editingIndexEl =
    document.getElementById("editingIndex") ||
    document.getElementById("editing-questions-index");
  if (editingIndexEl) editingIndexEl.value = String(index);

  const submitBtn =
    document.getElementById("entrySubmitBtn") ||
    document.getElementById("studio-questions-submit-btn");
  if (submitBtn) {
    submitBtn.textContent = "모범답안 수정 저장";
  }

  if (idEl && typeof idEl.focus === "function") {
    idEl.focus();
  }

  setDataStatus(
    `수정 모드: ${target.id || `Q${index + 1}`} 항목을 편집 중입니다.`,
    "info",
  );
  if (typeof window.updateAttachmentBoostButtonState === "function") {
    window.updateAttachmentBoostButtonState();
  }
  if (window.Studio && typeof window.Studio.refreshDraftPlanUi === "function") {
    window.Studio.refreshDraftPlanUi();
  }
}

function deleteModelAnswerEntry(index) {
  let data;
  try {
    data = getCurrentAnswerData();
  } catch (error) {
    setDataStatus(`JSON 파싱 오류: ${error.message}`, "error");
    return;
  }

  if (!Array.isArray(data.questions) || !data.questions[index]) {
    setDataStatus("삭제할 항목을 찾지 못했습니다.", "error");
    return;
  }

  const removed = data.questions.splice(index, 1)[0];
  syncJsonAndRender(
    data,
    `${removed.id || `Q${index + 1}`} 항목을 삭제했습니다.`,
  );
  resetEntryForm();
}

function loadSampleData() {
  const inputEl = document.getElementById("answerJsonInput");
  if (inputEl) {
    inputEl.value = JSON.stringify(sampleAnswerData, null, 2);
  }
  renderAnswerData(sampleAnswerData);
  setDataStatus("샘플 데이터를 로드했습니다.", "success");
}

function applyAnswerData() {
  const inputEl = document.getElementById("answerJsonInput");
  if (!inputEl) return;

  const raw = inputEl.value.trim();
  if (!raw) {
    setDataStatus("JSON 입력값이 비어 있습니다.", "error");
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.questions)) {
      setDataStatus(
        "유효하지 않은 형식입니다. questions 배열이 필요합니다.",
        "error",
      );
      return;
    }
    renderAnswerData(parsed);
    setDataStatus(
      `JSON 적용 완료: ${parsed.questions.length}개 문제를 렌더링했습니다.`,
      "success",
    );
  } catch (error) {
    setDataStatus(`JSON 파싱 오류: ${error.message}`, "error");
  }
}

function saveAnswerData(silent = false) {
  const inputEl = document.getElementById("answerJsonInput");
  const raw = inputEl ? inputEl.value.trim() : "";
  if (!raw) {
    if (!silent) setDataStatus("저장할 JSON이 없습니다.", "error");
    return;
  }
  (window.safeLocalStorage || localStorage).setItem(ANSWER_STORAGE_KEY, raw);

  // 마지막 저장 시간 업데이트 (v20.0)
  const now = new Date();
  const timeStr = now.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const lastSavedEl = document.getElementById("lastSavedStatus");
  if (lastSavedEl) {
    lastSavedEl.textContent = `Last Saved: ${timeStr} (Auto)`;
  }

  if (!silent) {
    setDataStatus("브라우저 로컬 저장소에 저장했습니다.", "success");
  }
}

function loadAnswerData() {
  const saved = (window.safeLocalStorage || localStorage).getItem(
    ANSWER_STORAGE_KEY,
  );
  if (!saved) {
    setDataStatus("저장된 데이터가 없어 샘플 데이터를 불러옵니다.", "info");
    loadSampleData();
    return;
  }
  try {
    const parsed = JSON.parse(saved);
    const inputEl = document.getElementById("answerJsonInput");
    if (inputEl) inputEl.value = saved;
    renderAnswerData(parsed);
    setDataStatus("마지막 작업 세션을 복구했습니다.", "success");

    // 저장 시간 표시 초기화 (복구 시점)
    const lastSavedEl = document.getElementById("lastSavedStatus");
    if (lastSavedEl) {
      lastSavedEl.textContent = "Last Session Restored";
    }
  } catch (e) {
    setDataStatus(
      "저장된 데이터복구 중 오류가 발생하여 샘플을 로드합니다.",
      "error",
    );
    loadSampleData();
  }
}

function exportAnswerDataToFile() {
  const raw = document.getElementById("answerJsonInput").value.trim();
  if (!raw) {
    setDataStatus("내보낼 JSON이 없습니다.", "error");
    return;
  }

  let normalizedData;
  try {
    normalizedData = normalizeData(JSON.parse(raw));
  } catch (error) {
    setDataStatus(`JSON 파싱 오류: ${error.message}`, "error");
    return;
  }

  const content = JSON.stringify(normalizedData, null, 2);
  const blob = new Blob([content], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const filename = `civil-answers-${yyyy}${mm}${dd}-${hh}${mi}.json`;

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);

  setDataStatus(`JSON 파일로 내보냈습니다: ${filename}`, "success");
}

function openImportFileDialog() {
  const input = document.getElementById("importJsonFileInput");
  input.value = "";
  input.click();
}

function importAnswerDataFromFile(event) {
  const input = event.target;
  const file = input.files?.[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || ""));
      const normalized = normalizeData(parsed);
      if (!Array.isArray(normalized.questions)) {
        setDataStatus(
          "questions 배열이 없어 가져오기를 중단했습니다.",
          "error",
        );
        return;
      }

      const content = JSON.stringify(normalized, null, 2);
      document.getElementById("answerJsonInput").value = content;
      renderAnswerData(normalized);
      setDataStatus(`JSON 파일을 가져왔습니다: ${file.name}`, "success");
    } catch (error) {
      setDataStatus(`가져오기 실패: ${error.message}`, "error");
    }
  };

  reader.onerror = () => {
    setDataStatus("파일 읽기 중 오류가 발생했습니다.", "error");
  };

  reader.readAsText(file, "utf-8");
}
// Pipeline audit modal helpers
function openPipelineAuditModal(payload) {
  const modal = document.getElementById('pipelineAuditModal');
  const content = document.getElementById('pipelineAuditContent');
  if(content) content.textContent = JSON.stringify(payload, null, 2);
  // reset checkboxes
  ['pipeline_check_stored','pipeline_check_notebook','pipeline_check_flowith','pipeline_check_deep'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.checked = false;
  });
  // store last payload for retry
  window.__lastPipelineAudit = payload;
  if(modal) modal.classList.remove('hidden');
}

function closePipelineAuditModal() {
  const modal = document.getElementById('pipelineAuditModal');
  if(modal) modal.classList.add('hidden');
}

// Retry helper invoked by modal buttons
function pipelineRetryLast(forceMandatory) {
  const payload = window.__lastPipelineAudit;
  if(!payload) return closePipelineAuditModal();
  // collect user-checked hints
  const hints = {};
  ['stored','notebook','flowith','deep'].forEach(k=>{
    const el = document.getElementById('pipeline_check_'+k);
    if(el && el.checked) hints[k] = true;
  });
  // call api retry hook if available
  if(window.pipelineAuditRetry) {
    try {
      window.pipelineAuditRetry({payload, hints, forceMandatory});
    } catch (e) {
      console.warn('pipelineAuditRetry handler failed', e);
    }
  }
  closePipelineAuditModal();
}

document.addEventListener("DOMContentLoaded", () => {
  initTheoryArchiveAiPanel();
  initTheoryManagerPdfFilters();
  initAnswerManagerPdfFilters();
  initDashboardActions();
});

window.toggleAnswerManagerPinned = toggleAnswerManagerPinned;
