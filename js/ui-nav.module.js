import { getEl } from './dom-utils.js';
import { Debug } from './utils.js';

/**
 * UI Navigation Module
 * Handles section switching and tab management.
 */
const UINav = {
  showSection(sectionId) {
    const requestedSectionId = sectionId;
    const resolvedSectionId =
      requestedSectionId === "theory-manager" || requestedSectionId === "answer-manager"
        ? "studio"
        : requestedSectionId;
    
    // 전역 상태 플래그 설정 (레거시 코드 호환용)
    window.__theoryManagerMode = requestedSectionId === "theory-manager";
    window.__answerManagerMode = requestedSectionId === "answer-manager";

    if (Debug) {
      Debug.log("nav", "showSection requested", {
        requestedSectionId,
        resolvedSectionId,
      });
    }

    // 모든 섹션 숨기기
    document.querySelectorAll(".content-section").forEach((el) => {
      el.classList.remove("active");
      el.classList.add("hidden");
    });

    // 대상 섹션 활성화
    const target = getEl(resolvedSectionId);
    if (target) {
      target.classList.add("active");
      target.classList.remove("hidden");
    }

    // 네비게이션 버튼 스타일 업데이트
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      const match = btn.dataset.target === requestedSectionId;
      btn.classList.toggle("bg-indigo-600/20", match);
      btn.classList.toggle("text-indigo-400", match);
      btn.classList.toggle("border-indigo-500/30", match);
      btn.classList.toggle("hover:bg-slate-700/50", !match);
    });

    // Knowledge Studio 특화 로직
    if (resolvedSectionId === "studio") {
      this.handleStudioActivation(requestedSectionId);
    }
  },

  handleStudioActivation(requestedSectionId) {
    // PDF 뷰어 초기화 시도
    if (typeof window.openPdfVisualModal === "function") {
      window.openPdfVisualModal();
    }

    const Studio = window.Studio || (window.StudioModules?.UI);
    if (!Studio) return;

    if (requestedSectionId === "theory-manager" && typeof Studio.switchTab === "function") {
      Studio.switchTab("theory");
    } else if (requestedSectionId === "answer-manager" && typeof Studio.switchTab === "function") {
      Studio.switchTab("answers");
    } else if (typeof Studio.updatePdfAreaView === "function") {
      Studio.updatePdfAreaView();
    }
  },

  toggleDarkMode() {
    const isDark = document.documentElement.classList.toggle("dark");
    const storage = window.safeLocalStorage || localStorage;
    if (storage && typeof storage.setItem === "function") {
      storage.setItem("solve_theme", isDark ? "dark" : "light");
    }
    const icon = document.querySelector('button[onclick*="toggleDarkMode"] i');
    if (icon) {
      icon.classList.toggle("fa-moon", !isDark);
      icon.classList.toggle("fa-sun", isDark);
    }
  },

  toggleViewMode() {
    const container = document.getElementById("answerList");
    if (!container) return;
    const isGrid = container.classList.toggle("grid-view");
    container.classList.toggle("grid", isGrid);
    container.classList.toggle("grid-cols-1", isGrid);
    container.classList.toggle("md:grid-cols-2", isGrid);
    container.classList.toggle("gap-4", isGrid);
    if (window.showToast) window.showToast(isGrid ? "카드 그리드 뷰로 전환되었습니다." : "리스트 뷰로 전환되었습니다.", "info");
  },

  initTheme() {
    const storage = window.safeLocalStorage || localStorage;
    const savedTheme = storage && typeof storage.getItem === "function" ? storage.getItem("solve_theme") : null;
    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
      const icon = document.querySelector('button[onclick*="toggleDarkMode"] i');
      if (icon) {
        icon.classList.remove("fa-moon");
        icon.classList.add("fa-sun");
      }
    }
  },

  switchTab(tabId) {
    // 모든 탭 컨텐츠 숨기기
    document.querySelectorAll(".tab-content").forEach((el) => {
      el.classList.add("hidden");
    });
    
    // 대상 탭 표시
    const target = getEl(tabId);
    if (target) {
      target.classList.remove("hidden");
    }

    // 탭 스타일 업데이트
    document.querySelectorAll(".exam-tab").forEach((t) => {
      const match = t.dataset.tab === tabId;
      t.classList.toggle("active-tab", match);
      t.classList.toggle("border-indigo-600", match);
      t.classList.toggle("text-indigo-600", match);
      t.classList.toggle("border-transparent", !match);
    });
  },

  exposeGlobal() {
    window.showSection = this.showSection.bind(this);
    window.switchTab = this.switchTab.bind(this);
    window.toggleDarkMode = this.toggleDarkMode.bind(this);
    window.toggleViewMode = this.toggleViewMode.bind(this);
    window.initTheme = this.initTheme.bind(this);
  }
};

export default UINav;
