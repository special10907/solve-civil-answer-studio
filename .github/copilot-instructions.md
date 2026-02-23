 # Copilot / AI agent instructions — solve-civil-answer-studio

 목적: 이 레포지토리에서 AI 코딩 에이전트가 즉시 생산적으로 작업할 수 있도록
 중요 패턴, 실행 흐름, 통합 포인트와 파일 위치를 간결하게 정리합니다.

 요약(한줄)
 - 단일 페이지 SPA: `solve_120.html` (브라우저 UI + 모든 클라이언트 로직). 서버는 개발용 모의 analyze 백엔드 `server/index.js`.
 - 런타임: 정적 파일을 8000 포트로 서빙하고(예: `python -m http.server 8000`), 분석 백엔드는 기본 `http://localhost:8787`.

 핵심 파일/디렉터리
 - `solve_120.html` — 메인 SPA. 첨부파일 분석, 자동 추출 파이프라인, AI 엔드포인트 설정, OCR이 MVP에서 제거됨.
 - `server/index.js` — Express 기반 로컬 모의 분석 API (/api/analyze-questions, /api/analyze-attachments, /api/analyze-webpage, /api/validate-keys). 간단한 `simpleParseQuestions(text)` 파서 사용.
 - `.tools/headless_capture.js` — Puppeteer 기반 E2E 로그 + 스크린샷 수집기.
 - `server/test_post.js`, `server/test_post_attachment.js` — 백엔드 핑/검증 스크립트.
 - `server/restart_server.ps1` — Windows 개발자용 서버 재시작 헬퍼.
 - `trivy_summary.txt`, `.github/workflows/*` — 보안 스캔/CI 관련 파일.
 - `.github/instructions/codacy.instructions.md` — Codacy 정책(수정 후 분석 필수) 참고.

 아키텍처 및 데이터 흐름(요약)
 - 사용자(브라우저) → `solve_120.html` UI → 첨부파일 처리(readAttachmentTextExcerpt 등) → `/api/analyze-attachments` 또는 `/api/analyze-questions` 호출
 - 클라이언트는 `aiEndpointUrl`에 Foundry 스타일(127.0.0.1:5619) 설정을 감지하면 `isLikelyFoundryEndpoint()` 로직에 따라 호출 라우팅을 조정합니다. 이때 클라이언트는 `window.__ANALYZE_BACKEND__ || http://localhost:8787`을 우선 사용하도록 되어 있습니다.
 - 서버(`server/index.js`)는 텍스트 집계 → `simpleParseQuestions`로 질문 추출 후 JSON 응답(개발용 모의 LLM)

 중요한 개발 워크플로(명령어)
 - 정적 SPA 서빙: repo 루트에서
 ```
 python -m http.server 8000
 ```
 - 로컬 분석 백엔드 시작:
 ```
 cd server
 npm start
 ```
 - 백엔드 엔드포인트 검증:
 ```
 node server/test_post.js
 node server/test_post_attachment.js
 ```
 - 헤드리스 캡처(E2E 디버깅):
 ```
 node .tools/headless_capture.js http://localhost:8000/solve_120.html
 ```
 - 보안 스캔(수동): `server/` 및 루트에서 `npm audit` 실행, 저장된 `trivy_summary.txt` 확인

 프로젝트 특이 패턴 / 에이전트가 주의할 점
 - 단일 HTML에 많은 클라이언트 로직이 있으므로 수정 시 함수 스코프 전체(특히 전역 window 바인딩)를 확인하세요. 예: `analyzeAttachedFiles`, `extractQuestionsFromPdfText`, `generateDraftAnswersByApi` 등.
 - 안전성: OCR 관련 기능이 제거되어(stubbed) 있으니 OCR 코드 변경은 예상치 못한 부작용을 내포합니다.
 - Foundry 탐지: `isLikelyFoundryEndpoint()`를 건드리면 클라이언트가 분석 백엔드로 라우팅하는 동작이 바뀝니다 — 수정시 테스트 필수.
 - 로컬 모의백엔드와 클라이언트는 실패 페일오버로 로컬 분석(브라우저 내 파서)을 수행하므로, 에이전트는 서버가 없어도 동작 흐름을 이해해야 합니다.
 - Codacy 규칙: `.github/instructions/codacy.instructions.md`에 따르면 파일 편집 후 특정 파일에 대해 `codacy_cli_analyze`를 실행하도록 요구됩니다. (호스트에 CLI가 없을 수 있음 — 사용 전 확인)

 간단한 예시 (API 호출 형태)
 - POST /api/analyze-attachments
   body: { items: [{name,type,size,textExcerpt}], focus: "요약 포인트" }
 - POST /api/analyze-questions
   body: { text: "...extracted text...", source: "attachments" }

 테스트 가이드(변경 후)
 - 클라이언트 변경: 반드시 정적 서버(8000) + 분석 백엔드(8787)로 E2E 검증
 - 새로운 백엔드 라우트 추가시 `server/test_post*.js`에 테스트 추가
 - 보안/의존성 변경시 `npm audit` 및 트리비(Trivy) 실행

 커밋/PR 컨벤션(간단)
 - 문서/설정: `docs:` 또는 `chore:`
 - 기능 추가: `feat:`
 - 모의서버/테스트 수정: `test:` 또는 `chore(server):`

 문의/불명확한 부분
 - ASR(오디오 전사) 통합은 현재 모의(`/api/transcribe`) 또는 클라이언트 폴백으로 동작합니다. 실작업 전 ASR 전략(A/B/C)을 확인 요청하세요.

 피드백 요청: 이 파일을 검토한 뒤 누락된 통합 포인트나 자동화(예: 추가 테스트 스크립트)를 알려주시면 바로 반영하겠습니다.
