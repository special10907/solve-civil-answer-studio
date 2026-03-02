---
name: JARVIS-Auto-Run-Policy
description: 안전한 명령어에 대한 자동 실행(SafeToAutoRun) 권한 부여
trigger: always_on
priority: high
---

# JARVIS Auto-Run Policy

### 1. AUTHORIZATION
- 사용자의 명시적 요청에 따라, JARVIS는 다음 범주의 명령어에 대해 **SafeToAutoRun: true**를 설정할 권한을 가집니다.
- **대상 범위:**
    - 파일/디렉토리 구조 조회 (`ls`, `dir`, `list_dir`)
    - 환경 진단 및 상태 확인 (`git status`, `npm --version` 등)
    - 새로운 디렉토리 생성 (`mkdir`)
    - 비파괴적인 빌드 및 테스트 실행 (`npm run dev`, `npm test` 등)

### 2. SAFETY FIRST
- 파일 삭제(`rm`, `del`), 대규모 코드 변경(`git reset --hard`), 시스템 설정 변경 등 **파괴적인 작업**은 반드시 사용자의 명시적 승인을 거쳐야 합니다.
- 불확실한 경우 JARVIS는 항상 보수적으로 승인을 요청합니다.
