// Node.js 환경에서 Tesseract.js v5 OCR 직접 테스트
// 실행: node ocr_node_test.js
const { createWorker } = require("tesseract.js");
const { createCanvas } = require("canvas").Canvas
  ? require("canvas")
  : { createCanvas: null };
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("=== Node.js Tesseract.js OCR 진단 ===\n");

  // 1. 패키지 버전 확인
  try {
    const pkg = require("./node_modules/tesseract.js/package.json");
    console.log(`[OK] tesseract.js 버전: ${pkg.version}`);
  } catch (e) {
    console.log("[OK] tesseract.js 로드 (버전 확인 실패)");
  }

  // 2. 워커 생성 테스트 (eng만, kor은 파일 크기가 커서 시간 소요)
  console.log("\n[테스트 1] eng 워커 생성 중...");
  let worker;
  try {
    worker = await createWorker("eng", 1, {
      logger: (m) => {
        if (m.status && m.progress != null) {
          const pct = Math.round(m.progress * 100);
          process.stdout.write(`\r  진행: ${m.status} ${pct}%    `);
        }
      },
      errorHandler: (e) => console.error("\n  [에러]", e),
    });
    console.log("\n[OK] eng 워커 생성 성공!");
  } catch (e) {
    console.error(`\n[FAIL] 워커 생성 실패: ${e.message || e}`);
    process.exit(1);
  }

  // 3. 실제 이미지 파일 있으면 테스트, 없으면 스킵
  const testImages = ["test.png", "test.jpg", "sample.png", "sample.jpg"];
  let tested = false;
  for (const img of testImages) {
    const imgPath = path.join(__dirname, img);
    if (fs.existsSync(imgPath)) {
      console.log(`\n[테스트 2] '${img}' 파일로 OCR 인식 중...`);
      try {
        const result = await worker.recognize(imgPath);
        const text = (result?.data?.text || "").trim();
        console.log(`[OK] 인식 결과 (처음 200자):\n${text.slice(0, 200)}`);
        tested = true;
      } catch (e) {
        console.error(`[FAIL] OCR 실패: ${e.message || e}`);
      }
      break;
    }
  }

  if (!tested) {
    console.log("\n[SKIP] 테스트 이미지 파일(test.png/jpg 등)이 없어 이미지 OCR 스킵.");
    console.log("       → 브라우저 페이지(http://127.0.0.1:9876/ocr_test.html)에서 PDF로 테스트하세요.");
  }

  // 4. PDF 테스트 (pdf.js 별도 필요, 여기서는 tesseract만 확인)
  console.log("\n[요약]");
  console.log("✅ tesseract.js Node.js 로드: 정상");
  console.log("✅ 워커 생성 (eng): 정상");
  console.log("   → 브라우저 ocr_test.html에서 '2. 워커 생성 테스트' 버튼을 클릭하여");
  console.log("     kor+eng 포함 전체 테스트를 진행하세요.");

  await worker.terminate();
  console.log("✅ 워커 종료 완료.");
}

main().catch((e) => {
  console.error("[CRITICAL]", e);
  process.exit(1);
});
