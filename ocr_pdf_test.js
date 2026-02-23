// Node.js로 실제 PDF 파일 OCR 테스트
// pdfjs-dist(PDF 렌더링) + tesseract.js(OCR) + canvas(캔버스)
const pdfjs = require("pdfjs-dist/legacy/build/pdf.js");
const { createWorker } = require("tesseract.js");
const { createCanvas } = require("pdfjs-dist/legacy/build/pdf.js").findDOMWindow
  ? require("canvas")
  : (() => {
      try { return require("canvas"); } catch { return null; }
    })() || null;
const path = require("path");
const fs = require("fs");

const PDF_PATH = path.join(
  __dirname,
  "제120회 토목구조기술사(2020년).pdf"
);
const TEST_PAGES = [1, 2]; // 1~2페이지만 테스트

async function renderPageToImageBuffer(pdf, pageNum, scale = 1.5) {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  // pdfjs-dist Node.js용 캔버스 팩토리가 필요
  // NodeCanvasFactory 구현
  class NodeCanvasFactory {
    create(w, h) {
      const { createCanvas } = require("canvas");
      const canvas = createCanvas(w, h);
      return { canvas, context: canvas.getContext("2d") };
    }
    reset(ctx, w, h) {
      ctx.canvas.width = w;
      ctx.canvas.height = h;
    }
    destroy(ctx) {}
  }

  const factory = new NodeCanvasFactory();
  const ctx = factory.create(viewport.width, viewport.height);

  await page.render({
    canvasContext: ctx.context,
    viewport,
    canvasFactory: factory,
  }).promise;

  // PNG buffer 반환
  return ctx.canvas.toBuffer("image/png");
}

async function main() {
  console.log("=== Node.js PDF → OCR 직접 테스트 ===\n");

  // 0. PDF 파일 확인
  if (!fs.existsSync(PDF_PATH)) {
    console.error("[FAIL] PDF 파일을 찾을 수 없음:", PDF_PATH);
    process.exit(1);
  }
  const pdfStat = fs.statSync(PDF_PATH);
  console.log(`[OK] PDF 파일: ${path.basename(PDF_PATH)} (${(pdfStat.size / 1024 / 1024).toFixed(1)} MB)`);

  // 1. canvas 모듈 확인
  let canvasMod;
  try {
    canvasMod = require("canvas");
    console.log("[OK] canvas 모듈 로드 성공");
  } catch (e) {
    console.error("[FAIL] canvas 모듈 없음. 설치 필요: npm install canvas");
    console.log("       → 대신 브라우저에서 ocr_test.html로 테스트하세요.");
    process.exit(1);
  }

  // 2. PDF 로드
  console.log("[INFO] PDF 로드 중...");
  const data = new Uint8Array(fs.readFileSync(PDF_PATH));
  const pdf = await pdfjs.getDocument({
    data,
    useSystemFonts: true,
  }).promise;
  console.log(`[OK] PDF 로드 완료: ${pdf.numPages}페이지`);

  // 3. Tesseract 워커 생성 (kor+eng)
  console.log("[INFO] Tesseract kor+eng 워커 생성 중...");
  let worker;
  try {
    worker = await createWorker("kor+eng", 1, {
      logger: m => {
        if (m.status && m.progress != null) {
          process.stdout.write(`\r  [Tesseract] ${m.status}: ${Math.round(m.progress * 100)}%   `);
        }
      },
    });
    console.log("\n[OK] kor+eng 워커 생성 성공!");
  } catch (e) {
    console.warn(`\n[WARN] kor+eng 워커 실패: ${e.message}. eng로 재시도...`);
    try {
      worker = await createWorker("eng", 1, {
        logger: m => {
          if (m.status && m.progress != null) {
            process.stdout.write(`\r  [Tesseract] ${m.status}: ${Math.round(m.progress * 100)}%   `);
          }
        },
      });
      console.log("\n[OK] eng 워커 생성 성공 (한국어 미지원).");
    } catch (e2) {
      console.error(`\n[FAIL] 워커 생성 완전 실패: ${e2.message}`);
      process.exit(1);
    }
  }

  // 4. 페이지별 OCR 실행
  const pagesToTest = TEST_PAGES.filter(p => p <= pdf.numPages);
  for (const pageNum of pagesToTest) {
    console.log(`\n[INFO] 페이지 ${pageNum} 처리 중...`);
    try {
      const imgBuf = await renderPageToImageBuffer(pdf, pageNum, 2.0);
      console.log(`[OK] 페이지 ${pageNum} 이미지 렌더링 완료 (${(imgBuf.length / 1024).toFixed(0)} KB)`);

      process.stdout.write(`[INFO] OCR 인식 중...`);
      const result = await worker.recognize(imgBuf);
      console.log(`\n[OK] OCR 완료!`);

      const text = (result?.data?.text || "").trim();
      console.log(`\n--- 페이지 ${pageNum} OCR 결과 (처음 400자) ---`);
      console.log(text.slice(0, 400) || "(인식된 텍스트 없음)");
      console.log("---");

      if (text.length > 10) {
        console.log(`[OK] 텍스트 인식 성공! (${text.length}자)`);
      } else {
        console.log("[WARN] 텍스트가 매우 짧거나 없음 - 이미지 품질 또는 언어 설정 확인 필요");
      }
    } catch (e) {
      console.error(`[FAIL] 페이지 ${pageNum} 처리 실패: ${e.message || e}`);
    }
  }

  await worker.terminate();
  console.log("\n[OK] 워커 종료 완료.");
  console.log("\n=== 진단 완료 ===");
}

main().catch(e => {
  console.error("[CRITICAL]", e.message || e);
  process.exit(1);
});
