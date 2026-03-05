#!/usr/bin/env python3
"""Q8: 도로교설계기준(한계상태설계법) - 여용성, 중요도, 연성 (η_R, η_I, η_D)"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from subnote_framework import *  # noqa: F401,F403

OUTPUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "120_1_8_Bridge_Factors.docx")

doc = create_document()

# ─── HEADER ──────────────────────────────────────────────────────────────────
add_exam_header(doc, 8, "도로교설계기준(한계상태설계법) \u2014 여용성\u00b7중요도\u00b7연성")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 1: 개요
# ═══════════════════════════════════════════════════════════════════════════════
add_section_header(doc, 1, "개요", "LRFD Load Modifier \u03b7 = \u03b7_D \u00d7 \u03b7_R \u00d7 \u03b7_I")

add_content_line(doc, 1, "", bold_prefix="한계상태설계법(LRFD) 기본 철학: ")
add_content_sub_highlight(doc,
    "하중에는 하중계수(\u03b3), 저항에는 저항계수(\u03c6)를 적용하고, 추가로 ",
    "하중수정계수(\u03b7 = \u03b7_D \u00d7 \u03b7_R \u00d7 \u03b7_I)를 통해 구조물의 특성을 반영", ".", indent=1.0)

add_content_line(doc, 2, "", bold_prefix="기본 설계식: ")
p = doc.add_paragraph()
set_paragraph_spacing(p, before=0, after=3, line_spacing=1.3)
p.paragraph_format.left_indent = Cm(1.0)
add_run(p, "\u03b7 \u00d7 \u03a3(\u03b3_i \u00d7 Q_i) \u2264 \u03c6 \u00d7 R_n", "Arial", 11, bold=True, color=NAVY)
add_run(p, "   (여기서 \u03b7 = \u03b7_D \u00d7 \u03b7_R \u00d7 \u03b7_I \u2265 0.95)", "Malgun Gothic", 9, color=MEDIUM_GRAY)

add_content_line(doc, 3, "", bold_prefix="도입 배경: ")
add_content_sub(doc,
    "기존 허용응력설계(ASD)·강도설계법(USD)과 달리, 구조물의 '사회적 중요성'과 "
    "'파괴 후 거동(여용성·연성)'을 정량적으로 설계에 반영하기 위함.",
    indent=1.0)

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 2: 3대 하중수정계수 상세
# ═══════════════════════════════════════════════════════════════════════════════
add_spacer(doc, 5)
add_section_header(doc, 2, "3대 하중수정계수 상세", "\u03b7_D (Ductility) \u00b7 \u03b7_R (Redundancy) \u00b7 \u03b7_I (Importance)")

col_w = [2.2, 3.0, 3.5, 3.5, TABLE_W - 2.2 - 3.0 - 3.5 - 3.5]
add_data_table(doc,
    headers=["계수", "의  미", "\u2265 1.0 (불리)", "= 1.0 (일반)", "\u2264 1.0 (유리)"],
    data=[
        ["\u03b7_D\n(연성)",
         "파괴 시 연성거동\n확보 여부",
         "1.05\n비연성 부재\n(취성 파괴 우려)",
         "1.00\n일반 연성\n설계 기준 충족",
         "0.95\n추가 연성 확보\n(초과 배근 등)"],
        ["\u03b7_R\n(여용성)",
         "부재 파괴 시\n대체 하중경로\n존재 여부",
         "1.05\n비여용 구조\n(단순보, 단주 등)",
         "1.00\n일반 여용\n(연속교 등)",
         "0.95\n높은 여용성\n(다경간 연속)"],
        ["\u03b7_I\n(중요도)",
         "교량의 사회적\n중요도 등급",
         "1.05\n필수 교량\n(긴급 구조 노선 등)",
         "1.00\n일반 교량",
         "0.95\n상대적 저중요\n교량 (대체 노선 有)"],
    ],
    col_widths=col_w)

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 3: 실전 삽도 (계수 적용 흐름)
# ═══════════════════════════════════════════════════════════════════════════════
add_spacer(doc, 5)
add_section_header(doc, 3, "실전 삽도", "Load Modifier Application Flow")

add_callout_box(doc,
    "시험장 드로잉 전략",
    "1) LRFD 기본식 \u03b7\u2211\u03b3Q \u2264 \u03c6R_n 큰 글씨 → "
    "2) \u03b7 = \u03b7_D \u00d7 \u03b7_R \u00d7 \u03b7_I 전개 → "
    "3) 3개 계수 각각 1.05/1.00/0.95 조건 도표 → "
    "4) \u03b7 \u2265 0.95 하한 조건 명시 → "
    "5) 적용 예시: 비연성(1.05) \u00d7 비여용(1.05) \u00d7 필수(1.05) = 1.158")

add_spacer(doc, 3)

# Example calculation box
ex_tbl = doc.add_table(rows=1, cols=1)
ex_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
set_table_width_fixed(ex_tbl, TABLE_W)
cell = ex_tbl.cell(0, 0)
set_cell_shading(cell, "F0F4FF")
set_cell_margins(cell, top=50, bottom=50, left=100, right=100)

p = cell.paragraphs[0]
set_paragraph_spacing(p, before=0, after=0, line_spacing=1.2)
add_run(p, "  \uc801\uc6a9 \uc608\uc2dc (Worked Example)", "Malgun Gothic", 9, bold=True, color=NAVY)

examples = [
    ("Case 1 (최대 \u03b7):", "\u03b7_D=1.05 \u00d7 \u03b7_R=1.05 \u00d7 \u03b7_I=1.05 = 1.158  → 비연성·비여용·필수교량 (가장 보수적)"),
    ("Case 2 (일반):", "\u03b7_D=1.00 \u00d7 \u03b7_R=1.00 \u00d7 \u03b7_I=1.00 = 1.000  → 일반 교량 기본값"),
    ("Case 3 (최소 \u03b7):", "\u03b7_D=0.95 \u00d7 \u03b7_R=0.95 \u00d7 \u03b7_I=0.95 = 0.857 → 0.95 적용 (하한 제한)"),
]
for title, desc in examples:
    p2 = cell.add_paragraph()
    set_paragraph_spacing(p2, before=3, after=1, line_spacing=1.3)
    add_run(p2, f"  \u25b8 {title} ", "Malgun Gothic", 8.5, bold=True, color=DARK_NAVY)
    add_run(p2, desc, "Arial", 8.5, color=DARK_GRAY)

apply_table_borders(ex_tbl, HEADER_BG)

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 4: 한계상태별 적용
# ═══════════════════════════════════════════════════════════════════════════════
add_spacer(doc, 5)
add_section_header(doc, 4, "한계상태별 적용", "Application per Limit State")

col_w4 = [3.0, 4.5, TABLE_W - 3.0 - 4.5]
add_data_table(doc,
    headers=["한계상태", "\u03b7 적용 여부", "비  고"],
    data=[
        ["극한한계상태\n(Strength)",
         "\u03b7_D, \u03b7_R, \u03b7_I 모두 적용\n\u03b7 = \u03b7_D \u00d7 \u03b7_R \u00d7 \u03b7_I",
         "구조 안전성 지배\n가장 중요한 적용 대상"],
        ["사용한계상태\n(Service)",
         "\u03b7 = 1.0 (일반적)\n중요도만 선택 적용 가능",
         "사용성(균열, 처짐) 지배\n과도한 보수성 불필요"],
        ["피로한계상태\n(Fatigue)",
         "\u03b7 = 1.0",
         "피로 수명 별도 검토\n하중수정계수 미적용"],
        ["극단상황한계상태\n(Extreme Event)",
         "\u03b7 = 1.0",
         "지진, 선박충돌 등\n특수 하중 조합"],
    ],
    col_widths=col_w4)

p = doc.add_paragraph()
set_paragraph_spacing(p, before=4, after=2, line_spacing=1.3)
p.paragraph_format.left_indent = Cm(0.4)
add_run(p, "\u25b6 ", "Arial", 9, bold=True, color=ACCENT_GOLD)
add_run(p, "핵심 원칙: ", "Malgun Gothic", 9, bold=True, color=NAVY)
add_run(p, "\u03b7는 극한한계상태에서 가장 의미 있으며, \u03b7 \u2265 0.95 하한값을 반드시 기억할 것",
        "Malgun Gothic", 9, color=DARK_GRAY)

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 5: 기술사적 소견
# ═══════════════════════════════════════════════════════════════════════════════
add_spacer(doc, 5)
add_section_header(doc, 5, "기술사적 소견", "Professional Insight")

add_insight_box(doc, [
    ("실무 경험 (17년):",
     "실무에서 \u03b7 = 1.0으로 일괄 적용하는 경우가 많으나, "
     "단순보(비여용)이면서 필수 교량인 경우 \u03b7 = 1.05\u00d71.05\u00d71.05 = 1.158로 "
     "하중이 16% 증가하므로 설계 경제성에 큰 영향."),
    ("설계 착안점:",
     "여용성(\u03b7_R)은 구조 시스템의 '대체 경로' 유무로 결정되므로, "
     "단순 연속교라도 주거더 수가 2본이면 비여용으로 분류될 수 있음에 유의."),
    ("최신 경향:",
     "2016 도로교설계기준(한계상태설계법)은 AASHTO LRFD를 기반으로 하며, "
     "향후 개정에서 중요도 등급의 세분화(방재·국방 노선 구분) 논의 진행 중."),
])

# ─── DIVIDER & STRATEGY ─────────────────────────────────────────────────────
add_divider(doc)

add_strategy_section(doc, [
    ("핵심 키워드",
     "\u03b7 = \u03b7_D \u00d7 \u03b7_R \u00d7 \u03b7_I  |  LRFD  |  \u03b7 \u2265 0.95  |  "
     "1.05/1.00/0.95 체계  |  극한한계상태"),
    ("반드시 포함",
     "\u2460 기본 설계식 \u03b7\u2211\u03b3Q \u2264 \u03c6R_n  "
     "\u2461 3개 계수의 의미와 적용값(1.05/1.00/0.95)  "
     "\u2462 \u03b7 \u2265 0.95 하한 제한 조건"),
    ("유사 기출",
     "\u2022 114회 1-2 (LRFD 개요)  \u2022 120회 1-8 (\ubcf8 \ubb38\uc81c)  \u2022 131회 2-1 (하중조합)"),
    ("합격 포인트",
     "3개 계수를 표로 정리하고, 적용 예시(Case 1~3)를 수치로 제시하면 "
     "단순 개념 나열 대비 확실한 차별화. \u03b7 \u2265 0.95 하한 조건 언급은 필수."),
])

add_footer(doc, 8, "LRFD \u03b7_D \u00b7 \u03b7_R \u00b7 \u03b7_I")
save_document(doc, OUTPUT)
