# Civil Answer Backend (MVP)

프론트 `solve_120.html`에서 사용하는 질문 분석/자동 답안 생성 API입니다.

## 1) 설치

```bash
cd backend
npm install
```

## 2) 환경 변수

`.env.example`를 복사해 `.env` 생성:

```bash
copy .env.example .env
```

- `OPENAI_API_KEY`가 없으면 로컬 폴백 템플릿으로 답안을 생성합니다.
- `OPENAI_API_KEY`가 있으면 OpenAI를 우선 시도합니다.
- `GEMINI_API_KEY`가 있으면 Gemini를 폴백으로 시도합니다.
- 두 provider 모두 실패하면 로컬 폴백 템플릿으로 답안을 생성합니다.

## 3) 실행

```bash
npm start
```

기본 주소: `http://localhost:8787`

## 4) API

- `GET /health`
- `POST /api/analyze-questions` `{ text }`
- `POST /api/search-context` `{ query }`
- `POST /api/generate-answer` `{ question, instruction }`

응답에는 필요 시 아래 진단 필드가 포함됩니다.

- `providers`: provider 키 설정 여부
- `llmDiagnostics`: provider별 호출 상태(`success`/`skipped`/`failed`)와 사유

## 5) 프론트 연결

`solve_120.html`의 외부 API URL에 아래를 입력:

- `http://localhost:8787/api/generate-answer`
