/* state.js - Modern Module Entry Point (v27.0) */
import { AppState } from './app-state.js';
import { extractRoundOnly, escapeHtml } from './utils.js';
import UIStatus from './ui-status.module.js';
import UIBoost from './ui-boost.module.js';
const { setDataStatus } = UIStatus;
const { refreshAttachmentTargetOptions } = UIBoost;

// Sub-module Imports
import * as Storage from './state-storage.module.js';
import * as Dashboard from './state-dashboard.module.js';
import * as Theory from './state-theory.module.js';
import * as Analysis from './state-analysis.module.js';
import * as UI from './state-ui.module.js';
import TheoryArchive from './state-theory-archive.module.js';

const Archive = TheoryArchive;

// ──── Global Exports (Window Bridge) ───────────────────────────

window.safeLocalStorage = Storage.safeLocalStorage;
window.getCurrentAnswerData = Storage.getCurrentAnswerData;
window.saveAnswerData = Storage.saveAnswerData;
window.loadAnswerData = Storage.loadAnswerData;
window.loadSampleData = Storage.loadSampleData;
window.syncJsonAndRender = Storage.syncJsonAndRender;

window.updateDashboardUi = Dashboard.updateDashboardUi;
window.renderDashboardStats = Dashboard.renderDashboardStats;

window.renderTheoryKnowledge = Theory.renderTheoryKnowledge;
window.addTheoryEntry = Theory.addTheoryEntry;
window.editTheoryEntry = Theory.editTheoryEntry;
window.deleteTheoryEntry = Theory.deleteTheoryEntry;
window.upsertTheoryEntry = Theory.upsertTheoryEntry;
window.cancelTheoryEditMode = Theory.cancelTheoryEditMode;

window.renderAnalysisUi = Analysis.renderAnalysisUi;
window.evaluateRenderedAnswers = Analysis.evaluateRenderedAnswers;

window.renderAnswersUi = UI.renderAnswersUi;
window.applyAnswerFilters = UI.applyAnswerFilters;
window.getFilteredEntries = UI.getFilteredEntries;
window.updateGlobalRoundLabels = UI.updateGlobalRoundLabels;

// ──── Storage & File I/O ────────────────────────────────────
window.exportAnswerDataToFile = Storage.exportAnswerDataToFile;
window.openImportFileDialog = Storage.openImportFileDialog;
window.importAnswerDataFromFile = Storage.importAnswerDataFromFile;
window.deleteModelAnswerEntry = Storage.deleteModelAnswerEntry;

// ──── UI Modals & Actions ───────────────────────────────────
window.openDeleteConfirmModal = UI.openDeleteConfirmModal;
window.closeDeleteConfirmModal = UI.closeDeleteConfirmModal;
window.confirmDeleteModelAnswerEntry = UI.confirmDeleteModelAnswerEntry;
window.editModelAnswerEntry = UI.editModelAnswerEntry;

// ──── Theory & Archive ──────────────────────────────────────
window.analyzeTheoryKnowledge = Theory.analyzeTheoryKnowledge;
window.analyzeTheoryArchiveFiles = Archive.analyzeTheoryArchiveFiles;
window.clearTheoryArchiveAiPanel = () => Archive.renderTheoryArchiveAiInsight(null);

// ──── Orchestration Functions ───────────────────────────────

export function saveAnswerData(silent = false) {
  return Storage.saveAnswerData(silent);
}

export async function loadAnswerData() {
  const data = await Storage.loadAnswerData();
  if (data) {
    Dashboard.updateDashboardUi(data);
    Theory.renderTheoryKnowledge(data.theories);
    UI.renderAnswersUi(data.questions);
  }
  return data;
}

export function evaluateRenderedAnswers() {
  return Analysis.evaluateRenderedAnswers();
}

export function analyzeTheoryKnowledge() {
  return Theory.analyzeTheoryKnowledge();
}

export function applyAnswerFilters() {
  return UI.applyAnswerFilters();
}

export function updateGlobalRoundLabels(round) {
  return UI.updateGlobalRoundLabels(round);
}

export function analyzeTheoryArchiveFiles() {
  return Archive.analyzeTheoryArchiveFiles();
}

export function clearTheoryArchiveAiPanel() {
  return Archive.renderTheoryArchiveAiInsight(null);
}

export function exportAnswerDataToFile() {
  return Storage.exportAnswerDataToFile();
}

export function openImportFileDialog() {
  return Storage.openImportFileDialog();
}

export function importAnswerDataFromFile(file) {
  return Storage.importAnswerDataFromFile(file);
}

// ───── Startup Initialization ──────
(function init() {
  console.log("State Module v27.0 Initializing...");
  if (Archive && typeof Archive.initTheoryArchiveAiPanel === 'function') {
    Archive.initTheoryArchiveAiPanel();
  }
})();

export {
  Archive,
  Storage,
  Dashboard,
  Theory,
  Analysis,
  UI
};
