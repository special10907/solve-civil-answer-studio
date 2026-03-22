import { getEl } from './dom-utils.js';
import { AppState } from './app-state.js';
import UIStatus from './ui-status.module.js';
const { showToast, setDataStatus, setAttachmentStatus } = UIStatus;

/**
 * UI Boost Module
 * Handles UI logic for "Intelligent Attachment Boost" feature.
 */
const UIBoost = {
  isBusy: false,

  async applyAttachmentInsightToQuestion() {
    const data = typeof window.getCurrentAnswerData === "function" ? window.getCurrentAnswerData() : {};
    const targetInfo = this.resolveAttachmentTargetContext(data);
    const targetIndex = targetInfo.index;

    if (targetIndex < 0 || !data?.questions?.[targetIndex]) {
      showToast("보강할 대상 문항을 찾을 수 없습니다.", "error");
      return;
    }

    const q = data.questions[targetIndex];
    const insight = AppState.latestAttachmentInsight || window.latestAttachmentInsight;
    const userRequest = this.getAttachmentBoostUserRequest();
    const sourcePrefs = this.getAttachmentBoostSourcePreferences();
    const sourceLabels = sourcePrefs.labels;

    if (this.isBusy) return;
    this.isBusy = true;
    this.updateAttachmentBoostButtonState();
    UIStatus.setDataStatus(`${q.id} 심화 보강 생성 중...`, "info");

    try {
      const orch = window.ApiModules?.orchestrator;
      if (!orch) throw new Error("API Orchestrator not loaded");

      const theorySnippets = typeof orch.selectAttachmentBoostTheories === "function" 
        ? orch.selectAttachmentBoostTheories(q, data.theories || [], 3) 
        : [];
      
      let boostedAnswer = "";
      if (insight && insight.answerBoost) {
        boostedAnswer = orch.buildAttachmentBoostFallback({
          target: q, insight, userRequest, theorySnippets
        });
      } else {
        boostedAnswer = await orch.generateDeepAttachmentBoost({
          target: q, insight: insight || {}, userRequest, sourceLabels, theorySnippets
        });
      }

      if (boostedAnswer) {
        const sanitized = orch.sanitizeBoostForExamSubmission(boostedAnswer);
        const separator = "\n\n---\n\n";
        const current = String(q.modelAnswer || "").trim();
        q.modelAnswer = current ? `${current}${separator}${sanitized}` : sanitized;
        q.source = q.source && q.source !== "-" ? `${q.source} + HubDeepBoost` : "Intelligence Hub DeepBoost";
        
        if (window.syncJsonAndRender) {
          window.syncJsonAndRender(data, `${q.id} 심화 보강이 적용되었습니다.`, true);
        }
        showToast(`${q.id} 보강 완료`, "success");
        UIStatus.setAttachmentStatus(`문항 심화 보강이 반영되었습니다. (${sourceLabels.join(", ")})`, "success");
      } else {
        showToast("보강 생성에 실패했습니다.", "warning");
      }
    } catch (err) {
      console.error("Attachment Boost Error:", err);
      showToast("보강 중 오류가 발생했습니다.", "error");
      UIStatus.setAttachmentStatus(`오류: ${err.message}`, "error");
    } finally {
      this.isBusy = false;
      this.updateAttachmentBoostButtonState();
    }
  },

  resolveAttachmentTargetContext(data) {
    const select = document.getElementById("attachmentTargetQuestion");
    if (select && select.value !== "") {
      const fromSelect = Number(select.value);
      if (Number.isInteger(fromSelect) && fromSelect >= 0) {
        const id = String(data?.questions?.[fromSelect]?.id || `Q${fromSelect + 1}`);
        return { index: fromSelect, source: "manual-select", targetId: id };
      }
    }

    const editingIndexEl = document.getElementById("editing-questions-index");
    const editingIndex = Number(editingIndexEl?.value);
    if (Number.isInteger(editingIndex) && editingIndex >= 0) {
      const id = String(data?.questions?.[editingIndex]?.id || `Q${editingIndex + 1}`);
      return { index: editingIndex, source: "editing-index", targetId: id };
    }

    const currentId = String(document.getElementById("studio-q-id")?.value || "").trim();
    if (currentId && Array.isArray(data?.questions)) {
      const idxById = data.questions.findIndex(q => String(q?.id || "").trim() === currentId);
      if (idxById >= 0) {
        return { index: idxById, source: "editing-id", targetId: currentId };
      }
    }
    return { index: -1, source: "none", targetId: "" };
  },

  getAttachmentBoostUserRequest() {
    const el = document.getElementById("attachmentBoostUserRequest");
    return String(el?.value || "").trim();
  },

  getAttachmentBoostSourcePreferences() {
    const options = [
      { id: "boostSourceWebDeep", label: "웹 딥리서치" },
      { id: "boostSourceTheory", label: "이론 자료" },
      { id: "boostSourceNotebookLm", label: "Notebook LM" },
      { id: "boostSourceFlowith", label: "Flowith 지식정원" },
      { id: "boostSourceInternet", label: "인터넷 검색" },
    ];
    const selected = options
      .map(opt => ({ ...opt, checked: !!document.getElementById(opt.id)?.checked }))
      .filter(opt => opt.checked);
    return { selected, labels: selected.map(opt => opt.label) };
  },

  updateAttachmentBoostButtonState() {
    const btn = document.getElementById("applyAttachmentInsightBtn");
    const chip = document.getElementById("attachmentBoostStateChip");
    const checklist = document.getElementById("attachmentBoostChecklist");
    if (!btn) return;

    const data = typeof window.getCurrentAnswerData === "function" ? window.getCurrentAnswerData() : {};
    const targetInfo = this.resolveAttachmentTargetContext(data);
    const targetIndex = targetInfo.index;
    const hasTarget = targetIndex >= 0 && data?.questions?.[targetIndex];
    const insight = AppState.latestAttachmentInsight || window.latestAttachmentInsight;
    const hasInsight = !!insight && !!String(insight?.answerBoost || "").trim();
    const hasUserRequest = !!this.getAttachmentBoostUserRequest();
    
    btn.disabled = !hasTarget || this.isBusy;
    btn.classList.toggle("opacity-50", btn.disabled);

    if (chip) {
      let chipText = this.isBusy ? "생성 중" : hasTarget ? `준비 완료 (${data.questions[targetIndex].id})` : "타겟 대기";
      chip.className = `inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold ${this.isBusy ? "bg-indigo-50 text-indigo-700" : hasTarget ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-600"}`;
      chip.innerHTML = `<i class="fas fa-circle text-[8px]"></i> ${chipText}`;
    }

    if (checklist) {
      const done = '<i class="fas fa-check-circle text-emerald-500"></i>';
      const pending = '<i class="far fa-circle text-slate-400"></i>';
      checklist.innerHTML = `
        <div class="flex gap-2 text-[10px]">
          <span>${hasInsight ? done : pending} 인사이트</span>
          <span>${hasTarget ? done : pending} 타겟문항</span>
          <span>${hasUserRequest ? done : pending} 요청사항</span>
        </div>
      `;
    }
  },

  initAttachmentBoostButtonStateSync() {
    ["attachmentTargetQuestion", "attachmentBoostUserRequest", "editing-questions-index", "studio-q-id"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("input", () => this.updateAttachmentBoostButtonState());
    });
    this.updateAttachmentBoostButtonState();
  },

  refreshAttachmentTargetOptions(data) {
    const select = document.getElementById("attachmentTargetQuestion");
    if (!select) return;
    const current = select.value;
    select.innerHTML = '<option value="">진행 중인 문항 선택...</option>';
    (data?.questions || []).forEach((q, idx) => {
      const opt = document.createElement("option");
      opt.value = idx;
      opt.textContent = `${q.id || `Q${idx + 1}`}: ${String(q.title || "").slice(0, 30)}...`;
      if (String(idx) === current) opt.selected = true;
      select.appendChild(opt);
    });
  },

  exposeGlobal() {
    window.applyAttachmentInsightToQuestion = this.applyAttachmentInsightToQuestion.bind(this);
    window.updateAttachmentBoostButtonState = this.updateAttachmentBoostButtonState.bind(this);
    window.initAttachmentBoostButtonStateSync = this.initAttachmentBoostButtonStateSync.bind(this);
    window.refreshAttachmentTargetOptions = this.refreshAttachmentTargetOptions.bind(this);
  }
};

export default UIBoost;
