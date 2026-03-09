import logging
import sys
import time
import urllib.parse

import requests
from bs4 import BeautifulSoup


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("WebResearchSkill")


class KDSWebSearcher:
    """KDS/KCS 중심 딥리서치 컨텍스트 수집기."""

    def __init__(self):
        self.headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            )
        }

    def search_guideline(self, user_query: str) -> dict:
        """질의 기반으로 KDS 우선, 없으면 웹 fallback 결과를 반환."""
        logger.info("[*] Deep Research 스킬 작동: '%s' 검색 중...", user_query)

        try:
            mock_results = self._mock_kds_database(user_query)
            if mock_results:
                logger.info(
                    "   [+] 신뢰할 수 있는 기준을 찾았습니다: %s",
                    mock_results.get("title", ""),
                )
                return {
                    "status": "success",
                    "source": "KDS_Center_Mock",
                    "data": mock_results,
                }

            logger.info("   [-] 매핑 없음. 일반 웹 검색 fallback 실행")
            time.sleep(0.3)
            web_results = self._search_web_fallback(user_query)
            if web_results:
                summaries = [
                    item.get("summary", "")
                    for item in web_results[:3]
                    if item.get("summary")
                ]
                merged_summary = " / ".join(summaries)[:1200]
                return {
                    "status": "success",
                    "source": "DuckDuckGo_HTML",
                    "data": {
                        "title": f"Web fallback results for: {user_query}",
                        "summary": (
                            merged_summary
                            or "관련 일반 웹 검색 결과를 확보했습니다."
                        ),
                        "url": web_results[0].get("url", ""),
                        "results": web_results,
                    },
                }

            return {
                "status": "warning",
                "message": "검색 결과가 충분하지 않습니다.",
                "data": {
                    "title": "General Context",
                    "summary": "검색 결과가 충분하지 않습니다.",
                },
            }
        except requests.RequestException as req_err:
            logger.error("Web Research 요청 오류: %s", req_err)
            return {"status": "error", "message": str(req_err)}

    def _mock_kds_database(self, user_query: str) -> dict:
        """핵심 KDS 매핑 테이블."""
        keywords = user_query.replace(" ", "").lower()

        if "전단마찰" in keywords or "142022" in keywords:
            return {
                "title": "KDS 14 20 22 : 2021 콘크리트구조 전단/비틀림",
                "summary": (
                    "전단마찰 철근은 전단면을 가로질러 배치하며, "
                    "마찰계수 μ 적용 조건을 구분한다."
                ),
                "url": "https://www.kcsc.re.kr/",
            }

        if "강구조" in keywords or "좌굴" in keywords:
            return {
                "title": "KDS 14 31 10 : 2017 강구조 부재 설계기준",
                "summary": (
                    "기둥 압축강도는 휨/비틀림/휨비틀림 좌굴 중 "
                    "지배 한계상태로 결정된다."
                ),
                "url": "https://www.kcsc.re.kr/",
            }

        if "내진" in keywords or "지진" in keywords:
            return {
                "title": "KDS 17 10 00 : 2018 내진설계 일반",
                "summary": "지진구역/지역계수 기반 설계응답스펙트럼을 산정한다.",
                "url": "https://www.kcsc.re.kr/",
            }

        return {}

    def _search_web_fallback(
        self,
        user_query: str,
        max_results: int = 3,
    ) -> list:
        """DuckDuckGo HTML 검색으로 최소 컨텍스트 수집."""
        encoded = urllib.parse.quote_plus(user_query)
        url = f"https://duckduckgo.com/html/?q={encoded}"
        response = requests.get(url, headers=self.headers, timeout=8)
        if response.status_code != 200:
            return []

        soup = BeautifulSoup(response.text, "html.parser")
        items = []

        for node in soup.select(".result"):
            title_node = node.select_one(".result__title")
            link_node = node.select_one(".result__a")
            snippet_node = node.select_one(".result__snippet")
            if not link_node:
                continue

            href = link_node.get("href", "").strip()
            if not href:
                continue

            if title_node:
                title = title_node.get_text(" ", strip=True)
            else:
                title = link_node.get_text(" ", strip=True)

            summary = (
                snippet_node.get_text(" ", strip=True) if snippet_node else ""
            )
            items.append(
                {
                    "title": title[:200],
                    "summary": summary[:320],
                    "url": href,
                }
            )
            if len(items) >= max_results:
                break

        return items


def inject_research_context(llm_prompt: str, search_keyword: str) -> str:
    """LLM 프롬프트에 딥리서치 컨텍스트를 주입해 반환."""
    searcher = KDSWebSearcher()
    research_result = searcher.search_guideline(search_keyword)

    if research_result.get("status") == "success":
        kds_data = research_result.get("data", {})
        injection_text = (
            "\n\n[DEEP RESEARCH CONTEXT: 최신 구조설계기준 반영]\n"
            f"- 기준명: {kds_data.get('title', '')}\n"
            f"- 핵심요약: {kds_data.get('summary', '')}\n"
            f"- 출처: {kds_data.get('url', '')}\n"
        )
        return llm_prompt + injection_text

    return llm_prompt


def render_cli_context(result_data: dict, user_query: str) -> str:
    """CLI 호출 시 서버가 바로 쓸 수 있는 텍스트 컨텍스트로 렌더."""
    status = result_data.get("status")
    if status == "success":
        data = result_data.get("data", {})
        lines = [
            "[WEB_RESEARCH]",
            f"query: {user_query}",
            f"title: {data.get('title', '')}",
            f"summary: {data.get('summary', '')}",
            f"url: {data.get('url', '')}",
        ]

        results = data.get("results")
        if isinstance(results, list) and results:
            lines.append("references:")
            for idx, item in enumerate(results[:5], start=1):
                ref_line = (
                    f"{idx}. {item.get('title', '')} | "
                    f"{item.get('url', '')} | "
                    f"{item.get('summary', '')}"
                )
                lines.append(ref_line)
        return "\n".join(lines)

    message = result_data.get("message", "검색 결과가 충분하지 않습니다.")
    return "\n".join(
        [
            "[WEB_RESEARCH]",
            f"query: {user_query}",
            f"status: {status}",
            f"message: {message}",
        ]
    )


def main() -> int:
    cli_query = " ".join(sys.argv[1:]).strip()
    if not cli_query:
        print("[WEB_RESEARCH]\nstatus: error\nmessage: query is required")
        return 1

    searcher = KDSWebSearcher()
    result_data = searcher.search_guideline(cli_query)
    print(render_cli_context(result_data, cli_query))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
