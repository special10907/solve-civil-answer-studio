import { AppState } from './app-state.js';
import { isLikelyLmStudioEndpoint } from './api-client.module.js';

/**
 * API UI Module
 * Handles API status display, diagnosis rendering, and mode-specific UX updates.
 */

export function applyStatusChip(el, label, message, type = "info") {
  if (!el) return;
  const palette = {
    info: "bg-slate-100 text-slate-600",
    success: "bg-emerald-100 text-emerald-700",
    error: "bg-rose-100 text-rose-700",
  };
  el.className = `text-[11px] px-2 py-1 rounded-full self-center ${palette[type] || palette.info}`;
  el.textContent = `${label}: ${String(message || "확기 대기")}`;
}

export function setBackendStatus(message, type = "info") {
  const coreEl = document.getElementById("backendCoreStatus");
  const lmEl = document.getElementById("lmStudioStatus");
  const text = String(message || "").trim();
  const lower = text.toLowerCase();
  
  if (lower.includes("lm studio")) {
    applyStatusChip(coreEl, "백엔드", "연결됨", "success");
    let lmMsg = text.split("/").pop().replace(/^LM\s*Studio\s*/i, "").trim();
    applyStatusChip(lmEl, "LM Studio", lmMsg || "상태 확인 중", type);
  } else {
    applyStatusChip(coreEl, "백엔드", text || "확인 대기", type);
    applyStatusChip(lmEl, "LM Studio", isLikelyLmStudioEndpoint() ? "확인 중" : "외부 API 모드", "info");
  }
}

export function renderBackendDiagnostics(diagnostics = [], providers = null) {
  const el = document.getElementById("backendDiagnostics");
  if (!el) return;
  
  if (!providers) {
    el.innerHTML = `<div class="text-slate-400 text-[10px]">정보 없음</div>`;
    return;
  }

  let html = '<div class="flex flex-wrap gap-2">';
  Object.entries(providers).forEach(([name, on]) => {
    html += `<div class="flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full ${on ? 'bg-emerald-500' : 'bg-slate-300'}"></span><span class="text-[9px] uppercase ${on ? 'text-slate-700' : 'text-slate-400'}">${name}</span></div>`;
  });
  html += "</div>";
  el.innerHTML = html;
}

export function updateAiModeUx() {
  const isLm = isLikelyLmStudioEndpoint();
  const apiBtn = document.getElementById("generateByApiBtn");
  const modeHint = document.getElementById("aiModeHint");

  if (apiBtn) apiBtn.textContent = isLm ? "선택 모델로 초안 작성 (LM Studio)" : "선택 모델로 초안 작성 (외부 API)";
  if (modeHint) modeHint.textContent = isLm ? "로컬 모델 모드" : "외부 API 모드";
}

export async function refreshModelList() {
  console.log("[API-UI] Refresh model list requested");
  const icon = document.getElementById("modelRefreshIcon");
  if (icon) icon.classList.add("fa-spin");
  
  try {
    if (typeof window.initAiModels === "function") {
      await window.initAiModels();
      if (window.showToast) window.showToast("모델 목록을 새로고침했습니다.", "success");
    }
  } catch (err) {
    if (window.showToast) window.showToast("모델 목록 갱신 실패", "error");
  } finally {
    if (icon) setTimeout(() => icon.classList.remove("fa-spin"), 500);
  }
}
