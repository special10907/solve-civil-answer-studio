import { Debug } from './utils.js';
import { AppState } from './app-state.js';
import UIStatus from './ui-status.module.js';
const { setPdfStatus, showToast } = UIStatus;

/**
 * PDF Capture Module - Modern ESM (State-of-the-Art Intel)
 */

export function groupTextItems(items, thresholdY = 8) {
  if (!items || items.length === 0) return [];
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const groups = [];
  let currentGroup = null;
  sorted.forEach((item) => {
    const adjustedH = (item.h || 10) * 0.9;
    const isQuestionStart = /^\s*(\d+\s*[.]|Q\d+|[(]\d+[)])/.test(item.str);
    if (!currentGroup) {
      currentGroup = { texts: [item], minX: item.x, maxX: item.x + (item.w || 0), minY: item.y, maxY: item.y + adjustedH };
    } else {
      const verticalGap = Math.abs(currentGroup.minY - item.y);
      const horizontalShift = Math.abs(currentGroup.minX - item.x);
      const shouldSplit = isQuestionStart || verticalGap > thresholdY * 0.9 || (horizontalShift > 50 && verticalGap > 2);
      if (!shouldSplit) {
        currentGroup.texts.push(item);
        currentGroup.minX = Math.min(currentGroup.minX, item.x);
        currentGroup.maxX = Math.max(currentGroup.maxX, item.x + (item.w || 0));
        currentGroup.minY = Math.min(currentGroup.minY, item.y);
        currentGroup.maxY = Math.max(currentGroup.maxY, item.y + adjustedH);
      } else {
        groups.push(currentGroup);
        currentGroup = { texts: [item], minX: item.x, maxX: item.x + (item.w || 0), minY: item.y, maxY: item.y + adjustedH };
      }
    }
  });
  if (currentGroup) groups.push(currentGroup);
  return groups.map(g => ({
    str: g.texts.map(t => t.str).join(" "),
    x: g.minX, y: g.minY, w: g.maxX - g.minX, h: g.maxY - g.minY,
    rect: { x: g.minX, y: g.minY, w: g.maxX - g.minX, h: g.maxY - g.minY },
    isCandidate: /^\s*(\d+\s*[.]|Q\d+|[(]\d+[)])/.test(g.texts[0].str) || g.texts.map(t => t.str).join("").length > 50
  }));
}

export function extractSelectionImagePayload(overlay, minX, minY, maxX, maxY, pdfRect) {
  const canvasId = overlay?.id === "revPdfOverlay" ? "revPdfCanvas" : "pdfVisualCanvas";
  const sourceCanvas = document.getElementById(canvasId);
  if (!sourceCanvas) return null;
  const viewW = overlay.clientWidth || sourceCanvas.width, viewH = overlay.clientHeight || sourceCanvas.height;
  const scaleX = sourceCanvas.width / viewW, scaleY = sourceCanvas.height / viewH;
  const sx = Math.max(0, Math.floor(minX * scaleX)), sy = Math.max(0, Math.floor(minY * scaleY));
  const sw = Math.min(sourceCanvas.width - sx, Math.ceil((maxX - minX) * scaleX));
  const sh = Math.min(sourceCanvas.height - sy, Math.ceil((maxY - minY) * scaleY));
  if (sw < 4 || sh < 4) return null;
  const crop = document.createElement("canvas");
  crop.width = sw; crop.height = sh;
  crop.getContext("2d").drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
  const thumbMax = 320, thumbScale = Math.min(1, thumbMax / Math.max(sw, sh));
  const thumbCanvas = document.createElement("canvas");
  thumbCanvas.width = sw * thumbScale; thumbCanvas.height = sh * thumbScale;
  thumbCanvas.getContext("2d").drawImage(crop, 0, 0, sw, sh, 0, 0, thumbCanvas.width, thumbCanvas.height);
  return { hasImage: true, imageDataUrl: crop.toDataURL("image/jpeg", 0.9), thumbnailDataUrl: thumbCanvas.toDataURL("image/jpeg", 0.8), width: sw, height: sh, rect: pdfRect };
}

export function extractSelectionTextFromBlocks(pageData, viewport, minX, minY, maxX, maxY) {
  if (!pageData || !viewport) return "";
  const blocks = pageData.groupedBlocks || (pageData.texts ? groupTextItems(pageData.texts) : []);
  const selected = blocks.map(block => {
    const [vx1, vy1, vx2, vy2] = viewport.convertToViewportRectangle([block.x, block.y, block.x + block.w, block.y + block.h]);
    const bx1 = Math.min(vx1, vx2), by1 = Math.min(vy1, vy2), bx2 = Math.max(vx1, vx2), by2 = Math.max(vy1, vy2);
    const interArea = Math.max(0, Math.min(maxX, bx2) - Math.max(minX, bx1)) * Math.max(0, Math.min(maxY, by2) - Math.max(minY, by1));
    const overlapRatio = interArea / Math.max(1, (bx2 - bx1) * (by2 - by1));
    return (overlapRatio > 0.15) ? { str: block.str, y: by1, x: bx1 } : null;
  }).filter(Boolean).sort((a, b) => a.y - b.y || a.x - b.x);
  return selected.map(b => b.str).join("\n").trim();
}

export function deriveTitleFromCapturedText(rawText) {
  const line = String(rawText || "").split("\n").map(l => l.trim()).filter(l => l.length > 2)[0] || "";
  return line.length > 50 ? line.slice(0, 50) + "..." : line;
}

export function classifyManualContentMode(rawText, mediaPayload, referencePayload) {
  const text = String(rawText || "").trim();
  const textLen = text.replace(/\s+/g, "").length;
  const hasImage = !!mediaPayload?.imageDataUrl || !!referencePayload?.imageDataUrl;
  const isPlaceholder = /^\[(이미지 영역|선택 영역)\]/.test(text);
  if (!textLen && hasImage) return { mode: "image", hasText: false, hasImage: true, textLen };
  if ((textLen < 12 || isPlaceholder) && hasImage) return { mode: "image", hasText: textLen > 0, hasImage: true, textLen };
  if (hasImage && textLen >= 12) return { mode: "mixed", hasText: true, hasImage: true, textLen };
  return { mode: "text", hasText: textLen > 0, hasImage: false, textLen };
}

export function getContentModeLabel(mode) {
  const labelMap = { text: "텍스트 중심", image: "이미지 중심", mixed: "혼합(텍스트+이미지)" };
  return labelMap[String(mode || "").toLowerCase()] || "미지정";
}

export function getActiveCaptureImagePayload() { return AppState.pendingManualCaptureMedia || null; }
export function getDesignatedReferenceImagePayload() { return AppState.pendingManualReferenceImage || null; }

export async function ensureTesseractAvailable() {
  if (window.Tesseract) return true;
  const s = document.createElement("script"); s.src = "vendor/js/tesseract.min.js";
  return new Promise(resolve => { s.onload = () => resolve(true); s.onerror = () => resolve(false); document.head.appendChild(s); });
}

/**
 * Tesseract OCR 결과물의 공학적 보정 (Post-Processing)
 */
function cleanOcrText(text) {
  if (!text) return "";
  let cleaned = text;
  
  // 1. 공학 단위 보정 (자주 틀리는 패턴)
  cleaned = cleaned.replace(/k\s*N/gi, "kN");
  cleaned = cleaned.replace(/M\s*Pa/gi, "MPa");
  cleaned = cleaned.replace(/m\s*m/gi, "mm");
  cleaned = cleaned.replace(/c\s*m/gi, "cm");
  cleaned = cleaned.replace(/k\s*g/gi, "kg");
  cleaned = cleaned.replace(/N\s*\/\s*m\s*m\s*2/gi, "N/mm²");
  cleaned = cleaned.replace(/k\s*N\s*\/\s*m/gi, "kN/m");
  
  // 2. 수식 및 기호 보정
  cleaned = cleaned.replace(/([0-9])\s*x\s*([0-9])/gi, "$1 × $2"); // 곱셈 기호
  cleaned = cleaned.replace(/=+/g, "="); // 중복 등호 제거
  
  // 3. 특수 문자 정규화
  cleaned = cleaned.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
  
  return cleaned.trim();
}

export async function extractTextByOcrFromImage(imageDataUrl) {
  if (!imageDataUrl || !await ensureTesseractAvailable()) return "";
  const res = await window.Tesseract.recognize(imageDataUrl, "kor+eng");
  const rawText = res?.data?.text || "";
  return cleanOcrText(rawText);
}

export function captureManualQuestion(text, rect, media) {
  const textEl = document.getElementById("manualInputText");
  const numEl = document.getElementById("manualQNum");
  if (textEl) textEl.value = text || "";
  if (numEl) numEl.value = deriveTitleFromCapturedText(text || "");
  AppState.pendingManualRect = rect;
  AppState.pendingManualCaptureMedia = media;
  if (typeof window.updateManualContentModeBadge === "function") window.updateManualContentModeBadge();
  setPdfStatus("영역 지정 완료. Studio에서 확인하세요.", "success");
}

export function markCurrentAreaAsImage() {
  const media = getActiveCaptureImagePayload();
  if (!media) return setPdfStatus("이미지로 지정할 영역이 없습니다.", "error");
  AppState.pendingManualReferenceImage = { ...media };
  if (typeof window.updateManualContentModeBadge === "function") window.updateManualContentModeBadge();
  setPdfStatus("이미지 참조 영역 지정됨", "success");
}

export async function analyzeCurrentArea() {
  setPdfStatus("AI 분석 중...", "info");
  showToast("지능형 분석 기능은 향후 API 연동 시 활성화됩니다.", "info");
}

export function commitAreaToList() {
  const text = document.getElementById("manualInputText")?.value.trim();
  if (!text) return;
  const newQ = {
    id: "M-" + Date.now(), title: document.getElementById("manualQNum")?.value.trim() || deriveTitleFromCapturedText(text),
    rawQuestion: text, rect: AppState.pendingManualRect,
    captureImage: AppState.pendingManualCaptureMedia ? { thumbnailDataUrl: AppState.pendingManualCaptureMedia.thumbnailDataUrl } : null
  };
  AppState.currentReviewingQuestions.push(newQ);
  if (window.syncJsonAndRender) {
    const data = window.getCurrentAnswerData();
    data.questions.push(newQ);
    window.syncJsonAndRender(data, "문항 저장됨", true);
  }
  setPdfStatus("문항 저장 완료", "success");
}

export async function generateDraftForCurrentArea() {
  const text = document.getElementById("manualInputText")?.value.trim();
  if (!text) return showToast("분석할 텍스트가 없습니다.", "error");
  setPdfStatus("답안 초안 생성 중...", "info");
  try {
    if (typeof window.generateDraftAnswersByActiveModel === 'function') {
      const draft = await window.generateDraftAnswersByActiveModel(text);
      if (typeof window.switchTab === 'function') window.switchTab("draft");
      const draftEl = document.getElementById("draftText");
      if (draftEl) draftEl.value = draft;
      setPdfStatus("초안 생성 완료", "success");
    } else {
      showToast("초안 생성 엔진이 로드되지 않았습니다.", "error");
    }
  } catch (err) { setPdfStatus("초안 생성 실패", "error"); }
}

export function initDragSelection(overlay, viewport, pageNum) {
  if (!overlay) return;
  let dragStart = null, dragRect = null;
  overlay.onmousedown = (e) => {
    if (!AppState.isAddAreaMode) return; // 영역 지정 모드가 아닐 때는 무시
    if (e.button !== 0 || e.target.closest(".group-box") || e.target.closest("button")) return;
    const rectObj = overlay.getBoundingClientRect();
    dragStart = { x: e.clientX - rectObj.left, y: e.clientY - rectObj.top };
    dragRect = document.createElement("div");
    dragRect.className = "absolute ants-marching z-50 pointer-events-none rounded-sm";
    overlay.appendChild(dragRect);
  };
  overlay.onmousemove = (e) => {
    if (!dragStart || !dragRect) return;
    const rectObj = overlay.getBoundingClientRect();
    const cur = { x: e.clientX - rectObj.left, y: e.clientY - rectObj.top };
    const x = Math.min(dragStart.x, cur.x), y = Math.min(dragStart.y, cur.y);
    const w = Math.abs(dragStart.x - cur.x), h = Math.abs(dragStart.y - cur.y);
    dragRect.style.left = `${x}px`; dragRect.style.top = `${y}px`; dragRect.style.width = `${w}px`; dragRect.style.height = `${h}px`;
  };
  overlay.onmouseup = (e) => {
    if (!dragStart) return;
    const rectObj = overlay.getBoundingClientRect();
    const ex = e.clientX - rectObj.left, ey = e.clientY - rectObj.top;
    const minX = Math.min(dragStart.x, ex), maxX = Math.max(dragStart.x, ex), minY = Math.min(dragStart.y, ey), maxY = Math.max(dragStart.y, ey);
    if (Math.abs(maxX - minX) > 5 && Math.abs(maxY - minY) > 5) {
      const p1 = viewport.convertToPdfPoint(minX, minY), p2 = viewport.convertToPdfPoint(maxX, maxY);
      const pdfRect = { page: pageNum, x: Math.min(p1[0], p2[0]), y: Math.min(p1[1], p2[1]), w: Math.abs(p1[0] - p2[0]), h: Math.abs(p1[1] - p2[1]) };
      const pageData = AppState.visualTextCache.find(d => d.page === pageNum);
      const text = extractSelectionTextFromBlocks(pageData, viewport, minX, minY, maxX, maxY);
      const media = extractSelectionImagePayload(overlay, minX, minY, maxX, maxY, pdfRect);
      captureManualQuestion(text || "[영역]", pdfRect, media);
    }
    if (dragRect) dragRect.remove();
    dragStart = dragRect = null;
  };
}

const PdfCapture = {
  groupTextItems, extractSelectionImagePayload, extractSelectionTextFromBlocks,
  deriveTitleFromCapturedText, classifyManualContentMode, getContentModeLabel,
  getActiveCaptureImagePayload, getDesignatedReferenceImagePayload,
  ensureTesseractAvailable, extractTextByOcrFromImage,
  captureManualQuestion, markCurrentAreaAsImage, analyzeCurrentArea, commitAreaToList,
  generateDraftForCurrentArea, initDragSelection
};

export default PdfCapture;
