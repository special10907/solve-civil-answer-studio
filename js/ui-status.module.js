import { getEl } from './dom-utils.js';
import { Debug } from './utils.js';

/**
 * UI Status Module
 * Handles status messages and notifications across the application.
 */
const UIStatus = {
  setDataStatus(message, type = "info") {
    if (Debug) {
      Debug.log("status", "data status", { message, type });
    }
    const statusEl = getEl("dataStatus");
    if (!statusEl) return;
    const colorMap = {
      info: "text-slate-600",
      success: "text-emerald-700",
      error: "text-rose-700",
      warning: "text-amber-600",
    };
    statusEl.className = `mt-3 text-sm ${colorMap[type] || colorMap.info}`;
    statusEl.textContent = message;
  },

  setPdfStatus(message, type = "info") {
    if (Debug) {
      Debug.log("pdf", "pdf status", { message, type });
    }
    const statusEl = getEl("pdfVisualStatus");
    if (!statusEl) return;
    const colorMap = {
      info: "text-slate-400 font-medium italic",
      success: "text-emerald-500 font-bold",
      error: "text-rose-500 font-bold",
    };
    statusEl.className = `text-[10px] ${colorMap[type] || colorMap.info} transition-all duration-300 transform scale-100`;
    statusEl.textContent = message;
  },

  setAttachmentStatus(message, type = "info") {
    const statusEl = getEl("attachmentStatus");
    if (!statusEl) return;
    const colorMap = {
      info: "text-slate-500",
      success: "text-emerald-700",
      error: "text-rose-700",
    };
    statusEl.className = `mt-2 text-xs ${colorMap[type] || colorMap.info}`;
    statusEl.textContent = message;
  },

  showToast(message, type = "info", duration = 4000) {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      document.body.appendChild(container);
    }
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    let icon = type === "success" ? "check-circle" : (type === "error" ? "x-circle" : "info");
    toast.innerHTML = `
      <div class="flex items-center gap-2">
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
      </div>
      <button class="opacity-50 hover:opacity-100" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
    `;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add("fade-out");
      setTimeout(() => { if (toast.parentElement) toast.remove(); }, 300);
    }, duration);
  },

  // Legacy compatibility
  exposeGlobal() {
    window.setDataStatus = this.setDataStatus.bind(this);
    window.setPdfStatus = this.setPdfStatus.bind(this);
    window.setAttachmentStatus = this.setAttachmentStatus.bind(this);
    window.showToast = this.showToast.bind(this);
  }
};

export default UIStatus;
