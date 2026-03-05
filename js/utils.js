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

// Global Export
window.utils = {
  escapeHtml,
  extractRoundOnly,
  isValidWebUrl,
  normalizeOcrText
};

// 하위 호환성을 위해 전역 스코프에도 노출
window.escapeHtml = escapeHtml;
window.extractRoundOnly = extractRoundOnly;
window.isValidWebUrl = isValidWebUrl;
window.normalizeOcrText = normalizeOcrText;
