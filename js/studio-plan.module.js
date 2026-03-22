import UIStatus from './ui-status.module.js';
const { showToast } = UIStatus;

/**
 * Studio Plan Module
 * Handles Draft Plan history, comparison (Diff), and keyword extraction.
 */
const StudioPlan = {
  _decodeHistoryText(encoded = "") {
    try {
      return decodeURIComponent(String(encoded || ""));
    } catch {
      return "";
    }
  },

  applyHistoryPlanText(encodedText = "") {
    const textarea = document.getElementById("studio-q-draftPlan");
    if (!textarea) return;
    const decoded = this._decodeHistoryText(encodedText);
    const text = String(decoded || "").trim();
    if (!text) {
      showToast("적용할 계획이 없습니다.", "info");
      return;
    }
    textarea.value = text;
    // Note: Studio.toggleDraftPlanPanel and refreshDraftPlanUi will be called via the Studio bridge
    if (window.StudioModules?.UI?.toggleDraftPlanPanel) {
      window.StudioModules.UI.toggleDraftPlanPanel(true);
    }
    showToast("히스토리 계획을 상단 패널에 적용했습니다.", "success");
  },

  _normalizePlanLines(text = "") {
    return String(text || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  },

  tokenizePlanText(text = "", max = 200) {
    const stop = new Set([
      "그리고", "또한", "대한", "에서", "으로", "하는", "있는",
      "검토", "적용", "정리", "작성", "계획", "단계", "한다", "하기",
    ]);

    const tokens = String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9가-힣\s]/g, " ")
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2 && !stop.has(t));

    const uniq = [];
    for (const t of tokens) {
      if (!uniq.includes(t)) uniq.push(t);
      if (uniq.length >= max) break;
    }
    return uniq;
  },

  _pickDiffFocusKeywords(onlyCurrent = [], onlyHistory = [], max = 8) {
    const all = [...onlyCurrent, ...onlyHistory].join(" ");
    return this.tokenizePlanText(all, 120).slice(0, max);
  },

  _highlightPlanLine(line = "", focusKeywords = []) {
    const focusSet = new Set(
      (Array.isArray(focusKeywords) ? focusKeywords : [])
        .map((k) => String(k || "").toLowerCase().trim())
        .filter(Boolean),
    );
    if (!focusSet.size) return this._escapeHtml(line);

    return String(line || "")
      .split(/(\s+)/)
      .map((chunk) => {
        if (!chunk || /^\s+$/.test(chunk)) return chunk;
        const normalized = chunk
          .toLowerCase()
          .replace(/[^a-z0-9가-힣]/g, "")
          .trim();
        const safe = this._escapeHtml(chunk);
        if (!normalized || !focusSet.has(normalized)) return safe;
        return `<mark class="bg-indigo-100 text-indigo-800 px-0.5 rounded">${safe}</mark>`;
      })
      .join("");
  },

  _escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  },

  hideDraftPlanDiff() {
    const viewer = document.getElementById("draftPlanDiffViewer");
    const summary = document.getElementById("draftPlanDiffSummary");
    const body = document.getElementById("draftPlanDiffBody");
    if (viewer) viewer.classList.add("hidden");
    if (summary) summary.textContent = "";
    if (body) body.innerHTML = "";
  },

  showDraftPlanDiff(encodedText = "") {
    const currentPlan = String(
      document.getElementById("studio-q-draftPlan")?.value || "",
    ).trim();
    const comparePlan = String(this._decodeHistoryText(encodedText) || "").trim();

    if (!comparePlan) {
      showToast("비교할 히스토리 계획이 없습니다.", "info");
      return;
    }
    if (!currentPlan) {
      showToast("현재 계획이 비어 있어 비교할 수 없습니다.", "info");
      return;
    }

    const currentLines = this._normalizePlanLines(currentPlan);
    const compareLines = this._normalizePlanLines(comparePlan);
    const currentSet = new Set(currentLines);
    const compareSet = new Set(compareLines);

    const onlyCurrent = currentLines.filter((line) => !compareSet.has(line));
    const onlyHistory = compareLines.filter((line) => !currentSet.has(line));
    const currentTokens = new Set(this.tokenizePlanText(currentPlan));
    const historyTokens = new Set(this.tokenizePlanText(comparePlan));
    const union = new Set([...currentTokens, ...historyTokens]);
    const intersectionSize = [...currentTokens].filter((t) =>
      historyTokens.has(t),
    ).length;
    const similarity = union.size
      ? Math.round((intersectionSize / union.size) * 100)
      : 100;
    const focusKeywords = this._pickDiffFocusKeywords(onlyCurrent, onlyHistory, 8);

    const viewer = document.getElementById("draftPlanDiffViewer");
    const summary = document.getElementById("draftPlanDiffSummary");
    const body = document.getElementById("draftPlanDiffBody");
    if (!viewer || !summary || !body) return;

    const fmt = (arr = [], emptyText = "없음") =>
      arr.length
        ? arr
            .map(
              (line) =>
                `<li class="text-[10px] text-slate-700 leading-relaxed">${this._highlightPlanLine(line, focusKeywords)}</li>`,
            )
            .join("")
        : `<li class="text-[10px] text-slate-400">${emptyText}</li>`;

    summary.innerHTML = `유사도 <strong>${similarity}%</strong> · 현재 전용 ${onlyCurrent.length}개 · 히스토리 전용 ${onlyHistory.length}개${focusKeywords.length ? ` · 핵심키워드: ${this._escapeHtml(focusKeywords.join(", "))}` : ""}`;
    body.innerHTML = `
      <div class="rounded-lg border border-emerald-200 bg-emerald-50/50 p-2">
        <div class="text-[10px] font-bold text-emerald-700 mb-1">현재 계획에만 있는 항목</div>
        <ul class="space-y-0.5">${fmt(onlyCurrent)}</ul>
      </div>
      <div class="rounded-lg border border-amber-200 bg-amber-50/50 p-2">
        <div class="text-[10px] font-bold text-amber-700 mb-1">선택 히스토리에만 있는 항목</div>
        <ul class="space-y-0.5">${fmt(onlyHistory)}</ul>
      </div>
    `;

    viewer.classList.remove("hidden");
    showToast("계획 비교 결과를 표시했습니다.", "success");
  },
};

export default StudioPlan;
