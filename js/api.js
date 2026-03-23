import { AppState } from './app-state.js';
import UIStatus from './ui-status.module.js';
const { setPdfStatus, showToast } = UIStatus;

import {
  getBackendBaseUrl,
  getLmStudioBaseUrl,
  discoverAnalyzeBackendBaseUrl,
  generateAnswer,
  requestDocxGeneration,
  requestRevealInExplorer,
  requestOpenInDefaultApp,
  fetchLmStudioModelsViaBackend,
  markLmStudioOffline,
  clearLmStudioOffline,
  shouldSkipLmStudioProbe,
  isLikelyLmStudioEndpoint,
  getEffectiveSelectedModelId,
  parseSelectedModelToken,
  buildModelToken,
  fetchCloudProviderStatusViaBackend,
  buildCloudModelEntries,
  getSafeStorage,
  AI_ENDPOINT_STORAGE_KEY,
  detectLmStudioModelId
} from './api-client.module.js';

import {
  buildHighQualityAnswerInstruction,
  buildDraftPlanInstruction,
  mergePlanIntoDraftInstruction,
  buildTheoryContextForQuestion,
  inferAnswerWritingSpec,
  tokenizeForSimilarity,
  calculateTokenOverlapScore,
  sanitizeExtractedSourceText,
  appendDraftPlanHistory,
  generateLocalAnswerTemplate,
  enforceAnswerQualityGuard
} from './api-prompt.module.js';

import {
  loadAiPresets,
  saveCurrentAiPreset,
  deleteCurrentAiPreset,
  applyAiPreset,
  setLmStudioLocalPreset,
  switchToExternalApiMode
} from './api-presets.module.js';

import {
  generateDraftAnswersByApi,
  generateDraftAnswersByLmStudioLocal,
  extractQuestionsFromPdfText,
  runAutoPipeline,
  isMandatoryFiveStepPipelineEnabled,
  collectMandatoryFiveStepSources,
  buildMandatoryFiveStepInstruction,
  tokenizeBoostText,
  calculateBoostOverlapScore,
  selectAttachmentBoostTheories,
  isDRegionTopicForBoost,
  inferBoostTopicType,
  buildAttachmentBoostFallback,
  sanitizeBoostForExamSubmission,
  generateDeepAttachmentBoost
} from './api-orchestrator.module.js';

import {
  setBackendStatus,
  renderBackendDiagnostics,
  updateAiModeUx,
  applyStatusChip
} from './api-ui.module.js';

import { extractJsonFromText, convertJsonToMarkdown } from './ai-json.module.js';

/**
 * API Module Entry Point (api.js)
 */

window.ApiModules = {
  client: { getBackendBaseUrl, getLmStudioBaseUrl, discoverAnalyzeBackendBaseUrl, generateAnswer, requestDocxGeneration, requestRevealInExplorer, requestOpenInDefaultApp, buildModelToken, parseSelectedModelToken, fetchLmStudioModelsViaBackend, getSafeStorage, AI_ENDPOINT_STORAGE_KEY, detectLmStudioModelId },
  prompt: { buildHighQualityAnswerInstruction, buildDraftPlanInstruction, buildTheoryContextForQuestion, inferAnswerWritingSpec, sanitizeExtractedSourceText },
  presets: { loadAiPresets, saveCurrentAiPreset, deleteCurrentAiPreset, applyAiPreset, setLmStudioLocalPreset, switchToExternalApiMode },
  orchestrator: { 
    generateDraftAnswersByApi, generateDraftAnswersByLmStudioLocal, extractQuestionsFromPdfText, runAutoPipeline, 
    isMandatoryFiveStepPipelineEnabled, collectMandatoryFiveStepSources, buildMandatoryFiveStepInstruction,
    tokenizeBoostText, calculateBoostOverlapScore, selectAttachmentBoostTheories, isDRegionTopicForBoost,
    inferBoostTopicType, buildAttachmentBoostFallback, sanitizeBoostForExamSubmission, generateDeepAttachmentBoost
  },
  ui: { setBackendStatus, renderBackendDiagnostics, updateAiModeUx, applyStatusChip }
};

window.getBackendBaseUrl = getBackendBaseUrl;
window.getLmStudioBaseUrl = getLmStudioBaseUrl;
window.discoverAnalyzeBackendBaseUrl = discoverAnalyzeBackendBaseUrl;
const checkBackendConnection = () => setBackendStatus("연결 확인 중...", "info");
window.checkBackendConnection = checkBackendConnection;

window.loadAiPresets = loadAiPresets;
window.saveCurrentAiPreset = saveCurrentAiPreset;
window.deleteCurrentAiPreset = deleteCurrentAiPreset;
window.applyAiPreset = applyAiPreset;

window.generateDraftAnswersByApi = generateDraftAnswersByApi;
window.generateDraftAnswersByLmStudioLocal = generateDraftAnswersByLmStudioLocal;
window.extractQuestionsFromPdfText = extractQuestionsFromPdfText;
window.runAutoPipeline = runAutoPipeline;

window.setBackendStatus = setBackendStatus;
window.updateAiModeUx = updateAiModeUx;
window.getSafeStorage = getSafeStorage;

window.tokenizeBoostText = tokenizeBoostText;
window.calculateBoostOverlapScore = calculateBoostOverlapScore;
window.selectAttachmentBoostTheories = selectAttachmentBoostTheories;
window.isDRegionTopicForBoost = isDRegionTopicForBoost;
window.inferBoostTopicType = inferBoostTopicType;
window.buildAttachmentBoostFallback = buildAttachmentBoostFallback;

// ──── AI 모델 목록 초기화 (핵심 브릿지) ────────────────────────────

async function initAiModels() {
  const provider = document.getElementById("aiProvider")?.value || "gemini";
  const select = document.getElementById("aiAvailableModelSelect");
  if (!select) return;

  select.innerHTML = '<option value="">로딩 중...</option>';

  try {
    if (provider === "lmstudio") {
      const baseUrl = getLmStudioBaseUrl();
      const models = await fetchLmStudioModelsViaBackend(baseUrl);
      select.innerHTML = '<option value="">모델 선택...</option>';
      models.forEach(m => {
        const opt = document.createElement("option");
        opt.value = buildModelToken("lmstudio", m.id);
        opt.textContent = `[LM] ${m.id}`;
        select.appendChild(opt);
      });
    } else {
      // 클라우드 모델 목록 조회
      const providerStatus = await fetchCloudProviderStatusViaBackend().catch(() => null);
      const entries = buildCloudModelEntries(providerStatus || { [provider]: true });
      select.innerHTML = '<option value="">모델 선택...</option>';
      entries.forEach(({ provider: p, modelId, label }) => {
        const opt = document.createElement("option");
        opt.value = buildModelToken(p, modelId);
        opt.textContent = label;
        select.appendChild(opt);
      });
      if (!entries.length) {
        // 폴백: CLOUD_MODEL_CATALOG 직접 사용
        const CLOUD_CATALOG = {
          openai: ["gpt-4o-mini", "gpt-4.1-mini"],
          gemini: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-2.0-pro-exp-02-05"],
          anthropic: ["claude-3-5-sonnet-latest", "claude-3-5-haiku-latest"],
          github: ["copilot-gpt-4o", "copilot-claude-3.5-sonnet"],
        };
        const models = CLOUD_CATALOG[provider] || [];
        select.innerHTML = '<option value="">모델 선택...</option>';
        models.forEach(m => {
          const opt = document.createElement("option");
          opt.value = buildModelToken(provider, m);
          opt.textContent = `[${provider.toUpperCase()}] ${m}`;
          select.appendChild(opt);
        });
      }
    }
  } catch (err) {
    console.warn("[STARK] initAiModels 실패:", err.message);
    select.innerHTML = '<option value="">모델 로드 실패</option>';
  }
}

window.initAiModels = initAiModels;
window.refreshAvailableModels = initAiModels;

window.sanitizeBoostForExamSubmission = sanitizeBoostForExamSubmission;
window.generateDeepAttachmentBoost = generateDeepAttachmentBoost;

function generateDraftAnswersByActiveModel() {
  const isLm = isLikelyLmStudioEndpoint();
  return isLm ? generateDraftAnswersByLmStudioLocal() : generateDraftAnswersByApi();
}

function generateDraftAnswersLocal() {
    return generateDraftAnswersByApi({ forceLocal: true }); 
}

window.generateDraftAnswersByActiveModel = generateDraftAnswersByActiveModel;
window.generateDraftAnswersLocal = generateDraftAnswersLocal;

export {
  runAutoPipeline, getSafeStorage, setBackendStatus, updateAiModeUx,
  detectLmStudioModelId, AI_ENDPOINT_STORAGE_KEY, applyAiPreset,
  isLikelyLmStudioEndpoint, loadAiPresets,
  extractQuestionsFromPdfText, generateDraftAnswersByApi,
  generateDraftAnswersByLmStudioLocal,
  generateDraftAnswersLocal, checkBackendConnection,
  generateDraftAnswersByActiveModel,
  setLmStudioLocalPreset,
  tokenizeBoostText, calculateBoostOverlapScore, selectAttachmentBoostTheories,
  isDRegionTopicForBoost, inferBoostTopicType, buildAttachmentBoostFallback,
  sanitizeBoostForExamSubmission, generateDeepAttachmentBoost
};
