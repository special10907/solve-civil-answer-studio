import State from './state.module.js';
import UIStatus from './ui-status.module.js';
import UINav from './ui-nav.module.js';
import { AppState } from './app-state.js';
const { showToast, setDataStatus } = UIStatus;
const { switchTab } = UINav;

import StudioDocx from './studio-docx.module.js';
import StudioPlan from './studio-plan.module.js';
import StudioVisual from './studio-visual.module.js';
import StudioAI from './studio-ai.module.js';
import StudioUI from './studio-ui.module.js';

const Studio = {
  Modules: {
    Docx: StudioDocx,
    Plan: StudioPlan,
    Visual: StudioVisual,
    AI: StudioAI,
    UI: StudioUI
  },

  async init() {
    console.log("Studio init: Modularized Version 2.0.1");
    window.StudioModules = this.Modules;

    if (StudioDocx.init) StudioDocx.init();
    if (StudioPlan.init) StudioPlan.init();
    if (StudioVisual.init) StudioVisual.init();
    if (StudioAI.init) StudioAI.init();
    if (StudioUI.init) StudioUI.init();

    this.bindEvents();
    
    if (StudioUI.updatePdfAreaView) StudioUI.updatePdfAreaView();
    if (StudioUI.refreshDraftPlanUi) StudioUI.refreshDraftPlanUi();
    if (StudioUI.render) StudioUI.render();
  },

  bindEvents() {
    document.querySelectorAll(".studio-tab-btn").forEach((btn) => {
      if (!btn.dataset.boundClick) {
        btn.dataset.boundClick = "1";
        btn.addEventListener("click", () => StudioUI.switchTab(btn.dataset.tab));
      }
    });

    const genDocxBtn = document.getElementById("btnGenerateDocx") || document.getElementById("generateDocxBtn");
    if (genDocxBtn && !genDocxBtn.dataset.boundClick) {
      genDocxBtn.dataset.boundClick = "1";
      genDocxBtn.addEventListener("click", () => StudioDocx.generateProfessionalDocx());
    }
  },

  render() { StudioUI.render(); },
  switchTab(tab) { StudioUI.switchTab(tab); },
  saveEntry(type) { StudioUI.saveEntry(type); },
  editEntry(type, index) { StudioUI.editEntry(type, index); },
  deleteEntry(type, index) { StudioUI.deleteEntry(type, index); },
  resetForm(type) { StudioUI.resetForm(type); },
  refreshDraftPlanUi() { StudioUI.refreshDraftPlanUi(); },
  updatePdfAreaView() { StudioUI.updatePdfAreaView(); },
  generateProfessionalDocx() { StudioDocx.generateProfessionalDocx(); }
};

export default Studio;
