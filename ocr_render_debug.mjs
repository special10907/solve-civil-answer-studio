// pdfjs-dist v4 Node.js 렌더링 공식 방식 테스트
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas, Image as CanvasImage } from "canvas";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { tmpdir } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PDF_PATH = join(__dirname, "제120회 토목구조기술사(2020년).pdf");

// pdfjs-dist v4 공식 Node.js 캔버스 팩토리
class NodeCanvasFactory {
  _createCanvas(width, height) {
    return createCanvas(width, height);
  }

  create(width, height) {
    if (width <= 0 || height <= 0) throw new Error("Invalid canvas size");
    const canvas = this._createCanvas(width, height);
    return { canvas, context: canvas.getContext("2d") };
  }

  reset(canvasAndContext, width, height) {
    if (!canvasAndContext.canvas) throw new Error("Canvas missing");
    if (width <= 0 || height <= 0) throw new Error("Invalid canvas size");
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }

  destroy(canvasAndContext) {
    if (!canvasAndContext.canvas) return;
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

async function main() {
  console.log("=== PDF 렌더링 디버그 테스트 ===");
  const data = new Uint8Array(readFileSync(PDF_PATH));
  const pdf = await getDocument({
    data,
    useSystemFonts: true,
    disableFontFace: false,
    isEvalSupported: true,
  }).promise;
  console.log(`PDF: ${pdf.numPages}페이지`);

  // 페이지 1만 테스트
  const page = await pdf.getPage(1);
  const scale = 2.5;
  const viewport = page.getViewport({ scale });
  console.log(`뷰포트: ${viewport.width.toFixed(0)}×${viewport.height.toFixed(0)}`);

  const factory = new NodeCanvasFactory();
  const { canvas, context } = factory.create(
    Math.floor(viewport.width),
    Math.floor(viewport.height)
  );

  // 흰 배경
  context.fillStyle = "white";
  context.fillRect(0, 0, canvas.width, canvas.height);

  console.log("페이지 렌더링 중...");
  const renderTask = page.render({
    canvasContext: context,
    viewport,
    canvasFactory: factory,
  });

  await renderTask.promise;

  const buf = canvas.toBuffer("image/png");
  const outPath = join(tmpdir(), "ocr_render_test.png");
  writeFileSync(outPath, buf);
  console.log(`저장: ${outPath}`);
  console.log(`크기: ${canvas.width}×${canvas.height}, 파일: ${(buf.length/1024).toFixed(1)} KB`);

  // 픽셀 샘플 확인 (왼쪽 위 10×10 영역)
  const imgData = context.getImageData(100, 100, 10, 10);
  const pixels = [];
  for (let i = 0; i < 40; i += 4) {
    const r = imgData.data[i], g = imgData.data[i+1], b = imgData.data[i+2];
    pixels.push(`(${r},${g},${b})`);
  }
  console.log("픽셀 샘플 (100,100 근처):", pixels.slice(0, 5).join(" "));
  const isAllWhite = pixels.every(p => p === "(255,255,255)");
  console.log(isAllWhite
    ? "⚠️  모든 픽셀이 흰색 → 렌더링이 실제로 그려지지 않음!"
    : "✅ 다양한 픽셀 값 → 렌더링 성공"
  );

  // 이미지 파일 열기
  const { exec } = await import("child_process");
  exec(`start "" "${outPath}"`);
  console.log("이미지 파일을 열었습니다. 확인해보세요:", outPath);
}

main().catch(e => console.error("Error:", e.message || e));
