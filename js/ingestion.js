/**
 * SolveCivil Answer Studio - Unified Ingestion Logic
 * @version 2.0.0 (Unified)
 */

// 전역 유틸리티 및 함수 참조 (상위 스크립트에서 로드됨)
// window.setDataStatus, window.setAttachmentStatus 등은 전역 스코프에서 직접 접근 가능합니다.

/**
 * 하이브리드 지능형 주입 파이프라인
 * - RAG 엔진 전송 + 지식 베이스 자동 등록
 */
/**
 * 하이브리드 지능형 주입 파이프라인 (파일 및 웹사이트 통합)
 */
async function runUnifiedIngestion(input, focus = "") {
  const isUrl = typeof input === "string" && (input.startsWith("http://") || input.startsWith("https://"));
  const files = !isUrl ? (Array.isArray(input) ? input : [input]) : [];
  const url = isUrl ? input : "";

  if (!files.length && !url) {
    setDataStatus("주입할 자료(파일 또는 URL)를 입력하세요.", "error");
    return;
  }

  setDataStatus(`통합 지능형 ${isUrl ? "웹사이트" : "자료"} 분석 시작 중...`, "info");
  
  let items = [];
  if (!isUrl) {
    for (const file of files) {
      try {
        const textExcerpt = await window.readAttachmentTextExcerpt(file);
        items.push({
          name: file.name,
          type: file.type,
          size: file.size,
          textExcerpt
        });
      } catch (e) {
        console.warn(`File reading failed: ${file.name}`, e);
      }
    }
  }

  const formData = new FormData();
  if (isUrl) {
    formData.append("url", url); // 웹사이트 분석용
  } else {
    for (const file of files) {
      formData.append("files", file);
    }
  }
  formData.append("focus", focus);
  formData.append("items", JSON.stringify(items));

  try {
    const baseUrl = window.getAnalyzeBackendUrl ? window.getAnalyzeBackendUrl() : "http://localhost:8787";
    // 웹사이트인 경우 기존 api/analyze-webpage를 활용하거나 통합 처리
    const endpoint = isUrl ? "/api/analyze-webpage" : "/api/ingest-intelligence";
    
    // api/analyze-webpage는 JSON을 기대하므로 멀티파트가 아닐 수 있음
    let body, headers = {};
    if (isUrl) {
      body = JSON.stringify({ url, focus });
      headers = { "Content-Type": "application/json" };
    } else {
      body = formData;
    }

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: "POST",
      headers,
      body
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = await response.json();
    
    // 1. Intelligence 반영 (이론 지식 베이스)
    // api/analyze-webpage 결과 구조와 api/ingest-intelligence 결과 구조 통합 대응
    const insight = isUrl ? result : result.intelligence;
    
    if (insight) {
      window.latestAttachmentInsight = insight;
      if (typeof window.renderAttachmentInsight === "function") {
        window.renderAttachmentInsight(insight);
      }

      // 이론 DB 자동 등록 제안 또는 자동 등록
      if (window.shouldAutoAttachTheoryKnowledge(focus)) {
        const sourceItems = isUrl ? [{ name: url, textExcerpt: insight.originalText || "" }] : items;
        const autoEntries = window.buildTheoryEntriesFromAnalyzedFiles(sourceItems, insight, focus);
        const addedCount = window.appendTheoryEntriesToKnowledgeBase(autoEntries);
        
        const msg = isUrl 
          ? `웹 지식화 완료: 이론 등록 ${addedCount}건`
          : `통합 주입 완료: RAG 전송 ${result.savedToDropzone}건, 이론 등록 ${addedCount}건`;
        setDataStatus(msg, "success");
      } else {
        setDataStatus(`${isUrl ? "웹사이트" : "자료"} 분석 및 RAG 전송 완료`, "success");
      }
    }

    return result;
  } catch (error) {
    console.error("Unified Ingestion Error:", error);
    setDataStatus("분석 엔진 연결 실패. 로컬 엔진으로 전환합니다.", "warning");
    
    const fallbackTitle = isUrl ? url : `${files.length}개 자료`;
    const localInsight = window.buildLocalAttachmentInsight(items, focus, fallbackTitle);
    window.latestAttachmentInsight = { ...localInsight, mode: "local" };
    if (typeof window.renderAttachmentInsight === "function") {
      window.renderAttachmentInsight(window.latestAttachmentInsight);
    }
  }
}

/**
 * 전용 헬퍼: 웹사이트 분석 버튼용
 */
async function handleWebsiteIngestion() {
  const url = document.getElementById("attachmentWebsiteUrl")?.value;
  const focus = document.getElementById("attachmentFocus")?.value;
  if (!url) {
    setDataStatus("분석할 URL을 입력하세요.", "error");
    return;
  }
  await runUnifiedIngestion(url, focus);
}

/**
 * 사이드바 주입 버튼 이벤트 핸들러
 */
function handleSidebarIngestion() {
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.onchange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    
    // 데이터 허브(이론) 섹션으로 강제 이동하여 가시성 확보
    if (typeof window.showSection === "function") {
      window.showSection("theory");
    }
    await runUnifiedIngestion(files, "사이드바 신속 주입");
  };
  input.click();
}

/**
 * 전역 익스포트
 */
window.runUnifiedIngestion = runUnifiedIngestion;
window.handleSidebarIngestion = handleSidebarIngestion;
window.handleWebsiteIngestion = handleWebsiteIngestion;
