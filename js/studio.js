/**
 * SolveCivil Answer Studio - Knowledge Studio Module
 * @version 1.0.0
 */

const Studio = {
  currentTab: "answers", // 'answers' or 'theory'
  docxGenerationTrace: [],
  docxGenerationFilter: "all",
  docxPinErrorFirst: false,
  DOCX_LOG_PREFS_SCHEMA_VERSION: 2,
  DOCX_LOG_PREFS_KEY: "solve_studio_docx_log_prefs_v2",
  DOCX_LOG_PREFS_LEGACY_KEYS: ["solve_studio_docx_log_prefs_v1"],

  _normalizeDocxLogPrefs(input) {
    const allowedFilters = new Set(["all", "success", "fallback", "error"]);
    const fallback = {
      filter: "all",
      pinErrorFirst: false,
      version: this.DOCX_LOG_PREFS_SCHEMA_VERSION,
    };

    if (!input || typeof input !== "object") return fallback;

    const filter = allowedFilters.has(input.filter) ? input.filter : fallback.filter;
    const pinErrorFirst =
      typeof input.pinErrorFirst === "boolean"
        ? input.pinErrorFirst
        : fallback.pinErrorFirst;
    const version = Number.isFinite(Number(input.version))
      ? Number(input.version)
      : 1;

    return { filter, pinErrorFirst, version };
  },

  _saveDocxLogPrefs() {
    try {
      const payload = {
        version: this.DOCX_LOG_PREFS_SCHEMA_VERSION,
        filter: this.docxGenerationFilter,
        pinErrorFirst: this.docxPinErrorFirst,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(this.DOCX_LOG_PREFS_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn("DOCX 로그 설정 저장 실패:", e);
    }
  },

  _loadDocxLogPrefs() {
    try {
      const keys = [this.DOCX_LOG_PREFS_KEY, ...this.DOCX_LOG_PREFS_LEGACY_KEYS];
      let loaded = null;
      let loadedKey = "";

      for (const key of keys) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        loaded = this._normalizeDocxLogPrefs(JSON.parse(raw));
        loadedKey = key;
        break;
      }

      if (!loaded) return;

      this.docxGenerationFilter = loaded.filter;
      this.docxPinErrorFirst = loaded.pinErrorFirst;

      const needsMigration =
        loadedKey !== this.DOCX_LOG_PREFS_KEY ||
        loaded.version !== this.DOCX_LOG_PREFS_SCHEMA_VERSION;

      if (needsMigration) {
        this._saveDocxLogPrefs();
        this.DOCX_LOG_PREFS_LEGACY_KEYS.forEach((key) => {
          if (key !== this.DOCX_LOG_PREFS_KEY) {
            localStorage.removeItem(key);
          }
        });
      }
    } catch (e) {
      console.warn("DOCX 로그 설정 불러오기 실패:", e);
    }
  },

  _escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  },

  _canShowByFilter(mode) {
    if (this.docxGenerationFilter === "all") return true;
    if (this.docxGenerationFilter === "success") return mode === "json";
    return mode === this.docxGenerationFilter;
  },

  _syncDocxLogFilterUi() {
    document
      .querySelectorAll("#docxGenerationLogFilters [data-docx-log-filter]")
      .forEach((btn) => {
        const isActive = btn.dataset.docxLogFilter === this.docxGenerationFilter;
        btn.classList.toggle("bg-indigo-600", isActive);
        btn.classList.toggle("text-white", isActive);
        btn.classList.toggle("border-indigo-600", isActive);
        btn.classList.toggle("bg-white", !isActive);
        btn.classList.toggle("text-slate-600", !isActive);
        btn.classList.toggle("border-slate-200", !isActive);
      });
  },

  _setDocxGenerationFilter(filter = "all") {
    this.docxGenerationFilter = filter;
    this._saveDocxLogPrefs();
    this._syncDocxLogFilterUi();
    this._renderDocxGenerationLogPanel();
  },

  _syncDocxPinUi() {
    const btn = document.getElementById("docxPinErrorBtn");
    if (!btn) return;
    btn.classList.toggle("bg-rose-600", this.docxPinErrorFirst);
    btn.classList.toggle("text-white", this.docxPinErrorFirst);
    btn.classList.toggle("border-rose-600", this.docxPinErrorFirst);
    btn.classList.toggle("bg-white", !this.docxPinErrorFirst);
    btn.classList.toggle("text-slate-600", !this.docxPinErrorFirst);
    btn.classList.toggle("border-slate-200", !this.docxPinErrorFirst);
    btn.textContent = this.docxPinErrorFirst ? "오류고정 ON" : "오류고정 OFF";
  },

  _toggleDocxPinErrorFirst() {
    this.docxPinErrorFirst = !this.docxPinErrorFirst;
    this._saveDocxLogPrefs();
    this._syncDocxPinUi();
    this._renderDocxGenerationLogPanel();
  },

  _buildDocxLogSummaryLine(log = {}) {
    const mode = String(log.mode || "idle").toUpperCase();
    const time = this._formatDocxTraceTime(log.timestamp);
    const title = String(log.title || "-").trim();
    const filename = String(log.filename || "-").trim();
    const detail = String(log.detail || "-").trim();
    return `[${time}] ${mode} | 제목=${title} | 파일=${filename} | 상세=${detail}`;
  },

  _copyTopDocxLogSummary() {
    const filtered = this.docxGenerationTrace.filter((log) =>
      this._canShowByFilter(String(log.mode || "idle")),
    );
    if (!filtered.length) {
      window.showToast?.("복사할 로그가 없습니다.", "info");
      return;
    }
    const sorted = this.docxPinErrorFirst
      ? [...filtered].sort((a, b) => {
          const ae = String(a.mode || "") === "error" ? 1 : 0;
          const be = String(b.mode || "") === "error" ? 1 : 0;
          return be - ae;
        })
      : filtered;
    this._copyTextToClipboard(this._buildDocxLogSummaryLine(sorted[0]));
  },

  async _copyTextToClipboard(text) {
    const content = String(text || "").trim();
    if (!content) {
      window.showToast?.("복사할 내용이 없습니다.", "info");
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(content);
      } else {
        const temp = document.createElement("textarea");
        temp.value = content;
        temp.setAttribute("readonly", "readonly");
        temp.style.position = "fixed";
        temp.style.opacity = "0";
        document.body.appendChild(temp);
        temp.select();
        document.execCommand("copy");
        document.body.removeChild(temp);
      }
      window.showToast?.("클립보드에 복사했습니다.", "success");
    } catch (e) {
      console.warn("Clipboard copy failed:", e);
      window.showToast?.("복사 실패: 브라우저 권한을 확인하세요.", "error");
    }
  },

  _formatDocxTraceTime(ts) {
    const date = ts instanceof Date ? ts : new Date(ts);
    if (Number.isNaN(date.getTime())) return "시간정보 없음";
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    const ss = String(date.getSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  },

  _pushDocxGenerationTrace(entry = {}) {
    this.docxGenerationTrace.unshift({
      mode: entry.mode || "idle",
      detail: entry.detail || "",
      filename: entry.filename || "",
      title: entry.title || "",
      timestamp: new Date(),
    });
    this.docxGenerationTrace = this.docxGenerationTrace.slice(0, 10);
    this._renderDocxGenerationLogPanel();
  },

  _renderDocxGenerationLogPanel() {
    const body = document.getElementById("docxGenerationLogBody");
    if (!body) return;

    const filtered = this.docxGenerationTrace.filter((log) =>
      this._canShowByFilter(String(log.mode || "idle")),
    );
    const ordered = this.docxPinErrorFirst
      ? [...filtered].sort((a, b) => {
          const ae = String(a.mode || "") === "error" ? 1 : 0;
          const be = String(b.mode || "") === "error" ? 1 : 0;
          return be - ae;
        })
      : filtered;

    if (!this.docxGenerationTrace.length) {
      body.innerHTML =
        '<div class="text-[10px] text-slate-500">아직 생성 기록이 없습니다.</div>';
      return;
    }

    if (!ordered.length) {
      body.innerHTML =
        '<div class="text-[10px] text-slate-500">선택한 필터에 해당하는 기록이 없습니다.</div>';
      return;
    }

    body.innerHTML = ordered
      .map((log) => {
        const colorMap = {
          json: "text-emerald-700",
          fallback: "text-amber-700",
          error: "text-rose-700",
          idle: "text-slate-700",
        };
        const modeLabelMap = {
          json: "JSON",
          fallback: "Fallback",
          error: "Error",
          idle: "Idle",
        };
        const mode = String(log.mode || "idle");
        const modeLabel = modeLabelMap[mode] || mode;
        const detail = log.detail ? String(log.detail) : "-";
        const title = log.title ? String(log.title) : "-";
        const filename = log.filename ? String(log.filename) : "-";
        const toSafeHtml = (v) => this._escapeHtml(v);
        const detailCopy = toSafeHtml(detail);
        const filenameCopy = toSafeHtml(filename);

        return `
          <div class="rounded-lg border border-slate-200 bg-white px-2 py-1.5 space-y-1">
            <div class="flex items-center justify-between gap-2">
              <span class="text-[10px] font-bold ${colorMap[mode] || "text-slate-700"}">${modeLabel}</span>
              <span class="text-[10px] text-slate-500 font-mono">${this._formatDocxTraceTime(log.timestamp)}</span>
            </div>
            <div class="text-[10px] text-slate-700"><strong>제목</strong>: ${toSafeHtml(title)}</div>
            <div class="text-[10px] text-slate-700 flex items-center justify-between gap-2">
              <span><strong>파일</strong>: ${toSafeHtml(filename)}</span>
              <button type="button" data-copy-kind="filename" data-copy-value="${filenameCopy}" class="px-1.5 py-0.5 text-[10px] rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100">복사</button>
            </div>
            <div class="text-[10px] text-slate-700 flex items-center justify-between gap-2">
              <span><strong>상세</strong>: ${toSafeHtml(detail)}</span>
              <button type="button" data-copy-kind="detail" data-copy-value="${detailCopy}" class="px-1.5 py-0.5 text-[10px] rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100">복사</button>
            </div>
          </div>
        `;
      })
      .join("");
  },

  _toggleDocxGenerationLogPanel(forceOpen) {
    const panel = document.getElementById("docxGenerationLogPanel");
    if (!panel) return;
    const shouldOpen =
      typeof forceOpen === "boolean"
        ? forceOpen
        : panel.classList.contains("hidden");

    panel.classList.toggle("hidden", !shouldOpen);
    if (shouldOpen) {
      this._syncDocxLogFilterUi();
      this._syncDocxPinUi();
      this._renderDocxGenerationLogPanel();
    }
  },

  _setDocxGenerationModeBadge(mode = "idle", detail = "") {
    const badge = document.getElementById("docxGenerationModeBadge");
    if (!badge) return;

    const map = {
      idle: {
        text: "DOCX 생성 대기",
        title: "전문 서브노트 생성 상태",
        className:
          "inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-600",
      },
      json: {
        text: "JSON 직렬화 생성",
        title: "AI 응답 JSON 파싱 성공",
        className:
          "inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700",
      },
      fallback: {
        text: "구조화 폴백 사용",
        title: "AI JSON 파싱 실패로 텍스트 기반 구조화 사용",
        className:
          "inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700",
      },
      error: {
        text: "DOCX 생성 오류",
        title: "생성 과정에서 오류 발생",
        className:
          "inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700",
      },
    };

    const selected = map[mode] || map.idle;
    const suffix = detail ? ` · ${String(detail).slice(0, 40)}` : "";
    badge.className = selected.className;
    badge.title = detail ? `${selected.title} (${detail})` : selected.title;
    badge.innerHTML = `<i class="fas fa-circle text-[8px]"></i>${selected.text}${suffix}`;
  },

  _extractJsonCandidate(text) {
    const source = String(text || "").trim();
    if (!source) return "";

    const fenced = source.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenced?.[1]) return fenced[1].trim();

    const start = source.indexOf("{");
    const end = source.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return source.slice(start, end + 1).trim();
    }

    return source;
  },

  _buildDocxFallbackFromText(rawText, title = "") {
    const text = String(rawText || "").replace(/\r/g, "\n").trim();
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const first =
      lines.find((line) => line.length >= 8) ||
      `${title || "주제"}에 대한 핵심 개요를 정리합니다.`;

    const bullets = lines
      .filter((line) => /^[-*•]|^\d+[.)]/.test(line) || line.length >= 12)
      .slice(0, 8)
      .map((line) => line.replace(/^[-*•]\s*/, "").replace(/^\d+[.)]\s*/, ""));

    const characteristics = [
      {
        name: "핵심 개념",
        desc1: bullets[0] || first,
        desc2: bullets[1] || "정의와 적용 범위를 명확히 기술",
      },
      {
        name: "설계/해석 포인트",
        desc1: bullets[2] || "하중·저항·파괴모드 관점 검토",
        desc2: bullets[3] || "KDS 기준 및 수치 근거를 병기",
      },
      {
        name: "실무 적용",
        desc1: bullets[4] || "시공성·유지관리·리스크를 통합 검토",
        desc2: bullets[5] || "대안 비교표와 도해 전략 포함",
      },
    ];

    const insights = [
      {
        title: "기술사 관점",
        content:
          bullets[6] ||
          "기준 준수와 시공 현실성을 동시에 만족하는 대안을 우선 제시합니다.",
      },
      {
        title: "채점 가독성",
        content:
          bullets[7] ||
          "번호형 구조 + 근거 수치 + 결론 제언의 3단 구성을 유지합니다.",
      },
    ];

    const keywordSource = `${title || ""} ${text}`
      .toLowerCase()
      .replace(/[^a-z0-9가-힣\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 2)
      .slice(0, 8);

    return {
      overview: first,
      characteristics,
      insights,
      keywords: keywordSource.join(", ") || "토목구조, 설계기준, 시공성",
      strategy:
        "문제의 정의→메커니즘→기준 근거→실무 대책→결론 제언 순서로 답안을 구성한다.",
      diagrams: [
        {
          title: "하중 전달 및 저항 메커니즘",
          content: "주요 부재/력의 흐름을 블록 다이어그램으로 제시",
        },
      ],
    };
  },

  _extractDocxKeyTokens(text = "", max = 16) {
    const stopwords = new Set([
      "그리고",
      "또한",
      "대한",
      "에서",
      "으로",
      "하는",
      "있는",
      "합니다",
      "이다",
      "문제",
      "정의",
      "검토",
      "작성",
      "기준",
      "구성",
    ]);

    const uniq = [];
    const tokens = String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9가-힣\s]/g, " ")
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 2 && !stopwords.has(w));

    for (const token of tokens) {
      if (!uniq.includes(token)) {
        uniq.push(token);
      }
      if (uniq.length >= max) break;
    }
    return uniq;
  },

  _isDocxPayloadRelevant(llmData, question = {}) {
    if (!llmData || typeof llmData !== "object") return false;

    const content = [
      llmData.overview,
      llmData.keywords,
      llmData.strategy,
      ...(Array.isArray(llmData.characteristics)
        ? llmData.characteristics.flatMap((item) => [
            item?.name,
            item?.desc1,
            item?.desc2,
          ])
        : []),
      ...(Array.isArray(llmData.insights)
        ? llmData.insights.flatMap((item) => [item?.title, item?.content])
        : []),
      ...(Array.isArray(llmData.diagrams)
        ? llmData.diagrams.flatMap((item) => [item?.title, item?.content])
        : []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (!content.trim()) return false;

    const sourceTokens = this._extractDocxKeyTokens(
      `${question?.title || ""} ${question?.rawQuestion || ""} ${question?.modelAnswer || ""}`,
      20,
    );
    if (!sourceTokens.length) return true;

    const overlap = sourceTokens.filter((token) => content.includes(token));
    const genericSignals = [
      "정의 및 핵심 개념",
      "문제의 핵심 개념을 영어 병기와 함께",
      "하중, 저항, 파괴모드를 개조식",
      "도해 1개",
      "비교표 1개",
    ];
    const genericCount = genericSignals.filter((signal) =>
      content.includes(signal),
    ).length;

    if (overlap.length >= 2) return true;
    if (overlap.length >= 1 && content.length > 600) return true;
    if (genericCount >= 2) return false;
    return overlap.length >= 1;
  },

  init() {
    console.log("Knowledge Studio Initializing...");
    this._loadDocxLogPrefs();
    this.bindEvents();
    this.render();
  },

  bindEvents() {
    // 탭 전환 이벤트
    document.querySelectorAll(".studio-tab-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    const badge = document.getElementById("docxGenerationModeBadge");
    if (badge && !badge.dataset.boundClick) {
      badge.dataset.boundClick = "1";
      badge.addEventListener("click", () => this._toggleDocxGenerationLogPanel());
    }

    const closeBtn = document.getElementById("docxGenerationLogCloseBtn");
    if (closeBtn && !closeBtn.dataset.boundClick) {
      closeBtn.dataset.boundClick = "1";
      closeBtn.addEventListener("click", () => this._toggleDocxGenerationLogPanel(false));
    }

    const filters = document.getElementById("docxGenerationLogFilters");
    if (filters && !filters.dataset.boundClick) {
      filters.dataset.boundClick = "1";
      filters.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-docx-log-filter]");
        if (!btn) return;
        const filter = btn.dataset.docxLogFilter || "all";
        this._setDocxGenerationFilter(filter);
      });
    }

    const pinBtn = document.getElementById("docxPinErrorBtn");
    if (pinBtn && !pinBtn.dataset.boundClick) {
      pinBtn.dataset.boundClick = "1";
      pinBtn.addEventListener("click", () => this._toggleDocxPinErrorFirst());
    }

    const copySummaryBtn = document.getElementById("docxCopySummaryBtn");
    if (copySummaryBtn && !copySummaryBtn.dataset.boundClick) {
      copySummaryBtn.dataset.boundClick = "1";
      copySummaryBtn.addEventListener("click", () => this._copyTopDocxLogSummary());
    }

    const logBody = document.getElementById("docxGenerationLogBody");
    if (logBody && !logBody.dataset.boundClick) {
      logBody.dataset.boundClick = "1";
      logBody.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-copy-value]");
        if (!btn) return;
        const value = btn.getAttribute("data-copy-value") || "";
        this._copyTextToClipboard(value);
      });
    }

    this._syncDocxLogFilterUi();
    this._syncDocxPinUi();
  },

  switchTab(tab) {
    this.currentTab = tab;
    // UI 업데이트
    document.querySelectorAll(".studio-tab-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tab);
    });

    // 섹션 표시 전환
    document
      .getElementById("studio-answers-view")
      .classList.toggle("hidden", tab !== "answers");
    document
      .getElementById("studio-theory-view")
      .classList.toggle("hidden", tab !== "theory");

    this.render();
  },

  /**
   * 공통 저장/수정 로직
   * @param {string} type 'questions' | 'theories'
   */
  async saveEntry(type) {
    const data =
      typeof window.getCurrentAnswerData === "function"
        ? window.getCurrentAnswerData()
        : { questions: [], theories: [] };
    if (!Array.isArray(data.questions)) data.questions = [];
    if (!Array.isArray(data.theories)) data.theories = [];
    const formId = type === "questions" ? "answerForm" : "theoryForm";
    const form = document.getElementById(formId);

    if (!form) return;

    const formData = new FormData(form);
    const entry = Object.fromEntries(formData.entries());

    // 태그 처리
    if (entry.tags) {
      entry.tags = entry.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }

    const editingIndex = document.getElementById(`editing-${type}-index`).value;

    if (editingIndex !== "") {
      data[type][parseInt(editingIndex)] = {
        ...data[type][parseInt(editingIndex)],
        ...entry,
      };
      window.setDataStatus(
        `${type === "questions" ? "답안" : "이론"} 수정 완료`,
        "success",
      );
    } else {
      entry.id =
        type === "questions"
          ? `Q${data[type].length + 1}`
          : `TH-${String(data[type].length + 1).padStart(3, "0")}`;
      data[type].push(entry);
      window.setDataStatus(
        `${type === "questions" ? "답안" : "이론"} 추가 완료`,
        "success",
      );
    }

    this.resetForm(type);
    window.syncJsonAndRender(data);
  },

  editEntry(type, index) {
    const data =
      typeof window.getCurrentAnswerData === "function"
        ? window.getCurrentAnswerData()
        : { questions: [], theories: [] };
    const item = (data[type] || [])[index];
    if (!item) return;

    const prefix = type === "questions" ? "q" : "t";
    // 폼 필드 채우기 (HTML 구조에 맞춰 ID 매칭 필요)
    for (const key in item) {
      const el = document.getElementById(`studio-${prefix}-${key}`);
      if (el) {
        if (el.type === "checkbox") el.checked = !!item[key];
        else if (Array.isArray(item[key])) el.value = item[key].join(", ");
        else el.value = item[key];
      }
    }

    document.getElementById(`editing-${type}-index`).value = index;
    const btn = document.getElementById(`studio-${type}-submit-btn`);
    if (btn) btn.textContent = "수정 저장";

    window.setDataStatus(`${item.id} 수정 모드`, "info");
  },

  deleteEntry(type, index) {
    // pendingDeleteIndex/Type 설정 후 공통 모달 사용 (UX 일관성)
    window._pendingStudioDeleteType = type;
    window._pendingStudioDeleteIndex = index;
    const modal = document.getElementById("deleteConfirmModal");
    if (modal) {
      modal.classList.remove("hidden");
      modal.classList.add("flex");
    } else {
      // 폴백: 모달이 없을 때만 브라우저 confirm 사용
      if (!confirm("정말 삭제하시겠습니까?")) return;
      const data =
        typeof window.getCurrentAnswerData === "function"
          ? window.getCurrentAnswerData()
          : { questions: [], theories: [] };
      const removed = (data[type] || []).splice(index, 1)[0];
      window.syncJsonAndRender(data, `${removed.id} 삭제 완료`);
    }
  },

  resetForm(type) {
    const formId = type === "questions" ? "answerForm" : "theoryForm";
    const form = document.getElementById(formId);
    if (form) form.reset();

    document.getElementById(`editing-${type}-index`).value = "";
    const btn = document.getElementById(`studio-${type}-submit-btn`);
    if (btn) btn.textContent = type === "questions" ? "답안 추가" : "이론 추가";
  },

  async generateProfessionalDocx() {
    const title = document.getElementById("studio-q-title").value;
    const examRound = document.getElementById("studio-q-examRound").value;
    const qId = document.getElementById("studio-q-id").value;
    const modelAnswerText = String(
      document.getElementById("studio-q-modelAnswer")?.value || "",
    ).trim();

    if (!title) {
      window.showToast("문제 제목을 먼저 입력해주세요.", "error");
      return;
    }

    try {
      this._setDocxGenerationModeBadge("idle", "생성 준비");
      this._pushDocxGenerationTrace({
        mode: "idle",
        detail: "생성 준비",
        title,
      });
      window.setDataStatus("AI 전문 초안 생성 중...", "info");

      // 1. AI에게서 구조화된 JSON 데이터 획득
      const question = {
        title,
        examRound,
        qId,
        rawQuestion: title,
        modelAnswer: modelAnswerText,
      };

      if (!modelAnswerText || modelAnswerText.length < 20) {
        window.showToast(
          "모범 답안 본문이 짧아 일반 템플릿 문구가 생성될 수 있습니다. 본문을 먼저 보강하세요.",
          "info",
        );
      }

      const aiResult = await window.generateAnswer(
        question,
        [
          "전문 서브노트용 JSON만 반환하십시오. 다른 설명 문장은 금지.",
          "필수 키: overview(string), characteristics(array), insights(array), keywords(string), strategy(string)",
          "권장 키: diagrams(array)",
          "characteristics 원소 키: name, desc1, desc2",
          "insights 원소 키: title, content",
          "반드시 문제 제목과 모범답안 본문의 핵심 키워드를 반영할 것",
          "추상적 템플릿 문구(예: 정의 및 핵심 개념, 도해 1개 등)만 반복하지 말고 실제 내용으로 구체화할 것",
          "특성/소견에는 최소 1개 이상 구체 용어(재료/거동/기준/리스크)를 포함할 것",
        ].join("\n"),
        "json",
      );

      if (!aiResult || !aiResult.answer) {
        throw new Error("AI 답안 생성에 실패했습니다.");
      }

      let llmData = aiResult.answer;
      let usedFallback = false;
      if (typeof llmData === "string") {
        try {
          const cleanJson = this._extractJsonCandidate(llmData);
          llmData = JSON.parse(cleanJson);
          this._setDocxGenerationModeBadge("json");
          this._pushDocxGenerationTrace({
            mode: "json",
            detail: "AI JSON 파싱 성공",
            title,
          });
        } catch (e) {
          console.warn("JSON Parsing Error. Fallback to structured text:", e);
          llmData = this._buildDocxFallbackFromText(llmData, title);
          usedFallback = true;
          this._setDocxGenerationModeBadge("fallback", "JSON 파싱 실패");
          this._pushDocxGenerationTrace({
            mode: "fallback",
            detail: "JSON 파싱 실패",
            title,
          });
        }
      }

      if (!llmData || typeof llmData !== "object") {
        llmData = this._buildDocxFallbackFromText(String(aiResult.answer || ""), title);
        usedFallback = true;
        this._setDocxGenerationModeBadge("fallback", "응답 비정형");
        this._pushDocxGenerationTrace({
          mode: "fallback",
          detail: "응답 비정형",
          title,
        });
      }

      const fallbackSeed = `${question.rawQuestion || ""}\n${question.modelAnswer || ""}`.trim();
      if (!this._isDocxPayloadRelevant(llmData, question)) {
        llmData = this._buildDocxFallbackFromText(
          fallbackSeed || String(aiResult.answer || ""),
          title,
        );
        usedFallback = true;
        this._setDocxGenerationModeBadge("fallback", "문제 연관도 보정");
        this._pushDocxGenerationTrace({
          mode: "fallback",
          detail: "문제 연관도 낮아 본문 기반 보정",
          title,
        });
      }

      window.setDataStatus("DOCX 파일 변환 중...", "info");

      // 2. 백엔드 브릿지를 통한 Word 문서 생성
      const examNoMatch = (examRound || "").match(/(\d+)/);
      const examNo = examNoMatch ? parseInt(examNoMatch[1]) : 120;
      const period = 1; // 기본값
      const qNumMatch = (qId || "").match(/(\d+)/);
      const qNum = qNumMatch ? parseInt(qNumMatch[1]) : 1;

      const payload = {
        title,
        exam_no: examNo,
        period,
        q_num: qNum,
        llm_data: llmData,
      };

      const docxResult = await window.requestDocxGeneration(payload);

      if (docxResult?.ok) {
        if (!usedFallback) {
          this._setDocxGenerationModeBadge("json");
        }
        this._pushDocxGenerationTrace({
          mode: usedFallback ? "fallback" : "json",
          detail: usedFallback ? "폴백 기반 생성 완료" : "JSON 기반 생성 완료",
          filename: docxResult.filename || "",
          title,
        });
        window.setDataStatus(
          `서브노트 생성 완료: ${docxResult.filename}`,
          "success",
        );
        window.showToast(
          `전문 서브노트가 생성되었습니다: ${docxResult.filename}`,
          "success",
        );

        if (
          docxResult.path &&
          typeof window.requestRevealInExplorer === "function"
        ) {
          try {
            await window.requestRevealInExplorer(docxResult.path);
            window.showToast("생성된 파일 위치를 열었습니다.", "info");
          } catch (revealError) {
            console.warn("DOCX 위치 열기 실패:", revealError);
            this._pushDocxGenerationTrace({
              mode: "error",
              detail: `파일 생성 성공, 위치 열기 실패: ${revealError?.message || "unknown"}`,
              filename: docxResult.filename || "",
              title,
            });
          }
        }
      } else {
        throw new Error(docxResult?.error || "DOCX 생성 실패");
      }
    } catch (error) {
      console.error("DOCX Generate Error:", error);
      this._setDocxGenerationModeBadge("error", error?.message || "unknown");
      this._pushDocxGenerationTrace({
        mode: "error",
        detail: error?.message || "unknown",
        title,
      });
      window.setDataStatus("서브노트 생성 오류", "error");
      window.showToast("오류 발생: " + error.message, "error");
    }
  },

  render() {
    // 필터링 및 리스트 렌더링 로직 (기본 renderAnswerData 호출 등)
    const data =
      typeof window.getCurrentAnswerData === "function"
        ? window.getCurrentAnswerData()
        : window.App.State;
    window.renderAnswerData(data);
  },
};

window.Studio = Studio;
