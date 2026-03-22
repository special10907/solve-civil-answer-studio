/**
 * Studio AI Module
 * Handles AI response sanitization, JSON extraction, and relevance scoring.
 */
const StudioAI = {
  extractJsonCandidate(text) {
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

  buildDocxFallbackFromText(rawText, title = "") {
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

  sanitizeDocxAnswerText(rawText = "") {
    const lines = String(rawText || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !/시각화\s*요약/i.test(line))
      .filter((line) => !/^\d+\)\s*(그림|표|그래프)\s*[:：]/i.test(line))
      .filter((line) => !/^[-*•]\s*(목적|작성\s*기준|채점\s*포인트)\s*[:：]/i.test(line));

    return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  },

  sanitizeDocxAuxText(rawText = "") {
    const lines = String(rawText || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !/^\[web_research\]$/i.test(line))
      .filter((line) => !/^\[mandatory_pipeline_context\]$/i.test(line))
      .filter((line) => !/^\[deep_research_parsed\]$/i.test(line))
      .filter((line) => !/^\[검색\s*컨텍스트\s*요약\]$/i.test(line))
      .filter((line) => !/^\[심화\s*보강/i.test(line))
      .filter((line) => !/^query\s*:/i.test(line))
      .filter((line) => !/^status\s*:/i.test(line))
      .filter((line) => !/^message\s*:/i.test(line))
      .filter((line) => !/^title\s*:/i.test(line))
      .filter((line) => !/^summary\s*:/i.test(line))
      .filter((line) => !/^url\s*:/i.test(line))
      .filter((line) => !/^references\s*:/i.test(line))
      .filter((line) => !/^참고\s*링크\s*없음$/i.test(line))
      .filter((line) => !/^근거첨부$/i.test(line))
      .filter((line) => !/^-\s*요청사항\s*:/i.test(line))
      .filter((line) => !/^-\s*탐색소스\s*:/i.test(line))
      .filter((line) => !/^\|\s*단계\s*\|\s*소스\s*\|\s*핵심근거\s*\|\s*답안\s*적용\s*\|/i.test(line))
      .filter((line) => !/^\|---\|---\|---\|---\|/.test(line))
      .filter((line) => !/^\|\s*[1-5]\s*\|/.test(line));

    return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  },

  sanitizeDocxJsonPayload(llmData = {}) {
    const safe = llmData && typeof llmData === "object" ? { ...llmData } : {};
    safe.overview = this.sanitizeDocxAuxText(safe.overview || "");
    safe.strategy = this.sanitizeDocxAuxText(safe.strategy || "");
    safe.keywords = this.sanitizeDocxAuxText(safe.keywords || "").replace(/\n+/g, ", ");

    safe.characteristics = (Array.isArray(safe.characteristics)
      ? safe.characteristics
      : []
    )
      .map((item) => {
        const name = this.sanitizeDocxAuxText(item?.name || "");
        const desc1 = this.sanitizeDocxAuxText(item?.desc1 || "");
        const desc2 = this.sanitizeDocxAuxText(item?.desc2 || "");
        if (!name && !desc1 && !desc2) return null;
        return { name, desc1, desc2 };
      })
      .filter(Boolean)
      .slice(0, 6);

    safe.insights = (Array.isArray(safe.insights) ? safe.insights : [])
      .map((item) => {
        const title = this.sanitizeDocxAuxText(item?.title || "");
        const content = this.sanitizeDocxAuxText(item?.content || "");
        if (!title && !content) return null;
        return { title, content };
      })
      .filter(Boolean)
      .slice(0, 6);

    safe.diagrams = (Array.isArray(safe.diagrams) ? safe.diagrams : [])
      .map((item) => {
        const title = this.sanitizeDocxAuxText(item?.title || "");
        const content = this.sanitizeDocxAuxText(item?.content || "");
        if (!title && !content) return null;
        return { title, content };
      })
      .filter(Boolean)
      .slice(0, 6);

    return safe;
  },

  hasDocxPollutionSignals(input = "") {
    const source =
      input && typeof input === "object"
        ? JSON.stringify(input)
        : String(input || "");
    const text = source.toLowerCase();
    if (!text.trim()) return false;

    const signals = [
      "[web_research]",
      "[mandatory_pipeline_context]",
      "[deep_research_parsed]",
      "[검색 컨텍스트 요약]",
      "[심화 보강",
      "query:",
      "status:",
      "message:",
      "근거첨부",
      "요청사항:",
      "탐색소스:",
      "| 단계 | 소스 | 핵심근거 | 답안 적용 |",
      "|---|---|---|---|",
      "참고 링크 없음",
    ];

    return signals.some((sig) => text.includes(sig));
  },

  extractDocxKeyTokens(text = "", max = 16) {
    const stopwords = new Set([
      "그리고", "또한", "대한", "에서", "으로", "하는", "있는",
      "합니다", "이다", "문제", "정의", "검토", "작성", "기준", "구성",
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

  isDocxPayloadRelevant(llmData, question = {}) {
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

    const sourceTokens = this.extractDocxKeyTokens(
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

  isWeakDocxAnswerText(text = "", question = {}) {
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

    const tokens = this.extractDocxKeyTokens(
      `${question?.title || ""} ${question?.rawQuestion || ""} ${question?.modelAnswer || ""}`,
      20,
    );
    if (!tokens.length) return false;
    const overlap = tokens.filter((t) => source.includes(t)).length;
    return overlap < 1;
  },

  computeQuestionTextOverlap(text = "", question = {}) {
    const source = String(text || "").toLowerCase().trim();
    if (!source) return 0;
    const tokens = this.extractDocxKeyTokens(
      `${question?.title || ""} ${question?.rawQuestion || ""}`,
      24,
    );
    if (!tokens.length) return 0;
    return tokens.filter((token) => source.includes(token)).length;
  },

  isAnswerRelevantToQuestion(text = "", question = {}) {
    const src = String(text || "").toLowerCase().trim();
    if (!src) return false;

    const overlap = this.computeQuestionTextOverlap(src, question);
    if (overlap >= 2) return true;

    const q = `${question?.title || ""} ${question?.rawQuestion || ""}`.toLowerCase();
    // This depends on StudioVisual, will be linked via bridge
    const qIsDRegion = window.StudioModules?.Visual?.isDRegionTopic ? window.StudioModules.Visual.isDRegionTopic(q) : false;
    const qIsPsc = /psc|긴장재|응력부식|지연파괴|그라우팅/.test(q);
    const aIsDRegion = window.StudioModules?.Visual?.isDRegionTopic ? window.StudioModules.Visual.isDRegionTopic(src) : false;
    const aIsPsc = /psc|긴장재|응력부식|지연파괴|그라우팅/.test(src);

    if (qIsDRegion && aIsDRegion) return true;
    if (qIsPsc && aIsPsc) return true;
    if ((qIsDRegion && aIsPsc) || (qIsPsc && aIsDRegion)) return false;

    return overlap >= 1 && src.replace(/\s+/g, "").length >= 400;
  },

  _buildQuestionTokenSet(question = {}, max = 24) {
    const stopwords = new Set([
      "그리고", "또한", "대한", "에서", "으로", "하는", "있는",
      "문제", "검토", "적용", "정의", "기준", "구조", "설계",
    ]);

    const src = `${question?.title || ""} ${question?.rawQuestion || ""}`
      .toLowerCase()
      .replace(/[^a-z0-9가-힣\s]/g, " ")
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 2 && !stopwords.has(w));

    const uniq = [];
    for (const token of src) {
      if (!uniq.includes(token)) uniq.push(token);
      if (uniq.length >= max) break;
    }
    return new Set(uniq);
  },

  sanitizeDocxAnswerByQuestion(rawText = "", question = {}) {
    const cleaned = this.sanitizeDocxAnswerText(rawText);
    if (!cleaned) return "";

    const tokenSet = this._buildQuestionTokenSet(question);
    if (!tokenSet.size) return cleaned;

    const sections = String(cleaned)
      .split(/\n(?=\d+\.\s+)/g)
      .map((s) => s.trim())
      .filter(Boolean);

    const hasStructuredSections = sections.length >= 2;
    const blocks = hasStructuredSections
      ? sections
      : cleaned
          .split(/\n\n+/g)
          .map((s) => s.trim())
          .filter(Boolean);

    const seenHeaders = new Set();
    const kept = [];

    for (const block of blocks) {
      const lines = block
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      if (!lines.length) continue;

      const header = lines[0]
        .toLowerCase()
        .replace(/[^a-z0-9가-힣\s.]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (header && seenHeaders.has(header)) {
        continue;
      }

      const body = lines.join(" ").toLowerCase();
      let overlap = 0;
      for (const tk of tokenSet) {
        if (body.includes(tk)) overlap += 1;
      }

      const essential = /결론|제언|요약|도해|비교표|기준|판정/.test(body);
      const keep = overlap >= 1 || essential;
      if (!keep) continue;

      if (header) seenHeaders.add(header);
      kept.push(block);
    }

    if (!kept.length) return cleaned;
    return kept.join("\n\n").trim();
  },
};

export default StudioAI;
