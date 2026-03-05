#!/usr/bin/env python3
"""Q2: PS 강재의 응력부식과 지연파괴 (Stress Corrosion & Delayed Fracture of PS Steel)"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from subnote_framework import (
    create_document, save_document,
    add_exam_header, add_section_header, add_footer,
    add_content_line, add_content_sub, add_content_sub_highlight,
    add_data_table, add_insight_box, add_divider, add_strategy_section,
    add_callout_box, add_flow_diagram, add_spacer,
    add_run, set_paragraph_spacing,
    TABLE_W, ACCENT_RED, ACCENT_GOLD, NAVY, MEDIUM_GRAY, DARK_GRAY,
    Cm,
)


OUTPUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "120_1_2_PS_Steel.docx")

doc = create_document()

# ─── HEADER ──────────────────────────────────────────────────────────────────
add_exam_header(doc, 2, "PS 강재의 응력부식과 지연파괴")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 1: 개요
# ═══════════════════════════════════════════════════════════════════════════════
add_section_header(doc, 1, "개요", "Definition & Mechanism")

add_content_line(doc, 1, "", bold_prefix="응력부식(SCC): ")
add_content_sub_highlight(doc,
    "인장응력 + 부식환경(Cl\u207b, 수분)이 동시 작용 시 균열이 서서히 진전하여 ",
    "취성파괴에 이르는 현상", ".", indent=1.0)

add_content_line(doc, 2, "", bold_prefix="지연파괴(Delayed Fracture): ")
add_content_sub_highlight(doc,
    "고강도 PS 강재에 수소 원자가 침투하여 격자 결함에 축적되고, 시간 경과 후 ",
    "수소취화(Hydrogen Embrittlement)에 의한 돌발 파단", ".", indent=1.0)

add_content_line(doc, 3, "", bold_prefix="공통 핵심: ")
add_content_sub(doc,
    "두 현상 모두 고강도 강재(fpu \u2265 1,860 MPa)에서 주로 발생하며, 육안 검사로 사전 감지가 극히 곤란함.",
    indent=1.0)

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 2: 발생 메커니즘 및 영향 인자
# ═══════════════════════════════════════════════════════════════════════════════
add_section_header(doc, 2, "발생 메커니즘 및 영향 인자", "Mechanism & Influencing Factors")

col_w = [3.0, 4.8, TABLE_W - 3.0 - 4.8]
add_data_table(doc,
    headers=["구  분", "메커니즘", "주요 영향 인자"],
    data=[
        ["응력부식\n(SCC)",
         "양극 용해(Anodic Dissolution)\n→ 균열 선단 응력집중\n→ 서서히 진전 → 파단",
         "Cl\u207b 농도, pH < 12.5, 온도,\n인장응력 수준 (0.6fpu 이상)"],
        ["지연파괴\n(HE)",
         "음극 반응 → H\u2070 원자 생성\n→ 격자 내 확산·축적\n→ 수소취화 → 돌발 파단",
         "수소 공급원(그라우트 수분, 빗물),\n강재 강도 등급, 응력 이력"],
        ["공통 인자\n(Both)",
         "균열 개시 → 임계 응력확대계수(K_ISCC) 초과 시 진전",
         "부식 환경(해양·동결), 방식 불량,\n그라우트 충전 미비"],
    ],
    col_widths=col_w)

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 3: 실전 삽도 (Sketch guide)
# ═══════════════════════════════════════════════════════════════════════════════
add_section_header(doc, 3, "실전 삽도", "Hand-drawable Sketch for Exam")

add_callout_box(doc,
    "시험장 드로잉 전략",
    "1) PS 강연선 단면(7-Wire Strand) 원형 배치 → "
    "2) 외부로부터 Cl\u207b/H\u2082O 침투 화살표 → "
    "3) 강재 표면에 Pit(점식) 표시 → "
    "4) 균열 진전 방향 화살표(→파단) → "
    "5) 그라우트 미충전 Void 영역 해칭")

add_spacer(doc, 3)

# Mechanism flow diagram
add_flow_diagram(doc, [
    ("Cl⁻ / H₂O\n침투",    "FFEBEE", ACCENT_RED),
    ("Pit 발생 +\nH⁰ 축적", "FFF3E0", ACCENT_GOLD),
    ("SCC/HE\n파단",        "DCEEFB", NAVY),
])

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 4: 방지 대책 및 KDS 기준
# ═══════════════════════════════════════════════════════════════════════════════
add_section_header(doc, 4, "방지 대책 및 설계 기준", "Prevention & KDS 14 20:2024")

col_w4 = [2.8, 5.0, TABLE_W - 2.8 - 5.0]
add_data_table(doc,
    headers=["대책 구분", "핵심 내용", "KDS 관련 조항"],
    data=[
        ["재료 선정",
         "저릴랙세이션 강연선 사용\npH 12.5 이상 유지 가능 그라우트",
         "KDS 14 20 50\n(PS 강재 품질 규정)"],
        ["시공 관리",
         "진공 그라우팅으로 Void 제거\n방청유(VPI) 적용 및 습윤 관리",
         "KDS 14 20 54\n(그라우팅 시공 기준)"],
        ["구조 설계",
         "응력 제한: 0.80fpy, 0.74fpu\n부재 균열폭 제한 (0.2mm 이하)",
         "KDS 14 20 30\n(허용응력 설계)"],
        ["유지 관리",
         "전위차 측정(Half-cell)\n잔류 Cl\u207b 정량 분석",
         "시설물안전법\n정밀안전진단 항목"],
    ],
    col_widths=col_w4)

p = doc.add_paragraph()
set_paragraph_spacing(p, before=4, after=2, line_spacing=1.3)
p.paragraph_format.left_indent = Cm(0.4)
add_run(p, "\u25b6 ", "Arial", 9, bold=True, color=ACCENT_GOLD)
add_run(p, "핵심 원칙: ", "Malgun Gothic", 9, bold=True, color=NAVY)
add_run(p, "수소 공급 차단(그라우트 충전) + 부식 환경 제거(pH 관리) = 이중 방어 전략",
        "Malgun Gothic", 9, color=DARK_GRAY)

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 5: 기술사적 소견
# ═══════════════════════════════════════════════════════════════════════════════
add_section_header(doc, 5, "기술사적 소견", "Professional Insight")

add_insight_box(doc, [
    ("실무 경험 (17년):",
     "PSC 교량 텐던 파단 사고의 80% 이상이 그라우트 미충전 구간에서 발생. "
     "시공 단계의 그라우팅 품질 관리가 사후 보수보다 경제적·구조적으로 압도적 우위."),
    ("설계 착안점:",
     "단순히 강재 강도를 높이는 것이 아닌, 부식 환경과의 상호작용을 고려한 내구성 설계가 기술사의 핵심 판단임."),
    ("최신 동향:",
     "2024 KDS는 외부 텐던의 교체 가능 설계를 권장하며, "
     "Electrically Isolated Tendon(전기절연 텐던) 기술이 해외에서 확산 추세."),
])

# ─── DIVIDER & STRATEGY ─────────────────────────────────────────────────────
add_divider(doc)

add_strategy_section(doc, [
    ("핵심 키워드",
     "Stress Corrosion Cracking (SCC)  |  Hydrogen Embrittlement (HE)  |  K_ISCC  |  pH 12.5  |  Void"),
    ("반드시 포함",
     "\u2460 SCC와 HE의 메커니즘 차이(양극용해 vs 수소침투)  "
     "\u2461 고강도 강재의 취약성(fpu\u22651,860MPa)  "
     "\u2462 그라우트 충전의 결정적 중요성"),
    ("유사 기출",
     "\u2022 115회 1-9 (PS 강재 부식)  \u2022 122회 2-4 (그라우팅 품질)  \u2022 128회 1-7 (내구성 설계)"),
    ("합격 포인트",
     "SCC/HE 메커니즘의 '화학적 차이'를 명확히 구분하는 답안이 고득점의 관건. "
     "삽도에서 H\u2070 침투 경로를 반드시 표현할 것."),
])

add_footer(doc, 2, "PS Steel SCC & Delayed Fracture")
save_document(doc, OUTPUT)
