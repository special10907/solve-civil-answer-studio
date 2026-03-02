# VS Code 작업 규칙 (통합본)

목적: 이 저장소에서 VS Code 기반 작업(사람/에이전트 공통)의 실행·수정·검증·보안 기준을 단일 문서로 통합합니다.

마지막 업데이트: 2026-03-02

## 1) 적용 범위

- 저장소 전체(`**`)에 적용합니다.
- 우선순위는 아래 순서를 따릅니다.
  1. `.github/instructions/codacy.instructions.md`
  2. `.github/instructions/global.rules.md` (본 문서)
  3. `.github/copilot-instructions.md`
  4. `.agent/rules/*.md`, `.agent/workflows/*.md`

## 2) 기본 실행 환경

- 메인 프론트는 단일 페이지: `solve_120.html`
- 분석 백엔드 기본 주소: `http://localhost:8787`
- 권장 로컬 실행:
  - 정적 서빙: `python -m http.server 8000`
  - 백엔드 실행: `cd server && npm start`
- E2E 점검은 가능하면 헤드리스 캡처 스크립트(`.tools/headless_capture.js`)로 수행합니다.

## 3) 수정 전/중 규칙

- 단일 HTML(`solve_120.html`) 수정 시, 전역 함수 영향 범위를 먼저 확인합니다.
- OCR 관련 코드는 MVP에서 제거/비활성화 상태이므로, 변경 시 부작용 검토를 필수로 합니다.
- LM Studio 엔드포인트 감지 로직(`isLikelyLmStudioEndpoint`) 수정 시 분석 라우팅 영향 테스트를 필수로 합니다.
- 큰 변경(아키텍처/의존성/배포 흐름)은 먼저 계획을 문서화한 뒤 진행합니다.

## 4) Codacy 고정 규칙

- Codacy 파라미터가 필요한 경우 항상 아래 값 사용:
  - `provider: gh`
  - `organization: special10907`
  - `repository: solve-civil-answer-studio`
- 파일 편집 직후, 편집한 파일 단위로 Codacy 분석을 즉시 수행합니다.
- Codacy CLI 미설치 시 임의 설치하지 말고, 안내 절차를 따릅니다.
- Codacy 연결 실패/미동작 시 MCP 설정 점검 안내 후 필요 시 Codacy 지원 문의를 권장합니다.

## 5) 의존성/보안 규칙

- 아래 작업 직후 보안 점검 필수:
  - `npm/yarn/pnpm install` 실행
  - `package.json`, `requirements.txt`, `pom.xml`, `build.gradle` 등 의존성 변경
- 기본 점검:
  - `npm audit`
  - Trivy 스캔
- 신규 취약점 발견 시, 다른 작업보다 우선하여 수정/완화 후 진행합니다.

## 6) 테스트/검증 규칙

- 프론트 변경 시: 8000(정적) + 8787(백엔드) 조합으로 실제 흐름 검증
- 백엔드 라우트 변경 시: `server/test_post.js`, `server/test_post_attachment.js` 보강 또는 실행
- 실패 폴백(브라우저 내 로컬 파서) 동작을 깨지 않도록 회귀 확인

## 7) 자동 실행(SafeToAutoRun) 가이드

- 자동 실행 허용 대상(비파괴 작업):
  - 파일/디렉터리 조회
  - 환경 상태 점검
  - 디렉터리 생성
  - 비파괴 빌드/테스트
- 사용자 명시 승인 필수(파괴 작업):
  - 삭제, 강제 리셋, 시스템 설정 변경 등

## 8) 커밋/변경 이력 권장

- 문서/설정: `docs:`, `chore:`
- 기능: `feat:`
- 모의 서버/테스트: `test:`, `chore(server):`
- 보안/의존성 변경은 근거(스캔 결과)를 PR 설명에 함께 남깁니다.

## 9) 유지보수 원칙

- 규칙 충돌 시 더 엄격한 규칙을 우선 적용합니다.
- 새 워크플로/도구 추가 시 본 문서를 먼저 갱신한 뒤 코드 변경을 진행합니다.

## 10) 참고 문서

- JARVIS 정체성/톤/운영 프로토콜은 `.agent/rules/jarvis_core.md`를 기준으로 합니다.
- 자동 실행 정책은 `.agent/rules/auto_run_policy.md`와 `.agent/workflows/turbo_all.md`를 참고합니다.

담당: 저장소 소유자 및 메인 기여자
