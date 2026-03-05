#!/usr/bin/env python3
"""
run_all.py — 제120회 토목구조기술사 1교시 서브노트 일괄 생성기

Usage:
    python3 run_all.py              # Q2~Q9 전부 생성
    python3 run_all.py --qlist 2 5 8  # 지정 문항만 생성
    python3 run_all.py --out /path/to/dir  # 출력 디렉터리 지정 (미지원 스크립트는 무시)
"""

import argparse
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).parent

SCRIPTS = {
    2: ("gen_q2_ps_steel",      "Q2: PS 강재 응력부식 & 지연파괴"),
    3: ("gen_q3_crack_ratio",    "Q3: 균열폭 제한 비율"),
    4: ("gen_q4_anchors",        "Q4: 앵커 설계"),
    5: ("gen_q5_buckling",       "Q5: 강구조물 면외좌굴"),
    6: ("gen_q6_cables",         "Q6: 케이블 종류"),
    7: ("gen_q7_curvature",      "Q7: PSC 곡률 마찰"),
    8: ("gen_q8_factors",        "Q8: 교량 영향선"),
    9: ("gen_q9_liveloads",      "Q9: 활하중"),
}


def run_script(module_name: str) -> bool:
    """Run a question script as a subprocess, return True on success."""
    script_path = ROOT / f"{module_name}.py"
    if not script_path.exists():
        print(f"  ⚠️  파일 없음: {script_path.name}")
        return False

    result = subprocess.run(
        [sys.executable, str(script_path)],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
    )
    # Print the script's output (success message from save_document)
    if result.stdout.strip():
        print(f"  {result.stdout.strip()}")
    if result.returncode != 0:
        print(f"  STDERR: {result.stderr.strip()}")
    return result.returncode == 0



def main():
    parser = argparse.ArgumentParser(description="서브노트 일괄 생성 스크립트")
    parser.add_argument(
        "--qlist", nargs="+", type=int, default=list(SCRIPTS.keys()),
        metavar="N", help="생성할 문항 번호 목록 (기본: 2~9 전부)"
    )
    args = parser.parse_args()

    targets = [q for q in args.qlist if q in SCRIPTS]
    if not targets:
        print("⚠️  유효한 문항 번호가 없습니다 (2~9 범위).")
        sys.exit(1)

    print(f"\n{'='*60}")
    print(f"  📄 토목구조기술사 1교시 서브노트 일괄 생성")
    print(f"  대상 문항: {targets}")
    print(f"{'='*60}\n")

    results = {}
    total_start = time.time()

    for q in targets:
        module_name, title = SCRIPTS[q]
        print(f"[{q:02d}] {title}")
        t0 = time.time()
        ok = run_script(module_name)
        elapsed = time.time() - t0
        results[q] = ok
        print(f"     {'✅ 완료' if ok else '❌ 실패'} ({elapsed:.1f}s)\n")

    total_elapsed = time.time() - total_start
    success = sum(1 for v in results.values() if v)
    fail    = len(results) - success

    print(f"{'='*60}")
    print(f"  완료: {success}/{len(results)} 문항  |  총 소요: {total_elapsed:.1f}s")
    if fail:
        failed_qs = [str(q) for q, ok in results.items() if not ok]
        print(f"  실패 문항: Q{', Q'.join(failed_qs)}")
    print(f"{'='*60}\n")

    sys.exit(0 if fail == 0 else 1)


if __name__ == "__main__":
    main()
