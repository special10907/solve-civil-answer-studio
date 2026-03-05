#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from subnote_framework import (
    create_document, save_document,
    add_exam_header, add_section_header, add_footer,
    add_content_line, add_content_sub, add_content_sub_highlight,
    add_data_table, add_insight_box, add_divider, add_strategy_section,
    add_callout_box, add_flow_diagram,
    add_run, set_paragraph_spacing,
    TABLE_W, ACCENT_RED, ACCENT_GOLD, NAVY, MEDIUM_GRAY, DARK_GRAY,
    Cm,
)

EXAM_NO = 120
PERIOD = 1
Q_NUM = 3
TITLE = "철근콘크리트 슬래브의 균열율 (Crack Ratio)"

OUTPUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), f"{EXAM_NO}_{PERIOD}_{Q_NUM}_subnote.docx")

doc = create_document()

# ─── HEADER ──────────────────────────────────────────────────────────────────
add_exam_header(doc, Q_NUM, TITLE, exam_no=EXAM_NO, period=PERIOD)

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 1: 개요
# ═══════════════════════════════════════════════════════════════════════════════
add_section_header(doc, 1, "개요", "Overview")
add_content_line(doc, 1, "", bold_prefix="정의: ")
add_content_sub(doc, TITLE + "에 대한 기본적인 정의 및 배경 설명입니다.", indent=1.0)

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 2: 주요 특징 및 분석
# ═══════════════════════════════════════════════════════════════════════════════
add_section_header(doc, 2, "주요 특징 및 분석", "Key Characteristics")
col_w = [3.0, 5.0, TABLE_W - 3.0 - 5.0]
add_data_table(doc,
    headers=["구 분", "특성 1", "특성 2"],
    data=[
        ["항목 A", "설명 A1", "설명 A2"],
        ["항목 B", "설명 B1", "설명 B2"],
    ],
    col_widths=col_w)

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 3: 기술사적 소견
# ═══════════════════════════════════════════════════════════════════════════════
add_section_header(doc, 3, "기술사적 소견", "Professional Insight")
add_insight_box(doc, [
    ("실무 경험:", "해당 주제와 관련된 실무적 착안점 및 주의사항 기재"),
    ("최신 동향:", "관련 최신 설계기준(KDS) 또는 시공 트렌드"),
])

# ─── DIVIDER & STRATEGY ─────────────────────────────────────────────────────
add_divider(doc)

add_strategy_section(doc, [
    ("핵심 키워드", "Keyword 1 | Keyword 2 | Keyword 3"),
    ("합격 포인트", "이 문제의 고득점을 위한 차별화 답안 작성 전략 기술"),
])

add_footer(doc, Q_NUM, TITLE, exam_no=EXAM_NO, period=PERIOD)
save_document(doc, OUTPUT)
