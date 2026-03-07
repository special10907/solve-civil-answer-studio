#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bridge Script: Node.js -> Professional DOCX Generation
- Takes a JSON input containing structured question/answer data.
- Uses subnote_framework.py to generate a professional .docx subnote.
"""

import sys
import json
import re
from pathlib import Path

# Add research directory to sys.path
ROOT_DIR = Path(__file__).resolve().parent
WORKSPACE_ROOT = ROOT_DIR.parent.parent
RESEARCH_DIR = ROOT_DIR / "research"
sys.path.insert(0, str(RESEARCH_DIR))

try:
    from subnote_framework import (
        create_document, save_document,
        add_exam_header, add_section_header, add_footer,
        add_content_line, add_content_sub,
        add_data_table, add_insight_box, add_divider, add_strategy_section,
        add_callout_box, TABLE_W
    )
except ImportError as e:
    print(json.dumps({"ok": False, "error": f"Import error: {e}"}, ensure_ascii=False))
    sys.exit(1)


def generate_bridge(payload):
    try:
        exam_no = payload.get("exam_no", 120)
        period = payload.get("period", 1)
        q_num = payload.get("q_num", 1)
        title = payload.get("title", "Untitled Question")
        llm_data = payload.get("llm_data", {})

        # 저장 경로 기준을 "현재 파일 기준 상대"로 고정하되,
        # 결과는 workspace 루트 하위 exported_subnotes 로 일관되게 배치한다.
        # (기존: solution/exported_subnotes)
        output_base_dir = WORKSPACE_ROOT / "exported_subnotes"
        output_base_dir.mkdir(parents=True, exist_ok=True)

        exam_dir = output_base_dir / f"{exam_no}회"
        exam_dir.mkdir(parents=True, exist_ok=True)

        safe_title = re.sub(r'[\\/:*?"<>|\n\r]', '_', title).strip()
        safe_title = safe_title[:50]
        filename = f"{exam_no}_{period}_{q_num}_{safe_title}.docx"
        filepath = exam_dir / filename

        doc = create_document()
        add_exam_header(doc, q_num, title, exam_no=exam_no, period=period)

        # 1. Overview
        add_section_header(doc, 1, "개요", "Overview")
        overview_text = llm_data.get("overview", title + "에 대한 정의입니다.")
        add_content_line(doc, 1, "", bold_prefix="정의: ")
        add_content_sub(doc, overview_text, indent=1.0)

        # 2. Characteristics Table
        add_section_header(doc, 2, "주요 특징 및 분석", "Key Characteristics")
        col_w = [3.0, 5.0, TABLE_W - 3.0 - 5.0]
        chars = llm_data.get("characteristics", [])
        data_rows = []
        for c in chars:
            name = c.get("name", "특성")
            d1 = c.get("desc1", "설명")
            d2 = c.get("desc2", "-")
            data_rows.append([name, d1, d2])

        if not data_rows:
            data_rows = [["항목 A", "설명 A", "-"], ["항목 B", "설명 B", "-"]]

        add_data_table(doc, headers=["구 분", "특성 1", "특성 2"],
                       data=data_rows, col_widths=col_w)

        # 3. Professional Insights
        add_section_header(doc, 3, "기술사적 소견", "Professional Insight")
        insights = llm_data.get("insights", [])
        insight_rows = []
        for i in insights:
            insight_rows.append((i.get("title", "소견"), i.get("content", "-")))

        if not insight_rows:
            insight_rows = [("실무 경험", "설계기준 준수"), ("최신 동향", "KDS 강화")]

        add_insight_box(doc, insight_rows)

        # 4. Diagram Suggestions (New)
        diagrams = llm_data.get("diagrams", [])
        if diagrams:
            add_section_header(doc, 4, "도해 및 다이어그램 제언", "Diagram Suggestions")
            for d in diagrams:
                title = d.get("title", "도해 주제")
                desc = d.get("content", "설명")
                add_callout_box(doc, f"[DRAWING]: {title}", desc,
                                bg_color="F0F9FF", border_color="7DD3FC")

        # Divider & Strategy
        add_divider(doc)

        keywords = llm_data.get("keywords", "키워드 미지정")
        strategy = llm_data.get("strategy", "문제 분석 기반 전략 수립")
        add_strategy_section(doc, [
            ("핵심 키워드", keywords),
            ("합격 포인트", strategy),
        ])

        add_footer(doc, q_num, title, exam_no=exam_no, period=period)
        save_document(doc, str(filepath))

        return {"ok": True, "path": str(filepath), "filename": filename}

    except Exception:
        import traceback
        return {"ok": False, "error": traceback.format_exc()}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "No payload provided"}, ensure_ascii=False))
        sys.exit(1)

    try:
        payload_data = json.loads(sys.argv[1])
        result = generate_bridge(payload_data)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"ok": False, "error": f"Main error: {e}"}, ensure_ascii=False))
