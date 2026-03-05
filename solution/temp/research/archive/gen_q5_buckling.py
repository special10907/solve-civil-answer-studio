#!/usr/bin/env python3
"""Q5: 강구조물에서 부재의 면외좌굴 (Out-of-plane Buckling in Steel Structures)"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from subnote_framework import *  # noqa: F401,F403

OUTPUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "120_1_5_Steel_Buckling.docx")

doc = create_document()

# ─── HEADER ──────────────────────────────────────────────────────────────────
add_exam_header(doc, 5, "강구조물에서 부재의 면외좌굴 (Out-of-plane Buckling)")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 1: 개요
# ═══════════════════════════════════════════════════════════════════════════════
add_section_header(doc, 1, "개요", "Definition — In-plane vs. Out-of-plane")

add_content_line(doc, 1, "", bold_prefix="면외좌굴 정의: ")
add_content_sub_highlight(doc,
    "부재에 작용하는 하중 평면(재하면)을 벗어나 ",
    "약축(Weak Axis) 방향으로 횡방향 변위가 발생하는 불안정 현상", ".", indent=1.0)

add_content_line(doc, 2, "", bold_prefix="면내좌굴과의 차이: ")
add_content_sub(doc,
    "면내좌굴(In-plane)은 하중 작용면 내에서 발생하며, 부재의 강축(Strong Axis)이 지배. "
    "면외좌굴은 약축 방향으로 발생하므로 단면 2차모멘트(I_y)가 작은 부재에서 치명적.",
    indent=1.0)

add_content_line(doc, 3, "", bold_prefix="설계 핵심: ")
p = doc.add_paragraph()
set_paragraph_spacing(p, before=0, after=3, line_spacing=1.3)
p.paragraph_format.left_indent = Cm(1.0)
add_run(p, "횡비틀림좌굴(LTB) 방지를 위한 ", "Malgun Gothic", 10, color=DARK_GRAY)
add_run(p, "횡지지(Lateral Bracing) 간격 확보", "Malgun Gothic", 10, bold=True, color=NAVY)
add_run(p, "가 강구조 설계의 핵심 안전 요소.", "Malgun Gothic", 10, color=DARK_GRAY)

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 2: 면외좌굴의 유형 분류
# ═══════════════════════════════════════════════════════════════════════════════
add_spacer(doc, 5)
add_section_header(doc, 2, "면외좌굴의 유형 분류", "Classification of Out-of-plane Buckling")

col_w = [3.0, 5.0, TABLE_W - 3.0 - 5.0]
add_data_table(doc,
    headers=["좌굴 유형", "발생 메커니즘", "설계 검토 사항"],
    data=[
        ["횡비틀림좌굴\n(LTB: Lateral-\nTorsional Buckling)",
         "휨 부재의 압축 플랜지가\n약축 방향으로 횡변위 +\n비틀림이 동시 발생",
         "비지지길이 L_b \u2264 L_p (소성)\n또는 L_p < L_b \u2264 L_r (비탄성)\nKDS 14 31 25 준수"],
        ["횡좌굴\n(Lateral Buckling)",
         "압축재(기둥, 현재)가\n약축 방향으로 횡변위 발생\n(비틀림 미동반)",
         "세장비 KL/r_y 검토\n유효좌굴길이계수 K 산정\n가새 배치 계획"],
        ["판좌굴\n(Plate Buckling)\n\u2014 면외 방향",
         "얇은 복부판(Web)이\n면외 방향으로 파형 변형\n전단좌굴 포함",
         "판폭두께비 b/t 검토\n보강재(Stiffener) 배치\nKDS 14 31 20 준수"],
    ],
    col_widths=col_w)

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 3: 실전 삽도
# ═══════════════════════════════════════════════════════════════════════════════
add_spacer(doc, 5)
add_section_header(doc, 3, "실전 삽도", "Hand-drawable Sketch for Exam")

add_callout_box(doc,
    "시험장 드로잉 전략",
    "1) I형 거더 입면도(강축 방향) → "
    "2) 압축 플랜지에 횡변위 화살표(\u2190\u2192) 표시 → "
    "3) 비틀림 회전(\u21bb) 표시 → "
    "4) 횡지지점(Bracing Point) 위치에 \u25b2 기호 → "
    "5) L_b (비지지길이) 치수선 기입")

add_spacer(doc, 3)

# LTB diagram using flow table
diag = doc.add_table(rows=2, cols=5)
diag.alignment = WD_TABLE_ALIGNMENT.CENTER
set_table_width_fixed(diag, CONTENT_WIDTH_CM * 0.9)
dw = CONTENT_WIDTH_CM * 0.9 / 5
set_table_col_widths(diag, [dw]*5)
remove_table_borders(diag)

# Row 0: Beam zones
r0_data = [
    ("\u25b2\nBracing", "DCEEFB", NAVY),
    ("L_b\n(비지지구간)", "FFEBEE", ACCENT_RED),
    ("\u25b2\nBracing", "DCEEFB", NAVY),
    ("L_b\n(비지지구간)", "FFEBEE", ACCENT_RED),
    ("\u25b2\nBracing", "DCEEFB", NAVY),
]
for i, (txt, bg, clr) in enumerate(r0_data):
    c = diag.cell(0, i)
    set_cell_shading(c, bg)
    set_cell_margins(c, top=30, bottom=30, left=15, right=15)
    c.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
    p = c.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_run(p, txt, "Arial", 8.5, bold=True, color=clr)

# Row 1: Description
diag.cell(1, 0).merge(diag.cell(1, 4))
mc = diag.cell(1, 0)
set_cell_margins(mc, top=20, bottom=20, left=15, right=15)
p = mc.paragraphs[0]
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
add_run(p, "L_b \u2264 L_p: \uc18c\uc131\ubaa8\uba58\ud2b8 \ud655\ubcf4  |  L_p < L_b \u2264 L_r: \ube44\ud0c4\uc131 LTB  |  L_b > L_r: \ud0c4\uc131 LTB",
        "Malgun Gothic", 8, italic=True, color=MEDIUM_GRAY)

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
set_paragraph_spacing(p, before=2, after=2, line_spacing=1.0)
add_run(p, "\u203b LTB = Lateral-Torsional Buckling  |  L_b = \ube44\uc9c0\uc9c0\uae38\uc774  |  L_p, L_r = \ud55c\uacc4 \uae38\uc774",
        "Malgun Gothic", 8, italic=True, color=MEDIUM_GRAY)

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 4: 횡지지(Lateral Bracing) 설계
# ═══════════════════════════════════════════════════════════════════════════════
add_spacer(doc, 5)
add_section_header(doc, 4, "횡지지(Lateral Bracing) 설계", "Bracing Requirements / KDS 14 31")

col_w4 = [2.8, 5.0, TABLE_W - 2.8 - 5.0]
add_data_table(doc,
    headers=["가새 유형", "특  징", "설계 요구사항"],
    data=[
        ["상대 가새\n(Relative Bracing)",
         "인접 지점 간의 상대 변위를\n억제하는 가새 시스템\n(X-bracing, K-bracing 등)",
         "\u03b2_br \u2265 2M_r C_b / (L_b h_o)\n가새 강성 + 강도 동시 확보"],
        ["절점 가새\n(Nodal Bracing)",
         "개별 지점의 절대 변위를\n억제하는 가새\n(횡보, 다이아프램 등)",
         "\u03b2_br \u2265 4M_r C_b / (L_b h_o)\n절점 가새는 2배 강성 필요"],
        ["연속 가새\n(Continuous Bracing)",
         "바닥판, 데크 등이 연속적으로\n압축 플랜지를 구속",
         "바닥판-플랜지 합성 검토\n전단연결재 강도 확인"],
    ],
    col_widths=col_w4)

p = doc.add_paragraph()
set_paragraph_spacing(p, before=4, after=2, line_spacing=1.3)
p.paragraph_format.left_indent = Cm(0.4)
add_run(p, "\u25b6 ", "Arial", 9, bold=True, color=ACCENT_GOLD)
add_run(p, "핵심 원칙: ", "Malgun Gothic", 9, bold=True, color=NAVY)
add_run(p, "가새의 '강성(Stiffness)'과 '강도(Strength)'를 동시에 만족해야 유효한 횡지지 — "
        "어느 하나만으로는 좌굴 방지 불가",
        "Malgun Gothic", 9, color=DARK_GRAY)

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 5: 기술사적 소견
# ═══════════════════════════════════════════════════════════════════════════════
add_spacer(doc, 5)
add_section_header(doc, 5, "기술사적 소견", "Professional Insight")

add_insight_box(doc, [
    ("실무 경험 (17년):",
     "강교량 면외좌굴 사고의 대부분은 가새(Bracing) 자체의 파단이 아니라, "
     "'가새 접합부(Connection)'의 볼트 파단·용접 결함에서 기인함. "
     "접합부 설계가 가새 설계 이상으로 중요."),
    ("설계 착안점:",
     "거더 가설(Erection) 단계에서 바닥판 미합성 상태의 LTB가 가장 위험한 시나리오. "
     "시공 중 임시 가새 계획을 설계 단계에서 반드시 수립해야 함."),
    ("최신 경향:",
     "KDS 14 31(2024)에서는 가새의 강성·강도 요구사항을 별도 조항으로 명시하고 있으며, "
     "비선형 좌굴 해석(Eigenvalue Analysis)을 통한 검증을 권장."),
])

# ─── DIVIDER & STRATEGY ─────────────────────────────────────────────────────
add_divider(doc)

add_strategy_section(doc, [
    ("핵심 키워드",
     "LTB (Lateral-Torsional Buckling)  |  L_b (비지지길이)  |  Lateral Bracing  |  KL/r_y  |  면외좌굴"),
    ("반드시 포함",
     "\u2460 면내/면외좌굴 구분 (강축 vs 약축)  "
     "\u2461 LTB 3구간 (소성/비탄성/탄성)  "
     "\u2462 가새의 강성+강도 동시 요구"),
    ("유사 기출",
     "\u2022 109회 1-7 (LTB)  \u2022 116회 2-5 (가새 설계)  \u2022 124회 1-3 (좌굴 안정성)"),
    ("합격 포인트",
     "삽도에서 I형 거더의 압축 플랜지 횡변위 + 비틀림을 동시에 표현하고, "
     "비지지길이 L_b 구간을 명확히 표기하면 확실한 차별화."),
])

add_footer(doc, 5, "Out-of-plane Buckling & LTB")
save_document(doc, OUTPUT)
