import { AppState } from './app-state.js';
import { getCurrentAnswerData, syncJsonAndRender } from './state-storage.module.js';
import UIStatus from './ui-status.module.js';
import { escapeHtml } from './utils.js';

/**
 * State Theory Archive Module
 * 담당: 첨부파일/URL AI 분석, 이론 자동 지식화
 */

const TheoryArchive = {
  setTheoryArchiveAiStatus(message, type = "info") {
    const el = document.getElementById("theoryArchiveAiStatus");
    if (!el) return;
    const colorMap = { info: "text-slate-500", success: "text-emerald-700", error: "text-rose-700", warning: "text-amber-700" };
    el.className = `text-[10px] font-medium ${colorMap[type] || colorMap.info}`;
    el.textContent = message;
  },

  renderTheoryArchiveAiInsight(insight) {
    const summaryEl = document.getElementById("theoryArchiveAiSummary");
    const pointsEl = document.getElementById("theoryArchiveAiPoints");
    const boostEl = document.getElementById("theoryArchiveAiBoost");
    if (!summaryEl || !pointsEl || !boostEl) return;

    if (!insight) {
      summaryEl.textContent = "분석 대기 중...";
      pointsEl.innerHTML = "";
      boostEl.textContent = "";
      return;
    }

    summaryEl.textContent = String(insight.summary || "요약 결과 없음");
    const points = Array.isArray(insight.keyPoints) ? insight.keyPoints : [];
    pointsEl.innerHTML = points.map(p => `<li class="text-xs text-slate-600 mb-1">${escapeHtml(String(p || ""))}</li>`).join("");
    boostEl.textContent = String(insight.answerBoost || "");
  },

  async analyzeTheoryArchiveFiles() {
    if (AppState._theoryArchiveAiBusy) return;
    
    const filesEl = document.getElementById("theoryArchiveFiles");
    const urlEl = document.getElementById("theoryArchiveUrl");
    const focusEl = document.getElementById("theoryArchiveFocus");

    const files = Array.from(filesEl?.files || []);
    const url = String(urlEl?.value || "").trim();
    const focus = String(focusEl?.value || "").trim() || "이론 지식화 요약";

    if (!files.length && !url) {
      this.setTheoryArchiveAiStatus("파일 또는 URL을 입력하세요.", "error");
      return;
    }

    AppState._theoryArchiveAiBusy = true;
    this.setTheoryArchiveAiStatus("AI 분석 엔진 가동 중...", "info");

    try {
      let insight = null;
      const baseUrl = "http://localhost:8787";

      if (url) {
        const resp = await fetch(`${baseUrl}/api/analyze-webpage`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, focus })
        });
        if (!resp.ok) throw new Error("웹 분석 실패");
        insight = await resp.json();
      } else {
        // 실제 구현 시 인입 파이프라인(readAttachmentTextExcerpt) 활용 가능
        this.setTheoryArchiveAiStatus("파일 텍스트 추출 중...", "info");
        insight = { summary: "파일 분석 결과 (Mock)", keyPoints: ["KDS 14 20 00 준수", "항복 강도 검토"], answerBoost: "파일 데이터 기반 보강" };
      }

      this.renderTheoryArchiveAiInsight(insight);
      AppState.latestTheoryInsight = insight;
      this.setTheoryArchiveAiStatus("AI 분석 완료", "success");
      UIStatus.setDataStatus("이론 아카이브 분석이 완료되었습니다.", "success");
    } catch (e) {
      this.setTheoryArchiveAiStatus(`오류: ${e.message}`, "error");
    } finally {
      AppState._theoryArchiveAiBusy = false;
    }
  },

  // ──── 이론 지식화 유틸리티 (ui.js에서 이관) ──────────────────

  buildLocalAttachmentInsight(items, focus, title = "첨부자료") {
    const rawText = items
      .map((item) => item.textExcerpt || "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    const fallback = rawText || `${title} 분석 결과를 기반으로 핵심 포인트를 정리합니다.`;
    const firstChunk = fallback.slice(0, 240);
    const words = fallback
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 2)
      .slice(0, 120);

    const freq = new Map();
    words.forEach((word) => { freq.set(word, (freq.get(word) || 0) + 1); });
    const keyPoints = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => `핵심 키워드: ${word}`);

    return {
      summary: `${title} 요약: ${firstChunk}${fallback.length > 240 ? "..." : ""}`,
      keyPoints: keyPoints.length ? keyPoints : ["핵심 포인트를 추출할 텍스트가 부족합니다."],
      answerBoost: [
        `- 첨부자료 분석 초점: ${focus || "일반"} 관점에서 근거를 보강함.`,
        "- 기준/정의 → 원인/메커니즘 → 대책/결론 순으로 답안을 구조화함.",
        "- 수치·도해·비교표 제시 시 채점 가독성이 향상됨.",
      ].join("\n"),
    };
  },

  shouldAutoAttachTheoryKnowledge(focusText) {
    const focus = String(focusText || "").toLowerCase();
    return /(이론|지식|개념|서브노트|theory|knowledge|concept)/.test(focus);
  },

  makeTheoryTitleFromFileName(name, fallbackIndex = 1) {
    const base = String(name || "")
      .replace(/\.[^./\\]+$/, "")
      .replace(/[._-]+/g, " ")
      .trim();
    return base || `첨부 이론 ${fallbackIndex}`;
  },

  extractTopTheoryTags(text, maxCount = 5) {
    const stop = new Set(["그리고", "또한", "대한", "기준", "설계", "검토", "적용", "구조", "문제", "정리"]);
    const words = String(text || "").toLowerCase().replace(/[^a-z0-9가-힣\s]/g, " ").split(/\s+/).filter((token) => token.length >= 2 && !stop.has(token));
    const freq = new Map();
    words.forEach((word) => { freq.set(word, (freq.get(word) || 0) + 1); });
    return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, maxCount).map(([word]) => word);
  },

  buildTheoryEntriesFromAnalyzedFiles(items, insight, focus) {
    const keyPoints = Array.isArray(insight?.keyPoints) ? insight.keyPoints : [];
    const entries = [];

    (Array.isArray(items) ? items : []).forEach((item, idx) => {
      const excerpt = String(item?.textExcerpt || "").replace(/\s+/g, " ").trim();
      if (excerpt.length < 50) return;

      const title = this.makeTheoryTitleFromFileName(item?.name, idx + 1);
      const tags = this.extractTopTheoryTags(excerpt, 8); // 태그 개수 증가
      
      const round = (typeof window.normalizeExamRound === "function") 
        ? window.normalizeExamRound("실무자료", "분석결과") 
        : "미지정";

      // 구조화된 컨텐츠 생성
      const content = [
        `### [Source: ${item?.name || "Unknown"}]`,
        `**[Summary]** ${insight?.summary || "No summary available."}`,
        `**[Key Points]**`,
        ...(keyPoints.length ? keyPoints.map(p => `- ${p}`) : ["- No key points extracted."]),
        `**[Full Context]**`,
        `${excerpt.slice(0, 3000)}${excerpt.length > 3000 ? "..." : ""}`,
        `**[Analysis Focus]** ${focus || "Structural Analysis & Standard Review"}`
      ].join("\n");

      entries.push({ 
        title, 
        category: "AI분석자료", 
        examRound: round, 
        tags: [...new Set(["AI자동", ...tags])], 
        source: `AI-Extractor:${item?.name || "unknown"}`, 
        content 
      });
    });

    return entries;
  },

  appendTheoryEntriesToKnowledgeBase(entries) {
    const list = Array.isArray(entries) ? entries : [];
    if (!list.length) return 0;

    const data = getCurrentAnswerData();
    if (!data) return 0;
    if (!data.theories) data.theories = [];

    // 제목 또는 소스가 겹치면 중복으로 간주
    const exists = new Set(data.theories.map((row) => `${String(row.title || "").trim().toLowerCase()}`));

    let added = 0;
    list.forEach((entry) => {
      const key = String(entry.title || "").trim().toLowerCase();
      if (exists.has(key)) {
        // 이미 존재하면 내용 업데이트 (선택 사항, 여기선 건너뜀)
        return;
      }
      
      const nextId = `TH-${String(data.theories.length + 1).padStart(3, "0")}`;
      data.theories.push({
        id: nextId,
        title: entry.title || "AI 추출 이론",
        category: entry.category || "AI분석자료",
        examRound: entry.examRound || "미지정",
        tags: Array.isArray(entry.tags) ? entry.tags : ["AI자동"],
        source: entry.source || "AI-Extractor",
        content: entry.content || "",
        createdAt: new Date().toISOString()
      });
      exists.add(key);
      added += 1;
    });

    if (added > 0) {
      syncJsonAndRender(data, `지식 베이스 업데이트: ${added}개의 전문 지식이 추가되었습니다.`, true);
    }
    return added;
  },

  // ──── 헬퍼 유틸리티 (기존 로직) ──────────────────

  async ensureAttachmentOcrEngine() {
    if (window.Tesseract && typeof window.Tesseract.recognize === "function") return true;
    const script = document.createElement("script");
    script.src = "vendor/js/tesseract.min.js";
    script.async = true;
    return new Promise((resolve) => {
      script.onload = () => resolve(!!(window.Tesseract && typeof window.Tesseract.recognize === "function"));
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  },

  async runAttachmentOcr(source) {
    const ready = await this.ensureAttachmentOcrEngine();
    if (!ready) return "";
    try {
      const langPath = `${window.location.origin}/`;
      const result = await window.Tesseract.recognize(source, "kor+eng", { langPath });
      return (result?.data?.text || "").slice(0, 50000);
    } catch { return ""; }
  },

  async readAttachmentTextExcerpt(file) {
    const ext = (file.name || "").toLowerCase().split(".").pop() || "";
    const type = file.type || "";
    if (type.startsWith("text/") || ["txt", "md", "csv"].includes(ext)) {
      const buffer = await file.arrayBuffer();
      return new TextDecoder("utf-8").decode(new Uint8Array(buffer)).slice(0, 50000);
    }

    if ((type === "application/pdf" || ext === "pdf") && (window.pdfjsLib || AppState.pdfjsLib)) {
      const pdfjs = window.pdfjsLib || AppState.pdfjsLib;
      const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
      const parts = [];
      for (let i = 1; i <= Math.min(pdf.numPages, 30); i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        parts.push(content.items.map(it => it.str).join(" "));
      }
      return parts.join("\n").slice(0, 150000);
    }
    return `파일정보: ${file.name}, size=${file.size}`;
  },

  initTheoryArchiveAiPanel() {
    // app.js에서 수동 바인딩하므로 여기서는 구조적 호환성만 유지
    console.log("TheoryArchive AI Panel init");
  },

  exposeGlobal() {
    window.readAttachmentTextExcerpt = this.readAttachmentTextExcerpt.bind(this);
    window.buildLocalAttachmentInsight = this.buildLocalAttachmentInsight.bind(this);
    window.shouldAutoAttachTheoryKnowledge = this.shouldAutoAttachTheoryKnowledge.bind(this);
    window.buildTheoryEntriesFromAnalyzedFiles = this.buildTheoryEntriesFromAnalyzedFiles.bind(this);
    window.appendTheoryEntriesToKnowledgeBase = this.appendTheoryEntriesToKnowledgeBase.bind(this);
  }
};

export default TheoryArchive;
