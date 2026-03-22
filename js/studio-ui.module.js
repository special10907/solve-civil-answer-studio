import UIStatus from './ui-status.module.js';
import UINav from './ui-nav.module.js';
const { showToast } = UIStatus;
const { switchTab: uiSwitchTab } = UINav;

/**
 * Studio UI Module
 * Handles Studio-specific UI rendering, tab management, and list views.
 */
const StudioUI = {
  currentTab: "answers",

  init() {
    this.refreshDraftPlanUi();
    this.render();
  },

  switchTab(tab) {
    this.currentTab = tab;
    // UI 업데이트
    document.querySelectorAll(".studio-tab-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tab);
    });

    // 섹션 표시 전환
    const answersView = document.getElementById("studio-answers-view");
    const theoryView = document.getElementById("studio-theory-view");
    if (answersView) answersView.classList.toggle("hidden", tab !== "answers");
    if (theoryView) theoryView.classList.toggle("hidden", tab !== "theory");

    this.updatePdfAreaView();
    this.render();
  },

  updatePdfAreaView() {
    const pdfContainer = document.getElementById("pdfVisualWorkspaceContainer");
    const theoryPanel = document.getElementById("theoryManagerPdfListPanel");
    const answerPanel = document.getElementById("answerManagerPdfListPanel");
    if (!pdfContainer || !theoryPanel || !answerPanel) {
      return;
    }

    const isTheoryManagerMode = !!window.__theoryManagerMode;
    const isAnswerManagerMode = !!window.__answerManagerMode;
    const shouldShowTheoryList =
      isTheoryManagerMode && this.currentTab === "theory";
    const shouldShowAnswerList =
      isAnswerManagerMode && this.currentTab === "answers";
    const shouldHidePdf = shouldShowTheoryList || shouldShowAnswerList;

    pdfContainer.classList.toggle("hidden", shouldHidePdf);
    theoryPanel.classList.toggle("hidden", !shouldShowTheoryList);
    answerPanel.classList.toggle("hidden", !shouldShowAnswerList);

    if (
      shouldShowTheoryList &&
      typeof window.getCurrentAnswerData === "function" &&
      typeof window.renderTheoryDataForPdfPanel === "function"
    ) {
      const data = window.getCurrentAnswerData();
      window.renderTheoryDataForPdfPanel(data.theories || []);
    }

    if (
      shouldShowAnswerList &&
      typeof window.getCurrentAnswerData === "function" &&
      typeof window.renderAnswerDataForManagerPanel === "function"
    ) {
      const data = window.getCurrentAnswerData();
      window.renderAnswerDataForManagerPanel(data.questions || []);
    }
  },

  render() {
    const data =
      typeof window.getCurrentAnswerData === "function"
        ? window.getCurrentAnswerData()
        : { questions: [], theories: [] };
    
    if (typeof window.renderAnswerData === "function") {
      window.renderAnswerData(data);
    }
  },

  async saveEntry(type) {
    const data =
      typeof window.getCurrentAnswerData === "function"
        ? window.getCurrentAnswerData()
        : { questions: [], theories: [] };
    if (!Array.isArray(data.questions)) data.questions = [];
    if (!Array.isArray(data.theories)) data.theories = [];
    const formId = type === "questions" ? "answerForm" : "theoryForm";
    const form = document.getElementById(formId);

    if (!form) return;

    const formData = new FormData(form);
    const entry = Object.fromEntries(formData.entries());

    // 태그 처리
    if (entry.tags) {
      entry.tags = entry.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }

    const editingIndex = document.getElementById(`editing-${type}-index`).value;

    if (editingIndex !== "") {
      data[type][parseInt(editingIndex)] = {
        ...data[type][parseInt(editingIndex)],
        ...entry,
      };
      if (window.setDataStatus) window.setDataStatus(`${type === "questions" ? "답안" : "이론"} 수정 완료`, "success");
    } else {
      entry.id =
        type === "questions"
          ? `Q${data[type].length + 1}`
          : `TH-${String(data[type].length + 1).padStart(3, "0")}`;
      data[type].push(entry);
      if (window.setDataStatus) window.setDataStatus(`${type === "questions" ? "답안" : "이론"} 추가 완료`, "success");
    }

    this.resetForm(type);
    if (window.syncJsonAndRender) window.syncJsonAndRender(data);
  },

  editEntry(type, index) {
    const data =
      typeof window.getCurrentAnswerData === "function"
        ? window.getCurrentAnswerData()
        : { questions: [], theories: [] };
    const item = (data[type] || [])[index];
    if (!item) return;

    const prefix = type === "questions" ? "q" : "t";
    // 폼 필드 채우기
    for (const key in item) {
      const el = document.getElementById(`studio-${prefix}-${key}`);
      if (el) {
        if (el.type === "checkbox") el.checked = !!item[key];
        else if (Array.isArray(item[key])) el.value = item[key].join(", ");
        else el.value = item[key];
      }
    }

    document.getElementById(`editing-${type}-index`).value = index;
    const btn = document.getElementById(`studio-${type}-submit-btn`);
    if (btn) btn.textContent = "수정 저장";

    if (window.setDataStatus) window.setDataStatus(`${item.id} 수정 모드`, "info");
    if (type === "questions") {
      this.refreshDraftPlanUi();
    }
  },

  deleteEntry(type, index) {
    window._pendingStudioDeleteType = type;
    window._pendingStudioDeleteIndex = index;
    const modal = document.getElementById("deleteConfirmModal");
    if (modal) {
      modal.classList.remove("hidden");
      modal.classList.add("flex");
    } else {
      if (!confirm("정말 삭제하시겠습니까?")) return;
      const data =
        typeof window.getCurrentAnswerData === "function"
          ? window.getCurrentAnswerData()
          : { questions: [], theories: [] };
      const removed = (data[type] || []).splice(index, 1)[0];
      if (window.syncJsonAndRender) window.syncJsonAndRender(data, `${removed.id} 삭제 완료`);
    }
  },

  resetForm(type) {
    const formId = type === "questions" ? "answerForm" : "theoryForm";
    const form = document.getElementById(formId);
    if (form) form.reset();

    const idxEl = document.getElementById(`editing-${type}-index`);
    if (idxEl) idxEl.value = "";
    
    const btn = document.getElementById(`studio-${type}-submit-btn`);
    if (btn) btn.textContent = type === "questions" ? "답안 추가" : "이론 추가";
    if (type === "questions") {
      this.refreshDraftPlanUi();
    }
  },

  refreshDraftPlanUi() {
    const panel = document.getElementById("draftPlanPanel");
    const textarea = document.getElementById("studio-q-draftPlan");
    const stateEl = document.getElementById("draftPlanState");
    const toggleBtn = document.getElementById("toggleDraftPlanBtn");
    const historyEl = document.getElementById("draftPlanHistoryList");
    if (!panel || !textarea || !stateEl || !toggleBtn) return;

    const hasPlan = String(textarea.value || "").trim().length > 0;
    stateEl.textContent = hasPlan ? "계획 있음" : "계획 없음";
    stateEl.className = hasPlan
      ? "text-[10px] font-bold text-emerald-700"
      : "text-[10px] font-bold text-slate-400";

    const opened = !panel.classList.contains("hidden");
    toggleBtn.textContent = opened ? "계획 숨기기" : "계획 보기";

    if (!historyEl) return;

    let history = [];
    try {
      const data = window.getCurrentAnswerData ? window.getCurrentAnswerData() : { questions: [] };
      const questions = Array.isArray(data?.questions) ? data.questions : [];
      const editingIndex = Number(document.getElementById("editing-questions-index")?.value);
      const formId = String(document.getElementById("studio-q-id")?.value || "").trim();

      let matched = null;
      if (Number.isInteger(editingIndex) && editingIndex >= 0 && questions[editingIndex]) {
        matched = questions[editingIndex];
      }
      if (!matched && formId) {
        matched = questions.find((q) => String(q?.id || "").trim() === formId) || null;
      }
      history = Array.isArray(matched?.draftPlanHistory) ? matched.draftPlanHistory : [];
    } catch {
      history = [];
    }

    const normalized = history
      .map((entry) => {
        if (typeof entry === "string") {
          const text = String(entry || "").trim();
          return text ? { text, createdAt: "" } : null;
        }
        if (!entry || typeof entry !== "object") return null;
        const text = String(entry.text || entry.plan || "").trim();
        if (!text) return null;
        return { text, createdAt: String(entry.createdAt || "").trim() };
      })
      .filter(Boolean)
      .slice(0, 5);

    if (!normalized.length) {
      historyEl.innerHTML = '<div class="text-[10px] text-slate-500">히스토리 없음</div>';
      if (window.StudioModules?.Plan?.hideDraftPlanDiff) window.StudioModules.Plan.hideDraftPlanDiff();
      return;
    }

    const escapeHtml = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    historyEl.innerHTML = normalized
      .map((entry, idx) => {
        const time = entry.createdAt ? (window.StudioModules?.Docx?.formatDocxTraceTime ? window.StudioModules.Docx.formatDocxTraceTime(entry.createdAt) : entry.createdAt) : "-";
        const encodedText = encodeURIComponent(String(entry.text || ""));
        return `
          <div class="rounded-lg border border-slate-200 bg-white px-2 py-1.5 space-y-1">
            <div class="flex items-center justify-between gap-2">
              <span class="text-[10px] font-bold text-slate-600">Plan #${idx + 1}</span>
              <span class="text-[10px] text-slate-500 font-mono">${escapeHtml(time)}</span>
            </div>
            <div class="text-[10px] text-slate-700 whitespace-pre-wrap max-h-20 overflow-auto">${escapeHtml(entry.text)}</div>
            <div class="flex items-center justify-end gap-1 pt-0.5">
              <button type="button" data-history-compare="${encodedText}" class="px-1.5 py-0.5 text-[10px] rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100">비교</button>
              <button type="button" data-history-apply="${encodedText}" class="px-1.5 py-0.5 text-[10px] rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100">적용</button>
              <button type="button" data-history-copy="${encodedText}" class="px-1.5 py-0.5 text-[10px] rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100">복사</button>
            </div>
          </div>
        `;
      })
      .join("");
  },

  toggleDraftPlanPanel(forceOpen) {
    const panel = document.getElementById("draftPlanPanel");
    if (!panel) return;
    const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : panel.classList.contains("hidden");
    panel.classList.toggle("hidden", !shouldOpen);
    this.refreshDraftPlanUi();
  },

  async generatePdfReport() {
    const data = typeof window.getCurrentAnswerData === "function" ? window.getCurrentAnswerData() : { questions: [] };
    const questions = data.questions || [];
    if (!questions.length) {
      alert("리포트로 생성할 답안이 없습니다.");
      return;
    }

    const reportBtn = document.getElementById("studio-generate-report-btn");
    const originalContent = reportBtn ? reportBtn.innerHTML : "";
    if (reportBtn) {
      reportBtn.disabled = true;
      reportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 생성 중...';
    }

    try {
      const round = questions[0].examRound || "Draft";
      const response = await fetch("/api/generate-pdf-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examRound: round, questions })
      });

      if (!response.ok) throw new Error("PDF 생성 실패");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `PE_Report_${round}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      if (typeof window.setDataStatus === "function") window.setDataStatus("PDF 리포트 생성 완료", "success");
    } catch (e) {
      console.error(e);
      alert("리포트 생성 중 오류가 발생했습니다.");
    } finally {
      if (reportBtn) {
        reportBtn.disabled = false;
        reportBtn.innerHTML = originalContent;
      }
    }
  }
};

// 이벤트 바인딩 (초기화 시 또는 외부에서 호출)
document.addEventListener("click", (e) => {
  if (e.target.id === "studio-generate-report-btn" || e.target.closest("#studio-generate-report-btn")) {
    StudioUI.generatePdfReport();
  }
});

export default StudioUI;
