import { AppState } from './app-state.js';
import UIStatus from './ui-status.module.js';
import TheoryArchive from './state-theory-archive.module.js';

/**
 * SolveCivil Answer Studio - Unified Ingestion Logic (Modularized)
 */

async function runUnifiedIngestion(input, focus = "") {
  const isUrl = typeof input === "string" && (input.startsWith("http://") || input.startsWith("https://"));
  const files = !isUrl ? (Array.isArray(input) ? input : [input]) : [];
  const url = isUrl ? input : "";

  if (!files.length && !url) {
    UIStatus.setDataStatus("주입할 자료(파일 또는 URL)를 입력하세요.", "error");
    return;
  }

  UIStatus.setDataStatus(`통합 지능형 ${isUrl ? "웹사이트" : "자료"} 분석 시작 중...`, "info");

  let items = [];
  if (!isUrl) {
    for (const file of files) {
      try {
        const textExcerpt = await TheoryArchive.readAttachmentTextExcerpt(file);
        items.push({ name: file.name, type: file.type, size: file.size, textExcerpt });
      } catch (e) {
        console.warn(`File reading failed: ${file.name}`, e);
      }
    }
  }

  const formData = new FormData();
  if (isUrl) {
    formData.append("url", url);
  } else {
    for (const file of files) {
      formData.append("files", file);
    }
  }
  formData.append("focus", focus);
  formData.append("items", JSON.stringify(items));

  try {
    const baseUrl = window.getAnalyzeBackendUrl ? window.getAnalyzeBackendUrl() : "http://localhost:8787";
    const endpoint = isUrl ? "/api/analyze-webpage" : "/api/ingest-intelligence";

    let body, headers = {};
    if (isUrl) {
      body = JSON.stringify({ url, focus });
      headers = { "Content-Type": "application/json" };
    } else {
      body = formData;
    }

    const response = await fetch(`${baseUrl}${endpoint}`, { method: "POST", headers, body });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = await response.json();
    const insight = isUrl ? result : result.intelligence;

    if (insight) {
      AppState.latestAttachmentInsight = insight;
      if (window.renderAttachmentInsight) window.renderAttachmentInsight(insight);

      if (TheoryArchive.shouldAutoAttachTheoryKnowledge(focus)) {
        const sourceItems = isUrl ? [{ name: url, textExcerpt: insight.originalText || "" }] : items;
        const autoEntries = TheoryArchive.buildTheoryEntriesFromAnalyzedFiles(sourceItems, insight, focus);
        const addedCount = TheoryArchive.appendTheoryEntriesToKnowledgeBase(autoEntries);

        const msg = isUrl ? `웹 지식화 완료: 이론 등록 ${addedCount}건` : `통합 주입 완료: RAG 전송 ${result.savedToDropzone ?? 0}건, 이론 등록 ${addedCount}건`;
        UIStatus.setDataStatus(msg, "success");
      } else {
        UIStatus.setDataStatus(`${isUrl ? "웹사이트" : "자료"} 분석 및 RAG 전송 완료`, "success");
      }
    }
    return result;
  } catch (error) {
    console.warn("Backend Ingestion Fallback to Local:", error);
    UIStatus.setDataStatus("분석 엔진 연결 실패. 로컬 엔진으로 전환합니다.", "warning");

    const fallbackTitle = isUrl ? url : `${files.length}개 자료`;
    const localInsight = TheoryArchive.buildLocalAttachmentInsight(items, focus, fallbackTitle);
    AppState.latestAttachmentInsight = { ...localInsight, mode: "local" };
    
    if (window.renderAttachmentInsight) window.renderAttachmentInsight(AppState.latestAttachmentInsight);
  }
}

async function handleWebsiteIngestion() {
  const url = document.getElementById("attachmentWebsiteUrl")?.value;
  const focus = document.getElementById("attachmentFocus")?.value;
  if (!url) {
    UIStatus.setDataStatus("분석할 URL을 입력하세요.", "error");
    return;
  }
  await runUnifiedIngestion(url, focus);
}

function handleSidebarIngestion() {
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.onchange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    if (window.showSection) window.showSection("studio");
    await runUnifiedIngestion(files, "사이드바 신속 주입");
  };
  input.click();
}

// Global Expose
window.runUnifiedIngestion = runUnifiedIngestion;
window.handleSidebarIngestion = handleSidebarIngestion;
window.handleWebsiteIngestion = handleWebsiteIngestion;

export { runUnifiedIngestion, handleSidebarIngestion, handleWebsiteIngestion };
