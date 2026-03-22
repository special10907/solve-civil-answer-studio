/**
 * State Storage Module
 * 담당: 데이터 정규화, 로드/저장, JSON 동기화
 */
import { AppState } from './app-state.js';
import UIStatus from './ui-status.module.js';
import UIBoost from './ui-boost.module.js';
const { setDataStatus } = UIStatus;
const { refreshAttachmentTargetOptions } = UIBoost;

export const ANSWER_STORAGE_KEY = "solve120_answer_data_v1";

// ──── Storage Utility (Browser Compatibility) ──────────────────

export const safeLocalStorage = {
  _mem: {}, _checked: false, _enabled: false,
  _ensure() {
    if (this._checked) return this._enabled;
    this._checked = true;
    try {
      const testKey = "__storage_test__";
      window.localStorage.setItem(testKey, "1");
      window.localStorage.removeItem(testKey);
      this._enabled = true;
    } catch { this._enabled = false; }
    return this._enabled;
  },
  getItem(k) { return this._ensure() ? window.localStorage.getItem(k) : this._mem[k]; },
  setItem(k, v) { if (this._ensure()) window.localStorage.setItem(k, v); else this._mem[k] = v; },
  removeItem(k) { if (this._ensure()) window.localStorage.removeItem(k); else delete this._mem[k]; }
};

// ──── 정규화 유틸 ──────────────────────────────────────────────

export function normalizeExamRound(value, fallback = "미지정") {
  const text = String(value || "").trim();
  if (!text || text === "-") return fallback;
  const match = text.match(/(\d{2,3})\s*회/);
  if (match) return `${match[1]}회`;
  if (/^\d{2,3}$/.test(text)) return `${text}회`;
  return text || fallback;
}

export function normalizeDraftPlanHistory(entries) {
  if (!Array.isArray(entries)) return [];
  return entries
    .map((item) => {
      if (typeof item === "string") {
        const text = item.trim();
        return text ? { text, createdAt: "" } : null;
      }
      if (!item || typeof item !== "object") return null;
      const text = String(item.text || item.plan || "").trim();
      return text ? { text, createdAt: String(item.createdAt || "").trim() } : null;
    })
    .filter(Boolean);
}

export function normalizeData(data) {
  const normalized = data && typeof data === "object" ? data : {};
  
  // 버전 체크 및 기본값 설정
  normalized.version = normalized.version || "1.0";
  if (!Array.isArray(normalized.questions)) normalized.questions = [];
  if (!Array.isArray(normalized.theories)) normalized.theories = [];

  const fallbackRound = normalized.meta?.exam
    ? String(normalized.meta.exam).replace(/[^0-9가-힣회]/g, "") || "미지정"
    : "미지정";

  normalized.questions = normalized.questions.map((item, index) => {
    const q = item && typeof item === "object" ? { ...item } : {};
    q.id = q.id || `Q${index + 1}`;
    q.title = q.title || "제목 없음";
    q.modelAnswer = q.modelAnswer || "";
    q.tags = Array.isArray(q.tags) ? q.tags : [];
    q.source = q.source || "-";
    q.draftPlan = q.draftPlan || "";
    q.draftPlanHistory = normalizeDraftPlanHistory(q.draftPlanHistory);
    q.reviewed = !!q.reviewed;
    q.examRound = normalizeExamRound(q.examRound || fallbackRound, fallbackRound);
    return q;
  });

  normalized.theories = normalized.theories.map((item, index) => {
    const t = item && typeof item === "object" ? { ...item } : {};
    t.id = t.id || `TH-${String(index + 1).padStart(3, "0")}`;
    t.title = t.title || "이론 제목 없음";
    t.category = t.category || "일반";
    t.content = t.content || "";
    t.tags = Array.isArray(t.tags) ? t.tags : [];
    t.source = t.source || "-";
    t.examRound = normalizeExamRound(t.examRound || fallbackRound, fallbackRound);
    return t;
  });

  return normalized;
}

// ──── 현재 데이터 접근 ────────────────────────────────────────

export function getCurrentAnswerData() {
  const inputEl = document.getElementById("answerJsonInput");
  const raw = inputEl ? inputEl.value.trim() : "";
  if (!raw) return { questions: [], theories: [] };
  return normalizeData(JSON.parse(raw));
}

// ──── 동기화 ──────────────────────────────────────────────────

export function syncJsonAndRender(data, statusMessage) {
  const updatedJson = JSON.stringify(data, null, 2);
  const inputEl = document.getElementById("answerJsonInput");
  if (inputEl) inputEl.value = updatedJson;

  // 렌더는 window.renderAnswerData를 통해 (순환 참조 방지)
  if (typeof window.renderAnswerData === "function") window.renderAnswerData(data);
  if (typeof window.refreshAutoExtractSummary === "function") window.refreshAutoExtractSummary();

  saveAnswerData(true); // silent 자동 저장
  if (statusMessage) setDataStatus(statusMessage, "success");
}

// ──── 저장 / 불러오기 ─────────────────────────────────────────

let saveDebounceTimer = null;

export function saveAnswerData(silent = false) {
  const performSave = () => {
    try {
      const inputEl = document.getElementById("answerJsonInput");
      const raw = inputEl ? inputEl.value.trim() : "";
      if (!raw) {
        if (!silent) setDataStatus("저장할 데이터가 없습니다.", "error");
        return;
      }
      JSON.parse(raw); // 유효성 검사
      const storage = window.safeLocalStorage || localStorage;
      storage.setItem(ANSWER_STORAGE_KEY, raw);
      if (!silent) setDataStatus("데이터가 저장되었습니다.", "success");
    } catch (e) {
      if (!silent) setDataStatus(`저장 실패: ${e.message}`, "error");
    }
  };

  if (silent) {
    // 자동 저장(silent) 시에만 디바운싱 적용
    if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
    saveDebounceTimer = setTimeout(performSave, 1000);
  } else {
    // 수동 저장 시에는 즉시 실행
    if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
    performSave();
  }
}

export function loadAnswerData() {
  try {
    const storage = window.safeLocalStorage || localStorage;
    const raw = storage.getItem(ANSWER_STORAGE_KEY);
    if (!raw) { setDataStatus("저장된 데이터가 없습니다.", "info"); return; }
    const data = normalizeData(JSON.parse(raw));
    const inputEl = document.getElementById("answerJsonInput");
    if (inputEl) inputEl.value = JSON.stringify(data, null, 2);
    if (typeof window.renderAnswerData === "function") window.renderAnswerData(data);
    setDataStatus("데이터를 불러왔습니다.", "success");
  } catch (e) {
    setDataStatus(`불러오기 실패: ${e.message}`, "error");
  }
}

export function exportAnswerDataToFile() {
  try {
    const inputEl = document.getElementById("answerJsonInput");
    const raw = inputEl ? inputEl.value.trim() : "";
    if (!raw) { alert("내보낼 데이터가 없습니다."); return; }
    const data = JSON.parse(raw);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `answer-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    alert(`내보내기 실패: ${e.message}`);
  }
}

export function openImportFileDialog() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.onchange = (e) => {
    const file = e.target.files?.[0];
    if (file) importAnswerDataFromFile(file);
  };
  input.click();
}

export function importAnswerDataFromFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = normalizeData(JSON.parse(e.target.result));
      const inputEl = document.getElementById("answerJsonInput");
      if (inputEl) inputEl.value = JSON.stringify(data, null, 2);
      if (typeof window.renderAnswerData === "function") window.renderAnswerData(data);
      setDataStatus(`"${file.name}" 가져오기 완료.`, "success");
    } catch (err) {
      setDataStatus("파일 읽기 중 오류가 발생했습니다.", "error");
    }
  };
  reader.readAsText(file, "utf-8");
}

export function deleteModelAnswerEntry(index) {
  const data = getCurrentAnswerData();
  if (!data.questions[index]) return;
  const removed = data.questions.splice(index, 1)[0];
  syncJsonAndRender(data, `${removed.id} 항목을 삭제했습니다.`);
}

export function loadSampleData() {
  const sample = {
    meta: { exam: "토목구조기술사 120회", source: "NotebookLM/Flowith", version: "v1.0" },
    questions: [
      {
        id: "Q1",
        title: "응력교란구역(D-Region)의 정의 및 설계 원칙",
        examRound: "120회",
        tags: ["RC", "STM", "KDS 14 20 24"],
        modelAnswer: "D-Region은 평면유지 가정이 성립하지 않는 불연속 영역으로, 스트럿-타이 모델을 통해 힘의 흐름을 이상화하여 설계한다. 설계 시 strut, tie, node 강도와 정착 길이를 종합 검토한다.",
        source: "Flowith Draft",
        reviewed: false,
      },
      {
        id: "Q2",
        title: "PS 긴장재 부식 및 지연파괴 대책",
        examRound: "120회",
        tags: ["PSC", "유지관리", "그라우팅"],
        modelAnswer: "염소이온과 수분 환경에서 수소취성이 가속될 수 있으므로, 그라우팅 품질관리와 피복 두께 확보, 정기 점검 및 비파괴검사를 병행한다.",
        source: "NotebookLM Notes",
        reviewed: true,
      },
    ],
    theories: [
      {
        id: "TH-001",
        title: "응력교란구역(D-Region) 기본 개념",
        category: "RC",
        examRound: "120회",
        tags: ["RC", "STM", "D-Region"],
        source: "Subnote",
        content: "D-Region은 평면유지 가정이 성립하지 않는 불연속 구간이며 STM으로 힘의 전달 경로를 이상화하여 설계한다. KDS 14 20 24 기준으로 Strut/Tie/Node 강도를 검토한다.",
      },
      {
        id: "TH-002",
        title: "D-Region 설계 보강 포인트",
        category: "RC",
        examRound: "121회",
        tags: ["RC", "정착", "절점"],
        source: "PDF Upload",
        content: "STM 적용 시 절점(Nodal Zone)의 지압강도와 인장 철근 정착길이 확보를 우선 검토한다. 도해와 비교표를 활용하면 채점 가독성이 높아진다.",
      },
    ],
  };
  const inputEl = document.getElementById("answerJsonInput");
  if (inputEl) inputEl.value = JSON.stringify(sample, null, 2);
  if (typeof window.renderAnswerData === "function") window.renderAnswerData(sample);
  setDataStatus("고품질 샘플 데이터를 불러왔습니다.", "success");
}
