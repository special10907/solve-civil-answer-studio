#!/usr/bin/env python3
"""Q4: 후설치 앵커볼트의 종류 및 문제점 (Types & Issues of Post-installed Anchor Bolts)"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from subnote_framework import *  # noqa: F401,F403

OUTPUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "120_1_4_Anchors.docx")

doc = create_document()

# ─── HEADER ──────────────────────────────────────────────────────────────────
add_exam_header(doc, 4, "후설치 앵커볼트의 종류 및 문제점")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 1: 개요
# ═══════════════════════════════════════════════════════════════════════════════
add_section_header(doc, 1, "개요", "Definition & Classification")

add_content_line(doc, 1, "", bold_prefix="정의: ")
add_content_sub_highlight(doc,
    "콘크리트 경화 후 천공(Drilling)하여 설치하는 정착 장치로, ",
    "기존 구조물에 대한 증축·보수·설비 고정에 필수적인 접합 수단", ".", indent=1.0)

add_content_line(doc, 2, "", bold_prefix="선설치 앵커와의 차이: ")
add_content_sub(doc,
    "선설치(Cast-in-place) 앵커는 콘크리트 타설 전 매입하나, "
    "후설치(Post-installed) 앵커는 경화 후 설치하므로 시공 자유도가 높으나 강도 불확실성 존재.",
    indent=1.0)

add_content_line(doc, 3, "", bold_prefix="설계 기준: ")
p = doc.add_paragraph()
set_paragraph_spacing(p, before=0, after=3, line_spacing=1.3)
p.paragraph_format.left_indent = Cm(1.0)
add_run(p, "KDS 14 20 54 (콘크리트 앵커 설계)  |  ACI 318 Chapter 17  |  ETAG 001 (유럽 인증)", "Malgun Gothic", 10, color=DARK_GRAY)

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 2: 종류별 비교 (Mechanical vs Chemical)
# ═══════════════════════════════════════════════════════════════════════════════
add_spacer(doc, 5)
add_section_header(doc, 2, "종류별 비교", "Mechanical vs. Chemical Anchors")

col_w = [2.5, 4.0, 4.0, TABLE_W - 2.5 - 4.0 - 4.0]
add_data_table(doc,
    headers=["구  분", "기계식 앵커\n(Mechanical)", "화학식 앵커\n(Chemical)", "비  고"],
    data=[
        ["원리",
         "확장(Expansion) 또는\n언더컷(Undercut)에 의한\n기계적 마찰·지압 정착",
         "에폭시/비닐에스터 등\n화학 접착제(Adhesive)에\n의한 부착 정착",
         "하중 전달\n메커니즘 차이"],
        ["세부 유형",
         "\u2022 토크형(Torque-controlled)\n\u2022 변위형(Displacement-ctrl)\n\u2022 언더컷형(Undercut)",
         "\u2022 캡슐형(Capsule)\n\u2022 주입형(Injection)\n\u2022 하이브리드형",
         "언더컷형이\n가장 고신뢰"],
        ["시공성",
         "즉시 하중 재하 가능\n특수 장비 불요\n균열 콘크리트 사용 가능",
         "양생 시간 필요(수 시간)\n청소 상태에 민감\n온도 의존성 있음",
         "긴급 시공 시\n기계식 유리"],
        ["인장 강도",
         "콘크리트 콘 파괴 지배\n(Concrete Cone Breakout)",
         "부착 파괴 지배\n(Bond Failure)",
         "파괴 모드가\n설계 핵심"],
        ["내구성",
         "아연 도금/스테인리스\n내식 처리 필요",
         "접착제 열화(크리프)\n장기 내구성 검증 필요",
         "화학식은\n고온 취약"],
    ],
    col_widths=col_w)

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 3: 파괴 모드 (Failure Modes)
# ═══════════════════════════════════════════════════════════════════════════════
add_spacer(doc, 5)
add_section_header(doc, 3, "파괴 모드 및 연단 거리", "Failure Modes & Edge Distance")

add_callout_box(doc,
    "시험장 드로잉 전략",
    "1) 콘크리트 단면에 앵커 삽입 단면도 → "
    "2) 콘 파괴(45\u00b0 원추형) 해칭 → "
    "3) 연단 거리 c\u2081, c\u2082 치수선 → "
    "4) 인접 앵커 간격 s 표시 → "
    "5) 파괴 원추 겹침(Group Effect) 영역 음영")

add_spacer(doc, 3)

col_w3 = [3.0, 5.0, TABLE_W - 3.0 - 5.0]
add_data_table(doc,
    headers=["파괴 모드", "설  명", "설계 검토 사항"],
    data=[
        ["강재 파단\n(Steel Failure)",
         "앵커 볼트 자체의 인장/전단\n강도 초과에 의한 파단",
         "N_sa = A_se \u00d7 f_uta\n연성 파괴 유도가 이상적"],
        ["콘크리트 콘 파괴\n(Cone Breakout)",
         "45\u00b0 원추형 콘크리트 분리\n인장력 작용 시 지배적 파괴",
         "N_cb = k\u221a(f'c) \u00d7 h_ef^1.5\n연단거리·간격에 민감"],
        ["인발 파괴\n(Pull-out)",
         "앵커 확장부의 지압면적\n부족에 의한 빠짐 현상",
         "N_p = 8A_brg \u00d7 f'c\n확장부 크기 확인 필수"],
        ["쪼갬 파괴\n(Splitting)",
         "좁은 연단/두께에서\n콘크리트 쪼개짐",
         "최소 연단거리 c_min 확보\nc \u2265 1.5h_ef (KDS)"],
        ["부착 파괴\n(Bond, 화학식 한정)",
         "접착제 경계면의 부착\n강도 초과에 의한 파단",
         "N_a = \u03c4 \u00d7 \u03c0d \u00d7 h_ef\n천공홀 청소가 결정적"],
    ],
    col_widths=col_w3)

p = doc.add_paragraph()
set_paragraph_spacing(p, before=4, after=2, line_spacing=1.3)
p.paragraph_format.left_indent = Cm(0.4)
add_run(p, "\u25b6 ", "Arial", 9, bold=True, color=ACCENT_GOLD)
add_run(p, "핵심 원칙: ", "Malgun Gothic", 9, bold=True, color=NAVY)
add_run(p, "연단거리(Edge Distance)와 앵커 간격(Spacing)은 콘 파괴·쪼갬 파괴의 지배 인자 — "
        "최소값 미확보 시 설계 강도 대폭 감소",
        "Malgun Gothic", 9, color=DARK_GRAY)

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 4: 주요 문제점 및 대책
# ═══════════════════════════════════════════════════════════════════════════════
add_spacer(doc, 5)
add_section_header(doc, 4, "현장 문제점 및 대책", "Field Issues & Countermeasures")

col_w4 = [3.0, 5.5, TABLE_W - 3.0 - 5.5]
add_data_table(doc,
    headers=["문제점", "원  인", "대  책"],
    data=[
        ["인발(Pull-out)\n조기 파괴",
         "천공 깊이 부족, 확장 불완전\n화학식: 홀 청소 미흡",
         "시공 후 확인 인발 시험(Proof Test)\n설계 하중의 1.2~1.5배 확인"],
        ["그룹 효과\n(Group Effect)",
         "앵커 간격 s < 3h_ef 시\n파괴 원추 겹침으로 강도 저하",
         "최소 간격 s \u2265 3h_ef 확보\n또는 그룹 감소계수 적용"],
        ["화학 앵커\n고온 열화",
         "에폭시 Tg(유리전이온도)\n초과 시 부착 강도 급감",
         "내화 등급 확인 (ETA 인증)\nTg > 72\u00b0C 제품 사용"],
        ["균열 콘크리트\n영향",
         "균열부 콘크리트에서\n콘 파괴 강도 ~25% 감소",
         "균열 적용 계수(k_cr) 반영\n또는 언더컷 앵커 사용"],
    ],
    col_widths=col_w4)

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 5: 기술사적 소견
# ═══════════════════════════════════════════════════════════════════════════════
add_spacer(doc, 5)
add_section_header(doc, 5, "기술사적 소견", "Professional Insight")

add_insight_box(doc, [
    ("실무 경험 (17년):",
     "후설치 앵커 시공 현장의 70% 이상에서 천공 홀 청소 불량이 발견됨. "
     "화학식 앵커의 경우 이것만으로도 설계 강도의 50% 이상 손실 가능."),
    ("설계 착안점:",
     "후설치 앵커는 '연성 파괴(강재 파단)'를 유도하는 설계가 핵심. "
     "콘크리트 콘 파괴나 인발 파괴 같은 취성 파괴가 선행되지 않도록 h_ef, c, s를 확보해야 함."),
    ("최신 경향:",
     "2024 KDS 및 ACI 318-19에서는 지진 하중 작용 시 후설치 앵커의 성능 감소계수를 "
     "별도 규정하고 있으며, 내진 인증(Seismic Qualification) 제품 사용이 의무화 추세."),
])

# ─── DIVIDER & STRATEGY ─────────────────────────────────────────────────────
add_divider(doc)

add_strategy_section(doc, [
    ("핵심 키워드",
     "Pull-out  |  Cone Breakout  |  Edge Distance  |  Mechanical vs. Chemical  |  h_ef  |  Group Effect"),
    ("반드시 포함",
     "\u2460 기계식/화학식 앵커의 원리 차이  "
     "\u2461 5대 파괴 모드(강재·콘·인발·쪼갬·부착)  "
     "\u2462 연단거리·간격의 중요성 및 최소값"),
    ("유사 기출",
     "\u2022 112회 1-6 (앵커 파괴 모드)  \u2022 119회 2-2 (전단 연결재)  \u2022 126회 1-4 (부착 설계)"),
    ("합격 포인트",
     "파괴 모드별 설계식을 간략히라도 제시하고, 삽도에서 '콘 파괴 45\u00b0 원추'와 "
     "'연단거리 c' 치수선을 명확히 표현하면 확실한 고득점."),
])

add_footer(doc, 4, "Post-installed Anchor Bolts")
save_document(doc, OUTPUT)
