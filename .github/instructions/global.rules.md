# Global repository rules

목적: 리포지토리 전반에서 자동화 에이전트와 기여자가 따라야 할 기본 규칙을 정의합니다.

주요 규칙
- 의존성 추가/변경 후 보안 스캔 실행: `npm audit`, `trivy` 등. 결과를 커밋 메시지나 PR 설명에 첨부.
- Codacy 관련 도구를 호출할 때는 항상 다음 값을 사용:
  - provider: gh
  - organization: special10907
  - repository: solve-civil-answer-studio
- 파일 편집 후(특히 서버/패키지 변경) Codacy 분석을 실행해야 하는 경우 Codacy CLI가 설치되어 있는지 확인하고, 없으면 담당자에게 설치 요청.
- 자동화 에이전트는 중요한 변경(의존성/보안/빌드 설정 등)을 커밋하기 전에 리뷰를 요청하세요.

담당자: 저장소 소유자 및 메인 기여자
