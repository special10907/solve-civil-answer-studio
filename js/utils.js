/**
 * SolveCivil Answer Studio - Core Utilities
 * @version 1.0.0
 */

/**
 * HTML 특수 문자를 이스케이프 처리합니다.
 */
function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * 텍스트에서 회차 정보(예: 120회)만 추출합니다.
 */
function extractRoundOnly(value) {
  const text = String(value || "").trim();
  const match = text.match(/(\d{2,3})\s*회/);
  return match ? `${match[1]}회` : "";
}

/**
 * 유효한 HTTP/HTTPS URL인지 확인합니다.
 */
function isValidWebUrl(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * OCR 텍스트를 정규화하고 길이를 제한합니다.
 */
function normalizeOcrText(text, maxLength = 50000) {
  return String(text || "")
    .replace(/\0/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

/**
 * 전역 디버그 로깅 유틸리티
 */
function createDebugLogger() {
  const storage = window.safeLocalStorage || localStorage;
  const fromQuery = (() => {
    try {
      return new URLSearchParams(window.location.search).get("debug") === "1";
    } catch {
      return false;
    }
  })();

  const fromStorage = (() => {
    try {
      return storage.getItem("solve_debug_enabled") === "1";
    } catch {
      return false;
    }
  })();

  const state = {
    enabled: fromQuery || fromStorage,
    maxEntries: 2000,
    entries: [],
  };

  const push = (level, scope, message, data) => {
    const entry = {
      ts: new Date().toISOString(),
      level,
      scope: String(scope || "general"),
      message: String(message || ""),
      data: data ?? null,
    };
    state.entries.push(entry);
    if (state.entries.length > state.maxEntries) {
      state.entries.splice(0, state.entries.length - state.maxEntries);
    }

    if (!state.enabled) return;
    const prefix = `[DBG][${entry.scope}] ${entry.message}`;
    if (level === "error") {
      console.error(prefix, entry.data ?? "");
    } else if (level === "warn") {
      console.warn(prefix, entry.data ?? "");
    } else {
      console.log(prefix, entry.data ?? "");
    }
  };

  const api = {
    enable() {
      state.enabled = true;
      try {
        storage.setItem("solve_debug_enabled", "1");
      } catch {}
      push("info", "debug", "debug mode enabled");
    },
    disable() {
      push("info", "debug", "debug mode disabled");
      state.enabled = false;
      try {
        storage.setItem("solve_debug_enabled", "0");
      } catch {}
    },
    isEnabled() {
      return state.enabled;
    },
    log(scope, message, data) {
      push("info", scope, message, data);
    },
    warn(scope, message, data) {
      push("warn", scope, message, data);
    },
    error(scope, message, data) {
      push("error", scope, message, data);
    },
    clear() {
      state.entries = [];
    },
    getEntries() {
      return [...state.entries];
    },
    exportText() {
      return state.entries
        .map((e) => `${e.ts} [${e.level.toUpperCase()}] [${e.scope}] ${e.message}${e.data != null ? ` ${JSON.stringify(e.data)}` : ""}`)
        .join("\n");
    },
    printSummary() {
      const count = state.entries.length;
      const last = count ? state.entries[count - 1] : null;
      console.log("[DBG] entries:", count, "last:", last);
    },
  };

  return api;
}


// ESM Export: Debug 유틸리티 및 주요 함수
export const Debug = createDebugLogger();
export const debugLog = (...args) => Debug?.log(...args);
export const debugWarn = (...args) => Debug?.warn(...args);
export const debugError = (...args) => Debug?.error(...args);
export {
  escapeHtml,
  extractRoundOnly,
  isValidWebUrl,
  normalizeOcrText,
};

// 하위 호환성: window 등록(점진적 제거 예정)
window.utils = {
  escapeHtml,
  extractRoundOnly,
  isValidWebUrl,
  normalizeOcrText
};
window.escapeHtml = escapeHtml;
window.extractRoundOnly = extractRoundOnly;
window.isValidWebUrl = isValidWebUrl;
window.normalizeOcrText = normalizeOcrText;
if (!window.Debug) {
  window.Debug = Debug;
}
window.debugLog = debugLog;
window.debugWarn = debugWarn;
window.debugError = debugError;

// 디버그 모드일 때 주요 UI 인터랙션 추적
(function installDebugInteractionHooks() {
  if (!window.Debug || !window.Debug.isEnabled()) return;
  const watched = new Set(["addAreaBtn", "extractBtn", "studio-pdf-input"]);

  document.addEventListener(
    "click",
    (e) => {
      const target = e.target instanceof Element ? e.target : null;
      if (!target) return;
      const btn = target.closest("button, input, .nav-btn");
      if (!btn) return;
      const id = btn.id || "";
      const isNav = btn.classList.contains("nav-btn");
      if (!watched.has(id) && !isNav) return;

      window.Debug.log("event", "ui click", {
        id,
        className: btn.className,
        text: (btn.textContent || "").trim().slice(0, 40),
        isTrusted: !!e.isTrusted,
      });
    },
    true,
  );
})();
