# Answer Studio 버튼-함수 상세 매핑 가이드 (표 버전)

> 대상 파일: `solve_120.html`, `js/ui.js`, `js/api.js`, `js/pdf.js`, `js/studio.js`, `js/state.js`  
> 목적: 버튼/컨트롤 → 함수 → 실제 동작을 **한눈에 스캔**

---

## 빠른 인덱스

| 구역 | 핵심 함수 |
|---|---|
| Header | `refreshAvailableModels`, `extractQuestionsFromPdfText`, `toggleViewMode`, `toggleDarkMode` |
| 좌측 네비 | `showSection` |
| Analysis | `updateBuckling`, `switchTab` |
| PDF 툴바 | `deleteCapturedQuestion`, `zoomIn`, `zoomOut` |
| Studio(Answers/Theory) | `Studio.switchTab`, `Studio.saveEntry`, `Studio.generateProfessionalDocx`, `evaluateRenderedAnswers`, `analyzeTheoryKnowledge` |
| 삭제 모달 | `closeDeleteConfirmModal`, `confirmDeleteModelAnswerEntry` |

---

## 1) Header

| UI 요소 | 트리거 | 연결 함수 | 주요 동작 | 위치 |
|---|---|---|---|---|
| AI Provider (`#aiProvider`) | `onchange` | `refreshAvailableModels()` *(alias: `refreshModelList`)* | 모델 목록 갱신, `window.App.initAiModels()` 시도 | `solve_120.html:~233`, `js/ui.js` |
| 새로고침 아이콘 | `onclick` | `refreshAvailableModels()` | 모델 목록 수동 갱신 | `solve_120.html:~248` |
| 파일 선택 | `onclick` | `document.getElementById('studio-pdf-input').click()` | PDF 파일 선택창 오픈 | `solve_120.html:~256` |
| 문제 자동 추출 (`#extractBtn`) | `onclick` | `extractQuestionsFromPdfText()` | PDF/첨부 텍스트 추출 → 파서 병합 → JSON 반영 | `solve_120.html:~262`, `js/api.js` |
| 뷰 전환 | `onclick` | `toggleViewMode()` | 답안 리스트/그리드 토글 | `solve_120.html:~270`, `js/ui.js` |
| 다크모드 | `onclick` | `toggleDarkMode()` | `dark` 클래스 토글 + 저장 | `solve_120.html:~273`, `js/ui.js` |

---

## 2) 좌측 네비게이션

| 버튼 | 트리거 | 함수 | 주요 동작 | 위치 |
|---|---|---|---|---|
| Dashboard | `onclick` | `showSection('dashboard')` | 섹션 전환 + nav active 스타일 변경 | `solve_120.html:~295`, `js/ui.js` |
| Analysis Studio | `onclick` | `showSection('analysis')` | 섹션 전환 | `solve_120.html:~299`, `js/ui.js` |
| Knowledge Studio | `onclick` | `showSection('studio')` | 섹션 전환 + `openPdfVisualModal()` 시도 | `solve_120.html:~303`, `js/ui.js` |

---

## 3) Analysis 컨트롤

| UI 요소 | 트리거 | 함수 | 주요 동작 | 위치 |
|---|---|---|---|---|
| K 슬라이더 (`#kInput`) | `oninput` | `updateBuckling()` | 좌굴 차트 재계산/업데이트 | `solve_120.html:~399`, `js/ui.js` |
| 1교시 탭 | `onclick` | `switchTab('p1')` | 탭 콘텐츠 전환 + 스타일 갱신 | `solve_120.html:~598`, `js/ui.js` |
| 2~4교시 탭 | `onclick` | `switchTab('p2')` | 탭 콘텐츠 전환 + 스타일 갱신 | `solve_120.html:~606`, `js/ui.js` |

---

## 4) Studio 중앙 (PDF 툴바)

| UI 요소 | 트리거 | 함수/로직 | 주요 동작 | 위치 |
|---|---|---|---|---|
| 영역 지정 (`#addAreaBtn`) | `onclick` | inline: `window.isAddAreaMode = !window.isAddAreaMode` | 드래그 모드(영역 추가/선택) 전환 | `solve_120.html:~1064`, `js/pdf.js:initDragSelection` |
| 전체 삭제 | `onclick` | `deleteCapturedQuestion(-1)` | 전체 문항 삭제 + 상태/오버레이/JSON 동기화 | `solve_120.html:~1067`, `js/pdf.js` |
| 이전 페이지 | runtime bind | `prevPdfPageBtn.onclick = ...` | 페이지 감소 + 재렌더 | `js/pdf.js:openPdfVisualModal` |
| 다음 페이지 | runtime bind | `nextPdfPageBtn.onclick = ...` | 페이지 증가 + 재렌더 | `js/pdf.js:openPdfVisualModal` |
| 확대 | `onclick` | `window.zoomIn()` | `pdfZoomLevel` 증가 + 재렌더 | `solve_120.html:~1080`, `js/pdf.js` |
| 축소 | `onclick` | `window.zoomOut()` | `pdfZoomLevel` 감소 + 재렌더 | `solve_120.html:~1081`, `js/pdf.js` |

---

## 5) Studio 우측 (Answers/Theory)

| UI 요소 | 트리거 | 함수 | 주요 동작 | 위치 |
|---|---|---|---|---|
| Answers 탭 | `onclick` | `Studio.switchTab('answers')` | `answers/theory` 패널 전환 | `solve_120.html:~1099`, `js/studio.js` |
| Theory 탭 | `onclick` | `Studio.switchTab('theory')` | `answers/theory` 패널 전환 | `solve_120.html:~1102`, `js/studio.js` |
| 답안 저장/업데이트 | `onclick` | `Studio.saveEntry('questions')` | 폼→데이터 반영→`syncJsonAndRender` | `solve_120.html:~1155`, `js/studio.js` |
| 전문 서브노트 생성 | `onclick` | `Studio.generateProfessionalDocx()` | LLM JSON 생성 + DOCX 생성 요청 | `solve_120.html:~1160`, `js/studio.js` |
| 지능형 출처 보강 | `onclick` | `applyAttachmentInsightToQuestion()` | 첨부 인사이트를 선택 문항 답안에 합성 | `solve_120.html:~1163`, `js/ui.js` |
| 분석 실행(품질) | `onclick` | `evaluateRenderedAnswers()` | 점수/피드백 계산 및 렌더 | `solve_120.html:~1186`, `js/state.js` |
| 이론 저장 | `onclick` | `Studio.saveEntry('theories')` | 이론 신규/수정 반영 | `solve_120.html:~1216`, `js/studio.js` |
| 이론 중복 분석 | `onclick` | `analyzeTheoryKnowledge()` | 유사도/중복/보강 draft 생성 | `solve_120.html:~1217`, `js/state.js` |
| 이론 폼 초기화 | `onclick` | `Studio.resetForm('theories')` | 편집 상태/폼 초기화 | `solve_120.html:~1218`, `js/studio.js` |

---

## 6) 삭제 확인 모달

| UI 요소 | 트리거 | 함수 | 주요 동작 | 위치 |
|---|---|---|---|---|
| 취소 | `onclick` | `closeDeleteConfirmModal()` | 모달 닫기 | `solve_120.html:~1265`, `js/state.js` |
| 삭제 | `onclick` | `confirmDeleteModelAnswerEntry()` | 일반 삭제/Studio pending 삭제 확정 | `solve_120.html:~1272`, `js/state.js` |

---

## 7) 인라인이 아닌 런타임 바인딩 요약

| 항목 | 바인딩 위치 | 영향 |
|---|---|---|
| Studio 탭 addEventListener | `js/studio.js:bindEvents()` | HTML inline `onclick`과 중복 트리거 가능성 |
| URL 입력 상태 제어 | `js/ui.js` | `#attachmentWebsiteUrl` input/change 연동 |
| PDF 페이지 버튼 | `js/pdf.js:openPdfVisualModal()` | 뷰어 초기화 전에는 동작 안 할 수 있음 |
| PDF 마우스 상호작용 | `js/pdf.js` | 드래그/리사이즈 중 `document` mousemove/mouseup 사용 |

---

## 8) 장애 대응 체크표

| 증상 | 1차 확인 | 2차 확인 |
|---|---|---|
| 버튼 클릭 무반응 | `window.<함수명>` 존재 여부 | Safety Bridge 대기 로그 존재 여부 |
| PDF 버튼 무반응 | `window.visualPdfDoc` 로드 여부 | `openPdfVisualModal()` 선행 여부 |
| 모델 새로고침 이상 | `refreshAvailableModels` alias 확인 | `window.App.initAiModels` 존재 여부 |
| Studio 저장 미반영 | `Studio.saveEntry` 호출 여부 | `syncJsonAndRender` + `answerJsonInput` 존재 여부 |

---

## 9) 유지보수 메모

| 권장 항목 | 이유 |
|---|---|
| inline `onclick` → `addEventListener` 점진 통일 | 이벤트 추적/테스트 용이성 향상 |
| `refreshAvailableModels` 네이밍 정리 | alias 혼선 감소 |
| Studio 탭 이벤트 중복 경로 단일화 | 이중 호출 리스크 감소 |
| 버튼 변경 시 본 문서 동시 갱신 | 운영/개발 커뮤니케이션 비용 절감 |
