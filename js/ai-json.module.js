/**
 * AI JSON Module
 * 담당: AI 응답용 JSON 스키마 정의 및 파싱 유틸리티
 */

/**
 * 기술사 답안 구조화 JSON 스키마 설명
 * AI 프롬프트에 삽입되어 정형화된 응답을 유도합니다.
 */
export const ANSWER_JSON_SCHEMA_PROMPT = `
응답은 반드시 아래 구조의 JSON 형식이어야 합니다:
{
  "title": "답안 제목",
  "sections": [
    {
      "header": "섹션 제목 (예: 1. 개요)",
      "items": ["개조식 본문 문장 1", "개조식 본문 문장 2"],
      "diagram": "이 섹션에 포함될 도해 지시사항 (없으면 빈 문자열)",
      "table": {
        "title": "비교표 제목",
        "columns": ["항목", "내용A", "내용B"],
        "rows": [
          ["구분", "값1", "값2"]
        ]
      } (표가 필요한 경우만 포함)
    }
  ],
  "keywords": ["핵심용어1(English)", "핵심용어2"],
  "codes": ["관련 KDS/KCS 코드"],
  "summary": "최종 결론 및 제언 (3~4줄)"
}
`;

/**
 * 문자열에서 JSON 부분을 추출하고 파싱합니다.
 * 마크다운 코드 블록 (\`\`\`json ... \`\`\`) 형태를 우선적으로 처리합니다.
 */
export function extractJsonFromText(text) {
  if (!text) return null;

  let jsonStr = text.trim();

  // 1. 마크다운 코드 블록 제거 시도
  const jsonBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch) {
    jsonStr = jsonBlockMatch[1];
  } else {
    // 2. {로 시작해서 }로 끝나는 가장 큰 덩어리 찾기 (코드 블록이 없을 경우 대비)
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
    }
  }

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("AI JSON Parsing Error:", e, "Original text snippet:", text.substring(0, 100));
    return null;
  }
}

/**
 * 파싱된 JSON 데이터를 기존의 마크다운 텍스트 형식으로 변환합니다.
 * (하위 호환성 및 기존 UI 렌더링을 위해 필요)
 */
export function convertJsonToMarkdown(json) {
  if (!json || typeof json !== 'object') return String(json || "");

  let md = `# ${json.title || "답안 초안"}\n\n`;

  if (Array.isArray(json.sections)) {
    json.sections.forEach(section => {
      md += `## ${section.header}\n`;
      if (Array.isArray(section.items)) {
        section.items.forEach(item => { md += `- ${item}\n`; });
      }
      if (section.diagram) {
        md += `\n> [도해 지시] ${section.diagram}\n`;
      }
      if (section.table) {
        md += `\n### ${section.table.title || "비교"}\n`;
        const cols = section.table.columns || [];
        md += `| ${cols.join(" | ")} |\n`;
        md += `| ${cols.map(() => "---").join(" | ")} |\n`;
        if (Array.isArray(section.table.rows)) {
          section.table.rows.forEach(row => {
            md += `| ${row.join(" | ")} |\n`;
          });
        }
      }
      md += "\n";
    });
  }

  if (Array.isArray(json.keywords) && json.keywords.length > 0) {
    md += `**핵심 용어:** ${json.keywords.join(", ")}\n\n`;
  }

  if (Array.isArray(json.codes) && json.codes.length > 0) {
    md += `**관련 기준:** ${json.codes.join(", ")}\n\n`;
  }

  if (json.summary) {
    md += `## 결론 및 제언\n${json.summary}\n`;
  }

  return md;
}
