#!/usr/bin/env python3
"""Q7: PSC 거더의 횡만곡 (Horizontal Curvature in PSC Girders)"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from subnote_framework import *  # noqa: F401,F403

OUTPUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "120_1_7_PSC_Curvature.docx")

doc = create_document()

# ─── HEADER ──────────────────────────────────────────────────────────────────
add_exam_header(doc, 7, "PSC 거더의 횡만곡 (Horizontal Curvature)")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 1: 개요
# ═══════════════════════════════════════════════════════════════════════════════
add_section_header(doc, 1, "개요", "Definition & Structural Effects")

add_content_line(doc, 1, "", bold_prefix="횡만곡 PSC 거더: ")
add_content_sub_highlight(doc,
    "평면적으로 곡선 선형을 갖는 PSC 거더로, 직선 거더와 달리 ",
    "비틀림(Torsion)과 횡방향 편향력(Deviation Force)이 추가 발생", ".", indent=1.0)

add_content_line(doc, 2, "", bold_prefix="직선 PSC와의 차이: ")
add_content_sub(doc,
    "직선 거더는 축력(N) + 휨(M)이 지배하나, "
    "횡만곡 거더는 여기에 비틀림(T) + 횡방향 텐던 편향력(Lateral Deviation Force)이 추가됨.",
    indent=1.0)

add_content_line(doc, 3, "", bold_prefix="적용 사례: ")
add_content_sub(doc,
    "IC/JCT 연결 램프교, 도심 고가교, 곡선반경(R)이 작은 교량에서 불가피하게 적용.",
    indent=1.0)

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 2: 횡만곡에 의한 구조적 영향
# ═══════════════════════════════════════════════════════════════════════════════
add_spacer(doc, 5)
add_section_header(doc, 2, "횡만곡에 의한 구조적 영향", "Structural Effects of Curvature")

col_w = [3.0, 5.2, TABLE_W - 3.0 - 5.2]
add_data_table(doc,
    headers=["영향 요소", "발생 메커니즘", "설계 검토 사항"],
    data=[
        ["비틀림\n(Torsion)",
         "곡선 선형으로 인해 편심 하중\n→ 단면에 비틀림 모멘트 발생\nT = M / R (근사)",
         "St. Venant 비틀림 + 뒤틀림\n비틀림 저항 검토\n폐합 단면 유리 (Box Girder)"],
        ["텐던 횡방향\n편향력\n(Lateral Deviation)",
         "긴장력 P가 곡선 텐던을 따라\n작용 → 횡방향 분력 발생\nF_lat = P / R",
         "복부판(Web) 횡방향 휨 검토\n국부 보강(횡격벽) 배치\nKDS 14 20 54 준수"],
        ["외측 지점\n반력 증가",
         "곡선 외측에 하중 편심\n→ 외측 지점 반력 증대\n→ 내측 지점 부상(Uplift) 위험",
         "지점 반력 불균형 검토\n내측 지점 Uplift 방지\n받침 고정 방식 확인"],
        ["횡방향 처짐\n(Lateral Deflection)",
         "곡선 외측 방향으로\n수평 처짐 발생",
         "횡방향 변위 제한\n신축이음 횡방향 여유량 확보\n바닥판 슬래브 기울기 관리"],
    ],
    col_widths=col_w)

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 3: 실전 삽도
# ═══════════════════════════════════════════════════════════════════════════════
add_spacer(doc, 5)
add_section_header(doc, 3, "실전 삽도", "Hand-drawable Sketch for Exam")

add_callout_box(doc,
    "시험장 드로잉 전략",
    "1) 평면도: 곡선 거더 외곽선 + 곡선반경 R 기입 → "
    "2) 텐던 배치선 곡선 표시 → "
    "3) 텐던에서 외측 방향 화살표 F_lat = P/R → "
    "4) 단면도: Box 단면 + 복부판에 횡방향 응력 표시 → "
    "5) 외측 지점 반력 \u25b2(큰 화살표) / 내측 지점 \u25b3(작은 화살표 + Uplift 주의)")

add_spacer(doc, 3)

# Flow diagram
diag = doc.add_table(rows=1, cols=5)
diag.alignment = WD_TABLE_ALIGNMENT.CENTER
set_table_width_fixed(diag, CONTENT_WIDTH_CM * 0.9)
dw = CONTENT_WIDTH_CM * 0.9 / 5
set_table_col_widths(diag, [dw]*5)
remove_table_borders(diag)

flow = [
    ("곡선 선형\nR < \u221e", "DCEEFB", NAVY),
    ("\u2192", SECTION_BG, MEDIUM_GRAY),
    ("비틀림 T\n편향력 F_lat", "FFF3E0", ACCENT_GOLD),
    ("\u2192", SECTION_BG, MEDIUM_GRAY),
    ("복부판 횡휨\n지점 불균형", "FFEBEE", ACCENT_RED),
]
for i, (txt, bg, clr) in enumerate(flow):
    c = diag.cell(0, i)
    set_cell_shading(c, bg)
    set_cell_margins(c, top=35, bottom=35, left=15, right=15)
    c.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
    p = c.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    is_arrow = (txt == "\u2192")
    add_run(p, txt, "Arial" if is_arrow else "Malgun Gothic",
            16 if is_arrow else 9, bold=True, color=clr)

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
set_paragraph_spacing(p, before=2, after=2, line_spacing=1.0)
add_run(p, "\u203b F_lat = P/R  |  T \u2248 M/R  |  R = \uace1\uc120\ubc18\uacbd  |  P = \uae34\uc7a5\ub825",
        "Malgun Gothic", 8, italic=True, color=MEDIUM_GRAY)

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 4: 설계 시 주요 검토 사항
# ═══════════════════════════════════════════════════════════════════════════════
add_spacer(doc, 5)
add_section_header(doc, 4, "설계 시 주요 검토 사항", "Design Considerations / KDS 24 14")

col_w4 = [3.0, 5.0, TABLE_W - 3.0 - 5.0]
add_data_table(doc,
    headers=["검토 항목", "핵심 내용", "관련 기준"],
    data=[
        ["단면 선정",
         "Box Girder 원칙 (비틀림 저항)\n뒤틀림 강성 확보",
         "KDS 24 14 21\n폐합단면 우선 적용"],
        ["텐던 배치",
         "횡방향 편향력 분산\n복부판 내 텐던 편심 최소화",
         "KDS 14 20 54\n텐던 배치 상세"],
        ["횡격벽\n(Diaphragm)",
         "비틀림 응력 분산\n복부판 국부 보강\n지점부 반력 전달",
         "지간 내 L/4~L/3 간격\n지점부 필수 배치"],
        ["가설 중 안정성",
         "긴장 시 횡방향 편향력 관리\n가설 장비 편심 하중",
         "시공 단계별 안정성 검토\nFCM 공법 시 특별 주의"],
    ],
    col_widths=col_w4)

p = doc.add_paragraph()
set_paragraph_spacing(p, before=4, after=2, line_spacing=1.3)
p.paragraph_format.left_indent = Cm(0.4)
add_run(p, "\u25b6 ", "Arial", 9, bold=True, color=ACCENT_GOLD)
add_run(p, "핵심 원칙: ", "Malgun Gothic", 9, bold=True, color=NAVY)
add_run(p, "횡만곡 PSC의 핵심은 F_lat = P/R — 곡선반경이 작을수록 편향력 증가 → "
        "복부판 횡방향 휨 + 횡격벽 설계가 구조 안전의 관건",
        "Malgun Gothic", 9, color=DARK_GRAY)

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 5: 기술사적 소견
# ═══════════════════════════════════════════════════════════════════════════════
add_spacer(doc, 5)
add_section_header(doc, 5, "기술사적 소견", "Professional Insight")

add_insight_box(doc, [
    ("실무 경험 (17년):",
     "횡만곡 PSC 거더에서 가장 빈번한 문제는 긴장 시(Tensioning Stage) 횡방향 편향력에 의한 "
     "복부판 균열. 특히 곡선반경 R < 200m 구간에서 시공 중 균열 사례가 다수 보고됨."),
    ("설계 착안점:",
     "완성 상태뿐 아니라 '긴장 단계별' 횡방향 편향력 검토가 필수. "
     "텐던을 순차 긴장할 때 편향력의 불균형이 최대가 되는 시점을 파악해야 함."),
    ("최신 경향:",
     "3D 유한요소 해석(Solid Element)을 통한 복부판 국부 응력 검토가 보편화되고 있으며, "
     "KDS 2024에서는 곡선반경 R < 300m 시 별도 횡방향 검토를 의무화."),
])

# ─── DIVIDER & STRATEGY ─────────────────────────────────────────────────────
add_divider(doc)

add_strategy_section(doc, [
    ("핵심 키워드",
     "F_lat = P/R  |  Torsion (T \u2248 M/R)  |  횡격벽(Diaphragm)  |  Box Girder  |  Lateral Deviation Force"),
    ("반드시 포함",
     "\u2460 횡만곡에 의한 4대 영향(비틀림/편향력/지점불균형/횡처짐)  "
     "\u2461 F_lat = P/R 핵심 산정식  "
     "\u2462 복부판 횡휨 검토 + 횡격벽 배치"),
    ("유사 기출",
     "\u2022 113회 1-5 (곡선교)  \u2022 121회 2-1 (비틀림)  \u2022 127회 1-9 (PSC 설계)"),
    ("합격 포인트",
     "평면도(곡선 텐던 + F_lat 화살표) + 단면도(Box 단면 횡응력)를 함께 그리면 "
     "구조적 이해도를 확실히 어필. 시공 단계 편향력 언급은 가산점 확보 포인트."),
])

add_footer(doc, 7, "PSC Horizontal Curvature")
save_document(doc, OUTPUT)
