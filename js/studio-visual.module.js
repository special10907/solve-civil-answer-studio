/**
 * Studio Visual Module
 * Handles visualization rules, diagram generation, and D-Region detection.
 */
const StudioVisual = {
  isDRegionTopic(text = "") {
    const src = String(text || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
    if (!src) return false;

    if (/d[\s-]?region|응력\s*교란\s*구역|응력\s*교란|strut\s*[- ]?\s*tie|stm\b|스트럿\s*[-·]?\s*타이|스트럿타이/.test(src)) {
      return true;
    }

    const hasStrut = /(^|[^a-z])strut([^a-z]|$)|스트럿/.test(src);
    const hasTie = /(^|[^a-z])tie([^a-z]|$)|타이\s*모델|타이\s*부재|타이\s*요소/.test(src);
    return hasStrut && hasTie;
  },

  buildRequiredVisualsForQuestion(question = {}, incomingVisuals = []) {
    const seed = `${String(question?.title || "")} ${String(question?.rawQuestion || "")}`.toLowerCase();
    const isDRegion = this.isDRegionTopic(seed);
    const sourceRows = Array.isArray(incomingVisuals) ? incomingVisuals : [];

    if (!isDRegion) {
      const filtered = sourceRows.filter((item) =>
        this.isVisualRelevantToQuestion(item, question),
      );
      if (filtered.length >= 2) {
        return filtered.slice(0, 6);
      }
      return this.buildGenericFallbackVisuals(question);
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
        kind: "table",
        title: "B-Region vs D-Region 해석가정·절차·오류위험 비교표 이미지",
        purpose: "B-Region(선형변형률 가정)과 D-Region(STM 적용)의 해석 차이를 비교표로 제시",
        spec: [
          "구분 | B-Region(선형변형률 가정) | D-Region(STM 적용)",
          "해석가정 | 단면 변형률 선형 분포 가정 | 불연속부 비선형 응력 재분배 고려",
          "설계절차 | 휨이론 중심 단면 검토 | Strut·Tie·Node 기반 STM 검토",
          "오류위험 | D-Region 누락 시 과소평가 가능 | 경계 오판 시 정착/절점 취약부 과소평가",
        ].join(" | "),
        scoringPoint: "해석가정·절차·오류위험 비교를 통한 적용 근거 명확화",
        imageUrl: pickUrl(),
      },
    ];
  },

  isVisualRelevantToQuestion(visual = {}, question = {}) {
    const body = [
      visual?.title,
      visual?.purpose,
      visual?.spec,
      visual?.scoringPoint,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!body.trim()) return false;

    const overlap = this.computeQuestionTextOverlap(body, question);
    if (overlap >= 1) return true;

    const q = `${question?.title || ""} ${question?.rawQuestion || ""}`.toLowerCase();
    const qIsDRegion = this.isDRegionTopic(q);
    const qIsPsc = /psc|긴장재|응력부식|지연파괴|그라우팅/.test(q);
    const vIsDRegion = this.isDRegionTopic(body);
    const vIsPsc = /psc|긴장재|응력부식|지연파괴|그라우팅/.test(body);

    if (qIsDRegion && vIsDRegion) return true;
    if (qIsPsc && vIsPsc) return true;
    if ((qIsDRegion && vIsPsc) || (qIsPsc && vIsDRegion)) return false;

    return false;
  },

  computeQuestionTextOverlap(text = "", question = {}) {
    const source = String(text || "").toLowerCase().trim();
    if (!source) return 0;
    // Note: StudioAI.extractDocxKeyTokens or similar will be needed. 
    // For now, let's use a simple word-based overlap or call StudioAI via bridge.
    if (window.StudioModules?.AI?.extractDocxKeyTokens) {
      const tokens = window.StudioModules.AI.extractDocxKeyTokens(
        `${question?.title || ""} ${question?.rawQuestion || ""}`,
        24
      );
      if (!tokens.length) return 0;
      return tokens.filter((token) => source.includes(token)).length;
    }
    return 0;
  },

  buildGenericFallbackVisuals(question = {}) {
    const topic = String(question?.title || question?.rawQuestion || "핵심 구조 메커니즘")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 40) || "핵심 구조 메커니즘";
    const seed = `${question?.title || ""} ${question?.rawQuestion || ""}`.toLowerCase();
    const isPsc = /psc|긴장재|응력부식|지연파괴|그라우팅/.test(seed);

    if (isPsc) {
      return [
        {
          kind: "diagram",
          title: "PSC 정착·부식 진행 메커니즘 도해",
          purpose: "긴장재 성능저하 경로와 취약부를 시각화",
          spec: "요소: 정착부, 쉬스, 그라우팅 결함, 균열/부식 진행 화살표 | 판독 포인트: 원인-결과 경로",
          scoringPoint: "응력부식·지연파괴의 인과관계 제시",
        },
        {
          kind: "table",
          title: "PSC 예방대책 비교표",
          purpose: "설계·시공·유지관리 대책 비교",
          spec: "구분 | 설계 단계 | 시공 단계 | 유지관리 단계 | 핵심 리스크 대응",
          scoringPoint: "단계별 대책의 실무 적용성 제시",
        },
        {
          kind: "graph",
          title: "성능저하 추세 그래프",
          purpose: "시간경과에 따른 성능저하 및 임계치 제시",
          spec: "X축: 시간 | Y축: 성능지표 | 관리한계선 포함",
          scoringPoint: "점검·보수 시점의 근거 확보",
        },
      ];
    }

    return [
      {
        kind: "diagram",
        title: `${topic} 메커니즘 도해`,
        purpose: "하중-저항-파괴 전이 경로 시각화",
        spec: "요소: 하중, 지점, 주요 부재, 취약부 | 판독 포인트: 지배 거동",
        scoringPoint: "답안 논리 흐름 가시화",
      },
      {
        kind: "table",
        title: `${topic} 대안 비교표`,
        purpose: "안전성·시공성·경제성·유지관리성 비교",
        spec: "항목 | 대안 A | 대안 B | 판정",
        scoringPoint: "최종 대안 선택 근거 명확화",
      },
      {
        kind: "graph",
        title: `${topic} 성능-여유도 그래프`,
        purpose: "조건 변화에 따른 여유도 추세 제시",
        spec: "X축: 하중/조건 | Y축: 여유도 | 허용경계선 포함",
        scoringPoint: "정량 근거 제시",
      },
    ];
  },

  ensureDocxDiagramRule(content = "") {
    const source = String(content || "").trim();
    const lines = source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const base = lines.join("\n");

    const required = [
      { label: "도해 목적", fallback: "핵심 메커니즘을 빠르게 전달" },
      { label: "구성 요소", fallback: "하중·저항·경계조건·핵심 부재" },
      { label: "작성 순서", fallback: "1) 외곽 2) 하중/반력 3) 내부 경로/레이블" },
      { label: "채점 포인트", fallback: "기준 용어 일치, 수치/근거, 결론 연결" },
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

  enforceDocxVisualizationRules(llmData, question = {}) {
    const safe = llmData && typeof llmData === "object" ? { ...llmData } : {};
    const topicSeed = String(question?.title || "").trim() || "핵심 구조 메커니즘";

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
        const content = this.ensureDocxDiagramRule(item?.content || "");
        if (!content) return null;
        return { title, content };
      })
      .filter(Boolean);

    while (normalized.length < 2) {
      const seed = fallbackDiagrams[normalized.length] || fallbackDiagrams[0];
      normalized.push({
        title: seed.title,
        content: this.ensureDocxDiagramRule(seed.content),
      });
    }

    safe.diagrams = normalized.slice(0, 4);
    return safe;
  },
};

export default StudioVisual;
