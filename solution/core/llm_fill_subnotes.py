#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LLM 서브노트 자동 생성기 (Knowledge Injection)
- 선택된 회차의 기출문제 제목을 기반으로 Flowith LLM API에 질의하여 답변 초안을 추출
- 추출된 내용을 subnote_framework.py에 주입하여 구조화된 Word(.docx) 파일로 변환
"""

import os
import re
import sys
import json
import time
import requests
from pathlib import Path

# Add research directory to sys.path to import subnote_framework
# Current path: solution/core/llm_fill_subnotes.py
ROOT_DIR = Path(__file__).resolve().parent
RESEARCH_DIR = ROOT_DIR / "research"
sys.path.insert(0, str(RESEARCH_DIR))

try:
    from subnote_framework import (
        create_document, save_document,
        add_exam_header, add_section_header, add_footer,
        add_content_line, add_content_sub,
        add_data_table, add_insight_box, add_divider, add_strategy_section,
        TABLE_W
    )
except ImportError as e:
    print(f"Error importing subnote_framework: {e}")
    sys.exit(1)

OUTPUT_BASE_DIR = ROOT_DIR.parent / "llm_subnotes"

def get_api_key():
    path = os.path.expanduser("~/.flowith/credentials.json")
    try:
        with open(path) as f:
            return json.load(f)["apiKey"]
    except Exception as e:
        print(f"Error reading Flowith API Key: {e}")
        return None

FLOWITH_API_KEY = get_api_key()

def get_knowledge_corrections() -> str:
    """보스가 지적한 과거 교정사항 및 지시사항을 불러옵니다."""
    try:
        corr_path = ROOT_DIR.parent / "memory" / "KNOWLEDGE_CORRECTIONS.md"
        if corr_path.exists():
            with open(corr_path, "r", encoding="utf-8") as f:
                return f.read().strip()
    except Exception as e:
        print(f"Error reading KNOWLEDGE_CORRECTIONS: {e}")
    return ""

def get_rag_context(title: str) -> str:
    """Dropzone에서 추출되어 병합된 master_knowledge_index.json에서 RAG 컨텍스트를 검색합니다."""
    try:
        index_path = ROOT_DIR.parent / "master_knowledge_index.json"
        if not index_path.exists():
            return ""
        
        with open(index_path, "r", encoding="utf-8") as f:
            idx_data = json.load(f)
            
        if not isinstance(idx_data, list):
            return ""
            
        # 간단한 BM25 방식의 유사도 체크 (띄어쓰기 및 키워드 기반)
        q_tokens = [t for t in re.sub(r'[^a-zA-Z0-9가-힣]', ' ', title.lower()).split() if len(t) > 1]
        if not q_tokens:
            return ""
            
        matched_docs = []
        for doc in idx_data:
            doc_text = f"{doc.get('title', '')} {doc.get('content', '')}".lower()
            score = sum(1 for t in q_tokens if t in doc_text)
            if score > 0:
                matched_docs.append((score, doc))
                
        matched_docs.sort(key=lambda x: x[0], reverse=True)
        top_docs = matched_docs[:3]
        
        if top_docs:
            context_str = "\n[Universal Knowledge DB 검색 결과]\n"
            for _, doc in top_docs:
                source = doc.get("title") or doc.get("source") or "첨부문서"
                content_preview = doc.get("content", "")[:1000]
                context_str += f"[{source}] {content_preview}...\n\n"
            return context_str.strip()
    except Exception as e:
        print(f"Error reading master_knowledge_index: {e}")
    return ""

def generate_llm_content(title: str):
    """
    문제 제목(title)을 기반으로 LLM에 프롬프트를 보내어 요구된 형식의 JSON 응답을 파싱
    """
    if not FLOWITH_API_KEY:
         return None

    # 자기 진화형 메모리(보스의 교정 기록) 로드
    corrections_text = get_knowledge_corrections()
    rag_text = get_rag_context(title)
    
    context_injection = ""
    if rag_text:
        context_injection += f"\n\n{rag_text}\n위의 검색 결과를 최우선적으로 참고하여 답안에 반영하십시오."
        
    if corrections_text:
        context_injection += (
            f"\n\n[SYSTEM DIRECTIVE / 사용자 교정 메모리]\n"
            f"다음은 당신이 과거에 답안을 작성할 때 발생했던 오류나 보스가 직접 내린 지시사항입니다.\n"
            f"절대 아래 규칙을 어기지 마십시오:\n"
            f"-----------------------------------\n{corrections_text}\n-----------------------------------\n"
        )

    prompt = f"""당신은 토목구조기술사 시험의 전문 강사입니다.
다음 기출문제: "{title}" 에 대한 서브노트 초안을 작성해주세요.{context_injection}

반드시 아래 JSON 포맷에 정확히 맞추어 응답해주십시오. 백틱(```json)이나 다른 설명 없이 오직 JSON만 반환해야 합니다.

{{
  "overview": "이 문제에 대한 개요 및 핵심 원리 1~2문장",
  "characteristics": [
    {{"name": "특성1 이름 (짧게)", "desc1": "설명 1줄", "desc2": "보조 설명"}},
    {{"name": "특성2 이름 (짧게)", "desc1": "설명 1줄", "desc2": "보조 설명"}}
  ],
  "insights": [
    {{"title": "실무 경험", "content": "실제 현장/설계 시 주의사항 1줄"}},
    {{"title": "최신 동향", "content": "관련 KDS 기준 혹은 최신 기술 트렌드 1줄"}}
  ],
  "diagrams": [
    {{"title": "시스템 구성도", "content": "어떤 구성 요소들을 어떤 흐름으로 그려야 하는지 상세 가이드 1줄"}}
  ],
  "keywords": "키워드1 | 키워드2 | 키워드3",
  "strategy": "고득점을 위한 차별화 답안 작성 전략 1줄"
}}"""

    headers = {
        "Authorization": f"Bearer {FLOWITH_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "models": ["gpt-4.1", "gemini-2.5-pro", "claude-sonnet-4"],
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "thinking": False
    }

    try:
        response = requests.post("https://edge.flowith.io/external/use/llm", headers=headers, json=payload, timeout=60)
        response.raise_for_status()
        res_data = response.json()
        content_text = res_data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
        
        # JSON 추출
        if content_text.startswith("```json"):
            content_text = content_text[7:]
        if content_text.startswith("```"):
            content_text = content_text[3:]
        if content_text.endswith("```"):
            content_text = content_text[:-3]
            
        return json.loads(content_text.strip())
    except Exception as e:
        print(f"LLM API Error for '{title}': {e}")
        return None

def create_llm_subnote(exam_no, period, q_num, title, llm_data, output_dir):
    """LLM 데이터를 바탕으로 서브노트 Word 문서 템플릿 실작성"""
    output_dir.mkdir(parents=True, exist_ok=True)
    
    safe_title = re.sub(r'[\/\:\*\?\"\<\>\|\\n\r]', '_', title).strip()
    safe_title = safe_title[:50]
    filename = f"{exam_no}_{period}_{q_num}_{safe_title}.docx"
    filepath = output_dir / filename

    doc = create_document()
    add_exam_header(doc, q_num, title, exam_no=exam_no, period=period)

    # ─── SECTION 1: 개요 ─────────────────────────────────────────────────────────────
    add_section_header(doc, 1, "개요", "Overview")
    overview_text = llm_data.get("overview", title + "에 대한 기본적인 정의입니다.")
    add_content_line(doc, 1, "", bold_prefix="정의: ")
    add_content_sub(doc, overview_text, indent=1.0)

    # ─── SECTION 2: 주요 특징 및 분석 ────────────────────────────────────────────────
    add_section_header(doc, 2, "주요 특징 및 분석", "Key Characteristics")
    col_w = [3.0, 5.0, TABLE_W - 3.0 - 5.0]
    
    chars = llm_data.get("characteristics", [])
    data_rows = []
    for c in chars:
        data_rows.append([c.get("name", "특성"), c.get("desc1", "설명"), c.get("desc2", "-")])
        
    if not data_rows: # 기본값
        data_rows = [["항목 A", "설명 A", "-"], ["항목 B", "설명 B", "-"]]
        
    add_data_table(doc,
        headers=["구 분", "핵심 원리", "설명 및 적용"],
        data=data_rows,
        col_widths=col_w)

    # ─── SECTION 3: 기술사적 소견 ────────────────────────────────────────────────────
    add_section_header(doc, 3, "기술사적 소견", "Professional Insight")
    insights = llm_data.get("insights", [])
    box_data = []
    for i in insights:
        box_data.append((i.get("title", "의견") + ":", i.get("content", "실무적 착안점 기재")))
        
    if not box_data:
        box_data = [("실무 경험:", "해당 주제 주의사항"), ("최신 동향:", "관련 KDS 기준 확인")]
        
    add_insight_box(doc, box_data)

    # ─── DIVIDER & STRATEGY ─────────────────────────────────────────────────
    add_divider(doc)

    keywords = llm_data.get("keywords", "키워드1 | 키워드2")
    strategy = llm_data.get("strategy", "고득점 전략 기술")
    add_strategy_section(doc, [
        ("핵심 키워드", keywords),
        ("합격 포인트", strategy),
    ])

    add_footer(doc, q_num, title, exam_no=exam_no, period=period)
    save_document(doc, str(filepath))
    return True

def process_exam(exam_no: int):
    """
    이미 파싱된 결과물로부터 기출문제 목록을 참조하여(docx 파일명 역산),
    LLM에 텍스트를 던져 답변을 받고 새로운 템플릿에 기록
    """
    source_dir = ROOT_DIR.parent / "all_subnotes" / f"{exam_no}회"
    if not source_dir.exists():
        print(f"제{exam_no}회 기출문제 파싱 결과를 찾을 수 없습니다: {source_dir}")
        return

    # 120_1_1_제목어쩌고저쩌고.docx 형식 역산
    files = list(source_dir.glob("*.docx"))
    if not files:
        print(f"제{exam_no}회 기출문제 파일이 없습니다.")
        return

    print(f"===== 제{exam_no}회 LLM 서브노트 생성 시작 (총 {len(files)}문항) =====")
    
    output_dir = OUTPUT_BASE_DIR / f"{exam_no}회_LLM_채움"
    count_ok = 0
    count_fail = 0
    
    for f in sorted(files):
        # 파싱
        basename = f.name.replace('.docx', '')
        parts = basename.split('_', 3)
        if len(parts) < 4:
            continue
            
        period = int(parts[1])
        q_num = int(parts[2])
        title_safe = parts[3]
        
        # 파일명을 실제 타이틀로 쓰기엔 축약되었지만, 
        # 원본 타이틀 맵핑(DB 없음)이 없으므로 추출된 타이틀을 프롬프트용 제목으로 사용합니다.
        title_display = title_safe.replace('_', ' ')
        
        # 중복 방지
        out_file = output_dir / f.name
        if out_file.exists():
            print(f"[SKIP] 이미 작성됨: {f.name}")
            continue

        msg = f"▶ LLM 질의 중: {period}교시 {q_num}번 - {title_display[:30]}..."
        print(msg)
        
        llm_json = generate_llm_content(title_display)
        if llm_json:
            try:
                create_llm_subnote(exam_no, period, q_num, title_display, llm_json, output_dir)
                print("   ✅ 생성 완료")
                count_ok += 1
            except Exception as e:
                print(f"   ❌ 오류 발생: {e}")
                count_fail += 1
        else:
            print(f"   ❌ LLM 응답 실패 (Rate Limit 등)")
            count_fail += 1
            
        # API Rate Limit (60 req / min) 방지를 위해 1.5초 딜레이
        time.sleep(1.5)

    print(f"===== 작업 완료: 성공 {count_ok} 건, 실패 {count_fail} 건 =====")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 llm_fill_subnotes.py <EXAM_NO>")
        print("Example: python3 llm_fill_subnotes.py 120")
        sys.exit(1)
        
    exam_no_arg = int(sys.argv[1])
    process_exam(exam_no_arg)
