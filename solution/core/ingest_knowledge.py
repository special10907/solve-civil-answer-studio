import os
import sys
import glob
import time
import json
import logging
from typing import List, Dict, Any

# ==========================================
# Phase 1-1: Universal Ingestion Router
# ==========================================
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger('IngestDaemon')

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DROPZONE_DIR = os.path.join(ROOT_DIR, "knowledge_dropzone")
PROCESSED_DIR = os.path.join(DROPZONE_DIR, "processed")
ASSETS_DIR = os.path.join(ROOT_DIR, "assets", "images")
JSON_OUT_DIR = os.path.join(ROOT_DIR, "json_subnotes")
INDEX_FILE = os.path.join(ROOT_DIR, "master_knowledge_index.json")

class IngestionRouter:
    def __init__(self):
        # 디렉토리 초기화
        for d in [DROPZONE_DIR, PROCESSED_DIR, ASSETS_DIR, JSON_OUT_DIR]:
            os.makedirs(d, exist_ok=True)
            
        self.index_data = self._load_master_index()

    def _load_master_index(self) -> Dict[str, Any]:
        """마스터 인덱스를 로드하거나 초기화합니다."""
        if os.path.exists(INDEX_FILE):
            with open(INDEX_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {"documents": [], "last_updated": ""}

    def _save_master_index(self):
        """변경된 마스터 인덱스를 저장합니다."""
        self.index_data["last_updated"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        with open(INDEX_FILE, 'w', encoding='utf-8') as f:
            json.dump(self.index_data, f, ensure_ascii=False, indent=4)

    def scan_dropzone(self) -> List[str]:
        """Dropzone에 새로 들어온 파일 목록을 스캔합니다. (processed 및 private 폴더 제외)"""
        files = []
        for root, dirs, filenames in os.walk(DROPZONE_DIR):
            # 처리 완료 및 접근 제한 폴더 제외
            if "processed" in dirs: dirs.remove("processed")
            if "private" in dirs: dirs.remove("private")
            
            for file in filenames:
                files.append(os.path.join(root, file))
        return files

    def route_file(self, filepath: str):
        """확장자에 따라 적합한 추출 파이프라인 스크립트로 라우팅(분배)합니다."""
        filename = os.path.basename(filepath)
        ext = os.path.splitext(filename)[1].lower()
        
        logger.info(f"[*] 새 파일 감지: {filename} (타입: {ext})")
        
        try:
            if ext in ['.pdf', '.docx', '.txt', '.md']:
                self.process_standard_document(filepath)
            elif ext in ['.hwp', '.hwpx']:
                self.process_hwp_document(filepath)
            elif ext in ['.xls', '.xlsx', '.csv']:
                self.process_spreadsheet(filepath)
            elif ext in ['.mp4', '.avi', '.mp3', '.m4a']:
                self.process_media(filepath)
            elif ext in ['.png', '.jpg', '.jpeg']:
                self.process_image(filepath)
            else:
                logger.warning(f"지원하지 않는 파일 형식입니다. 스킵: {filename}")
                return
                
            # 처리가 무사히 끝났다면 processed 폴더로 이동 (백업)
            os.rename(filepath, os.path.join(PROCESSED_DIR, filename))
            logger.info(f"[+] 처리 완료 및 이동: {filename} -> processed/")
            
        except Exception as e:
            logger.error(f"[!] 파일 처리 중 오류 발생 ({filename}): {str(e)}")

    # ---------------------------------------------------------
    # Extractor 파이프라인 함수 (이후 Phase별로 상세 모듈 분리 및 교체 예정)
    # ---------------------------------------------------------
    def process_standard_document(self, filepath: str):
        """PDF, DOCX, TXT 파일에서 텍스트를 추출하고 마크다운 포맷으로 변환합니다."""
        filename = os.path.basename(filepath)
        ext = os.path.splitext(filename)[1].lower()
        logger.info(f"   -> [표준 문서 추출기] 구동 중... ({filename})")
        
        extracted_text = ""
        try:
            if ext == '.pdf':
                try:
                    import PyPDF2
                    with open(filepath, 'rb') as f:
                        reader = PyPDF2.PdfReader(f)
                        for page in reader.pages:
                            text = page.extract_text()
                            if text: extracted_text += text + "\n"
                except ImportError:
                    logger.error("PyPDF2 모듈이 설치되어 있지 않습니다.")
                    
            elif ext in ['.docx']:
                try:
                    import docx
                    doc = docx.Document(filepath)
                    for para in doc.paragraphs:
                        if para.text: extracted_text += para.text + "\n"
                except ImportError:
                    logger.error("python-docx 모듈이 설치되어 있지 않습니다.")
                    
            elif ext in ['.txt', '.md']:
                with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                    extracted_text = f.read()

            if not extracted_text.strip():
                logger.warning(f"     [-] {filename}에서 추출된 텍스트가 없습니다.")
                return

            # 3. JSON 변환 및 json_subnotes 에 저장
            json_filename = f"{os.path.splitext(filename)[0]}.json"
            out_path = os.path.join(JSON_OUT_DIR, json_filename)
            
            doc_data = {
                "source_file": filename,
                "type": ext.lstrip('.'),
                "content": extracted_text.strip(),
                "metadata": {
                    "ingested_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "status": "raw_extracted"
                }
            }
            
            with open(out_path, 'w', encoding='utf-8') as f:
                json.dump(doc_data, f, ensure_ascii=False, indent=4)
                
            # 4. 마스터 인덱스 업데이트
            self.index_data["documents"].append({
                "source": filename,
                "json_ref": json_filename,
                "type": ext.lstrip('.'),
                "added_at": doc_data["metadata"]["ingested_at"]
            })
            logger.info(f"     [+] JSON 지식 변환 완료: {json_filename}")
            
        except Exception as e:
            logger.error(f"     [!] 표준 문서 추출 실패: {str(e)}")
        
    def process_hwp_document(self, filepath: str):
        """HWP 바이너리 파일 내부의 텍스트를 추출하여 마크다운으로 저장합니다."""
        filename = os.path.basename(filepath)
        logger.info(f"   -> [HWP 디코더] 구동 중... ({filename})")
        extracted_text = ""
        try:
            import olefile
            import zlib
            
            f = olefile.OleFileIO(filepath)
            dirs = f.listdir()
            
            # HWP 문서 내 본문이 들어있는 Section 스트림을 찾아 압축(zlib) 해제 후 파싱
            for d in dirs:
                if d[0] == 'BodyText':
                    stream = f.openstream(d)
                    data = stream.read()
                    try:
                        # 디플레이트(Deflate) 해제 시도
                        unpacked_data = zlib.decompress(data, -15)
                        # 원시 바이너리 내에서 UTF-16 등으로 텍스트 추출 (근사적 방식/향후 고도화)
                        text_chunk = unpacked_data.decode('utf-16le', errors='ignore')
                        # 제어 문자 필터링
                        clean_text = ''.join(c for c in text_chunk if c.isprintable() or c in ['\n', '\t'])
                        extracted_text += clean_text + "\n"
                    except:
                        pass
        except ImportError:
            logger.error("     [!] olefile 모듈이 설치되어 있지 않습니다.")
        except Exception as e:
            logger.error(f"     [!] HWP 파싱 에러: {str(e)}")

        self._save_to_json(filename, 'hwp', extracted_text)

    def process_spreadsheet(self, filepath: str):
        """엑셀(xls, xlsx) 및 CSV 데이터를 Markdown Table 형식으로 변환합니다."""
        filename = os.path.basename(filepath)
        ext = os.path.splitext(filename)[1].lower()
        logger.info(f"   -> [엑셀 -> Markdown 변환기] 구동 중... ({filename})")
        
        extracted_text = f"# 데이터 소스: {filename}\n\n"
        try:
            import pandas as pd
            if ext == '.csv':
                df = pd.read_csv(filepath)
                extracted_text += df.to_markdown(index=False) + "\n"
            else:
                # 엑셀 파일은 여러 시트(Sheet)를 순회하며 모두 마크다운으로 병합
                xls = pd.ExcelFile(filepath)
                for sheet_name in xls.sheet_names:
                    df = pd.read_excel(xls, sheet_name=sheet_name)
                    extracted_text += f"## 시트명: {sheet_name}\n"
                    extracted_text += df.to_markdown(index=False) + "\n\n"
        except ImportError:
            logger.error("     [!] pandas 또는 openpyxl 모듈이 설치되어 있지 않습니다.")
        except Exception as e:
            logger.error(f"     [!] 스프레드시트 처리 실패: {str(e)}")

        self._save_to_json(filename, ext.lstrip('.'), extracted_text)

    def _save_to_json(self, filename: str, doc_type: str, content: str):
        """추출된 내용을 바탕으로 JSON을 만들고 인덱스로 전달하는 공용 저장 함수"""
        if not content.strip():
            logger.warning(f"     [-] {filename}에서 유의미한 텍스트를 추출하지 못했습니다.")
            return

        json_filename = f"{os.path.splitext(filename)[0]}.json"
        out_path = os.path.join(JSON_OUT_DIR, json_filename)
        
        doc_data = {
            "source_file": filename,
            "type": doc_type,
            "content": content.strip(),
            "metadata": {
                "ingested_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "status": "raw_extracted"
            }
        }
        
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump(doc_data, f, ensure_ascii=False, indent=4)
            
        self.index_data["documents"].append({
            "source": filename,
            "json_ref": json_filename,
            "type": doc_type,
            "added_at": doc_data["metadata"]["ingested_at"]
        })
        logger.info(f"     [+] JSON 지식 변환 완료: {json_filename}")
        
    def process_media(self, filepath: str):
        """동영상(mp4) 및 오디오 파일에서 음성을 텍스트로 전환(STT)하여 지식화합니다."""
        filename = os.path.basename(filepath)
        logger.info(f"   -> [대용량 미디어 청킹 & Whisper 엔진] 구동 중... ({filename})")
        
        extracted_text = f"# 미디어 소스: {filename}\n본 내용은 동영상/음성 강의의 자동 전사(Transcription) 결과입니다.\n\n"
        try:
            import ffmpeg
            import whisper
            
            # (1) 오디오 분리: mp4 -> 임시 mp3
            temp_audio_path = os.path.join(DROPZONE_DIR, f"temp_audio_{int(time.time())}.mp3")
            logger.info("     [-] FFmpeg를 통한 오디오 분리(Demuxing) 시작...")
            # ffmpeg.input(filepath).output(temp_audio_path, ac=1, ar='16k').run(quiet=True) 
            # (주석 해제 시 실제 ffmpeg 의존성 실행)
            
            # (2) 로컬 Whisper 모델 구동
            logger.info("     [-] 로컬 Whisper 모델 로딩 및 전사(Transcription) 진행 중...")
            # 로컬 메모리 한계를 고려해 기본적으로 'base' 모델 뼈대 사용 (성능 필요 시 'medium' 이상 가능)
            # model = whisper.load_model("base")
            # result = model.transcribe(temp_audio_path)
            # extracted_text += result["text"]
            
            # 현재 테스트 목적이므로 Mock 데이터를 남깁니다.
            extracted_text += "[SYSTEM] 이 구간은 FFmpeg 오디오 청킹 및 로컬 Whisper 모델 연산을 통해 텍스트로 변환된 내용이 치환되는 구역입니다."
            
            # 임시 오디오 삭제 처리
            if os.path.exists(temp_audio_path):
                os.remove(temp_audio_path)
                
        except ImportError:
            logger.error("     [!] ffmpeg-python 또는 openai-whisper 패키지가 설치되지 않았습니다.")
        except Exception as e:
            logger.error(f"     [!] 미디어 처리 에러: {str(e)}")

        self._save_to_json(filename, 'media', extracted_text)

    def process_image(self, filepath: str):
        """이미지 내의 텍스트(OCR) 및 구조를 파악합니다."""
        filename = os.path.basename(filepath)
        logger.info(f"   -> [Vision/Math OCR 엔진] 구동 중... ({filename})")
        extracted_text = f"# 시각 자료: {filename}\n\n"
        
        try:
            # 보스의 지시대로 수식(Math)은 LLM Vision 처리를 위해 경로만 참조로 남겨두는 전략 적용
            image_dest_path = os.path.join(ASSETS_DIR, filename)
            
            import shutil
            shutil.copy2(filepath, image_dest_path)
            
            extracted_text += f"> 시스템 알림: 이미지 원본은 `assets/images/{filename}` (으)로 보존 처리되었습니다.\n"
            extracted_text += "> 향후 RAG 또는 Frontend에서 해당 참조 링크를 통해 수식이나 표를 렌더링합니다."
            
        except Exception as e:
            logger.error(f"     [!] 이미지 처리 에러: {str(e)}")
            
        self._save_to_json(filename, 'image', extracted_text)

if __name__ == "__main__":
    logger.info("Universal Ingestion Router 데몬이 시작되었습니다. Dropzone 감시 중...")
    router = IngestionRouter()
    
    # 기초 1회 스캔 실행 (향후 while True: 주기적 스캔 방식으로 데몬화 필요)
    new_files = router.scan_dropzone()
    if not new_files:
        logger.info("Dropzone이 비어 있습니다.")
    else:
        for f in new_files:
            router.route_file(f)
        
        # 파일이 한 개라도 처리되었다면 인덱스 업데이트
        router._save_master_index()
        logger.info("마스터 인덱스 업데이트 완료.")
