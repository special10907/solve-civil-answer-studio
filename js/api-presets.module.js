/**
 * API Presets Module
 * 담당: AI 프리셋 저장/불러오기/삭제, LM Studio & Foundry 로컬 설정
 */
import {
  getSafeStorage,
  AI_ENDPOINT_STORAGE_KEY,
  AI_PRESETS_STORAGE_KEY,
  getLmStudioBaseUrl,
  getEffectiveSelectedModelId,
  isLikelyLmStudioEndpoint,
} from './api-client.module.js';

// 순환 참조 방지: api.js에 정의된 함수는 window 브리지를 통해 접근
// (api.js → api-presets.module.js → api.js 순환 차단)
const callIfExists = (fnName, ...args) => {
  if (typeof window[fnName] === "function") window[fnName](...args);
};


// ──── 프리셋 관리 ──────────────────────────────────────────────

export function loadAiPresets() {
  const select = document.getElementById("aiModelPresets");
  if (!select) return;

  const storage = getSafeStorage();
  const raw = storage.getItem(AI_PRESETS_STORAGE_KEY);
  let presets = [];
  try { presets = raw ? JSON.parse(raw) : []; } catch { presets = []; }

  if (presets.length === 0) {
    presets = [
      { name: "Local Backend (v14.0)", url: "http://localhost:8787", key: "", model: "", provider: "" },
      { name: "LM Studio Local", url: "http://127.0.0.1:1234/v1/chat/completions", key: "", model: "", provider: "" },
    ];
    storage.setItem(AI_PRESETS_STORAGE_KEY, JSON.stringify(presets));
  }

  const currentVal = select.value;
  select.innerHTML = '<option value="">프리셋 선택...</option>';
  presets.forEach((p, idx) => {
    const opt = document.createElement("option");
    opt.value = idx;
    opt.textContent = p.name;
    select.appendChild(opt);
  });
  select.value = currentVal;
}

export function saveCurrentAiPreset() {
  const url = document.getElementById("aiEndpointUrl")?.value?.trim() || "";
  const key = document.getElementById("aiApiKey")?.value?.trim() || "";
  const model = getEffectiveSelectedModelId();
  const provider = document.getElementById("aiProvider")?.value || "";

  if (!url) { alert("먼저 Endpoint URL을 입력하세요."); return; }

  const name = prompt("이 설정의 프리셋 이름을 입력하세요:", `AI-${new Date().toLocaleTimeString()}`);
  if (!name) return;

  const storage = getSafeStorage();
  let presets = [];
  try { presets = JSON.parse(storage.getItem(AI_PRESETS_STORAGE_KEY) || "[]"); } catch { presets = []; }

  presets.push({ name, url, key, model, provider });
  storage.setItem(AI_PRESETS_STORAGE_KEY, JSON.stringify(presets));
  loadAiPresets();
  alert("프리셋이 저장되었습니다.");
}

export function deleteCurrentAiPreset() {
  const select = document.getElementById("aiModelPresets");
  const idx = select?.value;
  if (!idx && idx !== 0) { alert("삭제할 프리셋을 선택하세요."); return; }
  if (!confirm("정말 이 프리셋을 삭제하시겠습니까?")) return;

  const storage = getSafeStorage();
  let presets = [];
  try { presets = JSON.parse(storage.getItem(AI_PRESETS_STORAGE_KEY) || "[]"); } catch { presets = []; }

  presets.splice(Number(idx), 1);
  storage.setItem(AI_PRESETS_STORAGE_KEY, JSON.stringify(presets));
  if (select) select.value = "";
  loadAiPresets();
}

export function applyAiPreset(idx) {
  if (idx === "" || idx === undefined) return;
  const storage = getSafeStorage();
  let presets = [];
  try { presets = JSON.parse(storage.getItem(AI_PRESETS_STORAGE_KEY) || "[]"); } catch { presets = []; }

  const p = presets[Number(idx)];
  if (!p) return;

  const endpointEl = document.getElementById("aiEndpointUrl");
  const keyEl = document.getElementById("aiApiKey");
  const modelEl = document.getElementById("aiFoundryModelId");
  const providerEl = document.getElementById("aiProvider");

  if (endpointEl) endpointEl.value = p.url || "";
  if (keyEl) keyEl.value = p.key || "";
  if (modelEl) modelEl.value = p.model || "";
  if (providerEl && p.provider) providerEl.value = p.provider;

  storage.setItem(AI_ENDPOINT_STORAGE_KEY, p.url || "");
  if (typeof window.AI_FOUNDRY_MODEL_STORAGE_KEY !== "undefined") {
    storage.setItem(window.AI_FOUNDRY_MODEL_STORAGE_KEY, p.model || "");
  }

  callIfExists("updateAiModeUx");
  callIfExists("refreshAvailableModels", true);
  callIfExists("checkBackendConnection");
}

// ──── 로컬 프리셋 (LM Studio / Foundry) ─────────────────────

export function setLmStudioLocalPreset() {
  const endpointInput = document.getElementById("aiEndpointUrl");
  if (endpointInput) {
    endpointInput.value = "http://127.0.0.1:1234/v1/chat/completions";
    getSafeStorage().setItem(AI_ENDPOINT_STORAGE_KEY, endpointInput.value);
  }
  callIfExists("setBackendStatus", "LM Studio Local 프리셋 적용됨", "info");
  callIfExists("updateAiModeUx");
  callIfExists("detectLmStudioModelId");
}

export function setFoundryLocalPreset() {
  setLmStudioLocalPreset();
}

// ──── ExternalAPI 모드 전환 ───────────────────────────────────

export function switchToExternalApiMode() {
  const providerEl = document.getElementById("aiProvider");
  const endpointEl = document.getElementById("aiEndpointUrl");

  if (isLikelyLmStudioEndpoint()) {
    const defaultBackend = "http://localhost:8787";
    if (endpointEl) endpointEl.value = defaultBackend;
    getSafeStorage().setItem(AI_ENDPOINT_STORAGE_KEY, defaultBackend);
  }

  callIfExists("updateAiModeUx");
  callIfExists("refreshAvailableModels", false);
}
