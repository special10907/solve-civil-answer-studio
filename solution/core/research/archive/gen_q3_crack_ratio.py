#!/usr/bin/env python3
"""Q3: 철근콘크리트 슬래브의 균열율 (Crack Ratio of RC Slabs)"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from subnote_framework import *  # noqa: F401,F403

OUTPUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "120_1_3_Crack_Ratio.docx")

doc = create_document()

# ─── HEADER ──────────────────────────────────────────────────────────────────
add_exam_header(doc, 3, "철근콘크리트 슬래브의 균열율")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 1: 개요
# ═══════════════════════════════════════════════════════════════════════════════
add_section_header(doc, 1, "개요", "Definition — Crack Ratio vs. Crack Width")

add_content_line(doc, 1, "", bold_prefix="균열율(Crack Ratio) 정의: ")
add_content_sub_highlight(doc,
    "슬래브 전체 면적 대비 균열이 분포하는 면적의 비율로, ",
    "RC 슬래브의 열화 정도를 정량 평가하는 지표", ".", indent=1.0)

add_content_line(doc, 2, "", bold_prefix="균열폭(Crack Width)과의 차이: ")
add_content_sub(doc,
    "균열폭은 '개별 균열의 크기(mm)'를 측정하는 반면, "
    "균열율은 '부재 전체의 균열 분포 밀도(m/m\u00b2)'를 평가함.",
    indent=1.0)

add_content_line(doc, 3, "", bold_prefix="적용 목적: ")
add_content_sub(doc,
    "기존 구조물의 내구성 평가, 보수·보강 판정, 정밀안전진단 시 정량적 등급 산정에 활용.",
    indent=1.0)

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 2: 균열율 산정 방법 및 등급 기준
# ═══════════════════════════════════════════════════════════════════════════════
add_spacer(doc, 5)
add_section_header(doc, 2, "균열율 산정 방법 및 등급 기준", "Measurement & Grading")

add_content_line(doc, 1, "", bold_prefix="산정식: ")
p = doc.add_paragraph()
set_paragraph_spacing(p, before=0, after=3, line_spacing=1.3)
p.paragraph_format.left_indent = Cm(1.0)
add_run(p, "균열율 = \u03a3(균열 길이 \u00d7 균열 폭) / 조사 면적  ", "Malgun Gothic", 10, color=DARK_GRAY)
add_run(p, "[단위: m/m\u00b2]", "Arial", 9, bold=True, color=STEEL_BLUE)

add_spacer(doc, 3)

# Grading table
col_w = [2.2, 3.2, 3.2, TABLE_W - 2.2 - 3.2 - 3.2]
add_data_table(doc,
    headers=["등급", "균열율 (m/m\u00b2)", "균열폭 범위", "상태 평가"],
    data=[
        ["A (양호)",    "0.1 이하",         "0.1mm 이하",  "경미한 표면 균열, 보수 불요"],
        ["B (보통)",    "0.1 ~ 0.3",       "0.1 ~ 0.2mm", "경미한 열화, 관찰 필요"],
        ["C (주의)",    "0.3 ~ 0.5",       "0.2 ~ 0.3mm", "진행성 균열, 보수 권고"],
        ["D (심각)",    "0.5 ~ 1.0",       "0.3 ~ 0.5mm", "구조적 열화, 보수·보강 필요"],
        ["E (위험)",    "1.0 초과",         "0.5mm 초과",  "긴급 조치, 사용 제한 검토"],
    ],
    col_widths=col_w)

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 3: 균열 발생 원인 분류
# ═══════════════════════════════════════════════════════════════════════════════
add_spacer(doc, 5)
add_section_header(doc, 3, "균열 발생 원인 분류", "Classification of Crack Causes")

col_w3 = [2.5, 4.0, TABLE_W - 2.5 - 4.0]
add_data_table(doc,
    headers=["구  분", "원  인", "특  징"],
    data=[
        ["하중 균열\n(Structural)",
         "휨, 전단, 비틀림\n과하중, 피로 하중",
         "하중 방향과 직교 발생\n균열폭이 하중에 비례 증감"],
        ["비하중 균열\n(Non-structural)",
         "건조수축, 온도변화\n소성수축, 자기수축",
         "초기 양생 시 주로 발생\n불규칙 패턴, 면 전체 분포"],
        ["내구성 균열\n(Durability)",
         "염해, 탄산화, ASR\n동결융해, 철근 부식",
         "균열 → 열화 가속 악순환\n박리·층상·부식 동반"],
    ],
    col_widths=col_w3)

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 4: 환경 조건별 허용 균열폭
# ═══════════════════════════════════════════════════════════════════════════════
add_spacer(doc, 5)
add_section_header(doc, 4, "환경 조건별 허용 균열폭", "Allowable Crack Width / KDS 14 20")

col_w4 = [3.5, 3.0, 3.0, TABLE_W - 3.5 - 3.0 - 3.0]
add_data_table(doc,
    headers=["노출 환경", "허용 균열폭\n(일반)", "허용 균열폭\n(PS부재)", "비 고"],
    data=[
        ["건조 환경\n(실내, 보호)", "0.4 mm", "0.2 mm", "미관 위주 기준"],
        ["습윤 환경\n(외기 노출)", "0.3 mm", "비균열 허용\n(감압 시 0.2)", "내구성 지배"],
        ["부식 환경\n(해안·제설)", "0.2 mm", "비균열", "염소이온 침투 지배\nKDS 14 20 40 준수"],
        ["수밀 구조\n(수조·터널)", "0.2 mm", "비균열", "누수 방지 목적\nw \u2264 0.1 권장"],
    ],
    col_widths=col_w4)

p = doc.add_paragraph()
set_paragraph_spacing(p, before=4, after=2, line_spacing=1.3)
p.paragraph_format.left_indent = Cm(0.4)
add_run(p, "\u25b6 ", "Arial", 9, bold=True, color=ACCENT_GOLD)
add_run(p, "핵심 원칙: ", "Malgun Gothic", 9, bold=True, color=NAVY)
add_run(p, "균열폭은 '개별 관리', 균열율은 '전체 건전도 평가' — 두 지표를 병행하는 것이 기술사 수준의 평가임.",
        "Malgun Gothic", 9, color=DARK_GRAY)

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 5: 기술사적 소견
# ═══════════════════════════════════════════════════════════════════════════════
add_spacer(doc, 5)
add_section_header(doc, 5, "기술사적 소견", "Professional Insight")

add_insight_box(doc, [
    ("실무 경험 (17년):",
     "교량 슬래브 정밀안전진단 시 균열율 산정은 필수 항목이며, "
     "D등급 이상 시 긴급 보수·보강 판정의 핵심 근거로 활용됨."),
    ("설계 착안점:",
     "균열폭 제한만으로는 RC 슬래브의 전반적 열화를 평가할 수 없으며, "
     "균열 '밀도'와 '패턴 분석'을 통한 원인 추정이 진단의 핵심임."),
    ("최신 경향:",
     "드론+AI 기반 자동 균열 검출 및 균열율 자동 산정 기술이 확산 중이며, "
     "2024 KDS에서는 디지털 진단 도구의 활용을 권장하고 있음."),
])

# ─── DIVIDER & STRATEGY ─────────────────────────────────────────────────────
add_divider(doc)

add_strategy_section(doc, [
    ("핵심 키워드",
     "균열율(Crack Ratio)  |  균열폭(Crack Width)  |  m/m\u00b2  |  등급 판정  |  KDS 14 20 40"),
    ("반드시 포함",
     "\u2460 균열율 정의 및 산정식  "
     "\u2461 균열폭과의 개념적 차이  "
     "\u2462 환경별 허용 균열폭 표(최소 3개 환경)"),
    ("유사 기출",
     "\u2022 110회 1-3 (균열폭 제한)  \u2022 118회 2-6 (내구성 설계)  \u2022 130회 1-5 (슬래브 진단)"),
    ("합격 포인트",
     "균열율과 균열폭의 '차이점'을 명확히 구분하고, 환경별 허용 균열폭 표를 삽도로 제시하면 고득점 확보."),
])

add_footer(doc, 3, "RC Slab Crack Ratio")
save_document(doc, OUTPUT)
