계획: AI 기반 첨부파일 분석 및 검증 작업 계획

목표
- `solve_120.html`의 문제 자동 추출을 OCR 대신 첨부파일 우선 AI 파이프라인으로 안정화
- 로컬 모의 분석 백엔드 유지 및 테스트 엔드투엔드(헤드리스) 검증 흐름 유지
- 비디오/오디오 첨부에 대한 ASR 옵션 마련(사용자 선택 구현)
- 보안 스캔(로컬 npm audit + Trivy) 및 CI 통합(이미 추가된 워크플로 유지)
- 레포 전역 규칙 `.github/instructions/global.rules.md` 초안 작성 및 커밋

우선순위 체크리스트
- [x] 오프라인 자산(폰트 등) 벤더링 및 콘솔 잡음 억제
- [x] 페이지 에러(PAGE_ERROR) 방어 코드 적용
- [x] PDF OCR MVP 비활성화 및 첨부파일 우선 파이프라인 구현
- [x] 로컬 모의 분석 백엔드(`server/index.js`) 구현 및 `/api/analyze-questions`, `/api/analyze-attachments`, `/api/analyze-webpage`, `/api/validate-keys` 추가
- [x] 클라이언트에서 Foundry 엔드포인트 감지 시 분석 호출을 로컬 분석 백엔드로 라우팅하도록 수정
- [x] 헤드리스 캡처(harvest) 스크립트 추가 및 실행하여 콘솔 로그 + 스크린샷 확보
- [x] 서버 재시작/테스트 스크립트(`restart_server.ps1`, `server/test_post*.js`) 추가
- [x] 로컬 보안 스캔 실행 (`npm audit`, `trivy`) — 취약점 없음 보고
- [x] Dependabot 및 Trivy + npm audit GH 워크플로 추가
- [x] Codacy Actions 워크플로 추가 (실제 Codacy CLI는 사용자가 설치/허용 여부 결정)
- [ ] `.github/instructions/global.rules.md` 초안 작성 및 커밋
- [ ] 비디오/오디오 첨부용 ASR 통합 — 사용자 선택 방식 구현
  - 옵션 A: 클라이언트에서 사용자가 ASR 여부 선택 (간단)
  - 옵션 B: 서버측 로컬 ASR(whisper 등) — 더 편리하지만 의존성/리소스 필요
  - 옵션 C: 외부 ASR API 연동 — 비용/키 관리 필요
- [ ] 사용자 E2E 검증 (사용자 환경에서 헤드리스+정적 서버 실행하여 테스트)
- [ ] Codacy CLI 설치 및 WSL/Codacy 분석(사용자가 허락하면 진행)
- [ ] CI에 글로벌 규칙 강제 적용(선택)

실행 단계(간단)
1. `.github/instructions/global.rules.md` 초안 작성(템플릿 제공 필요 시 요청)
2. ASR 전략 선택 — (권장) 우선 옵션 A로 빠르게 구현, 이후 B/C 중 하나 추가
3. 필요한 서버 의존성(ASR을 선택하면) `server/package.json`에 추가 후 `npm install` 및 로컬 보안 재검토
4. 사용자에게 E2E 검증 방법 제공(명령어와 기대 출력)
5. Codacy 통합 여부 결정 — CLI 설치/권한 제공 시 자동 분석 추가

검증(로컬)
- 서버 시작:
  ```powershell
  cd server
  npm start
  ```
- 정적 파일 서버(루트에서):
  ```bash
  python -m http.server 8000
  ```
- 헤드리스 캡처 실행:
  ```bash
  node .tools/headless_capture.js http://localhost:8000/solve_120.html
  ```
- 분석 엔드포인트 테스트:
  ```bash
  node server/test_post.js
  node server/test_post_attachment.js
  ```

간단 요약
- 남은 핵심 작업: 글로벌 규칙 파일 초안 작성, ASR 전략 선택 및 구현(필요 시), 사용자 E2E 검증, Codacy CLI 설치 여부 결정 및 적용.
