import os
import sys
import fitz  # PyMuPDF
import Quartz
import Vision
from Foundation import NSURL

def ocr_image(image_bytes):
    """
    macOS Vision API를 이용해 이미지 바이트에서 한글/영문 텍스트를 추출
    """
    # NSData 생성
    from Foundation import NSData
    ns_data = NSData.dataWithBytes_length_(image_bytes, len(image_bytes))
    
    # CIImage 또는 CGImageSource 생성
    options = {Quartz.kCGImageSourceShouldCache: False}
    img_source = Quartz.CGImageSourceCreateWithData(ns_data, options)
    if not img_source:
        return ""
        
    cg_image = Quartz.CGImageSourceCreateImageAtIndex(img_source, 0, None)
    
    # 텍스트 인식 리퀘스트 설정
    request = Vision.VNRecognizeTextRequest.alloc().init()
    # 한국어와 영어 인식
    request.setRecognitionLanguages_(["ko-KR", "en-US"])
    request.setRecognitionLevel_(Vision.VNRequestTextRecognitionLevelAccurate)
    request.setUsesLanguageCorrection_(True)
    
    # 핸들러 생성
    handler = Vision.VNImageRequestHandler.alloc().initWithCGImage_options_(cg_image, None)
    success, error = handler.performRequests_error_([request], None)
    
    if not success:
        print(f"Vision API Error: {error}")
        return ""
        
    results = request.results()
    text_blocks = []
    
    for observation in results:
        # 가장 높은 확률의 텍스트 1순위 추출
        top_candidate = observation.topCandidates_(1)
        if top_candidate:
            text_blocks.append(top_candidate[0].string())
            
    return "\n".join(text_blocks)


def extract_text_from_scanned_pdf(pdf_path, dpi=300):
    """
    pdf 문서의 모든 페이지를 이미지화하여 일괄 OCR 후 전체 텍스트 반환
    """
    try:
        doc = fitz.open(pdf_path)
    except Exception as e:
        print(f"Error opening {pdf_path}: {e}")
        return ""

    full_text = []
    for i in range(len(doc)):
        page = doc[i]
        pix = page.get_pixmap(dpi=dpi)
        img_bytes = pix.tobytes("png")
        
        page_text = ocr_image(img_bytes)
        full_text.append(page_text)
        
    return "\n".join(full_text)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 macos_ocr_parser.py <pdf_path>")
        sys.exit(1)
        
    path = sys.argv[1]
    res = extract_text_from_scanned_pdf(path)
    print("=== EXTRACTED TEXT ===")
    print(res[:1000])
    print("...")
