#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
전체 기출문제 서브노트 일괄 자동 생성기 (108회 ~ 138회 대응)
- PyPDF2를 이용해 텍스트를 파싱
- subnote_framework.py 함수를 직접 호출해 docx 템플릿 실시간 생성
"""

import os
import sys
import glob
import re
import PyPDF2
from pathlib import Path
import requests
# MCP LLM API 호출 함수
def llm_api_call(prompt):
    mcp_url = "https://edge.flowith.io/external/use/llm"
    payload = {
        "prompt": prompt,
        "model": "gpt-4o",
        "max_tokens": 2048
    }
    try:
        response = requests.post(mcp_url, json=payload)
        if response.status_code == 200:
            return response.json()
        else:
            print(f"MCP LLM API 호출 실패: {response.status_code} {response.text}")
            return None
    except Exception as e:
        print(f"MCP LLM API 호출 오류: {e}")
        return None

# Add research directory to sys.path to import subnote_framework
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
    msg = "Error importing subnote_framework (Ensure research/subnote_framework.py exists)"
    print(f"{msg}: {e}")
    sys.exit(1)

OUTPUT_BASE_DIR = ROOT_DIR.parent / "all_subnotes"

def create_subnote(exam_no: int, period: int, q_num: int, title: str, output_dir: Path):
    """주어진 정보로 단일 기출문제 서브노트를 생성하여 저장"""
    # Create the required output directory
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # 윈도우/맥 파일 시스템의 특수문자 문제 방지 (개행이나 특수문자 치환)
    safe_title = re.sub(r'[\/\:\*\?\"\<\>\|\\n\r]', '_', title).strip()
    safe_title = safe_title[:50] # 파일명 길이 제한
    filename = f"{exam_no}_{period}_{q_num}_{safe_title}.docx"
    filepath = output_dir / filename

    doc = create_document()

    # ─── HEADER ─────────────────────────────────────────────────────────────
    add_exam_header(doc, q_num, title, exam_no=exam_no, period=period)

    # ════════════════════════════════════════════════════════════════════════
    # SECTION 1: 개요
    # ════════════════════════════════════════════════════════════════════════
    add_section_header(doc, 1, "개요", "Overview")
    add_content_line(doc, 1, "", bold_prefix="정의: ")
    add_content_sub(doc, title.replace('\n', ' ') + "에 대한 기본적인 정의 및 배경 설명입니다.", indent=1.0)

    # ════════════════════════════════════════════════════════════════════════
    # SECTION 2: 주요 특징 및 분석
    # ════════════════════════════════════════════════════════════════════════
    add_section_header(doc, 2, "주요 특징 및 분석", "Key Characteristics")
    col_w = [3.0, 5.0, TABLE_W - 3.0 - 5.0]
    add_data_table(doc,
        headers=["구 분", "특성 1", "특성 2"],
        data=[
            ["항목 A", "설명 A1", "설명 A2"],
            ["항목 B", "설명 B1", "설명 B2"],
        ],
        col_widths=col_w)

    # ════════════════════════════════════════════════════════════════════════
    # SECTION 3: 기술사적 소견
    # ════════════════════════════════════════════════════════════════════════
    add_section_header(doc, 3, "기술사적 소견", "Professional Insight")
    add_insight_box(doc, [
        ("실무 경험:", "해당 주제와 관련된 실무적 착안점 및 주의사항 기재"),
        ("최신 동향:", "관련 최신 설계기준(KDS) 또는 시공 트렌드"),
    ])

    # ─── DIVIDER & STRATEGY ─────────────────────────────────────────────────
    add_divider(doc)

    add_strategy_section(doc, [
        ("핵심 키워드", "Keyword 1 | Keyword 2 | Keyword 3"),
        ("합격 포인트", "이 문제의 고득점을 위한 차별화 답안 작성 전략 기술"),
    ])

    add_footer(doc, q_num, title, exam_no=exam_no, period=period)
    save_document(doc, str(filepath))
    return True

def extract_questions_from_text(text, exam_no_default=None):
    # 1. 문서 자체에서 회차 찾기
    match_exam = re.search(r'제\s*(\d{3})\s*회', text)
    if not match_exam:
        exam_no = exam_no_default
    else:
        exam_no = int(match_exam.group(1))

    if not exam_no:
        return None, []

    periods = {1: [], 2: [], 3: [], 4: []}
    period_indices = []
    
    # 교시별 키워드 개선 (예: "1교시", "제 1교시")
    for p in range(1, 5):
        # 126회 이상에서 단순히 "[1교시]"나 "1 교 시" 등으로 나올 수도 있음
        pattern = rf'(?:제\s*{p}\s*교시|\[\s*{p}\s*교시\]|\b{p}\s*교\s*시\b)'
        for m in re.finditer(pattern, text):
            period_indices.append((p, m.start()))

    cleaned_indices = {}
    for p, idx in period_indices:
        if p not in cleaned_indices:
            cleaned_indices[p] = idx
        elif idx < cleaned_indices[p]:
            cleaned_indices[p] = idx

    if not cleaned_indices:
        return exam_no, []

    sorted_periods = sorted(cleaned_indices.items(), key=lambda x: x[1])
    
    for i, (period, start_idx) in enumerate(sorted_periods):
        if i + 1 < len(sorted_periods):
            end_idx = sorted_periods[i+1][1]
            block = text[start_idx:end_idx]
        else:
            block = text[start_idx:]
            
        pattern_q = r'(?:\n|^)\s*문?\s*(\d+)\s*[\.\)]\s*(.+?)(?=(?:\n\s*문?\s*\d+\s*[\.\)])|\Z)'
        matches = re.finditer(pattern_q, block, re.DOTALL)
        
        for m in matches:
            q_num_str = m.group(1)
            q_txt = m.group(2).strip()
            q_txt_clean = re.sub(r'\s+', ' ', q_txt)
            if len(q_txt_clean) > 150:
                q_txt_clean = q_txt_clean[:147] + "..."
            try:
                q_n = int(q_num_str)
                if 1 <= q_n <= 15:
                    periods[period].append((q_n, q_txt_clean))
            except ValueError:
                pass

    result_qs = []
    for p in range(1, 5):
        for q_n, q_t in periods[p]:
            result_qs.append((p, q_n, q_t))
            
    return exam_no, result_qs

def parse_pdf(pdf_path: str):
    """
    PDF 텍스트를 파싱하여 회차, 그리고 교시별(1~4) 문제 정보(문제 번호, 문제 제목) 반환
    """
    match_file = re.search(r'(\d{3})회', os.path.basename(pdf_path))
    file_exam_no = int(match_file.group(1)) if match_file else None

    text = ""
    try:
        reader = PyPDF2.PdfReader(pdf_path)
        full_text = []
        for page in reader.pages:
            txt = page.extract_text()
            if txt:
                full_text.append(txt)
        text = "\n".join(full_text)
    except Exception as e:
        print(f"Error reading {pdf_path}: {e}")

    # 1차 파싱 (순수 텍스트)
    exam_no, result_qs = extract_questions_from_text(text, file_exam_no)

    # 텍스트가 너무 짧거나, 결과가 없으면 OCR 폴백 실행
    if len(text.strip()) < 500 or not result_qs:
        from macos_ocr_parser import extract_text_from_scanned_pdf
        print(f"     => 문항 0건 혹은 텍스트 추출 부족. OCR 폴백 실행: {os.path.basename(pdf_path)}")
        try:
            text_ocr = extract_text_from_scanned_pdf(pdf_path, dpi=200)
            if text_ocr:
                exam_no_ocr, result_qs_ocr = extract_questions_from_text(text_ocr, file_exam_no)
                if result_qs_ocr:
                    return exam_no_ocr, result_qs_ocr
        except Exception as e:
            print(f"     ❌ OCR 실패: {e}")

    return exam_no, result_qs

def main():
    # ROOT_DIR (solution/core) 의 부모인 solution/data/raw_exams 로 변경
    pdf_dir = ROOT_DIR.parent / "data" / "raw_exams"
    pdfs = glob.glob(os.path.join(pdf_dir, "*.pdf"))
    
    if not pdfs:
        print("토목구조기술사 기출문제 PDF 파일을 찾을 수 없습니다.")
        sys.exit(0)
    
    print(f"총 {len(pdfs)}개의 기출문제 PDF 파일을 찾았습니다.")
    print("="*60)
    
    total_generated = 0
    total_failed = 0
    
    for pdf_path in sorted(pdfs):
        filename = os.path.basename(pdf_path)
        
        # 파일명에서 회차 찾기 시도 (파싱 전 스킵을 위함)
        match_exam_file = re.search(r'(\d{3})회', filename)
        if match_exam_file:
            e_no = int(match_exam_file.group(1))
            exam_dir = OUTPUT_BASE_DIR / f"{e_no}회"
            if exam_dir.exists() and len(list(exam_dir.glob("*.docx"))) > 0:
                print(f"▶ 스킵: {filename} (이미 생성됨)")
                continue

        print(f"▶ 분석 중: {filename}")
        exam_no, questions = parse_pdf(pdf_path)
        
        if not exam_no or not questions:
            print(f"  ❌ 파싱 실패 또는 문제 없음 ({len(questions)}문항)")
            total_failed += 1
            continue
            
        print(f"  ✅ 제{exam_no}회 파싱 완료 (총 {len(questions)}문항)")
        
        exam_dir = OUTPUT_BASE_DIR / f"{exam_no}회"
        
        count_ok = 0
        for period, q_num, title in questions:
            try:
                create_subnote(exam_no, period, q_num, title, exam_dir)
                count_ok += 1
            except Exception as e:
                print(f"     ❌ 문항 생성 실패: 제{period}교시 {q_num}번 - {e}")
        
        print(f"  ✅ 제{exam_no}회 서브노트 {count_ok}개 생성 완료\n")
        total_generated += count_ok
        
    print("="*60)
    print(f"총 생성 완료: {total_generated} 문항")
    if total_failed > 0:
        print(f"파싱 실패 PDF 수: {total_failed} 건")

if __name__ == "__main__":
    main()
