# Knowledge Studio: Stark Edition User Guide (v27.2)

Sir, Knowledge Studio가 단순한 스크립트 모음에서 상용 수준의 지능형 워크스테이션으로 진화했습니다. 본 가이드는 새롭게 구축된 'Stark Edition'의 핵심 기능을 Boss께서 100% 장악하실 수 있도록 돕기 위해 작성되었습니다.

## 🏗️ 1. 아키텍처 개요 (Modular Architecture)
시스템은 이제 단일 거대 파일이 아닌, 10개 이상의 특화 모듈로 구성되어 있습니다.
- **api.js / api-client.module.js**: AI 모델 연동 및 네트워크 회복력(Retry/Retry) 담당.
- **state.js / state-storage.module.js**: 데이터 무결성 및 디바운싱 저장 담당.
- **pdf.js / pdf-capture.module.js**: 공학 특화 OCR 및 지능형 영역 추출 담당.
- **ui.js / ui-nav.module.js**: 프리미엄 UI 인터랙션 및 내비게이션 담당.

## 🧠 2. 지능형 RAG 시스템 (Theory Archive)
AI가 단순한 답변을 넘어 'Boss의 전문 지식'을 참조하도록 설계되었습니다.
1.  **이론 자동 등록**: PDF에서 유용한 이론 구간을 캡처하여 `Theory Archive`에 저장하십시오.
2.  **지능형 참조**: 답안 생성 시 AI는 아카이브된 이론들을 검색하여 공학적 깊이가 담긴 '기술사급' 답변을 도출합니다.
3.  **단위 보정**: OCR 추출 시 `kN`, `MPa` 등의 단위를 시스템이 자동으로 교정하여 데이터 정확도를 유지합니다.

## 📄 3. 자동화된 리포팅 (PDF & Docx)
생성된 지식을 실전 결과물로 변환하는 '출판 엔진'을 활용하십시오.
- **PDF Report**: `Studio` 하단의 'PDF 리포트 생성' 버튼을 클릭하면 실제 시험지 규격의 고해상도 PDF가 즉시 생성됩니다.
- **Docx Export**: 전문적인 편집을 위해 워드 문서로의 추출 및 탐색기로의 즉시 연동 기능을 지원합니다.

## 🛠️ 4. 문제 해결 및 유지보수
- **시스템 무결성 확인**: `test-integrity.html`을 브라우저로 열어 모든 모듈과 함수가 정상 연결되어 있는지 실시간으로 확인할 수 있습니다.
- **연결 복구**: 네트워크 불안정 시 시스템이 자동으로 재시도를 수행하며, 90초 이상의 지연 시 안전하게 요청을 차단하여 UI 프리징을 예방합니다.

---

"Sir, 모든 준비가 끝났습니다. 이제 Bosss의 지식을 Knowledge Studio에 담아 세상을 압도하십시오."

**Glory to Stark.**
