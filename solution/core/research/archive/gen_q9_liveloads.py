#!/usr/bin/env python3
"""Q9: 도로교설계기준(한계상태설계법) - 활하중 (Live Loads, KL-510)"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from subnote_framework import *  # noqa: F401,F403

OUTPUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "120_1_9_Live_Loads.docx")

doc = create_document()

# ─── HEADER ──────────────────────────────────────────────────────────────────
add_exam_header(doc, 9, "도로교설계기준(한계상태설계법) \u2014 활하중 (Live Loads)")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 1: 개요
# ═══════════════════════════════════════════════════════════════════════════════
add_section_header(doc, 1, "개요", "Live Load Model — KL-510 System")

add_content_line(doc, 1, "", bold_prefix="활하중 모델의 변천: ")
add_content_sub_highlight(doc,
    "기존 DB하중(DB-24) 체계에서 한계상태설계법 도입과 함께 ",
    "KL-510 (차량하중 + 등분포하중) 이중 모델 체계로 전환", ".", indent=1.0)

add_content_line(doc, 2, "", bold_prefix="KL-510 구성: ")
add_content_sub(doc,
    "설계 트럭 하중(KL-510 Truck: 총 510kN, 3축) + "
    "설계 차선 하중(Lane Load: 12.7kN/m 등분포)을 동시 재하.",
    indent=1.0)

add_content_line(doc, 3, "", bold_prefix="적용 기준: ")
p = doc.add_paragraph()
set_paragraph_spacing(p, before=0, after=3, line_spacing=1.3)
p.paragraph_format.left_indent = Cm(1.0)
add_run(p, "도로교설계기준(한계상태설계법, 2016)  |  KDS 24 12 21  |  AASHTO LRFD 참조 체계", "Malgun Gothic", 10, color=DARK_GRAY)

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 2: KL-510 활하중 모델 상세
# ═══════════════════════════════════════════════════════════════════════════════
add_spacer(doc, 5)
add_section_header(doc, 2, "KL-510 활하중 모델 상세", "Truck + Lane Load Specification")

col_w = [3.0, 5.5, TABLE_W - 3.0 - 5.5]
add_data_table(doc,
    headers=["구  분", "상  세", "비  고"],
    data=[
        ["설계 트럭\n(KL-510 Truck)",
         "총 중량: 510 kN (3축)\n\u2022 전축: 35 kN\n\u2022 중간축: 145 kN\n\u2022 후축: 145 kN + 185 kN\n축간거리: 4.3m (고정) + 4.3~9.0m (가변)",
         "AASHTO HL-93의\nHS-20 트럭에 대응\n국내 교통 여건 반영"],
        ["설계 차선\n(Lane Load)",
         "등분포: 12.7 kN/m\n전 차선 폭(3.0m)에 재하\n트럭과 동시 재하",
         "장경간 영향 반영\n집중 + 분포 중첩 효과"],
        ["설계 탠덤\n(Tandem)",
         "축하중: 2 \u00d7 110 kN\n축간거리: 1.2m\n+ Lane Load 동시 재하",
         "단경간 검토용\n트럭과 탠덤 중\n불리한 쪽 적용"],
        ["피로 트럭\n(Fatigue Truck)",
         "KL-510 트럭 단독\n(Lane Load 미적용)\n축간거리: 9.0m 고정",
         "피로한계상태 전용\n1대 트럭 단독 주행"],
    ],
    col_widths=col_w)

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 3: 실전 삽도
# ═══════════════════════════════════════════════════════════════════════════════
add_spacer(doc, 5)
add_section_header(doc, 3, "실전 삽도", "Hand-drawable Sketch for Exam")

add_callout_box(doc,
    "시험장 드로잉 전략",
    "1) 교량 측면 입면도(span 표시) → "
    "2) KL-510 트럭 3축 배치 (35+145+185+145 kN, 축간 4.3m) → "
    "3) 트럭 아래 전 구간 등분포 12.7 kN/m 화살표 → "
    "4) 다차로 시 다차로 감소계수(m) 표기 → "
    "5) IM(충격계수) 적용 위치 표시 (트럭에만 적용, Lane Load 제외)")

add_spacer(doc, 3)

# Truck axle diagram
diag = doc.add_table(rows=3, cols=7)
diag.alignment = WD_TABLE_ALIGNMENT.CENTER
set_table_width_fixed(diag, CONTENT_WIDTH_CM * 0.92)
dw = CONTENT_WIDTH_CM * 0.92 / 7
set_table_col_widths(diag, [dw]*7)
remove_table_borders(diag)

# Row 0: Axle loads
set_row_height(diag.rows[0], 0.6, "atLeast")
axle_data = [
    ("35 kN", "DCEEFB", NAVY),
    ("", "FFFFFF", MEDIUM_GRAY),
    ("145 kN", "DCEEFB", NAVY),
    ("", "FFFFFF", MEDIUM_GRAY),
    ("185 kN", "FFEBEE", ACCENT_RED),
    ("", "FFFFFF", MEDIUM_GRAY),
    ("145 kN", "DCEEFB", NAVY),
]
for i, (txt, bg, clr) in enumerate(axle_data):
    c = diag.cell(0, i)
    if txt:
        set_cell_shading(c, bg)
    set_cell_margins(c, top=20, bottom=20, left=5, right=5)
    c.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
    p = c.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    if txt:
        add_run(p, txt, "Arial", 8.5, bold=True, color=clr)

# Row 1: Arrows and spacing
set_row_height(diag.rows[1], 0.35, "atLeast")
arrow_data = ["\u25bc", "\u2190 4.3m \u2192", "\u25bc", "\u2190 4.3~9.0m \u2192", "\u25bc", "\u2190 4.3m \u2192", "\u25bc"]
for i, txt in enumerate(arrow_data):
    c = diag.cell(1, i)
    set_cell_margins(c, top=5, bottom=5, left=5, right=5)
    c.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
    p = c.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    is_arrow = (txt == "\u25bc")
    if is_arrow:
        add_run(p, txt, "Arial", 10, bold=True, color=DARK_NAVY)
    else:
        add_run(p, txt, "Arial", 7, color=STEEL_BLUE)

# Row 2: Lane load bar
set_row_height(diag.rows[2], 0.5, "atLeast")
diag.cell(2, 0).merge(diag.cell(2, 6))
mc = diag.cell(2, 0)
set_cell_shading(mc, "FFF3E0")
set_cell_margins(mc, top=15, bottom=15, left=20, right=20)
mc.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
set_cell_border(mc, top=(6, GOLD_HEX, "single"), bottom=(6, GOLD_HEX, "single"),
    left=(6, GOLD_HEX, "single"), right=(6, GOLD_HEX, "single"))
p = mc.paragraphs[0]
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
add_run(p, "\u2193\u2193\u2193\u2193\u2193  Lane Load: 12.7 kN/m (\uc804 \uad6c\uac04 \ub4f1\ubd84\ud3ec)  \u2193\u2193\u2193\u2193\u2193",
        "Malgun Gothic", 8.5, bold=True, color=ACCENT_GOLD)

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
set_paragraph_spacing(p, before=2, after=2, line_spacing=1.0)
add_run(p, "\u203b KL-510 = Korean Live load 510kN  |  IM: \ud2b8\ub7ed\uc5d0\ub9cc \uc801\uc6a9 (Lane Load \uc81c\uc678)",
        "Malgun Gothic", 8, italic=True, color=MEDIUM_GRAY)

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 4: 충격계수(IM) 및 다차로 보정
# ═══════════════════════════════════════════════════════════════════════════════
add_spacer(doc, 5)
add_section_header(doc, 4, "충격계수(IM) 및 다차로 보정", "Dynamic Allowance & Multi-lane Factor")

col_w4 = [3.0, 4.5, TABLE_W - 3.0 - 4.5]
add_data_table(doc,
    headers=["구  분", "적용 값", "비  고"],
    data=[
        ["충격계수 (IM)\n\u2014 일반부재",
         "IM = 0.25 (25%)\n트럭/탠덤에만 적용\nLane Load에는 미적용",
         "AASHTO: IM = 33%\n국내 기준은 25% 채택\n노면 상태 양호 가정"],
        ["충격계수 (IM)\n\u2014 신축이음부",
         "IM = 0.75 (75%)\n(또는 개별 검토)",
         "노면 불연속 영향\n국부 부재 설계 시 적용"],
        ["충격계수 (IM)\n\u2014 피로",
         "IM = 0.15 (15%)",
         "피로한계상태 전용\n일반보다 낮게 적용"],
        ["다차로\n감소계수 (m)",
         "1차로: m = 1.20\n2차로: m = 1.00\n3차로: m = 0.85\n4차로+: m = 0.65",
         "동시 재하 확률 반영\n1차로는 오히려 증가\n(편재 하중 효과)"],
    ],
    col_widths=col_w4)

p = doc.add_paragraph()
set_paragraph_spacing(p, before=4, after=2, line_spacing=1.3)
p.paragraph_format.left_indent = Cm(0.4)
add_run(p, "\u25b6 ", "Arial", 9, bold=True, color=ACCENT_GOLD)
add_run(p, "핵심 원칙: ", "Malgun Gothic", 9, bold=True, color=NAVY)
add_run(p, "IM은 트럭/탠덤에만 적용 (Lane Load 제외)  |  "
        "1차로 m=1.20은 '증가' 계수임에 주의  |  KL-510 = Truck + Lane 동시 재하",
        "Malgun Gothic", 9, color=DARK_GRAY)

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 5: 기존 기준과의 비교 & 기술사적 소견
# ═══════════════════════════════════════════════════════════════════════════════
add_spacer(doc, 5)
add_section_header(doc, 5, "기술사적 소견", "Professional Insight & Code Comparison")

add_insight_box(doc, [
    ("기존 기준 비교:",
     "DB-24(총 432kN, 1대 트럭)에서 KL-510(510kN 트럭 + 12.7kN/m Lane)으로 전환. "
     "장경간에서 Lane Load 중첩 효과로 설계 하중이 DB-24 대비 20~40% 증가."),
    ("실무 경험 (17년):",
     "KL-510 도입 후 교량 바닥판 두께와 거더 단면이 DB-24 시대 대비 평균 15% 이상 증가. "
     "특히 장경간(L > 50m) 연속교에서 Lane Load의 영향이 지배적."),
    ("최신 경향:",
     "자율주행 군집 주행(Platooning)에 따른 활하중 모델 재검토가 국제적으로 논의 중이며, "
     "국내에서도 중차량 통행 실태조사를 기반으로 한 KL-510 개정이 예고되고 있음."),
])

# ─── DIVIDER & STRATEGY ─────────────────────────────────────────────────────
add_divider(doc)

add_strategy_section(doc, [
    ("핵심 키워드",
     "KL-510  |  Truck(510kN) + Lane(12.7kN/m)  |  IM = 0.25  |  다차로 감소계수(m)  |  KDS 24 12 21"),
    ("반드시 포함",
     "\u2460 KL-510 구성(3축 트럭 + 등분포)  "
     "\u2461 IM 적용 규칙 (트럭 Only, Lane 제외)  "
     "\u2462 다차로 감소계수 m값 (1.20/1.00/0.85/0.65)"),
    ("유사 기출",
     "\u2022 114회 1-3 (활하중 모델)  \u2022 120회 1-9 (\ubcf8 \ubb38\uc81c)  \u2022 128회 2-2 (하중조합)"),
    ("합격 포인트",
     "3축 트럭 삽도(축하중+축간거리) + Lane Load 동시 재하를 '하나의 그림'으로 표현하고, "
     "IM 미적용 대상(Lane Load)을 명시적으로 구분하면 확실한 고득점."),
])

add_footer(doc, 9, "Live Loads KL-510 & IM")
save_document(doc, OUTPUT)
