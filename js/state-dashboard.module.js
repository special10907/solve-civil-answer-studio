/**
 * State Dashboard Module
 * 담당: 필터, 대시보드 렌더링, 차트 업데이트
 */
import { AppState } from './app-state.js';

let lastEvaluationResults = AppState.lastEvaluationResults || [];

// ──── 필터 옵션 ───────────────────────────────────────────────

export function updateFilterOptions(questions, theories = []) {
  const roundSelect = document.getElementById("filterRound");
  const tagSelect = document.getElementById("filterTag");
  if (!roundSelect || !tagSelect) return;

  const roundsSet = new Set();
  const tagsSet = new Set();
  (Array.isArray(questions) ? questions : []).forEach((q) => {
    if (q.examRound) roundsSet.add(String(q.examRound));
    if (Array.isArray(q.tags)) q.tags.forEach((t) => tagsSet.add(t));
  });

  const currentRound = roundSelect.value;
  roundSelect.innerHTML = '<option value="">전체 회차</option>';
  [...roundsSet].sort().forEach((r) => {
    const opt = document.createElement("option");
    opt.value = r; opt.textContent = r;
    roundSelect.appendChild(opt);
  });
  roundSelect.value = roundsSet.has(currentRound) ? currentRound : "";

  const currentTag = tagSelect.value;
  tagSelect.innerHTML = '<option value="">전체 태그</option>';
  [...tagsSet].sort().forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t; opt.textContent = t;
    tagSelect.appendChild(opt);
  });
  tagSelect.value = tagsSet.has(currentTag) ? currentTag : "";

  const globalRoundSelect = document.getElementById("globalRoundSelect");
  if (globalRoundSelect) {
    const curGlobal = globalRoundSelect.value;
    globalRoundSelect.innerHTML = '<option value="">전체 회차</option>';
    [...roundsSet].sort().forEach((r) => {
      const opt = document.createElement("option");
      opt.value = r; opt.textContent = r;
      globalRoundSelect.appendChild(opt);
    });
    globalRoundSelect.value = roundsSet.has(curGlobal) ? curGlobal : "";
  }
}

export function updateGlobalRoundLabels(round) {
  const label = round ? `${round}` : "전체 회차";
  document.querySelectorAll(".global-round-label").forEach((el) => { el.textContent = label; });
}

export function getFilteredEntries(questions) {
  const keyword = (document.getElementById("filterKeyword")?.value || "").trim().toLowerCase();
  const selectedRound = document.getElementById("filterRound")?.value || "";
  const selectedTag = document.getElementById("filterTag")?.value || "";
  const lowScoreOnly = document.getElementById("filterLowScore")?.checked || false;

  const scoreMap = new Map(lastEvaluationResults.map((r) => [r.index, r.score]));

  return questions
    .map((item, index) => ({ item, index }))
    .filter(({ item, index }) => {
      const fullText = `${item.id} ${item.title} ${item.modelAnswer} ${item.source} ${item.examRound}`.toLowerCase();
      if (keyword && !fullText.includes(keyword)) return false;
      if (selectedRound) {
        const r = item.examRound || "";
        if (!r.includes(selectedRound)) return false;
      }
      if (selectedTag && !(Array.isArray(item.tags) && item.tags.includes(selectedTag))) return false;
      if (lowScoreOnly && (scoreMap.get(index) ?? 100) >= 70) return false;
      return true;
    });
}

export function applyAnswerFilters() {
  const raw = (document.getElementById("answerJsonInput")?.value || "").trim();
  const listEl = document.getElementById("answerList");
  if (!raw) {
    if (listEl) listEl.innerHTML = '<div class="text-sm text-slate-500">표시할 문제가 없습니다.</div>';
    return;
  }
  try {
    if (typeof window.renderAnswerData === "function") {
      const data = JSON.parse(raw);
      window.renderAnswerData(data);
    }
  } catch {
    if (listEl) listEl.innerHTML = '<div class="text-sm text-rose-700">JSON 형식 오류로 필터를 적용할 수 없습니다.</div>';
  }
}

// ──── 대시보드 통계 ───────────────────────────────────────────

export function setDashboardStatText(candidateIds, text) {
  const ids = Array.isArray(candidateIds) ? candidateIds : [candidateIds];
  ids.forEach((id) => { const el = document.getElementById(id); if (el) el.textContent = String(text); });
}

export function classifyQuestionCategory(question) {
  const tags = Array.isArray(question?.tags) ? question.tags.join(" ") : "";
  const text = `${question?.title || ""} ${question?.modelAnswer || ""} ${tags}`.toLowerCase();
  if (/(구조역학|matrix|동역학|진동|고유진동|응답스펙트럼|해석)/i.test(text)) return "구조역학";
  if (/(rc|콘크리트|psc|철근|d-region|stm|응력교란)/i.test(text)) return "RC/PSC";
  if (/(강구조|steel|좌굴|용접|볼트|세장비)/i.test(text)) return "강구조";
  if (/(교량|유지관리|점검|보수|보강|내구성)/i.test(text)) return "교량/유지관리";
  return "기타";
}

export function updateDashboardExamDistribution(questions) {
  if (typeof Chart === "undefined") return;
  const canvas = document.getElementById("examDistChart-dash");
  if (!canvas) return;

  const labels = ["구조역학", "RC/PSC", "강구조", "교량/유지관리", "기타"];
  const counts = { "구조역학": 0, "RC/PSC": 0, "강구조": 0, "교량/유지관리": 0, "기타": 0 };
  (Array.isArray(questions) ? questions : []).forEach((q) => {
    const cat = classifyQuestionCategory(q);
    counts[cat] = (counts[cat] || 0) + 1;
  });
  const data = labels.map((l) => counts[l] || 0);
  const chart = typeof Chart.getChart === "function" ? Chart.getChart(canvas) : null;
  if (chart) { chart.data.datasets[0].data = data; chart.update(); return; }
  new Chart(canvas.getContext("2d"), {
    type: "doughnut",
    data: { labels, datasets: [{ data, backgroundColor: ["#6366f1","#22c55e","#f59e0b","#ef4444","#94a3b8"] }] },
    options: { responsive: true, plugins: { legend: { position: "bottom" } } },
  });
}

export function updateRoundDashboard(questions, theories = []) {
  const qArr = Array.isArray(questions) ? questions : [];
  const tArr = Array.isArray(theories) ? theories : [];
  const totalQ = qArr.length;
  const reviewedQ = qArr.filter((q) => q.reviewed).length;
  const totalT = tArr.length;

  setDashboardStatText(["stat-total-questions", "dash-total-q"], totalQ);
  setDashboardStatText(["stat-reviewed-questions", "dash-reviewed-q"], reviewedQ);
  setDashboardStatText(["stat-total-theories", "dash-total-t"], totalT);
  if (totalQ > 0) {
    const pct = Math.round((reviewedQ / totalQ) * 100);
    setDashboardStatText(["stat-review-pct", "dash-review-pct"], `${pct}%`);
    const bar = document.getElementById("dash-review-bar");
    if (bar) bar.style.width = `${pct}%`;
  }
  updateDashboardExamDistribution(qArr);
  updateFilterOptions(qArr, tArr);
}
