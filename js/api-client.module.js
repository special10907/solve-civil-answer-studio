/**
 * API Client Module
 * 담당: 엔드포인트 설정, HTTP 클라이언트, 모델 목록 조회, 백엔드 연결 확인
 */
import { AppState } from './app-state.js';
import UIStatus from './ui-status.module.js';
const { showToast } = UIStatus;

export const AI_ENDPOINT_STORAGE_KEY = "solve120_ai_endpoint_v1";
export const AI_PRESETS_STORAGE_KEY = "solve_ai_presets_v1";
const AI_SELECTED_MODEL_STORAGE_KEY = "solve120_ai_selected_model_v1";
const LM_STUDIO_RETRY_COOLDOWN_MS = 10000;
const MODEL_TOKEN_SEPARATOR = "::";

const ANALYZE_BACKEND_CANDIDATES = [
  "http://localhost:8787",
  "http://localhost:8788",
  "http://localhost:8789",
];

export const CLOUD_MODEL_CATALOG = {
  openai: ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4.1"],
  gemini: [
    "gemini-2.0-flash",
    "gemini-1.5-pro",
    "gemini-2.0-pro-exp-02-05",
    "gemini-2.0-flash-thinking-exp",
  ],
  anthropic: ["claude-3-5-sonnet-latest", "claude-3-5-haiku-latest"],
  github: ["copilot-gpt-4o", "copilot-claude-3.5-sonnet"],
};

// ──── 스토리지 헬퍼 ────────────────────────────────────────────

export function getSafeStorage() {
  return window.safeLocalStorage || localStorage;
}

// ──── URL 결정 함수들 ──────────────────────────────────────────

export function getBackendBaseUrl() {
  const endpointEl = document.getElementById("aiEndpointUrl");
  const endpoint = endpointEl ? endpointEl.value.trim() : "";
  if (!endpoint) return "http://localhost:8787";
  return endpoint.replace(/\/api\/generate-answer\/?$/i, "").replace(/\/$/, "");
}

export function getLmStudioBaseUrl() {
  const endpointEl = document.getElementById("aiEndpointUrl");
  const endpoint = endpointEl ? endpointEl.value.trim() : "";
  if (!endpoint) return "http://127.0.0.1:1234";
  return endpoint
    .replace(/127\.0\.0\.1:5619/gi, "127.0.0.1:1234")
    .replace(/localhost:5619/gi, "localhost:1234")
    .replace(/\/v1\/chat\/completions\/?$/i, "")
    .replace(/\/$/, "");
}

export function getFoundryBaseUrl() {
  return getLmStudioBaseUrl();
}

export function getAnalyzeBackendUrl() {
  if (AppState.configOverrides?.ANALYZE_BACKEND) return String(AppState.configOverrides.ANALYZE_BACKEND).replace(/\/$/, "");
  if (AppState.analyzeBackendDiscoveredBase) return String(AppState.analyzeBackendDiscoveredBase).replace(/\/$/, "");
  return "http://localhost:8787";
}

export async function discoverAnalyzeBackendBaseUrl() {
  if (AppState.configOverrides?.ANALYZE_BACKEND) {
    const fixed = String(AppState.configOverrides.ANALYZE_BACKEND).replace(/\/$/, "");
    AppState.analyzeBackendDiscoveredBase = fixed;
    return fixed;
  }
  if (AppState.analyzeBackendDiscoveredBase) {
    return String(AppState.analyzeBackendDiscoveredBase).replace(/\/$/, "");
  }
  for (const base of ANALYZE_BACKEND_CANDIDATES) {
    try {
      const response = await fetch(`${base}/health`, { signal: AbortSignal.timeout(1200) });
      if (!response.ok) continue;
      const payload = await response.json().catch(() => null);
      if (payload?.ok) {
        AppState.analyzeBackendDiscoveredBase = base;
        return base;
      }
    } catch { /* try next */ }
  }
  return getAnalyzeBackendUrl();
}

// ──── LM Studio 오프라인 관리 ──────────────────────────────────

export function markLmStudioOffline() {
  AppState.lmStudioOfflineUntil = Date.now() + LM_STUDIO_RETRY_COOLDOWN_MS;
}
export function clearLmStudioOffline() {
  AppState.lmStudioOfflineUntil = 0;
}
export function shouldSkipLmStudioProbe() {
  return Number(AppState.lmStudioOfflineUntil || 0) > Date.now();
}

// ──── 모델 토큰 파싱 ──────────────────────────────────────────

export function parseSelectedModelToken(rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) return { provider: "", modelId: "", token: "" };
  const idx = value.indexOf(MODEL_TOKEN_SEPARATOR);
  if (idx <= 0) return { provider: "", modelId: value, token: value };
  return {
    provider: value.slice(0, idx).trim(),
    modelId: value.slice(idx + MODEL_TOKEN_SEPARATOR.length).trim(),
    token: value,
  };
}

export function buildModelToken(provider, modelId) {
  const p = String(provider || "").trim();
  const m = String(modelId || "").trim();
  if (!m) return "";
  return p ? `${p}${MODEL_TOKEN_SEPARATOR}${m}` : m;
}

// ──── 클라우드 모델 조회 ──────────────────────────────────────

export async function fetchCloudProviderStatusViaBackend() {
  const backendUrl = await discoverAnalyzeBackendBaseUrl();
  const response = await fetch(`${backendUrl}/health`).catch(() => null);
  if (!response?.ok) return null;
  const payload = await response.json().catch(() => null);
  if (!payload || typeof payload.providers !== "object") return null;
  return payload.providers;
}

export function buildCloudModelEntries(providerStatus) {
  const status = providerStatus && typeof providerStatus === "object" ? providerStatus : {};
  const entries = [];
  Object.entries(CLOUD_MODEL_CATALOG).forEach(([provider, models]) => {
    if (!status[provider]) return;
    models.forEach((modelId) => {
      entries.push({ provider, modelId, label: `[${provider.toUpperCase()}] ${modelId}` });
    });
  });
  return entries;
}

export async function fetchLmStudioModelsViaBackend(baseUrl) {
  const backendUrl = await discoverAnalyzeBackendBaseUrl();
  const response = await fetch(`${backendUrl}/api/lmstudio-models`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ baseUrl }),
  }).catch(() => null);

  if (!response) throw new Error("backend-unreachable");
  let payload = null;
  try { payload = await response.json(); } catch { payload = null; }

  if (!response.ok) {
    const attempted = Array.isArray(payload?.attempted) ? payload.attempted.join(", ") : "";
    const detail = payload?.error || `HTTP ${response.status}`;
    throw new Error(attempted ? `${detail} (시도: ${attempted})` : detail);
  }
  if (!payload?.ok) throw new Error(payload?.error || "lmstudio-unreachable");
  return Array.isArray(payload.models) ? payload.models : [];
}

// ──── HTTP 요청 함수들 ─────────────────────────────────────────

/**
 * 지수 백오프 기반의 Fetch 재시도 헬퍼
 */
async function fetchWithRetry(url, options = {}, retries = 2, backoff = 1000) {
  const timeout = options.timeout || 60000;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  const internalOptions = { ...options, signal: controller.signal };
  delete internalOptions.timeout;

  try {
    let lastError = null;
    for (let i = 0; i < retries + 1; i++) {
      try {
        const response = await fetch(url, internalOptions);
        clearTimeout(id);
        return response;
      } catch (err) {
        lastError = err;
        if (err.name === 'AbortError') throw new Error(`요청 타임아웃 (${timeout}ms)`);
        if (i < retries) {
          const delay = backoff * Math.pow(2, i);
          console.warn(`[STARK] Retrying ${url} in ${delay}ms... (${i + 1}/${retries})`);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }
    throw lastError;
  } finally {
    clearTimeout(id);
  }
}

export async function generateAnswer(question, instruction, format = "text", options = {}) {
  const base = await discoverAnalyzeBackendBaseUrl();
  const requestBody = { question, instruction, format };
  if (options && typeof options === "object") {
    if (typeof options.mandatoryPipeline === "boolean") requestBody.mandatoryPipeline = options.mandatoryPipeline;
    if (options.sourceBundle) requestBody.sourceBundle = options.sourceBundle;
    if (typeof options.outputStyle === "string" && options.outputStyle.trim()) requestBody.outputStyle = options.outputStyle.trim();
    if (options.response_format) requestBody.response_format = options.response_format;
  }
  
  const response = await fetchWithRetry(`${base}/api/generate-answer`, {
    method: "POST", 
    headers: { "Content-Type": "application/json" }, 
    body: JSON.stringify(requestBody),
    timeout: 90000 // AI 생성은 더 긴 타임아웃 부여
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }
  return response.json();
}

export async function requestDocxGeneration(payload) {
  const base = await discoverAnalyzeBackendBaseUrl();
  const response = await fetchWithRetry(`${base}/api/generate-docx`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payload }),
    timeout: 30000
  });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || `HTTP ${response.status}`);
  return response.json();
}

export async function requestRevealInExplorer(targetPath) {
  const base = await discoverAnalyzeBackendBaseUrl();
  const response = await fetchWithRetry(`${base}/api/reveal-in-explorer`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetPath }),
    timeout: 10000
  });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || `HTTP ${response.status}`);
  return response.json();
}

export async function requestOpenInDefaultApp(targetPath) {
  const base = await discoverAnalyzeBackendBaseUrl();
  const response = await fetchWithRetry(`${base}/api/open-in-default-app`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetPath }),
    timeout: 10000
  });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || `HTTP ${response.status}`);
  return response.json();
}

export function isLikelyLmStudioEndpoint() {
  const endpoint = String(document.getElementById("aiEndpointUrl")?.value || "").toLowerCase();
  const isLocal = endpoint.includes("127.0.0.1") || endpoint.includes("localhost");
  return endpoint.includes("127.0.0.1:1234") || endpoint.includes("localhost:1234") || (isLocal && endpoint.includes("/v1/chat/completions"));
}
export function isLikelyFoundryEndpoint() { return isLikelyLmStudioEndpoint(); }

export function getEffectiveSelectedModelId() {
  const select = document.getElementById("aiAvailableModelSelect");
  const input = document.getElementById("aiFoundryModelId");
  const parsed = parseSelectedModelToken(String(select?.value || "").trim());
  if (parsed.modelId) return parsed.modelId;
  return String(input?.value || "").trim();
}

/**
 * LM Studio에서 현재 로드된 모델 ID를 감지하여 UI에 반영
 */
export async function detectLmStudioModelId() {
  try {
    const baseUrl = getLmStudioBaseUrl();
    const models = await fetchLmStudioModelsViaBackend(baseUrl);
    if (!models || !models.length) return;
    
    const activeModel = models[0].id;
    const modelSelect = document.getElementById("aiAvailableModelSelect");
    if (modelSelect) {
      // 이미 목록에 있다면 선택, 없으면 추가
      const token = buildModelToken("lmstudio", activeModel);
      let found = false;
      for (let i = 0; i< modelSelect.options.length; i++) {
        if (modelSelect.options[i].value === token) {
          modelSelect.selectedIndex = i;
          found = true;
          break;
        }
      }
      if (!found) {
        const opt = document.createElement("option");
        opt.value = token;
        opt.textContent = `[LM] ${activeModel}`;
        modelSelect.appendChild(opt);
        modelSelect.value = token;
      }
    }
  } catch (e) {
    console.warn("[STARK] detectLmStudioModelId failed:", e.message);
  }
}
