#!/usr/bin/env python3
import subprocess
import sys
from pathlib import Path
import time

ROOT = Path(__file__).parent

# 1교시:13, 2교시:6, 3교시:6, 4교시:6
TOTAL = 13 + 6 + 6 + 6

def main():
    print(f"\n{'='*60}")
    print(f"  [제120회 토목구조기술사 전체 기출 서브노트 자동 생성]")
    print(f"  총 31문항 (1교시~4교시)")
    print(f"{'='*60}\n")
    
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
                    print(f"❌ 실패\n{res.stderr}")
                    
    elapsed = time.time() - t0
    print(f"\n{'='*60}")
    print(f"  완료: {success}/{TOTAL} 문항  |  총 소요: {elapsed:.1f}s")
    print(f"{'='*60}\n")

if __name__ == "__main__":
    main()
