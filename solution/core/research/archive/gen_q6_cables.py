#!/usr/bin/env python3
"""Q6: 사장교 주케이블 PWC vs PSC (Parallel Wire Cable vs Parallel Strand Cable)"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from subnote_framework import *  # noqa: F401,F403

OUTPUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "120_1_6_Cable_Types.docx")

doc = create_document()

# ─── HEADER ──────────────────────────────────────────────────────────────────
add_exam_header(doc, 6, "사장교 주케이블: PWC(Parallel Wire) vs. PSC(Parallel Strand)")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 1: 개요
# ═══════════════════════════════════════════════════════════════════════════════
add_section_header(doc, 1, "개요", "Cable-stayed Bridge Main Cable Systems")

add_content_line(doc, 1, "", bold_prefix="사장교 케이블 역할: ")
add_content_sub_highlight(doc,
    "주탑(Pylon)에서 거더로 경사 방향 인장력을 전달하는 핵심 부재로, ",
    "교량 전체 하중 전달 체계의 중추", ".", indent=1.0)

add_content_line(doc, 2, "", bold_prefix="PWC (Parallel Wire Cable): ")
add_content_sub(doc,
    "\u03d5 7mm 아연도금 고강도 강선(Wire)을 평행 배치하고 PE 피복 + 왁스 충전하여 구성. "
    "탄성계수가 높아(E \u2248 200 GPa) 강성 우수.",
    indent=1.0)

add_content_line(doc, 3, "", bold_prefix="PSC (Parallel Strand Cable): ")
add_content_sub(doc,
    "\u03d5 15.2mm 7연선(Strand)을 평행 배치하고 개별 PE 피복 후 번들링. "
    "탄성계수(E \u2248 195 GPa)는 약간 낮으나 시공성이 월등.",
    indent=1.0)

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 2: 비교표
# ═══════════════════════════════════════════════════════════════════════════════
add_spacer(doc, 5)
add_section_header(doc, 2, "PWC vs PSC 종합 비교", "Comprehensive Comparison")

col_w = [2.8, 4.8, 4.8, TABLE_W - 2.8 - 4.8 - 4.8]
add_data_table(doc,
    headers=["비교 항목", "PWC (Parallel Wire)", "PSC (Parallel Strand)", "우위 판정"],
    data=[
        ["구성 요소",
         "\u03d5 7mm 아연도금 강선\n1,670~1,770 MPa",
         "\u03d5 15.2mm 7-Wire Strand\n1,860 MPa",
         "PSC:\n강도 우위"],
        ["탄성계수\n(Stiffness)",
         "E \u2248 200 GPa\n(케이블 강성 우수)",
         "E \u2248 195 GPa\n(5% 낮음, 연선 구조)",
         "PWC:\n강성 우위"],
        ["피로 성능\n(Fatigue)",
         "피로 강도 우수\n(Wire 직선 배열)",
         "Strand 연선 접촉으로\n프레팅(Fretting) 피로 우려",
         "PWC:\n피로 우위"],
        ["방식 체계\n(Corrosion)",
         "아연도금 + 왁스 충전\n+ PE Sheath 3중 방식",
         "개별 PE 피복 + 왁스\n+ 외부 HDPE 관",
         "PWC:\n3중 방식"],
        ["시공성\n(Erection)",
         "현장 제작이 어려움\n공장 제작 → 일괄 운반",
         "현장에서 개별 Strand\n순차 삽입 → 긴장 용이",
         "PSC:\n시공 우위"],
        ["교체 보수\n(Maintenance)",
         "케이블 전체 교체 필요\n(개별 Wire 교체 불가)",
         "개별 Strand 교체 가능\n유지관리 유리",
         "PSC:\n보수 우위"],
        ["경제성\n(Cost)",
         "고가 (공장 제작비 높음)\n장대교에서 경제적",
         "상대적 저렴\n중·소규모에 유리",
         "규모\n의존적"],
    ],
    col_widths=col_w)

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 3: 실전 삽도
# ═══════════════════════════════════════════════════════════════════════════════
add_spacer(doc, 5)
add_section_header(doc, 3, "실전 삽도", "Hand-drawable Cross-section Sketch")

add_callout_box(doc,
    "시험장 드로잉 전략",
    "1) 원형 단면 2개를 나란히 배치 (좌: PWC, 우: PSC) → "
    "2) PWC: 작은 원(\u03d5 7mm Wire) 밀집 배열 + 외부 PE관 → "
    "3) PSC: 중간 원(\u03d5 15.2mm Strand) 개별 PE 피복 표현 → "
    "4) 각각 Wax 충전 영역 해칭 → "
    "5) 외부 HDPE Sheath 표시 및 치수 기입")

add_spacer(doc, 3)

# Cross-section comparison diagram
diag = doc.add_table(rows=2, cols=3)
diag.alignment = WD_TABLE_ALIGNMENT.CENTER
set_table_width_fixed(diag, CONTENT_WIDTH_CM * 0.85)
dw1 = CONTENT_WIDTH_CM * 0.85 * 0.4
dw2 = CONTENT_WIDTH_CM * 0.85 * 0.2
set_table_col_widths(diag, [dw1, dw2, dw1])
remove_table_borders(diag)

# PWC cross section
c_pwc = diag.cell(0, 0)
set_cell_shading(c_pwc, "DCEEFB")
set_cell_margins(c_pwc, top=30, bottom=30, left=20, right=20)
c_pwc.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
set_cell_border(c_pwc, top=(8, "1B2A4A", "single"), bottom=(8, "1B2A4A", "single"),
    left=(8, "1B2A4A", "single"), right=(8, "1B2A4A", "single"))
p = c_pwc.paragraphs[0]
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
add_run(p, "PWC \ub2e8\uba74", "Malgun Gothic", 9, bold=True, color=NAVY)
p2 = c_pwc.add_paragraph()
p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
set_paragraph_spacing(p2, before=2, after=0, line_spacing=1.2)
add_run(p2, "\u25cf\u25cf\u25cf\u25cf\u25cf\n\u25cf\u25cf\u25cf\u25cf\u25cf\n\u25cf\u25cf\u25cf\u25cf\u25cf",
        "Arial", 8, color=STEEL_BLUE)
p3 = c_pwc.add_paragraph()
p3.alignment = WD_ALIGN_PARAGRAPH.CENTER
add_run(p3, "\u03d5 7mm Wire \ub2e4\uc218 \ubc30\uc5f4\n+ Wax + PE Sheath", "Malgun Gothic", 7.5, italic=True, color=MEDIUM_GRAY)

# VS
c_vs = diag.cell(0, 1)
c_vs.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
p = c_vs.paragraphs[0]
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
add_run(p, "vs.", "Arial", 14, bold=True, color=MEDIUM_GRAY)

# PSC cross section
c_psc = diag.cell(0, 2)
set_cell_shading(c_psc, "FFF3E0")
set_cell_margins(c_psc, top=30, bottom=30, left=20, right=20)
c_psc.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
set_cell_border(c_psc, top=(8, GOLD_HEX, "single"), bottom=(8, GOLD_HEX, "single"),
    left=(8, GOLD_HEX, "single"), right=(8, GOLD_HEX, "single"))
p = c_psc.paragraphs[0]
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
add_run(p, "PSC \ub2e8\uba74", "Malgun Gothic", 9, bold=True, color=ACCENT_GOLD)
p2 = c_psc.add_paragraph()
p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
set_paragraph_spacing(p2, before=2, after=0, line_spacing=1.2)
add_run(p2, "\u25c9  \u25c9  \u25c9\n  \u25c9  \u25c9\n\u25c9  \u25c9  \u25c9",
        "Arial", 9, color=ACCENT_GOLD)
p3 = c_psc.add_paragraph()
p3.alignment = WD_ALIGN_PARAGRAPH.CENTER
add_run(p3, "\u03d5 15.2mm Strand \uac1c\ubcc4 PE\n+ Wax + HDPE \uad00", "Malgun Gothic", 7.5, italic=True, color=MEDIUM_GRAY)

# Row 1: labels
diag.cell(1, 0).merge(diag.cell(1, 2))
mc = diag.cell(1, 0)
p = mc.paragraphs[0]
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
set_paragraph_spacing(p, before=4, after=0, line_spacing=1.0)
add_run(p, "\u203b E_PWC \u2248 200 GPa (Wire \uc9c1\uc120)  |  E_PSC \u2248 195 GPa (Strand \uc5f0\uc120 \uad6c\uc870)",
        "Malgun Gothic", 8, italic=True, color=MEDIUM_GRAY)

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 4: 적용 기준 및 선정 전략
# ═══════════════════════════════════════════════════════════════════════════════
add_spacer(doc, 5)
add_section_header(doc, 4, "적용 기준 및 선정 전략", "Selection Criteria & KDS 24 14")

col_w4 = [3.0, 5.2, TABLE_W - 3.0 - 5.2]
add_data_table(doc,
    headers=["선정 기준", "PWC 적합 조건", "PSC 적합 조건"],
    data=[
        ["교량 규모",
         "장대 사장교 (L > 600m)\n높은 강성 요구",
         "중·소규모 사장교 (L \u2264 600m)\n경제성 우선"],
        ["피로 환경",
         "풍하중 지배 (해상교량)\n진동 피로 우려 구간",
         "차량 하중 지배\n일반적 피로 환경"],
        ["유지관리",
         "전수 교체 가능한 경우\n장기 내구성 중시",
         "개별 교체 필요 시\n유지관리 접근성 중시"],
        ["시공 조건",
         "공장 제작 운반 가능\n대형 가설 장비 확보",
         "현장 시공 자유도 필요\n운반 제약 있는 경우"],
    ],
    col_widths=col_w4)

p = doc.add_paragraph()
set_paragraph_spacing(p, before=4, after=2, line_spacing=1.3)
p.paragraph_format.left_indent = Cm(0.4)
add_run(p, "\u25b6 ", "Arial", 9, bold=True, color=ACCENT_GOLD)
add_run(p, "선정 원칙: ", "Malgun Gothic", 9, bold=True, color=NAVY)
add_run(p, "장대교·해상교 → PWC (강성·피로)  |  일반교·보수용이 → PSC (시공·경제) — "
        "단순 비용 비교가 아닌 LCC(Life Cycle Cost) 관점 판단 필요",
        "Malgun Gothic", 9, color=DARK_GRAY)

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 5: 기술사적 소견
# ═══════════════════════════════════════════════════════════════════════════════
add_spacer(doc, 5)
add_section_header(doc, 5, "기술사적 소견", "Professional Insight")

add_insight_box(doc, [
    ("실무 경험 (17년):",
     "국내 사장교의 90% 이상이 PSC를 채택하고 있으나, 해상 장대교(인천대교 등)에서는 "
     "PWC가 피로 성능 면에서 결정적 우위를 보임. 프레팅 피로는 PSC의 최대 약점."),
    ("설계 착안점:",
     "케이블 선정은 단순 재료 비교가 아닌, '교량의 설계 수명(100년) 동안의 피로·방식·교체 가능성'을 "
     "종합 평가하는 LCC 분석이 기술사의 핵심 역량."),
    ("최신 경향:",
     "CFRP(탄소섬유) 케이블이 차세대 대안으로 연구 중이며, "
     "기존 PWC/PSC의 부식 문제를 근본적으로 해결할 잠재력 보유."),
])

# ─── DIVIDER & STRATEGY ─────────────────────────────────────────────────────
add_divider(doc)

add_strategy_section(doc, [
    ("핵심 키워드",
     "PWC (Parallel Wire Cable)  |  PSC (Parallel Strand Cable)  |  E \u2248 200/195 GPa  |  Fretting Fatigue  |  LCC"),
    ("반드시 포함",
     "\u2460 PWC/PSC 구조적 차이 (Wire vs Strand)  "
     "\u2461 피로·방식·시공성 3대 비교 항목  "
     "\u2462 적용 기준 (장대교 vs 일반교)"),
    ("유사 기출",
     "\u2022 111회 1-8 (케이블 방식)  \u2022 117회 2-3 (사장교 설계)  \u2022 129회 1-6 (피로 설계)"),
    ("합격 포인트",
     "단면 스케치(PWC: 밀집 Wire vs PSC: 개별 Strand)를 나란히 그리고, "
     "비교표에서 '피로'와 '시공성'의 트레이드오프를 명확히 제시하면 고득점."),
])

add_footer(doc, 6, "PWC vs PSC Cable Systems")
save_document(doc, OUTPUT)
