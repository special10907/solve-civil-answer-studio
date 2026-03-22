import UIStatus from './ui-status.module.js';
const { showToast } = UIStatus;

/**
 * Studio DOCX Module
 * Handles DOCX generation logging, tracing, and user preferences.
 */
const StudioDocx = {
  LAST_DOCX_META_KEY: "solve_last_generated_docx_v1",
  docxGenerationTrace: [],
  docxGenerationFilter: "all",
  docxPinErrorFirst: false,
  DOCX_LOG_PREFS_SCHEMA_VERSION: 2,
  DOCX_LOG_PREFS_KEY: "solve_studio_docx_log_prefs_v2",
  DOCX_LOG_PREFS_LEGACY_KEYS: ["solve_studio_docx_log_prefs_v1"],

  init() {
    this._loadDocxLogPrefs();
  },

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

  syncDocxLogFilterUi() {
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

  setDocxGenerationFilter(filter = "all") {
    this.docxGenerationFilter = filter;
    this._saveDocxLogPrefs();
    this.syncDocxLogFilterUi();
    this.renderDocxGenerationLogPanel();
  },

  syncDocxPinUi() {
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

  toggleDocxPinErrorFirst() {
    this.docxPinErrorFirst = !this.docxPinErrorFirst;
    this._saveDocxLogPrefs();
    this.syncDocxPinUi();
    this.renderDocxGenerationLogPanel();
  },

  formatDocxTraceTime(ts) {
    const date = ts instanceof Date ? ts : new Date(ts);
    if (Number.isNaN(date.getTime())) return "시간정보 없음";
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    const ss = String(date.getSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  },

  buildDocxLogSummaryLine(log = {}) {
    const mode = String(log.mode || "idle").toUpperCase();
    const time = this.formatDocxTraceTime(log.timestamp);
    const title = String(log.title || "-").trim();
    const filename = String(log.filename || "-").trim();
    const detail = String(log.detail || "-").trim();
    return `[${time}] ${mode} | 제목=${title} | 파일=${filename} | 상세=${detail}`;
  },

  copyTopDocxLogSummary() {
    const filtered = this.docxGenerationTrace.filter((log) =>
      this._canShowByFilter(String(log.mode || "idle")),
    );
    if (!filtered.length) {
      showToast("복사할 로그가 없습니다.", "info");
      return;
    }
    const sorted = this.docxPinErrorFirst
      ? [...filtered].sort((a, b) => {
          const ae = String(a.mode || "") === "error" ? 1 : 0;
          const be = String(b.mode || "") === "error" ? 1 : 0;
          return be - ae;
        })
      : filtered;
    this.copyTextToClipboard(this.buildDocxLogSummaryLine(sorted[0]));
  },

  async copyTextToClipboard(text) {
    const content = String(text || "").trim();
    if (!content) {
      showToast("복사할 내용이 없습니다.", "info");
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
      showToast("클립보드에 복사했습니다.", "success");
    } catch (e) {
      console.warn("Clipboard copy failed:", e);
      showToast("복사 실패: 브라우저 권한을 확인하세요.", "error");
    }
  },

  pushDocxGenerationTrace(entry = {}) {
    this.docxGenerationTrace.unshift({
      mode: entry.mode || "idle",
      detail: entry.detail || "",
      filename: entry.filename || "",
      title: entry.title || "",
      timestamp: new Date(),
    });
    this.docxGenerationTrace = this.docxGenerationTrace.slice(0, 10);
    this.renderDocxGenerationLogPanel();
  },

  renderDocxGenerationLogPanel() {
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
              <span class="text-[10px] text-slate-500 font-mono">${this.formatDocxTraceTime(log.timestamp)}</span>
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

  toggleDocxGenerationLogPanel(forceOpen) {
    const panel = document.getElementById("docxGenerationLogPanel");
    if (!panel) return;
    const shouldOpen =
      typeof forceOpen === "boolean"
        ? forceOpen
        : panel.classList.contains("hidden");

    panel.classList.toggle("hidden", !shouldOpen);
    if (shouldOpen) {
      this.syncDocxLogFilterUi();
      this.syncDocxPinUi();
      this.renderDocxGenerationLogPanel();
    }
  },

  setDocxGenerationModeBadge(mode = "idle", detail = "") {
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
    const effectiveRawQuestion = String(matchedQuestion?.rawQuestion || title || "").trim();
    const formQuestionCtx = {
      title,
      rawQuestion: effectiveRawQuestion || title,
    };

    const AI = window.StudioModules.AI;
    const Visual = window.StudioModules.Visual;

    const formAnswerRelevant = AI.isAnswerRelevantToQuestion(
      modelAnswerText,
      formQuestionCtx,
    );
    const dataAnswerRelevant = AI.isAnswerRelevantToQuestion(
      latestAnswerFromData,
      formQuestionCtx,
    );
    const effectiveModelAnswer = formAnswerRelevant
      ? modelAnswerText
      : dataAnswerRelevant
        ? latestAnswerFromData
        : "";

    const insightSummary = String(window.latestAttachmentInsight?.summary || "").trim();
    const insightBoost = String(window.latestAttachmentInsight?.answerBoost || "").trim();
    const userBoostRequest = String(
      document.getElementById("attachmentBoostUserRequest")?.value || "",
    ).trim();

    if (!title) {
      showToast("문제 제목을 먼저 입력해주세요.", "error");
      return;
    }

    try {
      this.setDocxGenerationModeBadge("idle", "생성 준비");
      this.pushDocxGenerationTrace({
        mode: "idle",
        detail: "생성 준비",
        title,
      });
      if (window.setDataStatus) window.setDataStatus("AI 전문 초안 생성 중...", "info");

      // 1. AI에게서 구조화된 JSON 데이터 획득
      const question = {
        title,
        examRound,
        qId,
        rawQuestion: effectiveRawQuestion || title,
        modelAnswer: effectiveModelAnswer,
      };

      if (!effectiveModelAnswer || effectiveModelAnswer.length < 20) {
        showToast(
          "현재 문항과 연관된 모범답안이 부족하여, 문제 본문 중심으로 새로 생성합니다.",
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
          const cleanJson = AI.extractJsonCandidate(llmData);
          llmData = JSON.parse(cleanJson);
          this.setDocxGenerationModeBadge("json");
          this.pushDocxGenerationTrace({
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
          llmData = AI.buildDocxFallbackFromText(fallbackSeed || llmData, title);
          usedFallback = true;
          this.setDocxGenerationModeBadge("fallback", "JSON 파싱 실패");
          this.pushDocxGenerationTrace({
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
        llmData = AI.buildDocxFallbackFromText(fallbackSeed || String(aiResult.answer || ""), title);
        usedFallback = true;
        this.setDocxGenerationModeBadge("fallback", "응답 비정형");
        this.pushDocxGenerationTrace({
          mode: "fallback",
          detail: "응답 비정형",
          title,
        });
      }

      llmData = AI.sanitizeDocxJsonPayload(llmData);

      if (AI.hasDocxPollutionSignals(llmData)) {
        const fallbackSeed = [
          String(question.rawQuestion || "").trim(),
          String(question.modelAnswer || "").trim(),
          insightSummary,
          insightBoost,
        ]
          .filter(Boolean)
          .join("\n\n");
        llmData = AI.buildDocxFallbackFromText(
          fallbackSeed || String(aiResult.answer || ""),
          title,
        );
        usedFallback = true;
        this.setDocxGenerationModeBadge("fallback", "오염 신호 보정");
        this.pushDocxGenerationTrace({
          mode: "fallback",
          detail: "메타/근거 로그 오염 신호 감지로 본문 기반 보정",
          title,
        });
      }

      if (typeof aiResult?.answer === "string" && AI.isWeakDocxAnswerText(aiResult.answer, question)) {
        const fallbackSeed = [
          String(question.rawQuestion || "").trim(),
          String(question.modelAnswer || "").trim(),
          insightSummary,
          insightBoost,
        ]
          .filter(Boolean)
          .join("\n\n");
        llmData = AI.buildDocxFallbackFromText(fallbackSeed || String(aiResult.answer || ""), title);
        usedFallback = true;
        this.setDocxGenerationModeBadge("fallback", "저품질 응답 보정");
        this.pushDocxGenerationTrace({
          mode: "fallback",
          detail: "저품질/일반 템플릿 응답을 본문 기반으로 보정",
          title,
        });
      }

      const fallbackSeed = `${question.rawQuestion || ""}\n${question.modelAnswer || ""}`.trim();
      if (!AI.isDocxPayloadRelevant(llmData, question)) {
        llmData = AI.buildDocxFallbackFromText(
          fallbackSeed || String(aiResult.answer || ""),
          title,
        );
        usedFallback = true;
        this.setDocxGenerationModeBadge("fallback", "문제 연관도 보정");
        this.pushDocxGenerationTrace({
          mode: "fallback",
          detail: "문제 연관도 낮아 본문 기반 보정",
          title,
        });
      }

      llmData = Visual.enforceDocxVisualizationRules(llmData, question);

      const normalizedVisuals = Array.isArray(aiResult?.visuals)
        ? aiResult.visuals
        : Array.isArray(llmData?.visuals)
          ? llmData.visuals
          : [];

      const requiredVisuals = Visual.buildRequiredVisualsForQuestion(
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

      if (window.setDataStatus) window.setDataStatus("DOCX 파일 변환 중...", "info");

      // 2. 백엔드 브릿지를 통한 Word 문서 생성
      const examNoMatch = (examRound || "").match(/(\d+)/);
      const examNo = examNoMatch ? parseInt(examNoMatch[1]) : 120;
      const period = 1; // 기본값
      const qNumMatch = (qId || "").match(/(\d+)/);
      const qNum = qNumMatch ? parseInt(qNumMatch[1]) : 1;

      const sanitizedAnswerText = AI.sanitizeDocxAnswerByQuestion ? 
        AI.sanitizeDocxAnswerByQuestion(question.modelAnswer || "", question) :
        question.modelAnswer || "";

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
          const metaPayload = {
            filename: docxResult.filename || "",
            path: docxResult.path || "",
            title,
            examRound: examRound || "",
            updatedAt: new Date().toISOString(),
          };
          const storage = window.safeLocalStorage || localStorage;
          storage.setItem(this.LAST_DOCX_META_KEY, JSON.stringify(metaPayload));
          window.dispatchEvent(
            new CustomEvent("solve:last-docx-updated", { detail: metaPayload }),
          );
        } catch (metaError) {
          console.warn("최근 DOCX 메타 저장 실패:", metaError);
        }

        if (!usedFallback) {
          this.setDocxGenerationModeBadge("json");
        }
        this.pushDocxGenerationTrace({
          mode: usedFallback ? "fallback" : "json",
          detail: usedFallback ? "폴백 기반 생성 완료" : "JSON 기반 생성 완료",
          filename: docxResult.filename || "",
          title,
        });
        if (window.setDataStatus) window.setDataStatus(`서브노트 생성 완료: ${docxResult.filename}`, "success");
        showToast(
          `전문 서브노트가 생성되었습니다: ${docxResult.filename}`,
          "success",
        );

        if (docxResult.path && typeof window.requestOpenInDefaultApp === "function") {
          try {
            await window.requestOpenInDefaultApp(docxResult.path);
            showToast("생성된 DOCX 파일을 열었습니다.", "success");
          } catch (openError) {
            console.warn("DOCX 파일 열기 실패:", openError);
            this.pushDocxGenerationTrace({
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
      this.setDocxGenerationModeBadge("error", error?.message || "unknown");
      this.pushDocxGenerationTrace({
        mode: "error",
        detail: error?.message || "unknown",
        title,
      });
      if (window.setDataStatus) window.setDataStatus("서브노트 생성 오류", "error");
      showToast("오류 발생: " + error.message, "error");
    }
  },
};

export default StudioDocx;
