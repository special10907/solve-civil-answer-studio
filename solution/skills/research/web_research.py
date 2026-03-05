import requests
from bs4 import BeautifulSoup
import urllib.parse
import logging
import json
import time

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger('WebResearchSkill')

class KDSWebSearcher:
    """
    국토교통부 설계기준(KDS) 및 시방서(KCS) 등 관련 자료를 동적으로 검색하는 
    Neo 에이전트 전용 Deep Research 스킬 모듈입니다.
    """
    def __init__(self):
        # 헤더를 일반 브라우저처럼 위장하여 스크래핑 봇 차단(403)을 방지합니다.
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }

    def search_guideline(self, query: str) -> dict:
        """
        주어진 키워드(예: '강구조 설계기준 KDS 14 31')로 최신 설계 기준 검색을 수행합니다.
        """
        logger.info(f"[*] Deep Research 스킬 작동: '{query}' 검색 중...")
        
        try:
            # Note: 실제 환경에서는 국가건설기준센터 OpenAPI 또는 검색 포털 API를 사용해야 하나,
            # 본 아키텍처에서는 검색 로직 프로토타입 시뮬레이션을 구현합니다.
            
            # (시뮬레이션) 빙/구글 검색 결과 대신, 토목구조기술사 빈출 KDS 기준을 매핑하여 반환
            mock_results = self._mock_kds_database(query)
            
            if mock_results:
                logger.info(f"   [+] 신뢰할 수 있는 최신 기준을 찾았습니다: {mock_results['title']}")
                return {
                    "status": "success",
                    "source": "KDS_Center_Mock",
                    "data": mock_results
                }
            
            # 검색 매핑에 없으면 일반 웹 스크래핑 시도 (예시)
            logger.info("   [-] 매핑된 기준이 없어 일반 웹 검색으로 Fallback 전환합니다.")
            time.sleep(1) # Rate limit 보호
            
            return {
                "status": "warning",
                "message": "Direct standard not found. Falling back to general web search context.",
                "data": {"title": "General Context", "summary": "검색 결과가 충분하지 않습니다."}
            }
            
        except Exception as e:
            logger.error(f"   [!] Web Research 중 오류 발생: {str(e)}")
            return {"status": "error", "message": str(e)}

    def _mock_kds_database(self, query: str) -> dict:
        """초기 RAG 적용을 위한 하드코딩된 핵심 최신 기준서(KDS) 매핑 테이블"""
        keywords = query.replace(' ', '').lower()
        
        if '전단마찰' in keywords or '142022' in keywords:
            return {
                "title": "KDS 14 20 22 : 2021 콘크리트구조 전단 및 비틀림 설계기준",
                "summary": "전단마찰 철근은 전단면을 가로질러 배치되어야 하며, 마찰계수 μ는 일체로 친 콘크리트에서 1.4λ, 고의로 거칠게 한 표면에서 1.0λ를 적용한다.",
                "url": "https://www.kcsc.re.kr/"
            }
        elif '강구조' in keywords or '좌굴' in keywords:
            return {
                "title": "KDS 14 31 10 : 2017 강구조 부재 설계기준(하중저항계수설계법)",
                "summary": "기둥의 압축강도는 휨좌굴, 비틀림좌굴, 휨비틀림좌굴 중 가장 작은 한계상태에 의해 결정된다.",
                "url": "https://www.kcsc.re.kr/"
            }
        elif '내진' in keywords or '지진' in keywords:
            return {
                "title": "KDS 17 10 00 : 2018 내진설계 일반",
                "summary": "지진구역 및 지역계수, 재현주기별 위험도계수를 적용하여 설계응답스펙트럼을 산정한다.",
                "url": "https://www.kcsc.re.kr/"
            }
        
        return {}

def inject_research_context(llm_prompt: str, search_keyword: str) -> str:
    """
    기존 LLM 프롬프트에 Deep Research로 찾은 최신 문서 컨텍스트를 주입(Injection)하여 반환합니다.
    """
    searcher = KDSWebSearcher()
    research_result = searcher.search_guideline(search_keyword)
    
    if research_result["status"] == "success":
        kds_data = research_result["data"]
        injection_text = (
            f"\n\n[DEEP RESEARCH CONTEXT: 다음과 같은 최신 구조설계기준(KDS)을 반드시 반영하여 답변하십시오.]\n"
            f"- 기준명: {kds_data['title']}\n"
            f"- 핵심요약: {kds_data['summary']}\n"
            f"- 출처: {kds_data['url']}\n"
        )
        return llm_prompt + injection_text
    
    return llm_prompt # 검색 실패 시 원본 프롬프트 반환

if __name__ == "__main__":
    # 스킬 테스트 구동
    test_prompt = "철근콘크리트 전단마찰 설계에 대해 설명하시오."
    enhanced_prompt = inject_research_context(test_prompt, "전단마찰 14 20 22")
    
    print("\n[기존 프롬프트]")
    print(test_prompt)
    print("\n[딥리서치(RAG) 주입 프롬프트]")
    print(enhanced_prompt)
