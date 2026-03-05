#!/usr/bin/env python3
"""
기출문제 전체 31문항(제120회 1~4교시) 스크립트 자동 생성기
"""

import os
from pathlib import Path

ROOT = Path(__file__).parent

QUESTIONS = {
    # 1교시 (13문항)
    (1, 1): "철근콘크리트 보의 응력교란구역",
    (1, 2): "PS 강재의 응력부식과 지연파괴",
    (1, 3): "철근콘크리트 슬래브의 균열율 (Crack Ratio)",
    (1, 4): "후설치 앵커볼트의 종류 및 문제점",
    (1, 5): "강구조물에서 부재의 면외좌굴",
    (1, 6): "사장교 주케이블: 평행소선케이블과 평행연선케이블",
    (1, 7): "PSC 거더의 횡만곡",
    (1, 8): "교량 구조물의 여용성, 중요도, 교량의 등급",
    (1, 9): "도로교설계기준 활하중",
    (1, 10): "안전성검토 수행절차",
    (1, 11): "매입형 강합성기둥과 충전형 강합성기둥",
    (1, 12): "비틀림 부재의 뒴(Warping)과 뒤틀림(Distortion)",
    (1, 13): "PSC 구조용 콘크리트와 PS강재 재료특성",

    # 2교시 (6문항)
    (2, 1): "반복 및 충격하중을 받는 강재구조 특성",
    (2, 2): "기존 교량 내진성능평가 및 확보방안",
    (2, 3): "3경간 연속 사장교 비대칭경간 구조계획",
    (2, 4): "단철근 보 휨철근량 및 최소전단철근 배치",
    (2, 5): "뼈대구조 횡방향 변위 좌굴하중 뼈대해석",
    (2, 6): "강합성 박스거더 지압보강재 축방향 압축강도",

    # 3교시 (6문항)
    (3, 1): "사장교 케이블 교체 및 파단 해석방법",
    (3, 2): "PSC 전단특성과 전단파괴 종류",
    (3, 3): "강박스 거더교 구조부재 및 개선형식",
    (3, 4): "트러스 구조계 수직탄성변위 계산",
    (3, 5): "ㄷ형강 전단중심(Shear Center) 편심거리 한계구하기",
    (3, 6): "PSC 거더교 교대부 신축이음장치 규모 산정",

    # 4교시 (6문항)
    (4, 1): "교통량 많은 차도 상부 신설교량 형식 및 가설공법",
    (4, 2): "철근콘크리트 구조물의 철근 피복두께 기준",
    (4, 3): "포스트텐션 긴장 시 즉시손실과 장기손실",
    (4, 4): "소수주 거더교의 구조적 특성",
    (4, 5): "해상 장대교량 와류진동",
    (4, 6): "단면 극한한계상태 휨강도 계산",
}

TEMPLATE = """#!/usr/bin/env python3
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
PERIOD = {period}
Q_NUM = {q_num}
TITLE = "{title}"

OUTPUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), f"{{EXAM_NO}}_{{PERIOD}}_{{Q_NUM}}_subnote.docx")

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
"""

def generate_scripts():
    print("Generating 31 scripts...")
    for (period, num), title in QUESTIONS.items():
        fname = f"gen_q{period}_{num}.py"
        path = ROOT / fname
        
        # 이미 존재하지만 예전 파일 포맷을 쓰는 경우(gen_q1_*.py)들은 그대로 두고
        # 새로운 교시/문항에 대해서만 템플릿 사용
        # 단, 이름 규칙상 기존 1교시 파일들(gen_q2_ps_steel.py)과는 별도의 prefix를 사용함 (gen_q1_2.py)
        
        content = TEMPLATE.format(period=period, q_num=num, title=title)
        path.write_text(content, encoding="utf-8")
        print(f"  Created: {fname}")

    # Generate a master run unifier script
    run_all_v2 = ROOT / "run_all_v2.py"
    master_script = """#!/usr/bin/env python3
import subprocess
import sys
from pathlib import Path
import time

ROOT = Path(__file__).parent

# 1교시:13, 2교시:6, 3교시:6, 4교시:6
TOTAL = 13 + 6 + 6 + 6

def main():
    print(f"\\n{'='*60}")
    print(f"  [제120회 토목구조기술사 전체 기출 서브노트 자동 생성]")
    print(f"  총 31문항 (1교시~4교시)")
    print(f"{'='*60}\\n")
    
    success = 0
    t0 = time.time()
    for period, max_q in [(1,13), (2,6), (3,6), (4,6)]:
        for q in range(1, max_q + 1):
            fname = f"gen_q{period}_{q}.py"
            p = ROOT / fname
            if p.exists():
                sys.stdout.write(f"[{period}교시 - {q:02d}번] 실행중... ")
                sys.stdout.flush()
                res = subprocess.run([sys.executable, str(p)], cwd=str(ROOT), capture_output=True, text=True)
                if res.returncode == 0:
                    print("✅ 완료")
                    success += 1
                else:
                    print(f"❌ 실패\\n{res.stderr}")
                    
    elapsed = time.time() - t0
    print(f"\\n{'='*60}")
    print(f"  완료: {success}/{TOTAL} 문항  |  총 소요: {elapsed:.1f}s")
    print(f"{'='*60}\\n")

if __name__ == "__main__":
    main()
"""
    run_all_v2.write_text(master_script, encoding="utf-8")
    print(f"  Created: run_all_v2.py")

if __name__ == "__main__":
    generate_scripts()
