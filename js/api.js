function getBackendBaseUrl() {
  const endpoint = document.getElementById("aiEndpointUrl").value.trim();
  if (!endpoint) {
    return "http://localhost:8787";
  }
  return endpoint.replace(/\/api\/generate-answer\/?$/i, "").replace(/\/$/, "");
}

function getLmStudioBaseUrl() {
  const endpoint = document.getElementById("aiEndpointUrl").value.trim();
  if (!endpoint) {
    return "http://127.0.0.1:1234";
  }
  return endpoint
    .replace(/127\.0\.0\.1:5619/gi, "127.0.0.1:1234")
    .replace(/localhost:5619/gi, "localhost:1234")
    .replace(/\/v1\/chat\/completions\/?$/i, "")
    .replace(/\/$/, "");
}

function extractRoundOnlySafe(value) {
  if (typeof extractRoundOnly === "function") {
    return extractRoundOnly(value);
  }
  const text = String(value || "").trim();
  const match = text.match(/(\d{2,3})\s*회/);
  return match ? `${match[1]}회` : "";
}

function getFoundryBaseUrl() {
  return getLmStudioBaseUrl();
}

function getAnalyzeBackendUrl() {
  if (window.__ANALYZE_BACKEND__) {
    return String(window.__ANALYZE_BACKEND__).replace(/\/$/, "");
  }
  if (window.__analyzeBackendDiscoveredBase) {
    return String(window.__analyzeBackendDiscoveredBase).replace(/\/$/, "");
  }
  return "http://localhost:8787";
}

const AI_SELECTED_MODEL_STORAGE_KEY = "solve120_ai_selected_model_v1";
const LM_STUDIO_RETRY_COOLDOWN_MS = 10000;
const MODEL_TOKEN_SEPARATOR = "::";

const CLOUD_MODEL_CATALOG = {
  openai: ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4.1"],
  gemini: ["gemini-2.0-flash", "gemini-1.5-pro"],
  anthropic: ["claude-3-5-sonnet-latest", "claude-3-5-haiku-latest"],
};

const ANALYZE_BACKEND_CANDIDATES = [
  "http://localhost:8787",
  "http://localhost:8788",
  "http://localhost:8789",
];

async function discoverAnalyzeBackendBaseUrl() {
  if (window.__ANALYZE_BACKEND__) {
    const fixed = String(window.__ANALYZE_BACKEND__).replace(/\/$/, "");
    window.__analyzeBackendDiscoveredBase = fixed;
    return fixed;
  }

  if (window.__analyzeBackendDiscoveredBase) {
    return String(window.__analyzeBackendDiscoveredBase).replace(/\/$/, "");
  }

  for (const base of ANALYZE_BACKEND_CANDIDATES) {
    try {
      const response = await fetch(`${base}/health`, {
        signal: AbortSignal.timeout(1200),
      });
      if (!response.ok) {
        continue;
      }
      const payload = await response.json().catch(() => null);
      if (payload?.ok) {
        window.__analyzeBackendDiscoveredBase = base;
        return base;
      }
    } catch {
      // try next candidate
    }
  }

  return getAnalyzeBackendUrl();
}

function getSafeStorage() {
  return window.safeLocalStorage || localStorage;
}

function markLmStudioOffline() {
  window.__lmStudioOfflineUntil = Date.now() + LM_STUDIO_RETRY_COOLDOWN_MS;
}

function clearLmStudioOffline() {
  window.__lmStudioOfflineUntil = 0;
}

function shouldSkipLmStudioProbe() {
  return Number(window.__lmStudioOfflineUntil || 0) > Date.now();
}

function parseSelectedModelToken(rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) {
    return { provider: "", modelId: "", token: "" };
  }

  const idx = value.indexOf(MODEL_TOKEN_SEPARATOR);
  if (idx <= 0) {
    return { provider: "", modelId: value, token: value };
  }

  return {
    provider: value.slice(0, idx).trim(),
    modelId: value.slice(idx + MODEL_TOKEN_SEPARATOR.length).trim(),
    token: value,
  };
}

function buildModelToken(provider, modelId) {
  const p = String(provider || "").trim();
  const m = String(modelId || "").trim();
  if (!m) {
    return "";
  }
  return p ? `${p}${MODEL_TOKEN_SEPARATOR}${m}` : m;
}

async function fetchCloudProviderStatusViaBackend() {
  const backendUrl = await discoverAnalyzeBackendBaseUrl();
  const response = await fetch(`${backendUrl}/health`).catch(() => null);
  if (!response?.ok) {
    return null;
  }
  const payload = await response.json().catch(() => null);
  if (!payload || typeof payload.providers !== "object") {
    return null;
  }
  return payload.providers;
}

function buildCloudModelEntries(providerStatus) {
  const status = providerStatus && typeof providerStatus === "object"
    ? providerStatus
    : {};

  const entries = [];
  Object.entries(CLOUD_MODEL_CATALOG).forEach(([provider, models]) => {
    if (!status[provider]) {
      return;
    }
    models.forEach((modelId) => {
      entries.push({
        provider,
        modelId,
        label: `[${provider.toUpperCase()}] ${modelId}`,
      });
    });
  });
  return entries;
}

async function fetchLmStudioModelsViaBackend(baseUrl) {
  const backendUrl = await discoverAnalyzeBackendBaseUrl();
  const response = await fetch(`${backendUrl}/api/lmstudio-models`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ baseUrl }),
  }).catch(() => null);

  if (!response) {
    throw new Error("backend-unreachable");
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const attempted = Array.isArray(payload?.attempted)
      ? payload.attempted.join(", ")
      : "";
    const detail = payload?.error || `HTTP ${response.status}`;
    throw new Error(
      attempted ? `${detail} (시도: ${attempted})` : detail,
    );
  }

  if (!payload?.ok) {
    throw new Error(payload?.error || "lmstudio-unreachable");
  }

  return Array.isArray(payload.models) ? payload.models : [];
}

function isLikelyLmStudioEndpoint() {
  const endpoint = String(
    document.getElementById("aiEndpointUrl").value || "",
  ).toLowerCase();

  const isLocalHost =
    endpoint.includes("127.0.0.1") || endpoint.includes("localhost");
  return (
    endpoint.includes("127.0.0.1:1234") ||
    endpoint.includes("localhost:1234") ||
    (isLocalHost && endpoint.includes("/v1/chat/completions"))
  );
}

function isLikelyFoundryEndpoint() {
  return isLikelyLmStudioEndpoint();
}

function updateAiModeUx() {
  const isLmStudio = isLikelyLmStudioEndpoint();
  const apiBtn = document.getElementById("generateByApiBtn");
  const modeHint = document.getElementById("aiModeHint");

  if (apiBtn) {
    apiBtn.textContent = isLmStudio
      ? "선택 모델로 초안 작성 (LM Studio)"
      : "선택 모델로 초안 작성 (외부 API)";
  }

  if (modeHint) {
    modeHint.textContent = isLmStudio
      ? "현재 LM Studio 로컬 모드입니다. 모델을 선택하고 바로 초안을 작성하세요."
      : "외부 API 모드입니다. 설정에서 Endpoint/Provider를 확인한 뒤 모델을 선택해 작성하세요.";
  }
}

function getEffectiveSelectedModelId() {
  const select = document.getElementById("aiAvailableModelSelect");
  const input = document.getElementById("aiFoundryModelId");
  const selectedToken = String(select?.value || "").trim();
  const parsed = parseSelectedModelToken(selectedToken);
  if (parsed.modelId) {
    return parsed.modelId;
  }
  return String(input?.value || "").trim();
}

function renderAvailableModelOptions(modelEntries = [], preferred = "") {
  const select = document.getElementById("aiAvailableModelSelect");
  if (!select) {
    return;
  }

  const storage = getSafeStorage();
  const providerEl = document.getElementById("aiProvider");
  const fallbackModel = String(document.getElementById("aiFoundryModelId")?.value || "").trim();
  const fallbackProvider = String(providerEl?.value || "").trim();

  const normalized = (Array.isArray(modelEntries) ? modelEntries : [])
    .map((entry) => {
      if (entry && typeof entry === "object") {
        const provider = String(entry.provider || "").trim();
        const modelId = String(entry.modelId || entry.id || "").trim();
        if (!modelId) {
          return null;
        }
        const token = buildModelToken(provider, modelId);
        return {
          provider,
          modelId,
          token,
          label: String(entry.label || (provider ? `[${provider.toUpperCase()}] ${modelId}` : modelId)),
        };
      }

      const modelId = String(entry || "").trim();
      if (!modelId) {
        return null;
      }
      return {
        provider: "",
        modelId,
        token: buildModelToken("", modelId),
        label: modelId,
      };
    })
    .filter(Boolean);

  const byToken = new Map();
  normalized.forEach((item) => {
    if (!byToken.has(item.token)) {
      byToken.set(item.token, item);
    }
  });
  const unique = Array.from(byToken.values());

  const preferredToken = String(preferred || "").trim();
  const fallbackToken = buildModelToken(fallbackProvider, fallbackModel);
  const storedToken = String(storage.getItem(AI_SELECTED_MODEL_STORAGE_KEY) || "").trim();
  const target = preferredToken || fallbackToken || storedToken;

  if (!unique.length) {
    select.innerHTML = '<option value="">사용 가능한 모델 없음</option>';
    select.value = "";
    return;
  }

  select.innerHTML = unique
    .map((item) => `<option value="${escapeHtml(item.token)}">${escapeHtml(item.label)}</option>`)
    .join("");

  if (target && unique.some((item) => item.token === target)) {
    select.value = target;
  } else if (target) {
    const parsedTarget = parseSelectedModelToken(target);
    const byModel = unique.find((item) => item.modelId === parsedTarget.modelId);
    select.value = byModel ? byModel.token : unique[0].token;
  } else {
    select.value = unique[0].token;
  }

  const selectedToken = String(select.value || "").trim();
  const selected = parseSelectedModelToken(selectedToken);
  const input = document.getElementById("aiFoundryModelId");
  if (input && selected.modelId) {
    input.value = selected.modelId;
  }

  if (providerEl && selected.provider && selected.provider !== "lmstudio") {
    providerEl.value = selected.provider;
  }

  storage.setItem(AI_SELECTED_MODEL_STORAGE_KEY, selectedToken);
  if (selected.modelId) {
    storage.setItem(AI_FOUNDRY_MODEL_STORAGE_KEY, selected.modelId);
  }
}

async function refreshAvailableModels(silent = false, knownModels = null) {
  const select = document.getElementById("aiAvailableModelSelect");
  const manualModel = String(document.getElementById("aiFoundryModelId")?.value || "").trim();
  const providerEl = document.getElementById("aiProvider");
  const manualProvider = String(providerEl?.value || "").trim();

  if (!select) {
    return [];
  }

  const cloudProviderStatus = await fetchCloudProviderStatusViaBackend().catch(
    () => null,
  );
  const cloudEntries = buildCloudModelEntries(cloudProviderStatus);
  const collectedEntries = [...cloudEntries];

  if (!isLikelyLmStudioEndpoint()) {
    if (manualModel) {
      collectedEntries.push({
        provider: manualProvider,
        modelId: manualModel,
        label: manualProvider
          ? `[${manualProvider.toUpperCase()}] ${manualModel}`
          : manualModel,
      });
    }
    renderAvailableModelOptions(
      collectedEntries,
      buildModelToken(manualProvider, manualModel),
    );
    if (!silent) {
      setBackendStatus(
        `외부 API 모드: 사용 가능 모델 ${collectedEntries.length}개`,
        "info",
      );
    }
    return collectedEntries.map((entry) => String(entry.modelId || "")).filter(Boolean);
  }

  if (!knownModels && shouldSkipLmStudioProbe()) {
    if (manualModel) {
      collectedEntries.push({ provider: "lmstudio", modelId: manualModel, label: `[LM STUDIO] ${manualModel}` });
    }
    renderAvailableModelOptions(
      collectedEntries,
      buildModelToken("lmstudio", manualModel),
    );
    if (!silent) {
      setBackendStatus(
        "백엔드 연결됨 / LM Studio 오프라인(재시도 대기). 외부 API 또는 로컬 규칙 모드를 사용할 수 있습니다.",
        "info",
      );
    }
    return collectedEntries.map((entry) => String(entry.modelId || "")).filter(Boolean);
  }

  let models = Array.isArray(knownModels) ? knownModels : null;
  if (!models) {
    try {
      const baseUrl = getLmStudioBaseUrl();
      models = await fetchLmStudioModelsViaBackend(baseUrl);
    } catch (error) {
      markLmStudioOffline();
      if (manualModel) {
        collectedEntries.push({ provider: "lmstudio", modelId: manualModel, label: `[LM STUDIO] ${manualModel}` });
      }
      renderAvailableModelOptions(
        collectedEntries,
        buildModelToken("lmstudio", manualModel),
      );
      if (!silent) {
        setBackendStatus(
          `백엔드 연결됨 / LM Studio 모델 조회 실패: ${error.message}`,
          "info",
        );
      }
      return collectedEntries.map((entry) => String(entry.modelId || "")).filter(Boolean);
    }
  }

  const lmModelIds = models
    .map((row) => String(row?.id || "").trim())
    .filter(Boolean);
  lmModelIds.forEach((modelId) => {
    collectedEntries.push({
      provider: "lmstudio",
      modelId,
      label: `[LM STUDIO] ${modelId}`,
    });
  });

  clearLmStudioOffline();
  renderAvailableModelOptions(
    collectedEntries,
    buildModelToken("lmstudio", manualModel),
  );

  if (!silent) {
    setBackendStatus(`모델 목록 갱신 완료: ${collectedEntries.length}개`, "success");
  }
  return collectedEntries.map((entry) => String(entry.modelId || "")).filter(Boolean);
}

async function generateDraftAnswersByActiveModel() {
  const selectedToken = String(
    document.getElementById("aiAvailableModelSelect")?.value || "",
  ).trim();
  const selected = parseSelectedModelToken(selectedToken);
  const providerEl = document.getElementById("aiProvider");

  if (providerEl && selected.provider && selected.provider !== "lmstudio") {
    providerEl.value = selected.provider;
  }

  if (selected.provider && selected.provider !== "lmstudio") {
    return generateDraftAnswersByApi();
  }

  if (isLikelyLmStudioEndpoint() || selected.provider === "lmstudio") {
    return generateDraftAnswersByLmStudioLocal();
  }
  return generateDraftAnswersByApi();
}

function setLmStudioLocalPreset() {
  const endpointInput = document.getElementById("aiEndpointUrl");
  endpointInput.value = "http://127.0.0.1:1234/v1/chat/completions";
  getSafeStorage().setItem(
    AI_ENDPOINT_STORAGE_KEY,
    endpointInput.value,
  );
  setBackendStatus("LM Studio Local 프리셋 적용됨", "info");
  updateAiModeUx();
  detectLmStudioModelId();
}

function setFoundryLocalPreset() {
  setLmStudioLocalPreset();
}

async function detectLmStudioModelId(silent = false) {
  const input = document.getElementById("aiFoundryModelId");
  const baseUrl = getLmStudioBaseUrl();

  if (shouldSkipLmStudioProbe()) {
    if (!silent) {
      setBackendStatus(
        "백엔드 연결됨 / LM Studio 오프라인(재시도 대기). 외부 API 또는 로컬 규칙 모드를 사용할 수 있습니다.",
        "info",
      );
    }
    return "";
  }

  try {
    const modelRows = await fetchLmStudioModelsViaBackend(baseUrl);
    const modelIds = modelRows
      .map((row) => String(row?.id || "").trim())
      .filter(Boolean);
    const modelId = modelIds[0] || "";
    if (!modelId) {
      throw new Error("로드된 모델이 없습니다. LM Studio에서 모델 로드 후 다시 시도하세요.");
    }
    renderAvailableModelOptions(modelIds, modelId);
    input.value = modelId;
    getSafeStorage().setItem(
      AI_FOUNDRY_MODEL_STORAGE_KEY,
      modelId,
    );
    setBackendStatus(`LM Studio 모델 감지: ${modelId}`, "success");
    window.isBackendAvailable = true; // v21.6.12
    clearLmStudioOffline();
    return modelId;
  } catch (error) {
    window.isBackendAvailable = false;
    markLmStudioOffline();
    if (!silent) {
      setBackendStatus(`LM Studio 연결 실패: ${error.message}`, "error");
    } else {
      setBackendStatus("LM Studio 연결 대기 중...", "info");
    }
    return "";
  }
}

async function detectFoundryModelId(silent = false) {
  return detectLmStudioModelId(silent);
}

function applyStatusChip(el, label, message, type = "info") {
  if (!el) {
    return;
  }

  const palette = {
    info: "bg-slate-100 text-slate-600",
    success: "bg-emerald-100 text-emerald-700",
    error: "bg-rose-100 text-rose-700",
  };

  el.className = `text-[11px] px-2 py-1 rounded-full self-center ${palette[type] || palette.info}`;
  el.textContent = `${label}: ${String(message || "확인 대기")}`;
}

function setLmActionButtonsVisible(visible) {
  const actionWrap = document.getElementById("lmActionButtons");
  if (!actionWrap) {
    return;
  }
  actionWrap.classList.toggle("hidden", !visible);
  actionWrap.classList.toggle("flex", Boolean(visible));
}

function switchToExternalApiMode() {
  const endpointInput = document.getElementById("aiEndpointUrl");
  const providerEl = document.getElementById("aiProvider");

  if (endpointInput && isLikelyLmStudioEndpoint()) {
    endpointInput.value = `${getAnalyzeBackendUrl()}/api/generate-answer`;
    getSafeStorage().setItem(AI_ENDPOINT_STORAGE_KEY, endpointInput.value);
  }

  if (providerEl && !providerEl.value) {
    providerEl.value = "openai";
  }

  updateAiModeUx();
  refreshAvailableModels(true);
  checkBackendConnection(true);
  setPdfStatus(
    "외부 API 모드로 전환했습니다. Provider/API Key 설정 후 '선택 모델로 초안 작성'을 실행하세요.",
    "info",
  );
}

function setBackendStatus(message, type = "info") {
  const statusEl = document.getElementById("backendStatus");
  const coreEl = document.getElementById("backendCoreStatus");
  const lmEl = document.getElementById("lmStudioStatus");
  const colorMap = {
    info: "text-slate-500",
    success: "text-emerald-700",
    error: "text-rose-700",
  };

  if (statusEl) {
    statusEl.className = `hidden text-xs self-center ${colorMap[type] || colorMap.info}`;
    statusEl.textContent = message;
  }

  const text = String(message || "").trim();
  const lower = text.toLowerCase();
  const lmMentioned = lower.includes("lm studio");

  if (lmMentioned) {
    const coreConnected =
      text.includes("백엔드 연결됨") || text.includes("연결됨: LM Studio Local");
    applyStatusChip(
      coreEl,
      "백엔드",
      coreConnected ? "연결됨" : text,
      coreConnected ? "success" : type,
    );

    let lmType = type;
    if (/모델 감지|로드 모델|목록 갱신 완료/.test(text)) {
      lmType = "success";
    } else if (/미연결|오프라인|실패|대기/.test(text)) {
      lmType = "info";
    }

    let lmMsg = text;
    const slashSplit = text.split("/").map((part) => part.trim()).filter(Boolean);
    if (slashSplit.length >= 2) {
      lmMsg = slashSplit[1];
    } else {
      const lmIndex = text.indexOf("LM Studio");
      lmMsg = lmIndex >= 0 ? text.slice(lmIndex) : text;
    }
    lmMsg = lmMsg
      .replace(/^LM\s*Studio\s*/i, "")
      .replace(/^모델\s*/, "모델 ")
      .replace(/^미연결\s*:\s*/i, "미연결 (")
      .replace(/\)$/g, "")
      .trim();
    if (lmMsg.startsWith("미연결 (") && !lmMsg.endsWith(")")) {
      lmMsg = `${lmMsg})`;
    }
    lmMsg = lmMsg || "상태 확인 중";
    applyStatusChip(lmEl, "LM Studio", lmMsg, lmType);

    const needsAction = /미연결|오프라인|실패|대기/.test(text);
    setLmActionButtonsVisible(needsAction);
    return;
  }

  applyStatusChip(coreEl, "백엔드", text || "확인 대기", type);
  if (isLikelyLmStudioEndpoint()) {
    applyStatusChip(lmEl, "LM Studio", "상태 확인 중", "info");
  } else {
    applyStatusChip(lmEl, "LM Studio", "외부 API 모드", "info");
  }
  setLmActionButtonsVisible(false);
}

function renderBackendDiagnostics(diagnostics = [], providers = null) {
  const el = document.getElementById("backendDiagnostics");
  if (!el) {
    return;
  }

  const providerObj =
    providers && typeof providers === "object" ? providers : null;

  if (!providerObj) {
    el.innerHTML = `<div class="text-slate-400">Provider 정보 없음</div>`;
    return;
  }

  const statusMap = {
    openai: { label: "OpenAI (GPT-4o-mini)", color: "blue" },
    gemini: { label: "Google (Gemini 2.0)", color: "emerald" },
    anthropic: { label: "Anthropic (Claude 3.5)", color: "orange" },
  };

  let html = '<div class="flex flex-wrap gap-x-4 gap-y-1">';
  Object.entries(providerObj).forEach(([name, enabled]) => {
    const config = statusMap[name] || { label: name, color: "slate" };
    const dotColor = enabled ? `bg-${config.color}-500` : "bg-slate-300";
    const textColor = enabled ? `text-${config.color}-700` : "text-slate-400";
    html += `
                  <div class="flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 rounded-full ${dotColor}"></span>
                    <span class="font-bold uppercase text-[9px] ${textColor}">${config.label}</span>
                    <span class="text-[9px] ${enabled ? "text-emerald-600" : "text-slate-400"}">${enabled ? "ON" : "OFF"}</span>
                  </div>
                `;
  });
  html += "</div>";

  const rows = Array.isArray(diagnostics) ? diagnostics : [];
  if (rows.length > 0) {
    html +=
      '<div class="mt-1.5 pt-1.5 border-t border-slate-200 text-[10px] space-y-0.5">';
    rows.forEach((row) => {
      const statusColor =
        row.status === "valid"
          ? "text-emerald-600"
          : row.status === "invalid"
            ? "text-rose-600"
            : "text-slate-500";
      const icon =
        row.status === "valid"
          ? "fa-check-circle"
          : row.status === "invalid"
            ? "fa-exclamation-triangle"
            : "fa-circle";
      html += `<div class="${statusColor} flex items-center gap-1">
                    <i class="fas ${icon}"></i>
                    <span class="font-bold">[${row.provider}]</span>
                    <span>${row.status === "valid" ? "검증 성공" : row.status === "invalid" ? `검증 실패: ${row.error || "unknown"}` : "설정 미흡"}</span>
                  </div>`;
    });
    html += "</div>";
  }

  el.innerHTML = html;
}

async function validateApiKeys() {
  const baseUrl = isLikelyLmStudioEndpoint()
    ? await discoverAnalyzeBackendBaseUrl()
    : getBackendBaseUrl();
  const el = document.getElementById("backendDiagnostics");

  try {
    setBackendStatus("API 키 유효성 검사 중...", "info");
    el.innerHTML = `
                  <div class="flex items-center gap-2 text-slate-500 animate-pulse">
                    <i class="fas fa-spinner fa-spin"></i>
                    <span>각 클라우드 제공업체(OpenAI, Gemini, Anthropic)에 테스트 요청을 보내는 중입니다...</span>
                  </div>
                `;

    const response = await fetch(`${baseUrl}/api/validate-keys`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const results = await response.json();
    const diagnostics = Object.entries(results).map(([provider, res]) => ({
      provider,
      status: res.status,
      error: res.error,
    }));

    const providers = {
      openai: results.openai?.status !== "missing",
      gemini: results.gemini?.status !== "missing",
      anthropic: results.anthropic?.status !== "missing",
    };

    renderBackendDiagnostics(diagnostics, providers);

    const validCount = Object.values(results).filter(
      (r) => r.status === "valid",
    ).length;
    const totalCount = Object.values(results).filter(
      (r) => r.status !== "missing",
    ).length;

    setBackendStatus(
      `검증 완료: ${validCount}/${totalCount} 유효`,
      validCount > 0 ? "success" : "error",
    );
  } catch (err) {
    setBackendStatus(`검증 실패: ${err.message}`, "error");
    el.textContent = `API 키 검증 중 오류가 발생했습니다: ${err.message}`;
  }
}

function summarizeLlmDiagnostics(diagnostics) {
  const rows = Array.isArray(diagnostics) ? diagnostics : [];
  if (!rows.length) {
    return "";
  }

  const failed = rows.filter((row) => row && row.status === "failed");
  if (failed.length) {
    const first = failed[0];
    return `${first.provider || "llm"} 실패: ${String(first.reason || "provider_call_failed").slice(0, 120)}`;
  }

  const skipped = rows.filter((row) => row && row.status === "skipped");
  if (skipped.length) {
    return `키 미설정 provider: ${skipped.map((row) => row.provider).join(", ")}`;
  }

  return "LLM 진단 정보가 수집되었습니다.";
}

function loadAiPresets() {
  const select = document.getElementById("aiModelPresets");
  if (!select) return;

  const storage = getSafeStorage();
  const raw = storage.getItem(AI_PRESETS_STORAGE_KEY);
  let presets = [];
  try {
    presets = raw ? JSON.parse(raw) : [];
  } catch (e) {
    presets = [];
  }

  // Default local backend preset if empty
  if (presets.length === 0) {
    presets = [
      {
        name: "Local Backend (v14.0)",
        url: "http://localhost:8787",
        key: "",
        model: "",
        provider: "",
      },
      {
        name: "LM Studio Local",
        url: "http://127.0.0.1:1234/v1/chat/completions",
        key: "",
        model: "",
        provider: "",
      },
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

function saveCurrentAiPreset() {
  const url = document.getElementById("aiEndpointUrl").value.trim();
  const key = document.getElementById("aiApiKey").value.trim();
  const model = getEffectiveSelectedModelId();
  const providerEl = document.getElementById("aiProvider");
  const provider = providerEl ? providerEl.value : "";

  if (!url) {
    alert("먼저 Endpoint URL을 입력하세요.");
    return;
  }

  const name = prompt(
    "이 설정의 프리셋 이름을 입력하세요:",
    `AI-${new Date().toLocaleTimeString()}`,
  );
  if (!name) return;

  const storage = getSafeStorage();
  const raw = storage.getItem(AI_PRESETS_STORAGE_KEY);
  let presets = [];
  try {
    presets = raw ? JSON.parse(raw) : [];
  } catch (e) {}

  presets.push({ name, url, key, model, provider });
  storage.setItem(AI_PRESETS_STORAGE_KEY, JSON.stringify(presets));
  loadAiPresets();
  alert("프리셋이 저장되었습니다.");
}

function deleteCurrentAiPreset() {
  const select = document.getElementById("aiModelPresets");
  const idx = select.value;
  if (idx === "") {
    alert("삭제할 프리셋을 선택하세요.");
    return;
  }

  if (!confirm("정말 이 프리셋을 삭제하시겠습니까?")) return;

  const storage = getSafeStorage();
  const raw = storage.getItem(AI_PRESETS_STORAGE_KEY);
  let presets = [];
  try {
    presets = raw ? JSON.parse(raw) : [];
  } catch (e) {}

  presets.splice(idx, 1);
  storage.setItem(AI_PRESETS_STORAGE_KEY, JSON.stringify(presets));
  select.value = "";
  loadAiPresets();
}

function applyAiPreset(idx) {
  if (idx === "") return;
  const storage = getSafeStorage();
  const raw = storage.getItem(AI_PRESETS_STORAGE_KEY);
  let presets = [];
  try {
    presets = raw ? JSON.parse(raw) : [];
  } catch (e) {}

  const p = presets[idx];
  if (!p) return;

  document.getElementById("aiEndpointUrl").value = p.url || "";
  document.getElementById("aiApiKey").value = p.key || "";
  document.getElementById("aiFoundryModelId").value = p.model || "";
  const providerEl = document.getElementById("aiProvider");
  if (providerEl && p.provider) {
    providerEl.value = p.provider;
  }

  storage.setItem(AI_ENDPOINT_STORAGE_KEY, p.url || "");
  storage.setItem(AI_FOUNDRY_MODEL_STORAGE_KEY, p.model || "");
  storage.setItem(AI_SELECTED_MODEL_STORAGE_KEY, p.model || "");

  updateAiModeUx();
  refreshAvailableModels(true);
  checkBackendConnection();
}

async function checkBackendConnection(silent = false) {
  const baseUrl = isLikelyLmStudioEndpoint()
    ? getLmStudioBaseUrl()
    : await discoverAnalyzeBackendBaseUrl();
  try {
    if (!silent) setBackendStatus("백엔드 연결 확인 중...", "info");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // Timeout reduced to 2s

    if (isLikelyLmStudioEndpoint()) {
      if (shouldSkipLmStudioProbe()) {
        if (!silent) {
          setBackendStatus(
            "백엔드 연결됨 / LM Studio 오프라인(재시도 대기). 외부 API 또는 로컬 규칙 모드를 사용할 수 있습니다.",
            "info",
          );
        }
        renderBackendDiagnostics([], null);
        window.isBackendAvailable = false;
        return false;
      }

      try {
        const modelRows = await fetchLmStudioModelsViaBackend(baseUrl);
        clearTimeout(timeoutId);
        const modelCount = modelRows.length;
        refreshAvailableModels(true, modelRows);
        setBackendStatus(
          `연결됨: LM Studio Local (로드 모델 ${modelCount}개)`,
          "success",
        );
        window.isBackendAvailable = true;
        clearLmStudioOffline();
        renderBackendDiagnostics([], null);
        return true;
      } catch {
        clearTimeout(timeoutId);
        window.isBackendAvailable = false;
        markLmStudioOffline();
        throw new Error("LM Studio 서비스 오프라인");
      }
    }

    const response = await fetch(`${baseUrl}/health`, {
      signal: controller.signal,
    }).catch(() => ({ ok: false })); // Prevent console noise

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status || "오프라인"}`);
    }
    const payload = await response.json();
    const providers =
      payload && typeof payload.providers === "object"
        ? payload.providers
        : null;
    const providerOnCount = providers
      ? Object.values(providers).filter(Boolean).length
      : 0;
    setBackendStatus(
      `연결됨: ${payload.service || "backend"}${providers ? ` (활성 provider ${providerOnCount}개)` : ""}`,
      "success",
    );
    renderBackendDiagnostics([], providers);
    return true;
  } catch (err) {
    if (isLikelyLmStudioEndpoint()) {
      setBackendStatus(
        `백엔드 연결됨 / LM Studio 미연결: ${err.message || "로컬 규칙 모드 사용"}`,
        "info",
      );
    } else {
      setBackendStatus(
        `연결 실패: ${err.message || "로컬 규칙 모드 사용"}`,
        "error",
      );
    }
    renderBackendDiagnostics([], null);
    return false;
  }
}

function getSelectedQuestionIdSetForAi() {
  const selected = Array.isArray(window.selectedQuestionIdsForAi)
    ? window.selectedQuestionIdsForAi
    : [];
  return new Set(selected.map((id) => String(id)));
}

function sanitizeExtractedSourceText(rawText) {
  const text = String(rawText || "");
  if (!text.trim()) {
    return "";
  }

  return text
    .replace(/\0/g, "")
    .replace(/^\s*=+\s*[^\n]*\s*=+\s*$/gm, "") // ===== file ===== 헤더 제거
    .replace(/^[ \t]*[|¦]{2,}.*$/gm, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function tokenizeForSimilarity(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2);
}

function calculateTokenOverlapScore(sourceTokens, targetTokens) {
  if (!sourceTokens.length || !targetTokens.length) {
    return 0;
  }
  const sourceSet = new Set(sourceTokens);
  let hit = 0;
  targetTokens.forEach((token) => {
    if (sourceSet.has(token)) {
      hit += 1;
    }
  });
  return hit / Math.max(1, targetTokens.length);
}

function buildTheoryContextForQuestion(question, theories, maxItems = 3) {
  const questionText = [question?.title, question?.rawQuestion, ...(question?.tags || [])]
    .filter(Boolean)
    .join(" ");
  const questionTokens = tokenizeForSimilarity(questionText);

  if (!Array.isArray(theories) || !theories.length || !questionTokens.length) {
    return [];
  }

  return theories
    .map((theory) => {
      const theoryText = [
        theory?.title,
        theory?.category,
        ...(Array.isArray(theory?.tags) ? theory.tags : []),
        theory?.content,
      ]
        .filter(Boolean)
        .join(" ");
      const theoryTokens = tokenizeForSimilarity(theoryText);
      return {
        theory,
        score: calculateTokenOverlapScore(theoryTokens, questionTokens),
      };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxItems)
    .map((row) => row.theory);
}

function inferAnswerWritingSpec(question) {
  const text = `${question?.title || ""} ${question?.rawQuestion || ""}`;
  const isShort = /1\s*교시|10\s*점|용어|단답/.test(text);
  if (isShort) {
    return {
      type: "short",
      pageTarget: "1.0~1.2페이지",
      minChars: 900,
      sectionGuide: [
        "1) 정의/배경 (핵심 용어 영문 병기 포함)",
        "2) 메커니즘 도해 지시 (단면+선도/응력블록/힘의 흐름 중 최소 1개)",
        "3) 특징·핵심 검토항목 (개조식 넘버링)",
        "4) 기준·수치(KDS 코드/계수/단위) + 결론",
      ],
    };
  }

  return {
    type: "long",
    pageTarget: "최소 2.5페이지, 권장 3페이지",
    minChars: 2200,
    sectionGuide: [
      "[1 page] 1) 개요 2) 기본 원리/메커니즘 (핵심 도해 1/3 비중)",
      "[2 page] 3) 상세 해석/설계 검토 (비교표 + 수식/단위 + KDS 근거)",
      "[3 page] 4) 시공/유지관리 유의사항 5) 결론/기술사 제언(본인 견해 3~4줄)",
    ],
  };
}

function buildHighQualityAnswerInstruction(question, relatedTheories = []) {
  const spec = inferAnswerWritingSpec(question);
  const theoryBlock = relatedTheories.length
    ? relatedTheories
        .map((theory, idx) => {
          const tags = Array.isArray(theory.tags) ? theory.tags.join(", ") : "";
          return [
            `- 참조이론 ${idx + 1}: ${theory.title || "이론"}`,
            `  분류/태그: ${theory.category || "일반"}${tags ? ` / ${tags}` : ""}`,
            `  핵심: ${String(theory.content || "").slice(0, 320)}`,
          ].join("\n");
        })
        .join("\n")
    : "- 참조이론 없음(문제 본문 중심으로 작성)";

  return [
    "당신은 토목구조기술사 채점위원 관점의 답안 코치다.",
    "채점관은 읽기보다 '보기'를 우선하므로, 글자 밀도 + 시각화 지시를 반드시 포함하라.",
    `답안 목표 분량: ${spec.pageTarget} (최소 ${spec.minChars}자 이상)`,
    "아래 형식을 정확히 지켜 고득점형 개조식 답안을 작성하라:",
    ...spec.sectionGuide,
    "필수 요소:",
    "- 메커니즘 도해 지시 2개 이상(예: 변형률 선도, 응력블록, 하중흐름 화살표, P-M 상관도, S-N 곡선)",
    "- 비교표 1개 이상(예: 허용응력설계법 vs 한계상태설계법)",
    "- 핵심 용어 영어 병기 3개 이상(예: Ductility, Redundancy, Arch Action)",
    "- KDS/KCS 코드 1개 이상 명시(예: KDS 14 20 00)",
    "- 문장 종결은 개조식/명사형 위주, 넘버링(1.,2.,3.) 유지",
    "금지: 장황한 서론, 중복 문장, 근거 없는 단정.",
    "출력 형식: 바로 답안지에 옮겨 적을 수 있도록 구조화된 초안으로 출력.",
    "",
    `[문제 제목] ${question?.title || ""}`,
    `[문제 원문] ${question?.rawQuestion || ""}`,
    "",
    "[연관 이론 컨텍스트]",
    theoryBlock,
  ].join("\n");
}

async function generateDraftAnswersByLmStudioLocal() {
  const endpointRaw = document.getElementById("aiEndpointUrl").value.trim();
  const apiKey = document.getElementById("aiApiKey").value.trim();
  const modelInput = document.getElementById("aiFoundryModelId");
  const baseUrl = endpointRaw ? getLmStudioBaseUrl() : "http://127.0.0.1:1234";
  const endpoint = `${baseUrl}/v1/chat/completions`;

  if (!endpointRaw) {
    document.getElementById("aiEndpointUrl").value = endpoint;
  }
  getSafeStorage().setItem(
    AI_ENDPOINT_STORAGE_KEY,
    document.getElementById("aiEndpointUrl").value.trim(),
  );

  let modelId = getEffectiveSelectedModelId();
  if (!modelId) {
    modelId = await detectLmStudioModelId();
    if (!modelId) {
      setPdfStatus(
        "LM Studio 모델 ID를 확인하세요. 모델 로드 후 다시 시도하세요.",
        "error",
      );
      return { ok: false, updated: 0, fallbackCount: 0 };
    }
  }

  getSafeStorage().setItem(
    AI_FOUNDRY_MODEL_STORAGE_KEY,
    modelId,
  );

  let data;
  try {
    data = getCurrentAnswerData();
  } catch (error) {
    setPdfStatus(`JSON 파싱 오류: ${error.message}`, "error");
    return { ok: false, updated: 0, fallbackCount: 0 };
  }

  const overwrite = document.getElementById("overwriteGenerated").checked;
  const selectedIdSet = getSelectedQuestionIdSetForAi();
  const selectedMode = selectedIdSet.size > 0;
  const targetTotal = selectedMode
    ? data.questions.filter((q) => selectedIdSet.has(String(q.id || ""))).length
    : data.questions.length;
  if (selectedMode && targetTotal === 0) {
    setPdfStatus("선택된 문항이 없습니다. 인식된 문항 리스트에서 대상을 선택하세요.", "error");
    return { ok: false, updated: 0, fallbackCount: 0 };
  }
  let updated = 0;
  let fallbackCount = 0;

  setPdfStatus(
    `LM Studio Local로 초안 생성 중... (${selectedMode ? `선택 ${targetTotal}개` : `전체 ${targetTotal}개`})`,
    "info",
  );

  for (let index = 0; index < data.questions.length; index += 1) {
    const question = data.questions[index];
    if (selectedMode && !selectedIdSet.has(String(question.id || ""))) {
      continue;
    }
    const hasAnswer = String(question.modelAnswer || "").trim().length > 0;
    if (!overwrite && hasAnswer) {
      continue;
    }

    const relatedTheories = buildTheoryContextForQuestion(
      question,
      data.theories || [],
      3,
    );
    const qualityInstruction = buildHighQualityAnswerInstruction(
      question,
      relatedTheories,
    );

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: modelId,
          temperature: 0.15,
          messages: [
            {
              role: "system",
              content:
                "토목구조기술사 고득점 답안 스타일로 작성하되, 번호형 구조와 기준 근거(KDS) 및 도해 포인트를 반드시 포함하세요.",
            },
            {
              role: "user",
              content: qualityInstruction,
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      const answer =
        payload?.choices?.[0]?.message?.content ||
        payload?.choices?.[0]?.delta?.content ||
        "";
      if (!String(answer).trim()) {
        throw new Error("응답 answer 텍스트가 없습니다.");
      }

      data.questions[index] = {
        ...question,
        modelAnswer: String(answer).trim(),
        source: question.source
          ? `${question.source} + LMStudioLocal`
          : "LMStudioLocal",
      };
      updated += 1;
    } catch {
      data.questions[index] = {
        ...question,
        modelAnswer: generateLocalAnswerTemplate(question),
        source: question.source
          ? `${question.source} + LMStudioLocalFallback`
          : "LMStudioLocalFallback",
      };
      updated += 1;
      fallbackCount += 1;
    }
  }

  syncJsonAndRender(
    data,
    `LM Studio Local 초안 생성(실패 시 로컬 대체) 완료: ${updated}개${selectedMode ? ` / 선택대상 ${targetTotal}개` : ""}`,
  );
  setPdfStatus(
    `LM Studio Local 초안 작성 완료: ${updated}개 (로컬 대체 ${fallbackCount}개)`,
    fallbackCount > 0 ? "info" : "success",
  );
  return { ok: true, updated, fallbackCount };
}

async function generateDraftAnswersByFoundryLocal() {
  return generateDraftAnswersByLmStudioLocal();
}

async function extractPdfText() {
  // PDF direct text extraction removed for MVP.
  setPdfStatus(
    "PDF 텍스트 추출 기능은 MVP에서 제거되었습니다. 텍스트를 직접 붙여넣어 주세요.",
    "error",
  );
  return false;
}

async function extractQuestionsFromPdfText() {
  // Prefer analyzing attached files (images/pdf/text).
  // Check both `attachmentFiles` and `pdfFileInput` inputs so users
  // who used either control are covered.
  const attachmentInput = document.getElementById("attachmentFiles");
  const pdfInput = document.getElementById("pdfFileInput");
  const attachedFiles = [];
  if (
    attachmentInput &&
    attachmentInput.files &&
    attachmentInput.files.length
  ) {
    attachedFiles.push(...Array.from(attachmentInput.files));
  }
  if (pdfInput && pdfInput.files && pdfInput.files.length) {
    attachedFiles.push(...Array.from(pdfInput.files));
  }

  let extracted = "";

  if (!attachedFiles.length) {
    setPdfStatus(
      "첨부파일이 없습니다. 문제 자동 추출을 사용하려면 파일을 첨부하세요.",
      "error",
    );
    return { ok: false, addedCount: 0, examRound: "미지정" };
  }

  if (attachedFiles.length) {
    setAttachmentStatus("첨부파일에서 텍스트 추출 중...", "info");
    const parts = [];
    for (const f of attachedFiles) {
      try {
        const snippet = await readAttachmentTextExcerpt(f);
        parts.push(`===== ${f.name} =====\n${snippet}`);
      } catch (err) {
        parts.push(`===== ${f.name} =====\n(텍스트 추출 실패: ${err.message})`);
      }
    }
    extracted = sanitizeExtractedSourceText(parts.join("\n\n"));
    setAttachmentStatus("첨부파일 텍스트 준비 완료.", "success");
  }

  if (!extracted) {
    setPdfStatus(
      "추출된 텍스트가 없습니다. 스캔된 이미지 기반 PDF이거나 텍스트 레이어가 없는 파일일 수 있습니다. '인식 영역 확인' 모드에서 수동으로 영역을 지정하거나 OCR 보조 도구 사용을 권장합니다.",
      "error",
    );
    return { ok: false, addedCount: 0, examRound: "미지정" };
  }

  let data;
  try {
    data = getCurrentAnswerData();
  } catch (error) {
    setPdfStatus(`현재 JSON 파싱 오류: ${error.message}`, "error");
    return { ok: false, addedCount: 0, examRound: "미지정" };
  }

  let parsedQuestions = [];
  let aiQuestions = [];
  let localQuestions = [];

  // 1. Local Parsing (Baseline)
  localQuestions = parseQuestionsFromText(extracted);
  if (typeof console.debug === "function") {
    console.debug(`[Local Parser] Found ${localQuestions.length} questions`);
  }

  // 2. AI Parsing (Optional Enhancement)
  const baseUrl = isLikelyLmStudioEndpoint()
    ? await discoverAnalyzeBackendBaseUrl()
    : getBackendBaseUrl();

  // v21.6.12: 연결이 확실히 오프라인인 경우 fetch 시도 자체를 건너뜀 (콘솔 노이즈 방지)
  if (window.isBackendAvailable === false) {
    console.debug("[AI Parser] Backend confirmed offline, using local only.");
    setBackendStatus("로컬 분석 모드 (AI 서버 미연결)", "info");
  } else {
    try {
      const response = await fetch(`${baseUrl}/api/analyze-questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: extracted, source: "attachments" }),
      }).catch(() => null);

      if (response && response.ok) {
        const payload = await response.json();
        aiQuestions = Array.isArray(payload.questions) ? payload.questions : [];
        if (typeof console.debug === "function") {
          console.debug(`[AI Parser] Found ${aiQuestions.length} questions`);
        }
        setBackendStatus(
          aiQuestions.length > 1
            ? "문제 추출: 백엔드 AI 분석 사용"
            : "문제 추출: AI 분석 불충분, 로컬 병합",
          "success",
        );
      } else {
        window.isBackendAvailable = false;
        throw new Error("백엔드 응답 없음");
      }
    } catch (err) {
      console.debug(
        "[AI Parser] Backend unavailable, falling back to local:",
        err?.message || err,
      );
      setBackendStatus("로컬 분석 모드 (AI 서버 미연결)", "info");
    }
  }

  // 3. Smart Merge
  // 로컬 파서가 1개 이하(보통 파일명 헤더만 찾은 경우)를 찾았고 AI가 더 많이 찾았다면 AI 우선.
  // 기술사 시험(31문항)인 경우 로컬 파서의 정확도가 높을 확률이 큼.
  if (
    localQuestions.length <= 1 &&
    aiQuestions.length > localQuestions.length
  ) {
    parsedQuestions = aiQuestions;
  } else if (localQuestions.length >= aiQuestions.length) {
    parsedQuestions = localQuestions;
  } else {
    // 둘 다 유효한 경우, 더 많이 찾은 쪽을 선택하되
    // 로컬이 최소 10개 이상 찾았다면 로컬 파서의 구조적 신뢰도를 우선함.
    parsedQuestions = localQuestions.length > 10 ? localQuestions : aiQuestions;
  }

  if (!parsedQuestions.length) {
    setPdfStatus(
      "문제 추출에 실패했습니다. 텍스트 파싱 결과를 확인하세요.",
      "error",
    );
    return { ok: false, addedCount: 0, examRound: "미지정" };
  }

  // Compute per-round counts from parsedQuestions (use inference per question)
  const countsByRound = {};
  parsedQuestions.forEach((q) => {
    const maybeRound =
      q.examRound || inferExamRoundFromText(q.rawQuestion || "") || "미지정";
    countsByRound[maybeRound] = (countsByRound[maybeRound] || 0) + 1;
  });
  const examRound =
    Object.keys(countsByRound).length === 1
      ? Object.keys(countsByRound)[0]
      : "혼합";
  const existingKeys = new Set(
    data.questions.map((item) => `${item.examRound}|${item.id}|${item.title}`),
  );
  let addedCount = 0;

  parsedQuestions.forEach((item, index) => {
    const inferredFromRaw = inferExamRoundFromText(item.rawQuestion || "");
    const qRound =
      extractRoundOnlySafe(item.examRound) ||
      extractRoundOnlySafe(inferredFromRaw) ||
      extractRoundOnlySafe(examRound) ||
      "미지정";
    const payload = {
      id: item.id || `Q${data.questions.length + index + 1}`,
      title: item.title || `문제 ${index + 1}`,
      examRound: qRound,
      tags: ["자동추출"],
      modelAnswer: "",
      source: attachedFiles.length ? "Attachment AI" : "Text Input",
      reviewed: false,
      rawQuestion: item.rawQuestion || "",
    };
    const key = `${payload.examRound}|${payload.id}|${payload.title}`;
    if (!existingKeys.has(key)) {
      data.questions.push(payload);
      existingKeys.add(key);
      addedCount += 1;
    }
  });

  syncJsonAndRender(
    data,
    `자동 추출 완료: ${addedCount}개 신규 추가 (총 ${data.questions.length}문항 보유)`,
  );
  setPdfStatus(
    `추출 결과: ${parsedQuestions.length}개 발견 (${addedCount}개 신규 추가)`,
    "success",
  );

  // ──── 보강된 공통 리포트 함수 호출 ────
  refreshAutoExtractSummary(addedCount);

  // ──── 사이드-바이-사이드 리뷰어 활성화 ────
  const reviewerSection = document.getElementById("extractReviewer");
  if (reviewerSection) {
    reviewerSection.classList.remove("hidden");
    revCurrentPage = 1;
    renderReviewerPdf(1);
    renderReviewerList(parsedQuestions);
    initReviewerControls(); // 버튼 리스너 연동

    // 스크롤 이동
    reviewerSection.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return { ok: true, addedCount, examRound, countsByRound };
}

function generateLocalAnswerTemplate(question) {
  const prompt = `${question.title || ""} ${question.rawQuestion || ""}`;
  const lower = prompt.toLowerCase();

  if (/d-region|stm|응력교란|스트럿|타이/.test(lower)) {
    return [
      "1. 정의 및 적용 배경",
      "- 응력교란구역(D-Region, Discontinuity Region)은 평면유지 가정이 성립하지 않는 구간임.",
      "- 하중 작용점/지점부/단면 급변부에서 집중응력으로 인해 Bernoulli 가정이 붕괴됨.",
      "2. 해석 및 설계 원칙",
      "- 스트럿-타이 모델(Strut-and-Tie Model)로 힘의 흐름을 압축대/인장대/절점으로 이상화함.",
      "- KDS 14 20 24 기준에 따라 Strut, Tie, Node 강도와 정착길이를 검토함.",
      "3. 도해/표 작성 포인트",
      "- 도해: 하중-스트럿-타이-절점의 하중경로를 화살표로 제시.",
      "- 비교표: B-Region vs D-Region 적용 이론과 검토항목 대비.",
      "4. 기술사 제언",
      "- 시공성/유지관리/품질관리(정착, 배근 간섭, 균열제어)까지 결론에서 제시.",
    ].join("\n");
  }

  if (/psc|긴장재|지연파괴|부식|그라우팅/.test(lower)) {
    return [
      "1. 손상 메커니즘 개요",
      "- 염소이온(Chloride) 및 수분 환경에서 PS 강재의 응력부식균열(SCC) 위험이 증가함.",
      "- 고응력 상태에서 수소취성(Hydrogen Embrittlement)으로 지연파괴 가능.",
      "2. 설계/시공/유지관리 대책",
      "- 설계: 노출환경 등급에 따른 피복 및 방청 상세를 명시.",
      "- 시공: 그라우팅 충전성 확보, 블리딩 제어, 공극 최소화.",
      "- 유지관리: 비파괴검사(NDT) 및 모니터링 주기 수립.",
      "3. 기준 연계",
      "- KDS 관련 조항을 답안에 직접 표기하고 수치 근거를 제시.",
      "4. 결론",
      "- 사고사례와 연계하여 예방 중심의 유지관리 체계를 제언.",
    ].join("\n");
  }

  if (/좌굴|강구조|lsd|한계상태/.test(lower)) {
    return [
      "1. 핵심 개념 정의",
      "- 한계상태설계법(LSD, Limit State Design)은 확률론적 신뢰성 기반의 설계체계임.",
      "2. 검토 흐름",
      "- 하중조합 설정 → 단면강도 산정 → 좌굴/국부좌굴/접합부 파괴 모드 검토.",
      "- KDS 기준 코드와 부분안전계수 적용 근거를 명시.",
      "3. 시각화 전략",
      "- 그래프: 세장비(KL/r)-임계응력(Fcr) 곡선 제시.",
      "- 표: ASD vs LSD 비교표로 차별화.",
      "4. 기술사 제언",
      "- 시공성과 경제성을 포함한 선택 기준을 결론에 제시.",
    ].join("\n");
  }

  return [
    "1. 문제 정의 및 배경",
    "- 핵심 개념을 영어 병기와 함께 정의하고 적용 범위를 제시.",
    "2. 메커니즘/설계 검토",
    "- 하중-저항-파괴모드 관점으로 단계별 검토항목을 번호화.",
    "- KDS 코드와 수치 근거를 명시.",
    "3. 도해/비교표",
    "- 도해 1개(메커니즘) + 비교표 1개(대안 비교) 구성.",
    "4. 결론 및 제언",
    "- 시공/유지관리 관점의 실무 제언으로 마무리.",
  ].join("\n");
}

function generateDraftAnswersLocal() {
  let data;
  try {
    data = getCurrentAnswerData();
  } catch (error) {
    setPdfStatus(`JSON 파싱 오류: ${error.message}`, "error");
    return { ok: false, updated: 0 };
  }

  const overwrite = document.getElementById("overwriteGenerated").checked;
  const selectedIdSet = getSelectedQuestionIdSetForAi();
  const selectedMode = selectedIdSet.size > 0;
  const targetTotal = selectedMode
    ? data.questions.filter((q) => selectedIdSet.has(String(q.id || ""))).length
    : data.questions.length;
  if (selectedMode && targetTotal === 0) {
    setPdfStatus("선택된 문항이 없습니다. 인식된 문항 리스트에서 대상을 선택하세요.", "error");
    return { ok: false, updated: 0 };
  }
  let updated = 0;

  data.questions = data.questions.map((question) => {
    if (selectedMode && !selectedIdSet.has(String(question.id || ""))) {
      return question;
    }
    const hasAnswer = String(question.modelAnswer || "").trim().length > 0;
    if (!overwrite && hasAnswer) {
      return question;
    }
    updated += 1;
    return {
      ...question,
      modelAnswer: generateLocalAnswerTemplate(question),
      source: hasAnswer
        ? `${question.source || "-"} + LocalDraft`
        : "LocalDraft",
    };
  });

  syncJsonAndRender(
    data,
    `로컬 규칙으로 ${updated}개 문항 초안을 생성했습니다.${selectedMode ? ` (선택대상 ${targetTotal}개)` : ""}`,
  );
  setPdfStatus(`초안 자동 작성 완료: ${updated}개`, "success");
  return { ok: true, updated };
}

async function generateDraftAnswersByApi() {
  if (isLikelyLmStudioEndpoint()) {
    return generateDraftAnswersByLmStudioLocal();
  }

  const endpoint = document.getElementById("aiEndpointUrl").value.trim();
  const apiKey = document.getElementById("aiApiKey").value.trim();
  const selectedModelId = getEffectiveSelectedModelId();
  if (!endpoint) {
    setPdfStatus(
      "외부 API URL을 입력하세요. URL이 없으면 로컬 규칙 생성을 사용하세요.",
      "error",
    );
    return { ok: false, updated: 0, fallbackCount: 0 };
  }

  getSafeStorage().setItem(
    AI_ENDPOINT_STORAGE_KEY,
    endpoint,
  );

  let data;
  try {
    data = getCurrentAnswerData();
  } catch (error) {
    setPdfStatus(`JSON 파싱 오류: ${error.message}`, "error");
    return { ok: false, updated: 0, fallbackCount: 0 };
  }

  const overwrite = document.getElementById("overwriteGenerated").checked;
  const selectedIdSet = getSelectedQuestionIdSetForAi();
  const selectedMode = selectedIdSet.size > 0;
  const targetTotal = selectedMode
    ? data.questions.filter((q) => selectedIdSet.has(String(q.id || ""))).length
    : data.questions.length;
  if (selectedMode && targetTotal === 0) {
    setPdfStatus("선택된 문항이 없습니다. 인식된 문항 리스트에서 대상을 선택하세요.", "error");
    return { ok: false, updated: 0, fallbackCount: 0 };
  }
  let updated = 0;
  let fallbackCount = 0;
  const diagnosticLogs = [];
  let providerStatus = null;

  setPdfStatus(
    `외부 API로 초안 생성 중... (${selectedMode ? `선택 ${targetTotal}개` : `전체 ${targetTotal}개`})`,
    "info",
  );

  for (let index = 0; index < data.questions.length; index += 1) {
    const question = data.questions[index];
    if (selectedMode && !selectedIdSet.has(String(question.id || ""))) {
      continue;
    }
    const hasAnswer = String(question.modelAnswer || "").trim().length > 0;
    if (!overwrite && hasAnswer) {
      continue;
    }

    try {
      // 외부 API일 경우 Provider 강제 주입 로직.
      // (v14 호환을 위해 endpoint에 선택된 provider 정보를 덧붙이는 방식이나 헤더 사용을 고려.
      // 현재 백엔드는 provider 지정이 안 오면 health check의 default를 사용함.
      // 여기서는 payload에 'provider' 필드를 명시적으로 넘김)

      // UI에 Provider 선택 select box('aiProvider')가 있다고 가정하고 값을 가져옴.
      // 없을 경우 null로 처리.
      const providerSelect = document.getElementById("aiProvider");
      const providerValue = providerSelect ? providerSelect.value : null;

      const relatedTheories = buildTheoryContextForQuestion(
        question,
        data.theories || [],
        3,
      );
      const qualityInstruction = buildHighQualityAnswerInstruction(
        question,
        relatedTheories,
      );

      const requestBody = {
        question,
        instruction: qualityInstruction,
      };
      if (providerValue) {
        requestBody.provider = providerValue;
      }
      if (selectedModelId) {
        requestBody.model = selectedModelId;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      const answer =
        payload.answer ||
        payload.content ||
        payload.result ||
        payload?.choices?.[0]?.message?.content;
      if (!answer || !String(answer).trim()) {
        throw new Error("응답에 answer 텍스트가 없습니다.");
      }

      if (Array.isArray(payload.llmDiagnostics)) {
        diagnosticLogs.push(...payload.llmDiagnostics);
      }
      if (payload && typeof payload.providers === "object") {
        providerStatus = payload.providers;
      }

      const payloadSource = String(payload.source || "").toLowerCase();
      const isFallbackByApi = payloadSource.includes("local-fallback");
      if (isFallbackByApi) {
        fallbackCount += 1;
      }

      const sourceLabel = isFallbackByApi
        ? "Api(LocalFallback)"
        : `Api(${payload.source || "remote"})`;

      data.questions[index] = {
        ...question,
        modelAnswer: String(answer).trim(),
        source: question.source
          ? `${question.source} + ${sourceLabel}`
          : sourceLabel,
      };
      updated += 1;
    } catch (error) {
      data.questions[index] = {
        ...question,
        modelAnswer: generateLocalAnswerTemplate(question),
        source: question.source
          ? `${question.source} + LocalFallback`
          : "LocalFallback",
      };
      updated += 1;
      fallbackCount += 1;
    }
  }

  syncJsonAndRender(
    data,
    `외부 API 기반 초안 생성(실패 시 로컬 대체) 완료: ${updated}개${selectedMode ? ` / 선택대상 ${targetTotal}개` : ""}`,
  );
  const diagnosticSummary = summarizeLlmDiagnostics(diagnosticLogs);
  if (diagnosticSummary) {
    setBackendStatus(diagnosticSummary, fallbackCount > 0 ? "error" : "info");
  }
  renderBackendDiagnostics(diagnosticLogs, providerStatus);
  setPdfStatus(
    `외부 API 초안 작성 완료: ${updated}개 (로컬 대체 ${fallbackCount}개)`,
    fallbackCount > 0 ? "info" : "success",
  );
  return { ok: true, updated, fallbackCount };
}

async function runAutoPipeline() {
  if (pipelineRunning) {
    setPdfStatus("자동 배치가 이미 실행 중입니다.", "info");
    return;
  }

  pipelineRunning = true;
  const runBtn = document.getElementById("runPipelineBtn");
  runBtn.disabled = true;
  runBtn.classList.add("opacity-60", "cursor-not-allowed");

  try {
    setPdfStatus(
      "자동 배치 시작: PDF 추출 → 문제 추출 → 답안 생성 → 평가",
      "info",
    );
    setPipelineReport("자동 배치 실행 중입니다...", "info");

    let beforeCount = 0;
    let beforeAvg = 0;
    try {
      const beforeData = getCurrentAnswerData();
      beforeCount = beforeData.questions.length;
      beforeAvg = calculateAverageScore(beforeData.questions);
    } catch {}

    // PDF auto-extraction was removed; extractQuestionsFromPdfText
    // now accepts attached files or textarea input. Proceed with
    // AI-backed extraction from attachments/text.
    const parseResult = await extractQuestionsFromPdfText();
    if (!parseResult.ok) {
      setPipelineReport("배치 중단: 문제 자동 추출 실패", "error");
      return;
    }

    let generationUpdated = 0;
    let fallbackCount = 0;
    const apiResult = await generateDraftAnswersByApi();
    if (!apiResult.ok) {
      const localResult = generateDraftAnswersLocal();
      generationUpdated = localResult.updated || 0;
      fallbackCount = generationUpdated;
    } else {
      generationUpdated = apiResult.updated || 0;
      fallbackCount = apiResult.fallbackCount || 0;
    }

    evaluateRenderedAnswers();
    let afterCount = 0;
    let afterAvg = 0;
    try {
      const afterData = getCurrentAnswerData();
      afterCount = afterData.questions.length;
      afterAvg = calculateAverageScore(afterData.questions);
    } catch {}

    const scoreDelta = afterAvg - beforeAvg;
    const deltaText = scoreDelta > 0 ? `+${scoreDelta}` : `${scoreDelta}`;
    setPipelineReport(
      `배치 완료 | 문제 추가: ${parseResult.addedCount}개 (${parseResult.examRound}) | 생성/갱신: ${generationUpdated}개 | 로컬 폴백: ${fallbackCount}개 | 문항 수: ${beforeCount}→${afterCount} | 평균점: ${beforeAvg}→${afterAvg} (${deltaText})`,
      "success",
    );
    setPdfStatus("자동 배치 완료: 생성/평가까지 반영되었습니다.", "success");

    // 자동 배치 완료 시 추출 데이터 정밀 리뷰 우측창(extractReviewer)을 표시하고 스크롤
    const reviewerSection = document.getElementById("extractReviewer");
    if (reviewerSection) {
      reviewerSection.classList.remove("hidden");
      reviewerSection.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      try {
        const currentData = getCurrentAnswerData();
        renderReviewerList(currentData.questions);
      } catch (e) {}
    }
  } finally {
    pipelineRunning = false;
    runBtn.disabled = false;
    runBtn.classList.remove("opacity-60", "cursor-not-allowed");
  }
}
