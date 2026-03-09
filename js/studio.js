/**
 * SolveCivil Answer Studio - Knowledge Studio Module
 * @version 1.0.0
 */

const Studio = {
  currentTab: "answers", // 'answers' or 'theory'
  LAST_DOCX_META_KEY: "solve_last_generated_docx_v1",
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
    const isNoiseLine = (line) => {
      const src = String(line || "").trim();
      if (!src) return true;
      if (/^\[심화\s*보강/i.test(src)) return true;
      if (/^-\s*요청사항\s*:/i.test(src)) return true;
      if (/^-\s*탐색소스\s*:/i.test(src)) return true;
      if (/^근거첨부$/i.test(src)) return true;
      if (/^\|\s*단계\s*\|\s*소스\s*\|\s*핵심근거\s*\|\s*답안\s*적용\s*\|/i.test(src)) return true;
      if (/^\|---\|---\|---\|---\|/.test(src)) return true;
      if (/^\|\s*[1-5]\s*\|/.test(src)) return true;
      if (/^\d+\)\s*(저장|notebooklm|flowith|인터넷\s*딥리서치|통합정리)/i.test(src)) return true;
      return false;
    };

    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !isNoiseLine(line));

    const cleanedText = lines.join("\n").trim();

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

    const keywordSource = `${title || ""} ${cleanedText || text}`
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
          content:
            "도해 목적: 하중 작용점→저항 경로를 한눈에 제시\n" +
            "구성 요소: 작용하중, 지점반력, 주요 부재(압축/인장 경로), 경계조건\n" +
            "작성 순서: 1) 외곽/경계조건 2) 하중·반력 3) 내부 힘 흐름 화살표\n" +
            "채점 포인트: 용어 표기 일치, 경로 방향성, 핵심 위험구간 표시",
        },
        {
          title: "설계 대안 비교표",
          content:
            "도해 목적: 대안별 장단점/리스크를 표 형태로 비교\n" +
            "구성 요소: 비교항목(안전성·시공성·경제성·유지관리성), 대안 A/B\n" +
            "작성 순서: 1) 비교항목 정의 2) 대안별 점검결과 3) 최종 권고안\n" +
            "채점 포인트: 기준 근거 명시, 결론의 정합성, 실무 제언 연결",
        },
      ],
    };
  },

  _sanitizeDocxAnswerText(rawText = "") {
    const lines = String(rawText || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !/시각화\s*요약/i.test(line))
      .filter((line) => !/^\d+\)\s*(그림|표|그래프)\s*[:：]/i.test(line))
      .filter((line) => !/^[-*•]\s*(목적|작성\s*기준|채점\s*포인트)\s*[:：]/i.test(line));

    return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  },

  _buildRequiredVisualsForQuestion(question = {}, incomingVisuals = []) {
    const seed = `${String(question?.title || "")} ${String(question?.rawQuestion || "")}`.toLowerCase();
    const isDRegion = /d-region|응력\s*교란|응력교란|스트럿|타이|stm/.test(seed);
    const sourceRows = Array.isArray(incomingVisuals) ? incomingVisuals : [];

    if (!isDRegion) {
      return sourceRows;
    }

    const urlPool = sourceRows
      .map((row) => String(row?.imageUrl || "").trim())
      .filter(Boolean);

    let cursor = 0;
    const pickUrl = () => {
      if (cursor >= urlPool.length) return "";
      return urlPool[cursor++];
    };

    return [
      {
        kind: "diagram",
        title: "하중점→지점 하중경로 및 Strut·Tie·Node 도해",
        purpose: "하중 전달 경로와 Strut(압축)·Tie(인장)·Node를 시각적으로 제시",
        spec: "요소: 하중점, 지점, Strut(압축), Tie(인장), Node | 표현: 하중/내부력 화살표(→) | 판독 포인트: 지배 파괴모드와 보강상세 연결",
        scoringPoint: "STM 핵심 메커니즘을 빠르게 판독 가능하게 제시",
        imageUrl: pickUrl(),
      },
      {
        kind: "image",
        title: "D-Region과 B-Region 경계 단면 도해",
        purpose: "D-Region/B-Region 경계를 단면도에 함께 표시하여 적용 해석법 차이를 제시",
        spec: "요소: 단면 경계, D/B 구역, 재하점·지점 | 표현: 경계선/해칭 + 주석 | 판독 포인트: 영역별 해석 접근 차이",
        scoringPoint: "경계 설정과 적용 해석법의 정합성 확보",
        imageUrl: pickUrl(),
      },
      {
        kind: "image",
        title: "B-Region vs D-Region 해석가정·절차·오류위험 비교표 이미지",
        purpose: "B-Region(선형변형률 가정)과 D-Region(STM 적용)의 해석 차이를 비교표로 제시",
        spec: "열: 구분 | B-Region | D-Region | 행: 해석가정, 설계절차, 오류위험",
        scoringPoint: "해석가정·절차·오류위험 비교를 통한 적용 근거 명확화",
        imageUrl: pickUrl(),
      },
    ];
  },

  _ensureDocxDiagramRule(content = "") {
    const source = String(content || "").trim();
    const lines = source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const base = lines.join("\n");

    const required = [
      {
        label: "도해 목적",
        fallback: "핵심 메커니즘을 빠르게 전달",
      },
      {
        label: "구성 요소",
        fallback: "하중·저항·경계조건·핵심 부재",
      },
      {
        label: "작성 순서",
        fallback: "1) 외곽 2) 하중/반력 3) 내부 경로/레이블",
      },
      {
        label: "채점 포인트",
        fallback: "기준 용어 일치, 수치/근거, 결론 연결",
      },
    ];

    const appended = [...lines];
    for (const item of required) {
      const hasLabel = new RegExp(`${item.label}\\s*:`, "i").test(base);
      if (!hasLabel) {
        appended.push(`${item.label}: ${item.fallback}`);
      }
    }
    return appended.join("\n").trim();
  },

  _enforceDocxVisualizationRules(llmData, question = {}) {
    const safe = llmData && typeof llmData === "object" ? { ...llmData } : {};
    const topicSeed =
      String(question?.title || "").trim() || "핵심 구조 메커니즘";

    const fallbackDiagrams = [
      {
        title: `${topicSeed} 메커니즘 도해`,
        content:
          "도해 목적: 문제의 하중-저항 흐름을 시각화\n" +
          "구성 요소: 작용하중, 지점반력, 주요 부재, 위험 구간\n" +
          "작성 순서: 1) 형상/경계조건 2) 하중·반력 3) 응력·힘 흐름\n" +
          "채점 포인트: 핵심 용어 표기, 방향성, 결론과의 연결",
      },
      {
        title: `${topicSeed} 대안 비교표`,
        content:
          "도해 목적: 대안별 설계 판단근거를 표로 비교\n" +
          "구성 요소: 비교항목(안전성·시공성·경제성·유지관리성), 대안 A/B\n" +
          "작성 순서: 1) 비교항목 설정 2) 대안별 평가 3) 권고안 도출\n" +
          "채점 포인트: 기준 근거, 트레이드오프 설명, 실무 제언",
      },
    ];

    const incoming = Array.isArray(safe.diagrams) ? safe.diagrams : [];
    const normalized = incoming
      .map((item, idx) => {
        const rawTitle = String(item?.title || "").trim();
        const title = rawTitle || `도해 ${idx + 1}`;
        const content = this._ensureDocxDiagramRule(item?.content || "");
        if (!content) return null;
        return { title, content };
      })
      .filter(Boolean);

    while (normalized.length < 2) {
      const seed = fallbackDiagrams[normalized.length] || fallbackDiagrams[0];
      normalized.push({
        title: seed.title,
        content: this._ensureDocxDiagramRule(seed.content),
      });
    }

    safe.diagrams = normalized.slice(0, 4);
    return safe;
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

  _isWeakDocxAnswerText(text = "", question = {}) {
    const source = String(text || "").trim().toLowerCase();
    if (!source) return true;

    const genericSignals = [
      "정의 및 핵심 개념",
      "문제의 핵심 개념을 영어 병기와 함께",
      "하중, 저항, 파괴모드를 개조식",
      "도해 1개",
      "비교표 1개",
    ];

    const genericCount = genericSignals.filter((s) => source.includes(s)).length;
    if (genericCount >= 2) {
      return true;
    }

    const tokens = this._extractDocxKeyTokens(
      `${question?.title || ""} ${question?.rawQuestion || ""} ${question?.modelAnswer || ""}`,
      20,
    );
    if (!tokens.length) return false;
    const overlap = tokens.filter((t) => source.includes(t)).length;
    return overlap < 1;
  },

  init() {
    console.log("Knowledge Studio Initializing...");
    this._loadDocxLogPrefs();
    this.bindEvents();
    this.updatePdfAreaView();
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

    this.updatePdfAreaView();

    this.render();
  },

  updatePdfAreaView() {
    const pdfContainer = document.getElementById("pdfVisualWorkspaceContainer");
    const theoryPanel = document.getElementById("theoryManagerPdfListPanel");
    const answerPanel = document.getElementById("answerManagerPdfListPanel");
    if (!pdfContainer || !theoryPanel || !answerPanel) {
      return;
    }

    const isTheoryManagerMode = !!window.__theoryManagerMode;
    const isAnswerManagerMode = !!window.__answerManagerMode;
    const shouldShowTheoryList =
      isTheoryManagerMode && this.currentTab === "theory";
    const shouldShowAnswerList =
      isAnswerManagerMode && this.currentTab === "answers";
    const shouldHidePdf = shouldShowTheoryList || shouldShowAnswerList;

    pdfContainer.classList.toggle("hidden", shouldHidePdf);
    theoryPanel.classList.toggle("hidden", !shouldShowTheoryList);
    answerPanel.classList.toggle("hidden", !shouldShowAnswerList);

    if (
      shouldShowTheoryList &&
      typeof window.getCurrentAnswerData === "function" &&
      typeof window.renderTheoryDataForPdfPanel === "function"
    ) {
      const data = window.getCurrentAnswerData();
      window.renderTheoryDataForPdfPanel(data.theories || []);
    }

    if (
      shouldShowAnswerList &&
      typeof window.getCurrentAnswerData === "function" &&
      typeof window.renderAnswerDataForManagerPanel === "function"
    ) {
      const data = window.getCurrentAnswerData();
      window.renderAnswerDataForManagerPanel(data.questions || []);
    }
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

    const currentData =
      typeof window.getCurrentAnswerData === "function"
        ? window.getCurrentAnswerData()
        : { questions: [] };
    const questions = Array.isArray(currentData?.questions)
      ? currentData.questions
      : [];
    const editingIndex = Number(
      document.getElementById("editing-questions-index")?.value,
    );

    let matchedQuestion = null;
    if (Number.isInteger(editingIndex) && editingIndex >= 0 && questions[editingIndex]) {
      matchedQuestion = questions[editingIndex];
    }
    if (!matchedQuestion && qId) {
      matchedQuestion =
        questions.find((item) => String(item?.id || "").trim() === String(qId).trim()) ||
        null;
    }
    if (!matchedQuestion && title) {
      matchedQuestion =
        questions.find((item) => String(item?.title || "").trim() === String(title).trim()) ||
        null;
    }

    const latestAnswerFromData = String(matchedQuestion?.modelAnswer || "").trim();
    const effectiveModelAnswer =
      latestAnswerFromData.length > modelAnswerText.length
        ? latestAnswerFromData
        : modelAnswerText;
    const effectiveRawQuestion = String(matchedQuestion?.rawQuestion || title || "").trim();

    const insightSummary = String(window.latestAttachmentInsight?.summary || "").trim();
    const insightBoost = String(window.latestAttachmentInsight?.answerBoost || "").trim();
    const userBoostRequest = String(
      document.getElementById("attachmentBoostUserRequest")?.value || "",
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
        rawQuestion: effectiveRawQuestion || title,
        modelAnswer: effectiveModelAnswer,
      };

      if (!effectiveModelAnswer || effectiveModelAnswer.length < 20) {
        window.showToast(
          "모범 답안 본문이 짧아 일반 템플릿 문구가 생성될 수 있습니다. 본문을 먼저 보강하세요.",
          "info",
        );
      }

      const aiResult = await window.generateAnswer(
        question,
        [
          "전문 서브노트용 JSON만 반환하십시오. 다른 설명 문장은 금지.",
          "메타 지시문체(예: 작성합니다/포함합니다/제시합니다)는 금지하고, 문제를 직접 푸는 답안 문장으로 작성할 것",
          "필수 키: overview(string), characteristics(array), insights(array), keywords(string), strategy(string)",
          "권장 키: diagrams(array)",
          "characteristics 원소 키: name, desc1, desc2",
          "insights 원소 키: title, content",
          "반드시 문제 제목과 모범답안 본문의 핵심 키워드를 반영할 것",
          "추상적 템플릿 문구(예: 정의 및 핵심 개념, 도해 1개 등)만 반복하지 말고 실제 내용으로 구체화할 것",
          "특성/소견에는 최소 1개 이상 구체 용어(재료/거동/기준/리스크)를 포함할 것",
          insightSummary ? `[첨부 인사이트 요약]\n${insightSummary}` : "",
          insightBoost ? `[첨부 인사이트 answerBoost]\n${insightBoost}` : "",
          userBoostRequest ? `[사용자 보강 요청]\n${userBoostRequest}` : "",
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
          const fallbackSeed = [
            String(question.rawQuestion || "").trim(),
            String(question.modelAnswer || "").trim(),
            String(llmData || "").trim(),
            insightSummary,
            insightBoost,
          ]
            .filter(Boolean)
            .join("\n\n");
          llmData = this._buildDocxFallbackFromText(fallbackSeed || llmData, title);
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
        const fallbackSeed = [
          String(question.rawQuestion || "").trim(),
          String(question.modelAnswer || "").trim(),
          String(aiResult.answer || "").trim(),
          insightSummary,
          insightBoost,
        ]
          .filter(Boolean)
          .join("\n\n");
        llmData = this._buildDocxFallbackFromText(fallbackSeed || String(aiResult.answer || ""), title);
        usedFallback = true;
        this._setDocxGenerationModeBadge("fallback", "응답 비정형");
        this._pushDocxGenerationTrace({
          mode: "fallback",
          detail: "응답 비정형",
          title,
        });
      }

      if (typeof aiResult?.answer === "string" && this._isWeakDocxAnswerText(aiResult.answer, question)) {
        const fallbackSeed = [
          String(question.rawQuestion || "").trim(),
          String(question.modelAnswer || "").trim(),
          insightSummary,
          insightBoost,
        ]
          .filter(Boolean)
          .join("\n\n");
        llmData = this._buildDocxFallbackFromText(fallbackSeed || String(aiResult.answer || ""), title);
        usedFallback = true;
        this._setDocxGenerationModeBadge("fallback", "저품질 응답 보정");
        this._pushDocxGenerationTrace({
          mode: "fallback",
          detail: "저품질/일반 템플릿 응답을 본문 기반으로 보정",
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

      llmData = this._enforceDocxVisualizationRules(llmData, question);

      const normalizedVisuals = Array.isArray(aiResult?.visuals)
        ? aiResult.visuals
        : Array.isArray(llmData?.visuals)
          ? llmData.visuals
          : [];

      const requiredVisuals = this._buildRequiredVisualsForQuestion(
        question,
        normalizedVisuals,
      );

      if (Array.isArray(requiredVisuals) && requiredVisuals.length) {
        llmData.visuals = requiredVisuals
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            return {
              kind: String(item.kind || "diagram").toLowerCase(),
              title: String(item.title || "시각자료").trim(),
              purpose: String(item.purpose || "").trim(),
              spec: String(item.spec || "").trim(),
              scoringPoint: String(item.scoringPoint || "").trim(),
              imageUrl: String(item.imageUrl || "").trim(),
            };
          })
          .filter(Boolean)
          .slice(0, 6);
      }

      window.setDataStatus("DOCX 파일 변환 중...", "info");

      // 2. 백엔드 브릿지를 통한 Word 문서 생성
      const examNoMatch = (examRound || "").match(/(\d+)/);
      const examNo = examNoMatch ? parseInt(examNoMatch[1]) : 120;
      const period = 1; // 기본값
      const qNumMatch = (qId || "").match(/(\d+)/);
      const qNum = qNumMatch ? parseInt(qNumMatch[1]) : 1;

      const sanitizedAnswerText = this._sanitizeDocxAnswerText(
        question.modelAnswer || "",
      );

      const payload = {
        title,
        exam_no: examNo,
        period,
        q_num: qNum,
        docx_style: "submission",
        raw_question: question.rawQuestion || "",
        answer_text: sanitizedAnswerText,
        llm_data: llmData,
      };

      const docxResult = await window.requestDocxGeneration(payload);

      if (docxResult?.ok) {
        try {
          const payload = {
            filename: docxResult.filename || "",
            path: docxResult.path || "",
            title,
            examRound: examRound || "",
            updatedAt: new Date().toISOString(),
          };
          const storage = window.safeLocalStorage || localStorage;
          storage.setItem(this.LAST_DOCX_META_KEY, JSON.stringify(payload));
          window.dispatchEvent(
            new CustomEvent("solve:last-docx-updated", { detail: payload }),
          );
        } catch (metaError) {
          console.warn("최근 DOCX 메타 저장 실패:", metaError);
        }

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
          typeof window.requestOpenInDefaultApp === "function"
        ) {
          try {
            await window.requestOpenInDefaultApp(docxResult.path);
            window.showToast("생성된 DOCX 파일을 열었습니다.", "success");
          } catch (openError) {
            console.warn("DOCX 파일 열기 실패:", openError);
            this._pushDocxGenerationTrace({
              mode: "error",
              detail: `파일 생성 성공, 열기 실패: ${openError?.message || "unknown"}`,
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
