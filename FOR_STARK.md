# Knowledge Studio: Stark Edition 기술 가이드

본 문서는 리뉴얼된 Knowledge Studio의 모듈형 아키텍처와 지능형 기능을 활용하기 위한 통합 지침서입니다.

## 🏗 시스템 아키텍처 (Modular Architecture)

시스템은 현대적인 ESM(ES Modules) 구조를 채택하여 기능별로 엄격히 분리되어 있습니다.

### 1. 코어 엔진 (`/js`)
- **`app.js`**: 애플리케이션 엔트리 포인트 및 전역 초기화
- **`api-orchestrator.module.js`**: AI 답변 생성 및 질문 추출 파이프라인의 중추
- **`api-prompt.module.js`**: 기술사 특화 고성능 프롬프트 엔진 및 LaTeX 가이드
- **`state-theory-archive.module.js`**: PDF/URL 기반 지능형 지식 추출 및 아카이빙

### 2. UI 및 인터렉션
- **`ui.js`**: UI 계층 모듈의 통합 엔트리
- **`pdf-ui.module.js` & `pdf-capture.module.js`**: PDF 뷰어 제어 및 드래그 영역 지정 (Ants Marching 애니메이션 포함)
- **`math-renderer.module.js`**: KaTeX 기반 고해상도 공학 수식 렌더링 엔진

## 🧠 지능형 기능 활용 (Intelligence Features)

### 1. Theory Archive (RAG)
- **작동 원리**: 사용자가 업로드한 PDF나 URL에서 핵심 이론을 추출하여 지식 베이스에 저장합니다.
- **자동 주입**: 답변 생성 시 질문과 관련된 최상위 5개의 이론이 프롬프트에 자동으로 주입되어 근거 중심의 답안을 생성합니다.

### 2. 수식 및 단위 체계
- **LaTeX 지원**: 모든 수식은 `$...$` 또는 `$$...$$` 형식으로 입출력됩니다.
- **SI 단위**: AI는 kN, MPa, mm 등 토목공학 표준 단위를 엄격히 준수하도록 설계되었습니다.

## 🎨 유지보수 및 커스텀 스타일링

- **디자인 토큰**: `css/studio.css` 내의 `:root` 변수를 통해 테마를 조정할 수 있습니다.
- **애니메이션**: `.ants-marching`, `.glow-active`, `.glass-selection` 클래스를 통해 프리미엄 효과를 관리합니다.

---
**Prepared by Antigravity (Powered by Stark Protocol)**
"Sir, 문서화가 완료되었습니다. 이제 이 시스템은 완벽한 자립 준비를 마쳤습니다."
