// Node.js ESM: PDF → OCR 직접 테스트 (수정본)
// 실행: node ocr_pdf_test.mjs
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createWorker } from "tesseract.js";
import { createCanvas } from "canvas";
import { readFileSync, statSync, existsSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { tmpdir } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PDF_PATH = join(__dirname, "제120회 토목구조기술사(2020년).pdf");
const TEST_PAGES = [1, 2];

class NodeCanvasFactory {
  create(width, height) {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    return { canvas, context };
  }
  reset(cc, w, h) { cc.canvas.width = w; cc.canvas.height = h; }
  destroy() {}
}

async function renderPage(pdf, pageNum, scale = 2.5) {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const W = Math.floor(viewport.width);
  const H = Math.floor(viewport.height);
  const factory = new NodeCanvasFactory();
  const { canvas, context } = factory.create(W, H);

  // 흰 배경
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, W, H);

  await page.render({
    canvasContext: context,
    viewport,
    canvasFactory: factory,
  }).promise;

  const buf = canvas.toBuffer("image/png");
  const tmpPath = join(tmpdir(), `ocr_page${pageNum}.png`);
  writeFileSync(tmpPath, buf);

  console.log(`  크기: ${W}×${H}, 파일: ${tmpPath} (${(buf.length/1024).toFixed(0)} KB)`);
  return tmpPath;
}

async function main() {
  console.log("=== Node.js PDF OCR 테스트 ===\n");

  if (!existsSync(PDF_PATH)) {
    console.error("PDF 없음:", PDF_PATH);
    process.exit(1);
  }
  console.log(`[OK] PDF: ${(statSync(PDF_PATH).size/1024/1024).toFixed(1)} MB`);

  console.log("[INFO] PDF 로드...");
  const data = new Uint8Array(readFileSync(PDF_PATH));
  const pdf = await getDocument({ data, useSystemFonts: true }).promise;
  console.log(`[OK] ${pdf.numPages}페이지`);

  let worker = null;
  for (const lang of ["kor+eng", "eng"]) {
    console.log(`\n[INFO] Tesseract '${lang}' 워커 생성...`);
    try {
      worker = await createWorker(lang, 1, {
        logger: m => {
          if (m.status && m.progress != null)
            process.stdout.write(`\r  ${m.status}: ${Math.round(m.progress*100)}%   `);
        },
      });
      console.log(`\n[OK] 워커 성공 (${lang})`);
      break;
    } catch(e) {
      console.warn(`\n[WARN] 실패: ${e.message}`);
      worker = null;
    }
  }
  if (!worker) { console.error("[FAIL] 워커 생성 실패"); process.exit(1); }

  for (const pn of TEST_PAGES.filter(p => p <= pdf.numPages)) {
    console.log(`\n--- 페이지 ${pn} ---`);
    try {
      console.log("렌더링 중...");
      const imgPath = await renderPage(pdf, pn, 2.5);
      console.log("OCR 인식 중...");
      const res = await worker.recognize(imgPath);
      const text = (res?.data?.text || "").trim();
      console.log("\n=== 결과 ===");
      console.log(text.slice(0, 500) || "(없음)");
      console.log(`============\n글자 수: ${text.length}, 한글 포함: ${/[가-힣]/.test(text)}`);
      if (text.length > 10) {
        console.log("✅ OCR 정상 작동!");
      } else {
        console.log(`⚠️  OCR 결과 없음. 이미지를 직접 확인하세요: ${imgPath}`);
      }
    } catch(e) {
      console.error(`[FAIL] 페이지 ${pn}: ${e.message}`);
    }
  }

  await worker.terminate();
  console.log("\n완료.");
}

main().catch(e => { console.error("CRITICAL:", e.message); process.exit(1); });
