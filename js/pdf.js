async function extractTextFromPdfFile(file, fromPage = 1, toPage = 2) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async function (e) {
      try {
        const typedarray = new Uint8Array(e.target.result);
        const pdfjsLib = window["pdfjsLib"] || window["pdfjs-dist/build/pdf"];
        if (!pdfjsLib) return reject("PDF.js 라이브러리 미로딩");
        const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
        let text = "";
        for (let i = fromPage; i <= Math.min(toPage, pdf.numPages); i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map((item) => item.str).join(" ") + "\n";
        }
        resolve(text.slice(0, 2000));
      } catch (err) {
        resolve("[PDF 텍스트 추출 실패]");
      }
    };
    reader.onerror = () => reject("파일 읽기 실패");
    reader.readAsArrayBuffer(file);
  });
}

function openPdfVisualModal() {
  if (!window.visualPdfDoc) {
    alert("먼저 PDF 파일을 첨부하고 추출 버튼을 눌러주세요.");
    return;
  }
  document.getElementById("pdfVisualModal").classList.remove("hidden");
  document.getElementById("pdfVisualModal").classList.add("flex");
  window.visualCurrentPage = 1;

  // v21.6.18: 저장된 상태가 있으면 복원, 없으면 빈 배열로 시작
  if (window._savedVisualQuestions && window._savedVisualQuestions.length > 0) {
    // 저장된 문항 목록을 복원 (깊은 복사)
    window.currentReviewingQuestions = JSON.parse(
      JSON.stringify(window._savedVisualQuestions),
    );
    window.ignoredVisualBlocks = Array.isArray(window._savedIgnoredBlocks)
      ? JSON.parse(JSON.stringify(window._savedIgnoredBlocks))
      : [];
    setPdfStatus(
      `이전 작업 상태 복원: ${window.currentReviewingQuestions.length}개 문항`,
      "success",
    );
  } else {
    window.currentReviewingQuestions = [];
    window.ignoredVisualBlocks = [];
  }

  window.selectedBoxIds = [];
  window._needsCandidateRefresh = true;

  // v21.6.19: 키보드 이벤트 리스너를 한 번만 등록 (중복 방지)
  if (!window._pdfKeyListenerAttached) {
    window._pdfKeyListenerAttached = true;
    document.addEventListener("keydown", (e) => {
      // 모달이 열려 있을 때만 처리
      const modal = document.getElementById("pdfVisualModal");
      if (!modal || modal.classList.contains("hidden")) return;

      // 인풋/텍스트에어리어 포커스 중이면 무시
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        const vp = window.currentVisualViewport;
        const pg = window.visualCurrentPage;

        // DEL: 선택된 등록 문항 삭제
        if (window.selectedBoxIds && window.selectedBoxIds.length > 0) {
          const ids = [...window.selectedBoxIds];
          window.currentReviewingQuestions =
            window.currentReviewingQuestions.filter((q) => !ids.includes(q.id));
          window.selectedBoxIds = [];
          window._needsCandidateRefresh = true;
          renderReviewerList(window.currentReviewingQuestions);
          if (vp) updateVisualOverlayBoxes(pg, vp);
          setPdfStatus(`${ids.length}개 등록 영역을 삭제했습니다.`, "info");
        }

        // DEL: 선택된 후보 영역 무시 처리
        if (
          window.selectedCandidateRects &&
          window.selectedCandidateRects.length > 0
        ) {
          window.selectedCandidateRects.forEach((c) => {
            window.ignoredVisualBlocks = window.ignoredVisualBlocks || [];
            window.ignoredVisualBlocks.push({
              page: c.page,
              x: c.x,
              y: c.y,
              str: c.str,
            });
          });
          window.selectedCandidateRects = [];
          window._needsCandidateRefresh = true;
          if (vp) updateVisualOverlayBoxes(pg, vp);
          renderReviewerList(window.currentReviewingQuestions);
          setPdfStatus("선택한 후보 영역을 숨겼습니다.", "info");
        }
      }

      if (e.key === "Escape") {
        window.selectedBoxIds = [];
        window.selectedCandidateRects = [];
        window.pendingAssignIndex = null;
        const vp = window.currentVisualViewport;
        if (vp) updateVisualOverlayBoxes(window.visualCurrentPage, vp);
        setPdfStatus("선택이 해제되었습니다.", "info");
      }
    });
  }

  renderVisualPage(1);

  try {
    renderReviewerList(window.currentReviewingQuestions);
  } catch (e) {}

  // 정밀 리뷰(사이드바이사이드) 이전/다음 버튼 연동 (extractReviewer 노출 전에도 연결)
  if (typeof initReviewerControls === "function") initReviewerControls();

  // 이벤트 리스너 설정 (중복 방지)
  document.getElementById("prevPdfPageBtn").onclick = () => {
    if (window.visualCurrentPage > 1) {
      window.visualCurrentPage--;
      renderVisualPage(window.visualCurrentPage);
      renderReviewerList(window.currentReviewingQuestions);
    }
  };
  document.getElementById("nextPdfPageBtn").onclick = () => {
    if (window.visualCurrentPage < window.visualPdfDoc.numPages) {
      window.visualCurrentPage++;
      renderVisualPage(window.visualCurrentPage);
      renderReviewerList(window.currentReviewingQuestions);
    }
  };
}

function groupTextItems(items, thresholdY = 8) {
  if (!items || items.length === 0) return [];

  // Y좌표 기준 내림차순 정렬 (위에서 아래로), 같은 Y면 X좌표 오름차순
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);

  const groups = [];
  let currentGroup = null;

  sorted.forEach((item) => {
    // 텍스트 높이 보정 (v18.5)
    const adjustedH = (item.h || 10) * 0.9;
    // 문항 시작 패턴 (1., Q1, (1) 등) 감지
    const isQuestionStart = /^\s*(\d+\s*[.]|Q\d+|[(]\d+[)])/.test(item.str);

    if (!currentGroup) {
      currentGroup = {
        texts: [item],
        minX: item.x,
        maxX: item.x + (item.w || 0),
        minY: item.y,
        maxY: item.y + adjustedH,
      };
    } else {
      const verticalGap = Math.abs(currentGroup.minY - item.y);
      // X축 변화량 감지 (들여쓰기나 중앙 정렬 변화 대응)
      const horizontalShift = Math.abs(currentGroup.minX - item.x);

      // 1. 문항 시작
      // 2. 줄 간격이 임계값보다 큼
      // 3. X축 위치가 크게 변함 (다른 문단이나 컬럼)
      const shouldSplit =
        isQuestionStart ||
        verticalGap > thresholdY * 0.9 ||
        (horizontalShift > 50 && verticalGap > 2);

      if (!shouldSplit) {
        currentGroup.texts.push(item);
        currentGroup.minX = Math.min(currentGroup.minX, item.x);
        currentGroup.maxX = Math.max(currentGroup.maxX, item.x + (item.w || 0));
        currentGroup.minY = Math.min(currentGroup.minY, item.y);
        currentGroup.maxY = Math.max(currentGroup.maxY, item.y + adjustedH);
      } else {
        groups.push(currentGroup);
        currentGroup = {
          texts: [item],
          minX: item.x,
          maxX: item.x + (item.w || 0),
          minY: item.y,
          maxY: item.y + adjustedH,
        };
      }
    }
  });
  if (currentGroup) groups.push(currentGroup);

  return groups.map((g) => ({
    str: g.texts.map((t) => t.str).join(" "),
    x: g.minX,
    y: g.minY,
    w: g.maxX - g.minX,
    h: g.maxY - g.minY,
    rect: {
      x: g.minX,
      y: g.minY,
      w: g.maxX - g.minX,
      h: g.maxY - g.minY,
    },
    isCandidate:
      /^\s*(\d+\s*[.]|Q\d+|[(]\d+[)])/.test(g.texts[0].str) ||
      g.texts.map((t) => t.str).join("").length > 50,
  }));
}

// Consolidated at the bottom of the file or kept here if needed.
// Removing redundant/simple stubs to avoid conflicts.

async function renderVisualPage(pageNum) {
  if (!window.visualPdfDoc) {
    console.warn("No visualPdfDoc loaded");
    return;
  }

  // 중복 호출 방지: 현재 렌더링 중인 페이지와 동일하면 건너뜀 (debounce)
  if (window._isRenderingPage === pageNum) {
    console.log(`[PDF] Page ${pageNum} is already being rendered. Skipping.`);
    return;
  }
  window._isRenderingPage = pageNum;

  currentPdfPage = pageNum;
  window.visualCurrentPage = pageNum;

  // 1. 이전 렌더링 작업이 있으면 취소
  if (visualRenderTask) {
    try {
      visualRenderTask.cancel();
    } catch (e) {}
    visualRenderTask = null;
  }

  const statusEl = document.getElementById("pdfVisualStatus");
  if (statusEl) statusEl.textContent = `${pageNum}페이지 렌더링 중...`;

  try {
    const page = await window.visualPdfDoc.getPage(pageNum);
    const canvas = document.getElementById("pdfVisualCanvas");
    if (!canvas) throw new Error("Canvas element not found");

    const context = canvas.getContext("2d");
    const viewport = page.getViewport({ scale: 1.5 });
    window.currentVisualViewport = viewport; // 전역 저장 (오버레이 업데이트용)

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;

    const workspace = document.getElementById("pdfVisualWorkspace");
    if (workspace) {
      workspace.style.width = `${viewport.width}px`;
      workspace.style.height = `${viewport.height}px`;
    }

    // Clear previous
    context.clearRect(0, 0, canvas.width, canvas.height);

    // 2. 새로운 렌더링 태스크 시작
    visualRenderTask = page.render({
      canvasContext: context,
      viewport: viewport,
    });
    await visualRenderTask.promise;
    visualRenderTask = null;
    console.log(`[PDF] Page ${pageNum} rendered successfully. (v21.6.8)`);

    // 3. 오버레이 업데이트 및 이벤트 리스너 연결
    updateVisualOverlayBoxes(pageNum, viewport);

    // v21.6.19: 매 페이지 전환마다 드래그/클릭 이벤트 리스너 재연결
    const overlay = document.getElementById("pdfVisualOverlay");
    if (overlay && typeof initDragSelection === "function") {
      initDragSelection(overlay, viewport, pageNum);
    }

    // UI Labels
    if (document.getElementById("pdfPageLabel")) {
      document.getElementById("pdfPageLabel").textContent =
        `${pageNum} / ${window.visualPdfDoc.numPages}`;
    }
    if (document.getElementById("prevPdfPageBtn")) {
      document.getElementById("prevPdfPageBtn").disabled = pageNum <= 1;
    }
    if (document.getElementById("nextPdfPageBtn")) {
      document.getElementById("nextPdfPageBtn").disabled =
        pageNum >= window.visualPdfDoc.numPages;
    }
    if (statusEl)
      statusEl.textContent =
        "렌더링 완료. 인식된 텍스트 영역이 표시되었습니다.";
  } catch (err) {
    if (err.name === "RenderingCancelledException") {
      console.log(`[PDF] Page ${pageNum} rendering cancelled.`);
    } else {
      console.error(`[PDF] Render Error on Page ${pageNum}:`, err);
      if (statusEl) statusEl.textContent = `렌더링 오류: ${err.message}`;
    }
  } finally {
    window._isRenderingPage = null; // 완료/실패 여부와 상관없이 플래그 초기화
  }
}

function updateVisualOverlayBoxes(pageNum, viewport) {
  if (!viewport) return;
  // v21.6.14: 중복 호출 방지 및 가드
  if (window._isUpdatingOverlay) return;
  window._isUpdatingOverlay = true;

  try {
    const overlay = document.getElementById("pdfVisualOverlay");
    if (!overlay) return;

    const pageData =
      window.visualTextCache &&
      window.visualTextCache.find((c) => c.page === pageNum);

    if (!pageData) {
      overlay.innerHTML = "";
      return;
    }

    // v21.6.15: 메모리 최적화 - 원본 texts를 사용해 groupedBlocks를 만든 후 texts를 해제
    if (pageData && pageData.texts && !pageData.groupedBlocks) {
      pageData.groupedBlocks = groupTextItems(pageData.texts);
      pageData.texts = null; // 원본 데이터 해제 (메모리 절감)
    }
    const blocks = (pageData && pageData.groupedBlocks) || [];

    overlay.innerHTML = "";
    overlay.style.width = `${viewport.width}px`;
    overlay.style.height = `${viewport.height}px`;

    const normalizeForMatch = (str) =>
      (str || "").replace(/\s+/g, "").replace(/[.·,]/g, "").slice(0, 30);
    const questions = window.currentReviewingQuestions || [];

    // ──── 자동 좌표 매칭 (Auto-Linker): groupedBlocks 있을 때만 ────
    if (pageData && pageData.groupedBlocks) {
      questions.forEach((q) => {
        if (!q.rect) {
          const qNorm = normalizeForMatch(q.rawQuestion || q.title);
          const match = blocks.find((b) => {
            const bNorm = normalizeForMatch(b.str);
            return (
              qNorm.includes(bNorm) ||
              bNorm.includes(qNorm) ||
              (qNorm.length > 10 &&
                bNorm.length > 10 &&
                calculateLevenshteinDistance(qNorm, bNorm) < 5)
            );
          });
          if (match) {
            q.rect = {
              page: pageNum,
              x: match.x,
              y: match.y,
              w: match.w,
              h: match.h,
            };
          }
        }
      });
    }

    const capturedTexts = questions
      .filter((q) => q.rect && q.rect.page === pageNum)
      .map((q) => normalizeForMatch(q.rawQuestion || q.title || ""));

    // ──── 등록된 질문(Box) 렌더링 ────
    questions.forEach((q) => {
      if (!q.rect || q.rect.page !== pageNum) return;

      const rect = document.createElement("div");
      const isSelected =
        window.selectedBoxIds && window.selectedBoxIds.includes(q.id);
      rect.className = `absolute border-2 rounded transition-all group-box group ${isSelected ? "border-orange-500 bg-orange-500/30 ring-2 ring-orange-300 z-50 shadow-xl" : "border-blue-600 bg-blue-500/20 hover:bg-blue-500/30 cursor-move z-40"}`;
      rect.dataset.qId = q.id;

      const [vx1, vy1, vx2, vy2] = viewport.convertToViewportRectangle([
        q.rect.x,
        q.rect.y,
        q.rect.x + q.rect.w,
        q.rect.y + q.rect.h,
      ]);
      const vx = Math.min(vx1, vx2),
        vy = Math.min(vy1, vy2);
      const vw = Math.abs(vx2 - vx1),
        vh = Math.abs(vy2 - vy1);

      rect.style.left = `${vx}px`;
      rect.style.top = `${vy}px`;
      rect.style.width = `${vw}px`;
      rect.style.height = `${vh}px`;

      if (isSelected) addResizeHandles(rect, q.id, viewport);

      rect.onmousedown = (e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        if (e.target.classList.contains("resizer")) return;
        startBoxMove(e, q.id, viewport);
      };

      rect.onclick = (e) => {
        e.stopPropagation();
        window.selectedBoxIds = [q.id];
        window.selectedCandidateRects = [];
        updateVisualOverlayBoxes(pageNum, viewport);
        scrollReviewerListItemIntoView(q.id);
        setPdfStatus(
          `"${q.title}" 선택됨. DEL키로 삭제, 핸들로 크기/위치 조정 가능.`,
          "info",
        );
      };

      rect.ondblclick = (e) => {
        e.stopPropagation();
        scrollReviewerListItemIntoView(q.id);
      };

      overlay.appendChild(rect);
    });

    // ──── 인식 후보(Candidate) 박스 렌더링 (v21.6.16: texts가 해제되어도 groupedBlocks가 있으면 렌더링) ────
    if (
      pageData &&
      (pageData.texts || pageData.groupedBlocks) &&
      !hideAllVisualCandidates
    ) {
      if (pageData.texts && !pageData.groupedBlocks) {
        pageData.groupedBlocks = groupTextItems(pageData.texts);
        pageData.texts = null; // 메모리 해제 유지
      }
      const groupedBlocks = pageData.groupedBlocks.filter((block) => {
        // 1. 이미 등록된 문항과 겹치지 않는지
        const cleanStr = normalizeForMatch(block.str);
        const isCaptured = capturedTexts.some(
          (ct) => ct.includes(cleanStr) || cleanStr.includes(ct),
        );
        if (isCaptured) return false;

        // 2. 사용자가 삭제(무시)한 영역인지 (v18.0)
        const isIgnored = ignoredVisualBlocks.some(
          (ib) =>
            ib.page === pageNum &&
            ((Math.abs(ib.x - block.x) < 5 && Math.abs(ib.y - block.y) < 5) ||
              normalizeForMatch(ib.str) === cleanStr),
        );
        return !isIgnored;
      });

      groupedBlocks.forEach((block) => {
        const isCandMultiSelected =
          window.selectedCandidateRects &&
          window.selectedCandidateRects.some(
            (c) =>
              c.page === pageNum &&
              Math.abs(c.x - block.x) < 2 &&
              Math.abs(c.y - block.y) < 2,
          );

        const rect = document.createElement("div");
        rect.className = `absolute rounded border transition-all z-10 group-candidate group ${isCandMultiSelected ? "border-rose-400 bg-rose-400/30 ring-2 ring-rose-300 shadow-lg" : "border-blue-400/40 bg-blue-400/10 hover:bg-blue-400/25 cursor-copy"}`;

        const [vx1, vy1, vx2, vy2] = viewport.convertToViewportRectangle([
          block.x,
          block.y,
          block.x + block.w,
          block.y + block.h,
        ]);
        const vx = Math.min(vx1, vx2);
        const vy = Math.min(vy1, vy2);
        const vw = Math.abs(vx2 - vx1);
        const vh = Math.abs(vy2 - vy1);

        rect.style.left = `${vx}px`;
        rect.style.top = `${vy}px`;
        rect.style.width = `${Math.max(10, vw) + 2}px`;
        rect.style.height = `${Math.max(10, vh) + 2}px`;

        // 후보 박스에도 호버 시 안내용 가이드 표시
        rect.title = "클릭하여 문항으로 등록";

        // 후보 박스 클릭 시: 다중 선택 토글 (v21.6.11: DEL 키 연동 강화)
        rect.onclick = (e) => {
          e.stopPropagation();
          if (!window.selectedCandidateRects)
            window.selectedCandidateRects = [];

          const idxIn = window.selectedCandidateRects.findIndex(
            (c) =>
              c.page === pageNum &&
              Math.abs(c.x - block.x) < 2 &&
              Math.abs(c.y - block.y) < 2,
          );

          if (idxIn === -1) {
            window.selectedCandidateRects.push({
              page: pageNum,
              x: block.x,
              y: block.y,
              str: block.str,
              w: block.w,
              h: block.h,
            });
            setPdfStatus(
              `후보 영역 선택됨. DEL 키로 숨기거나 더블클릭으로 문항 등록.`,
              "info",
            );
          } else {
            window.selectedCandidateRects.splice(idxIn, 1);
            setPdfStatus("후보 영역 선택 해제", "info");
          }
          updateVisualOverlayBoxes(pageNum, viewport);
        };

        // 후보 박스 더블 클릭 시: 즉시 문항 등록
        rect.ondblclick = (e) => {
          e.stopPropagation();
          captureManualQuestion(block.str, {
            page: pageNum,
            x: block.x,
            y: block.y,
            w: block.w,
            h: block.h,
          });
        };

        // ──── 인식 후보 삭제 버튼 (v18.0/18.1 스타일 개선) ────
        const delBtn = document.createElement("button");
        delBtn.className =
          "absolute -top-2 -right-2 w-5 h-5 bg-white border-2 border-slate-400 rounded-full flex items-center justify-center text-slate-500 hover:text-rose-600 hover:border-rose-500 shadow-md opacity-0 group-hover:opacity-100 transition-all z-20 scale-90 hover:scale-110";
        delBtn.innerHTML = '<i class="fas fa-times text-[10px]"></i>';
        delBtn.title = "이 후보 영역 숨기기";
        delBtn.onclick = (e) => {
          e.stopPropagation();
          ignoreVisualBlock(pageNum, block.x, block.y, block.str);
        };
        rect.appendChild(delBtn);

        overlay.appendChild(rect);
      });
    }

    // ──── 임시 확정 대기 중인 수동 캡처 영역 (녹색 박스) 렌더링 ────
    if (window.pendingManualRect && window.pendingManualRect.page === pageNum) {
      const p = window.pendingManualRect;
      const [vx1, vy1, vx2, vy2] = viewport.convertToViewportRectangle([
        p.x,
        p.y,
        p.x + p.w,
        p.y + p.h,
      ]);
      const vx = Math.min(vx1, vx2),
        vy = Math.min(vy1, vy2);
      const vw = Math.abs(vx2 - vx1),
        vh = Math.abs(vy2 - vy1);

      const pendingRect = document.createElement("div");
      pendingRect.className =
        "absolute border-[3px] border-green-500 bg-green-500/20 z-40 pointer-events-none rounded";
      pendingRect.style.left = `${vx}px`;
      pendingRect.style.top = `${vy}px`;
      pendingRect.style.width = `${vw}px`;
      pendingRect.style.height = `${vh}px`;
      overlay.appendChild(pendingRect);
    }

    // ──── 드래그 선택 라이브러리 (Drag-to-Capture) ────
    initDragSelection(overlay, viewport, pageNum);
  } finally {
    window._isUpdatingOverlay = false;
  }
}

async function renderReviewerPdf(pageNum) {
  if (!visualPdfDoc) return;

  // 1. 이전 렌더링 작업 취소
  if (reviewerRenderTask) {
    try {
      reviewerRenderTask.cancel();
    } catch (e) {}
    reviewerRenderTask = null;
  }

  try {
    const page = await visualPdfDoc.getPage(pageNum);
    const canvas = document.getElementById("revPdfCanvas");
    const container = document.getElementById("revPdfContainer");
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    // 컨테이너 너비에 맞춰 자동 스케일 조정 (약 0.8~1.0)
    const scale =
      (container.clientWidth - 40) / page.getViewport({ scale: 1 }).width;
    const viewport = page.getViewport({ scale: Math.min(scale, 1.2) });
    currentReviewerViewport = viewport; // 전역 저장

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    // 2. 렌더링 태스크 시작
    reviewerRenderTask = page.render({
      canvasContext: ctx,
      viewport: viewport,
    });
    await reviewerRenderTask.promise;
    reviewerRenderTask = null;

    // 3. 오버레이 (하이라이트) 처리
    updateReviewerOverlayBoxes(pageNum, viewport);

    // 4. 드래그 캡처 기능 활성화 (사이드 뷰어 누락 픽스)
    initDragSelection(
      document.getElementById("revPdfOverlay"),
      viewport,
      pageNum,
    );

    document.getElementById("revPageLabel").textContent =
      `${pageNum} / ${visualPdfDoc.numPages}`;
    document.getElementById("revPrevBtn").disabled = pageNum <= 1;
    document.getElementById("revNextBtn").disabled =
      pageNum >= visualPdfDoc.numPages;
  } catch (err) {
    if (err.name === "RenderingCancelledException") {
      console.log(`[Reviewer] Page ${pageNum} rendering cancelled.`);
    } else {
      console.error("Reviewer PDF render failed:", err);
    }
  }
}

function updateReviewerOverlayBoxes(pageNum, viewport) {
  const overlay = document.getElementById("revPdfOverlay");
  if (!overlay || !viewport) return;

  overlay.innerHTML = "";
  overlay.style.width = `${viewport.width}px`;
  overlay.style.height = `${viewport.height}px`;

  // ──── 이미 등록된 문항(자동·수동 인식) 영역 표시 (정밀 리뷰 창에서 위치 확인용) ────
  const questions = window.currentReviewingQuestions || [];
  questions.forEach((q, idx) => {
    if (!q.rect || q.rect.page !== pageNum) return;
    const [vx1, vy1, vx2, vy2] = viewport.convertToViewportRectangle([
      q.rect.x,
      q.rect.y,
      q.rect.x + q.rect.w,
      q.rect.y + q.rect.h,
    ]);
    const vx = Math.min(vx1, vx2);
    const vy = Math.min(vy1, vy2);
    const vw = Math.abs(vx2 - vx1);
    const vh = Math.abs(vy2 - vy1);

    const box = document.createElement("div");
    const isManual = q.tags && q.tags.includes("수동지정");
    box.className = isManual
      ? "absolute border-2 border-emerald-500 bg-emerald-400/30 rounded z-30 pointer-events-none"
      : "absolute border-2 border-emerald-500/80 bg-emerald-400/20 rounded z-30 pointer-events-none";
    box.style.left = `${vx}px`;
    box.style.top = `${vy}px`;
    box.style.width = `${Math.max(4, vw)}px`;
    box.style.height = `${Math.max(4, vh)}px`;
    box.title = `#${idx + 1} ${q.title || ""} ${isManual ? "(수동)" : ""}`;
    overlay.appendChild(box);
  });

  const pageData = visualTextCache.find((c) => c.page === pageNum);
  if (pageData && pageData.texts) {
    const normalize = (str) =>
      (str || "").replace(/\s+/g, "").replace(/[.·,]/g, "").slice(0, 30);
    const questions = window.currentReviewingQuestions || [];
    const capturedTexts = questions.map((q) =>
      normalize(q.rawQuestion || q.title || ""),
    );

    if (!pageData.groupedBlocks) {
      pageData.groupedBlocks = groupTextItems(pageData.texts);
    }
    const grouped = pageData.groupedBlocks.filter((block) => {
      // 1. 이미 등록된 문항과 겹치지 않는지 (이미 캡처됨)
      const cleanStr = normalize(block.str);
      const isCaptured = capturedTexts.some(
        (ct) => ct.includes(cleanStr) || cleanStr.includes(ct),
      );
      if (isCaptured) return false;

      // 2. 사용자가 삭제(무시)한 영역인지
      const isIgnored = ignoredVisualBlocks.some(
        (ib) =>
          ib.page === pageNum &&
          ((Math.abs(ib.x - block.x) < 5 && Math.abs(ib.y - block.y) < 5) ||
            normalize(ib.str) === cleanStr),
      );
      return !isIgnored;
    });

    grouped.forEach((block) => {
      const rect = document.createElement("div");
      rect.className =
        "absolute bg-blue-400/10 border border-blue-400/20 rounded-sm hover:bg-blue-400/30 transition-colors cursor-crosshair";
      const [vx1, vy1, vx2, vy2] = viewport.convertToViewportRectangle([
        block.x,
        block.y,
        block.x + block.w,
        block.y + block.h,
      ]);
      const vx = Math.min(vx1, vx2);
      const vy = Math.min(vy1, vy2);
      const vw = Math.abs(vx2 - vx1);
      const vh = Math.abs(vy2 - vy1);

      rect.style.left = `${vx - 1}px`;
      rect.style.top = `${vy - 1}px`;
      rect.style.width = `${Math.max(5, vw) + 2}px`;
      rect.style.height = `${Math.max(5, vh) + 2}px`;

      rect.title = "클릭하여 문항으로 추가: " + block.str.slice(0, 50);
      rect.onclick = (e) => {
        e.stopPropagation();
        captureManualQuestion(block.str, {
          page: pageNum,
          x: block.x,
          y: block.y,
          w: block.w,
          h: block.h,
        });
      };

      overlay.appendChild(rect);
    });

    // ──── 임시 확정 대기 중인 수동 캡처 영역 (녹색 박스) 렌더링 ────
    if (window.pendingManualRect && window.pendingManualRect.page === pageNum) {
      const p = window.pendingManualRect;
      const [vx1, vy1, vx2, vy2] = viewport.convertToViewportRectangle([
        p.x,
        p.y,
        p.x + p.w,
        p.y + p.h,
      ]);
      const vx = Math.min(vx1, vx2),
        vy = Math.min(vy1, vy2);
      const vw = Math.abs(vx2 - vx1),
        vh = Math.abs(vy2 - vy1);

      const pendingRect = document.createElement("div");
      pendingRect.className =
        "absolute border-[3px] border-green-500 bg-green-500/20 z-40 pointer-events-none rounded";
      pendingRect.style.left = `${vx}px`;
      pendingRect.style.top = `${vy}px`;
      pendingRect.style.width = `${vw}px`;
      pendingRect.style.height = `${vh}px`;
      overlay.appendChild(pendingRect);
    }
  }
}

function renderReviewerList(questions) {
  const container = document.getElementById("revQuestionList");
  const countLabel = document.getElementById("revCountLabel");
  const modalCount = document.getElementById("modalCaptureCount");

  if (!container) return;

  // 전역 참조용 업데이트
  window.currentReviewingQuestions = Array.isArray(questions)
    ? [...questions]
    : [];

  // v21.6.15: 30페이지 전체 전수 조사는 성능에 치명적이므로, 현재 페이지 중심 또는 캐시된 카운트 사용
  const getGlobalCandidateCount = () => {
    if (
      window._cachedGlobalCandidateCount !== undefined &&
      !window._needsCandidateRefresh
    ) {
      return window._cachedGlobalCandidateCount;
    }
    const count = visualTextCache.reduce((acc, curr) => {
      if (!curr.groupedBlocks && curr.texts) {
        curr.groupedBlocks = groupTextItems(curr.texts);
        curr.texts = null; // 여기서도 메모리 해제
      }
      const pageBlocks = curr.groupedBlocks || [];
      const questions = window.currentReviewingQuestions || [];
      const normalize = (str) =>
        (str || "").replace(/\s+/g, "").replace(/[.·,]/g, "").slice(0, 30);
      const capturedTexts = questions.map((q) =>
        normalize(q.rawQuestion || q.title || ""),
      );

      const activeBlocks = pageBlocks.filter((block) => {
        const cleanStr = normalize(block.str);
        if (
          capturedTexts.some(
            (ct) => ct.includes(cleanStr) || cleanStr.includes(ct),
          )
        )
          return false;
        return !ignoredVisualBlocks.some(
          (ib) =>
            ib.page === curr.page &&
            Math.abs(ib.x - block.x) < 2 &&
            Math.abs(ib.y - block.y) < 2,
        );
      });
      return acc + activeBlocks.length;
    }, 0);
    window._cachedGlobalCandidateCount = count;
    window._needsCandidateRefresh = false;
    return count;
  };

  const groupedBlocksCount = getGlobalCandidateCount();

  // 전체 숨김 플래그가 켜져 있으면 카운트를 0으로 표시 (선택 사항, 여기선 실제 개수 유지할수도 있지만 정합성을 위해 0으로)
  const displayBlocksCount = hideAllVisualCandidates ? 0 : groupedBlocksCount;

  const qs = window.currentReviewingQuestions;
  const isPending = (idx) => window.pendingAssignIndex === idx;

  const isModalOpen = !document
    .getElementById("pdfVisualModal")
    .classList.contains("hidden");
  const targetPage = isModalOpen ? visualCurrentPage : revCurrentPage;

  if (!qs.length) {
    container.innerHTML = `<p class="text-xs text-slate-400 text-center mt-10">인식된 문항이 없습니다.<br>PDF의 파란 박스를 클릭하여 직접 추가하세요.</p>`;
    if (countLabel) countLabel.textContent = "표시할 문항 0개";
    if (modalCount)
      modalCount.textContent = `현재 선택된 문항: 0개 (인식영역: ${displayBlocksCount})`;
  } else {
    // Calculate how many belong to current page
    const pageCount = qs.filter(
      (q) => q.rect && q.rect.page === targetPage,
    ).length;
    if (countLabel) countLabel.textContent = `표시 중: ${pageCount}개`;
    if (modalCount)
      modalCount.textContent = `현재 페이지 문항: ${pageCount}개 (전체: ${qs.length}개 / 인식후보: ${displayBlocksCount})`;
  }

  const listHtml = window.currentReviewingQuestions
    .map((q, i) => {
      if (q.rect && q.rect.page !== targetPage) return "";
      const pending = isPending(i);
      return `
                <div
                  draggable="true"
                  data-q-id="${q.id}"
                  onmouseenter="setHoverHighlight('${q.id}', true)"
                  onmouseleave="setHoverHighlight('${q.id}', false)"
                  ondragstart="handleDragStart(event, ${i})"
                  ondragover="handleDragOver(event)"
                  ondrop="handleDrop(event, ${i})"
                  onclick="highlightQuestionOnPdf(${i})"
                  ondblclick="highlightQuestionOnPdf(${i})"
                  class="p-3 border rounded-lg transition-all cursor-pointer group mb-2 relative reviewer-list-item item-${q.id} ${
                    pending
                      ? "bg-white border-blue-500 ring-2 ring-blue-200 animate-pulse shadow-md"
                      : q.tags && q.tags.includes("수동지정")
                        ? "bg-green-50/70 border-green-400 hover:border-green-600 hover:shadow-md cursor-grab active:cursor-grabbing"
                        : "bg-white border-slate-200 hover:border-blue-400 hover:shadow-md cursor-grab active:cursor-grabbing"
                  }"
                >
                  <div class="pr-8">
                    <div class="flex items-center justify-between mb-1">
                      <span class="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">${q.examRound || "미지정"}</span>
                      <span class="text-[10px] font-mono text-slate-400">#${i + 1}</span>
                    </div>
                    <h5 class="text-sm font-bold text-slate-800 line-clamp-2 mb-1 group-hover:text-blue-700">${escapeHtml(q.title)}</h5>
                    ${
                      pending
                        ? '<div class="text-[9px] text-blue-600 font-bold mt-1 animate-bounce"><i class="fas fa-crosshairs mr-1"></i>PDF에서 영역을 클릭하세요</div>'
                        : ""
                    }
                  </div>

                  <!-- 할당 취소 또는 삭제 버튼 -->
                  <div class="absolute top-2 right-2 flex gap-1">
                    ${
                      pending
                        ? `
                      <button
                        onclick="event.stopPropagation(); window.pendingAssignIndex = null; renderReviewerList(window.currentReviewingQuestions);"
                        class="w-6 h-6 flex items-center justify-center text-blue-600 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100"
                        title="할당 취소"
                      >
                        <i class="fas fa-undo text-[10px]"></i>
                      </button>
                    `
                        : `
                      <button
                        onclick="event.stopPropagation(); deleteCapturedQuestion(${i})"
                        class="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors"
                        title="삭제"
                      >
                        <i class="fas fa-trash-alt text-[10px]"></i>
                      </button>
                    `
                    }
                  </div>
                </div>
              `;
    })
    .join("");

  if (window.currentReviewingQuestions.length > 0) {
    container.innerHTML = `<div class="grid grid-cols-2 gap-2 h-full content-start">${listHtml}</div>`;
  }

  // v4.0: 모달 내부 리스트도 함께 업데이트
  updateModalNavigation(targetPage);
}

// v21.6.20: 절대 사용하지 마세요. 신버전은 1626줄 켜지고 실제를 위임하는 실제 신버전에서 제어합니다.
// 중복 정의: 있지만 1626줄 버전이 우선적으로 사용되어야 함. 이전 버전(931줄)은 필요 없음.
function _highlightQuestionOnPdfLegacy(index) {
  // Legacy stub - delegates to new highlightQuestionOnPdf at line 1626
  // DO NOT CALL THIS DIRECTLY
}

function scrollReviewerListItemIntoView(id) {
  const list =
    document.getElementById("modalCaptureList") ||
    document.getElementById("revQuestionList");
  if (!list) return;

  const item = list.querySelector(`.item-${id}`);
  if (item) {
    item.scrollIntoView({ behavior: "smooth", block: "center" });
    item.classList.add("ring-4", "ring-indigo-500/50", "bg-indigo-50");
    setTimeout(() => {
      item.classList.remove("ring-4", "ring-indigo-500/50", "bg-indigo-50");
    }, 1500);
  }
}

// Redundant version removed. See consolidated version below.

// Redundant version removed. See consolidated version below.

function updateModalNavigation(targetPage) {
  const modalList = document.getElementById("modalCaptureList");
  if (!modalList) {
    console.warn("modalCaptureList element not found. targetPage:", targetPage);
    return;
  }

  const currentQuestions = window.currentReviewingQuestions || [];

  if (!currentQuestions.length) {
    modalList.innerHTML = `<p class="text-center text-[11px] text-slate-400 mt-10">캡처된 문항이 없습니다.<br />PDF 박스를 클릭하세요.</p>`;
  } else {
    // 폼 요소는 이미 HTML (solve_120.html) 쪽에 고정 위치하므로, 동적 리스트만 삽입
    const filtered = currentQuestions
      .map((q, i) => {
        if (q.rect && q.rect.page !== targetPage) return "";
        return `
          <div
            onclick="highlightQuestionOnPdf(${i})"
            onmouseenter="setHoverHighlight('${q.id}', true)"
            onmouseleave="setHoverHighlight('${q.id}', false)"
            class="p-2 border border-slate-100 rounded bg-slate-50 relative group cursor-pointer hover:border-blue-300 transition-colors item-${q.id}"
          >
            <div class="text-[11px] font-bold text-slate-700 truncate pr-5">${escapeHtml(q.title)}</div>
            <button onclick="event.stopPropagation(); deleteCapturedQuestion(${i})" class="absolute right-1 top-1 w-4 h-4 text-slate-300 hover:text-rose-500"><i class="fas fa-times text-[10px]"></i></button>
          </div>`;
      })
      .join("");
    modalList.innerHTML =
      filtered ||
      `<p class="text-center text-[11px] text-slate-400 mt-10">이 페이지에 매핑된 문항이 없습니다.</p>`;
  }
}

function deleteCapturedQuestion(index) {
  const questions = window.currentReviewingQuestions || [];
  if (index < 0 || index >= questions.length) return;

  const removed = questions[index];
  const hasRect = !!removed.rect;

  let deleteArea = false;
  if (hasRect) {
    deleteArea = confirm(
      `"${removed.title}" 문항을 리스트에서 삭제하시겠습니까?\n\n(확인 클릭 시 인식 영역도 함께 숨겨집니다.)`,
    );
  } else {
    if (!confirm(`"${removed.title}" 문항을 리스트에서 삭제하시겠습니까?`))
      return;
  }

  // 실제 리스트에서 제거
  questions.splice(index, 1);

  if (deleteArea && removed.rect) {
    ignoredVisualBlocks.push({
      page: removed.rect.page,
      x: removed.rect.x,
      y: removed.rect.y,
      str: removed.rawQuestion || removed.title,
    });
  }

  window._needsCandidateRefresh = true;
  try {
    const data = getCurrentAnswerData();
    data.questions = data.questions.filter((q) => q.id !== removed.id);
    syncJsonAndRender(data, "문항이 삭제되었습니다.", true);
  } catch (e) {
    console.error("데이터 동기화 실패:", e);
  }

  renderReviewerList([...questions]);
  // v21.6.2 리스트 갱신/조작 후 캔버스 파괴(백화 현상) 방지
  if (currentVisualViewport) {
    updateVisualOverlayBoxes(visualCurrentPage, currentVisualViewport);
  }
  renderReviewerPdf(visualCurrentPage); // v18.4: 사이드 리뷰어 오버레이 동기화
  refreshAutoExtractSummary();
}

function handleDragStart(e, index) {
  draggedItemIndex = index;
  e.dataTransfer.effectAllowed = "move";
  e.currentTarget.classList.add("opacity-50");
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
}

function handleDrop(e, toIndex) {
  e.preventDefault();
  if (draggedItemIndex === null || draggedItemIndex === toIndex) return;

  const questions = [...window.currentReviewingQuestions];
  const [movedItem] = questions.splice(draggedItemIndex, 1);
  questions.splice(toIndex, 0, movedItem);

  // 메인 데이터 동기화
  try {
    const data = getCurrentAnswerData();
    // window.currentReviewingQuestions와 data.questions 간의 순서 동기화
    // id를 기준으로 기존 맵 유지하면서 순서만 재배열
    const newQuestions = questions.map((q) => {
      return data.questions.find((dbQ) => dbQ.id === q.id) || q;
    });

    // 데이터에 없던 항목이 있을 경우(그럴 가능성은 낮지만) 대비하여 필터링된 누락분 추가
    const missing = data.questions.filter(
      (dbQ) => !questions.some((q) => q.id === dbQ.id),
    );
    data.questions = [...newQuestions, ...missing];

    syncJsonAndRender(data, "문항 순서가 변경되었습니다.", true);
  } catch (e) {
    console.error("순서 동기화 실패:", e);
  }

  renderReviewerList(questions);
  // v21.6.2 리스트 갱신/조작 후 캔버스 파괴(백화 현상) 방지
  if (currentVisualViewport) {
    updateVisualOverlayBoxes(visualCurrentPage, currentVisualViewport);
  }
  renderReviewerPdf(visualCurrentPage); // v18.4: 사이드 리뷰어 오버레이 동기화
  draggedItemIndex = null;
}

function captureManualQuestion(text, rectData = null) {
  if (!text || !text.trim()) return;
  const questions = window.currentReviewingQuestions || [];

  // ──── 좌표 할당 모드 (Assign Mode) 처리 (v18.4) ────
  if (window.pendingAssignIndex !== null && rectData) {
    const idx = window.pendingAssignIndex;
    const targetQ = questions[idx];
    if (targetQ) {
      targetQ.rect = rectData;

      // 전역 데이터(DB)와 동기화
      try {
        const data = getCurrentAnswerData();
        const dbQ = data.questions.find((q) => q.id === targetQ.id);
        if (dbQ) {
          dbQ.rect = rectData;
          syncJsonAndRender(
            data,
            `"${targetQ.title}" 문항에 좌표를 연결했습니다.`,
            true,
          );
        }
      } catch (e) {
        console.error("데이터 동기화 실패:", e);
      }

      window.pendingAssignIndex = null; // 대기 모드 해제
      window.currentHighlightedBoxIndex = idx; // 해당 박스 선택 강조
      window.currentHighlightedBoxPage = rectData.page;

      renderReviewerList([...questions]);
      // v21.6.2 리스트 갱신/조작 후 캔버스 파괴(백화 현상) 방지
      if (currentVisualViewport) {
        updateVisualOverlayBoxes(visualCurrentPage, currentVisualViewport);
      }
      renderReviewerPdf(visualCurrentPage); // v18.4: 사이드 리뷰어 오버레이 동기화
      setPdfStatus("문항 좌표 연결 완료", "success");
      return;
    }
  }

  // ──── 수동 캡처 / 영역 확정 모드 (폼 채우기) ────
  const inputEl = document.getElementById("manualInputText");
  const roundEl = document.getElementById("manualExamRound");
  const sessionEl = document.getElementById("manualSession");
  const numEl = document.getElementById("manualQNum");

  if (inputEl) inputEl.value = text;

  if (roundEl) {
    const roundMatch = text.match(/(\d+)\s*회/);
    if (roundMatch) roundEl.value = roundMatch[0].replace(/\s+/g, "");
  }

  if (sessionEl) {
    if (/1\s*교시/.test(text)) sessionEl.value = "1교시";
    else if (/2\s*교시/.test(text)) sessionEl.value = "2교시";
    else if (/3\s*교시/.test(text)) sessionEl.value = "3교시";
    else if (/4\s*교시/.test(text)) sessionEl.value = "4교시";
  }

  if (numEl) {
    const numMatch = text.match(/^\s*(?:\[\s*\d+\s*\]|\d+)[가-힣-\.]*/);
    if (numMatch) {
      numEl.value = numMatch[0].replace(/\[|\]/g, "").trim() + "번";
    } else {
      numEl.value = "";
    }
  }

  window.pendingManualRect = rectData;
  setPdfStatus(
    "영역 텍스트 추출됨. 우측 폼에서 명칭 부여 후 '확정 및 저장' 하세요.",
    "info",
  );

  if (inputEl) {
    inputEl.classList.add("bg-blue-100", "border-blue-400");
    setTimeout(
      () => inputEl.classList.remove("bg-blue-100", "border-blue-400"),
      800,
    );
  }

  // 렌더링을 즉시 다시 수행하여 방금 추가된 녹색(대기) 영역이 그려지도록 함
  const isModalOpen = !document
    .getElementById("pdfVisualModal")
    .classList.contains("hidden");
  if (isModalOpen) {
    renderVisualPage(visualCurrentPage);
  } else {
    renderReviewerPdf(revCurrentPage);
  }
}

async function analyzeCurrentArea() {
  const textEl = document.getElementById("manualInputText");
  const roundEl = document.getElementById("manualExamRound");
  const numEl = document.getElementById("manualQNum");

  const rawText = textEl ? textEl.value.trim() : "";
  if (!rawText) {
    setPdfStatus(
      "분석할 내용이 없습니다. 영역을 먼저 클릭하거나 드래그하세요.",
      "error",
    );
    return;
  }

  setPdfStatus("AI 분석 중...", "info");
  try {
    // Cloudflare Worker API 또는 Local Endpoint 호출
    const response = await fetch(
      "http://localhost:8787/api/analyze-questions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: rawText }),
      },
    );

    if (!response.ok) throw new Error("API 연동 실패");

    const resData = await response.json();
    if (resData.questions && resData.questions.length > 0) {
      const q = resData.questions[0];
      if (numEl && q.title) numEl.value = q.title;
      if (textEl && q.rawQuestion) textEl.value = q.rawQuestion;
      setPdfStatus(
        "AI 분석 완료. 내역을 확인하고 '추가' 버튼을 누르세요.",
        "success",
      );
    } else {
      setPdfStatus("분석 결과가 없습니다. 기존 내용을 유지합니다.", "warning");
    }
  } catch (e) {
    console.error("AI Analyzer Error:", e);
    setPdfStatus("API 분석에 실패했습니다. 형식만 확정합니다.", "warning");

    let previewTitle = numEl && numEl.value.trim() ? numEl.value.trim() : "";
    if (!previewTitle) {
      previewTitle =
        rawText.length > 30
          ? rawText.slice(0, 30).trim() + "..."
          : rawText.trim();
    }
    if (numEl && !numEl.value) numEl.value = previewTitle;
  }
}

function commitAreaToList() {
  const textEl = document.getElementById("manualInputText");
  const text = textEl ? textEl.value.trim() : "";
  if (!text) {
    setPdfStatus("추가할 내용이 없습니다.", "error");
    return;
  }

  const roundEl = document.getElementById("manualExamRound");
  const sessionEl = document.getElementById("manualSession");

  let examRound = "";
  if (roundEl && roundEl.value.trim()) examRound += roundEl.value.trim();
  if (sessionEl && sessionEl.value !== "미지정" && sessionEl.value !== "선택") {
    examRound += (examRound ? " " : "") + sessionEl.value;
  }
  if (!examRound) examRound = "미지정";

  const numEl = document.getElementById("manualQNum");
  let title = numEl && numEl.value.trim() ? numEl.value.trim() : "";
  if (!title) {
    title = text.length > 50 ? text.slice(0, 50).trim() + "..." : text.trim();
  }

  const rectData = window.pendingManualRect || null;
  const questions = window.currentReviewingQuestions || [];

  if (rectData) {
    if (
      questions.some(
        (q) =>
          q.rect &&
          q.rect.page === rectData.page &&
          Math.abs(q.rect.x - rectData.x) < 2 &&
          Math.abs(q.rect.y - rectData.y) < 2,
      )
    ) {
      if (
        !confirm("이미 비슷한 위치에 등록된 항목이 있습니다. 추가하시겠습니까?")
      ) {
        return;
      }
    }
  }

  const newQ = {
    id: "MANUAL-" + Date.now(),
    title: title,
    examRound: examRound,
    rawQuestion: text,
    tags: ["수동지정"],
    rect: rectData,
    modelAnswer: "",
    source: "Manual Capture",
    reviewed: false,
  };

  window.currentReviewingQuestions.push(newQ);
  window._needsCandidateRefresh = true;
  renderReviewerList(window.currentReviewingQuestions);
  // v21.6 캔버스 날아감 방지: 백그라운드 렌더링 대신 오버레이만 갱신
  if (currentVisualViewport) {
    updateVisualOverlayBoxes(visualCurrentPage, currentVisualViewport);
  }
  setPdfStatus(
    "새 항목이 리뷰 목록에 등록되었습니다. 닫기 전 '적용'을 누르세요.",
    "success",
  );

  // 입력 폼 초기화
  if (textEl) textEl.value = "";
  if (numEl) numEl.value = "";
  window.pendingManualRect = null;
}

function toggleAddAreaMode() {
  window.isAddAreaMode = !window.isAddAreaMode;
  const btn = document.getElementById("toggleAddAreaBtn");
  const overlay = document.getElementById("pdfVisualOverlay");
  if (window.isAddAreaMode) {
    btn.classList.add("bg-blue-600", "text-white", "border-blue-700");
    btn.classList.remove("bg-white", "text-slate-600", "border-slate-200");
    if (overlay) overlay.style.cursor = "crosshair";
    setPdfStatus(
      "영역 추가 모드가 활성화되었습니다. 드래그하여 영역을 지정하세요.",
      "info",
    );
  } else {
    btn.classList.remove("bg-blue-600", "text-white", "border-blue-700");
    btn.classList.add("bg-white", "text-slate-600", "border-slate-200");
    if (overlay) overlay.style.cursor = "default";
    setPdfStatus("영역 추가 모드가 해제되었습니다.", "info");
  }
}

function deselectAllAreas() {
  // Reset manual capture form
  const textEl = document.getElementById("manualInputText");
  const numEl = document.getElementById("manualQNum");
  const roundEl = document.getElementById("manualExamRound");
  const sessionEl = document.getElementById("manualSession");

  if (textEl) textEl.value = "";
  if (numEl) numEl.value = "";
  if (roundEl) roundEl.value = "";
  if (sessionEl) sessionEl.value = "미지정";

  window.pendingManualRect = null;
  window.currentHighlightedBoxIndex = null;

  // Unset selection if any active question was in resizing/moving state
  if (window.activeQuestionId !== null) endMouseInteraction();

  // v21.6 캔버스 날아감 방지: 백그라운드 렌더링 대신 오버레이만 업데이트
  updateVisualOverlayBoxes(
    window.visualCurrentPage,
    window.currentVisualViewport,
  );
  renderReviewerList(window.currentReviewingQuestions);
}

function ignoreAllCandidatesOnPage() {
  const isModalOpen = !document
    .getElementById("pdfVisualModal")
    .classList.contains("hidden");
  const pageNum = isModalOpen
    ? window.visualCurrentPage
    : window.revCurrentPage;
  const pageData = window.visualTextCache.find((d) => d.page === pageNum);
  if (!pageData) return;

  if (
    !confirm(
      `현재 페이지(${pageNum}p)의 등록된 문항과 인식 후보 영역을 모두 삭제/숨김 처리하시겠습니까?`,
    )
  ) {
    return;
  }

  // 1. 현재 페이지의 등록된 문항(영역) 찾아서 삭제
  const questions = window.currentReviewingQuestions || [];
  const questionsToKeep = questions.filter(
    (q) => !(q.rect && q.rect.page === pageNum),
  );
  const removedCount = questions.length - questionsToKeep.length;

  window.currentReviewingQuestions = questionsToKeep;
  window._needsCandidateRefresh = true;

  // v21.6.4: 확정되지 않고 작성 중인 수동 캡처(녹색) 및 우측 상단 입력 폼 초기화
  deselectAllAreas();

  try {
    const data = getCurrentAnswerData();
    data.questions = data.questions.filter((q) =>
      questionsToKeep.some((k) => k.id === q.id),
    );
    // 경고를 주지 않고 무음 동기화 (마지막에 한번만 렌더)
    window.__currentAnswerData = data;
  } catch (e) {
    console.error("데이터 동기화 실패:", e);
  }

  // 2. 남은 미등록 자동 후보 텍스트 (글씨 하이라이트) 찾아서 숨김 처리 (기존 로직 유지)
  const normalizeForMatch = (str) =>
    (str || "").replace(/\s+/g, "").replace(/[.·,]/g, "").slice(0, 30);
  const capturedTexts = questionsToKeep.map((q) =>
    normalizeForMatch(q.rawQuestion || q.title || ""),
  );

  // v21.6.16: 캐싱된 데이터 사용
  if (pageData.texts && !pageData.groupedBlocks) {
    pageData.groupedBlocks = groupTextItems(pageData.texts);
    pageData.texts = null; // 메모리 해제 유지
  }
  const blocks = pageData.groupedBlocks || [];
  const candidates = blocks.filter((block) => {
    const cleanStr = normalizeForMatch(block.str);
    return !capturedTexts.some(
      (ct) => ct.includes(cleanStr) || cleanStr.includes(ct),
    );
  });

  candidates.forEach((block) => {
    window.ignoredVisualBlocks.push({
      page: pageNum,
      x: block.x,
      y: block.y,
      str: block.str,
    });
  });

  // UI 갱신 (캔버스 보존)
  syncJsonAndRender(
    window.__currentAnswerData,
    `현재 페이지의 문항 ${removedCount}개와 후보 영역 ${candidates.length}개를 모두 초기화했습니다.`,
    true,
  );
  updateVisualOverlayBoxes(pageNum, currentVisualViewport);
  renderReviewerList(window.currentReviewingQuestions);

  if (
    typeof updateReviewerOverlayBoxes === "function" &&
    currentReviewerViewport
  ) {
    updateReviewerOverlayBoxes(pageNum, currentReviewerViewport);
  }
}

function ignoreVisualBlock(pageNum, x, y, str) {
  window.ignoredVisualBlocks.push({
    page: pageNum,
    x: x,
    y: y,
    str: str,
  });
  window._needsCandidateRefresh = true;

  // 1. 메인 오버레이 갱신 (파란 박스 제거)
  updateVisualOverlayBoxes(pageNum, window.currentVisualViewport);

  // 2. 리뷰어 오버레이 갱신 (사이드-바이-사이드 동기화)
  if (
    typeof updateReviewerOverlayBoxes === "function" &&
    window.currentReviewerViewport
  ) {
    updateReviewerOverlayBoxes(pageNum, window.currentReviewerViewport);
  }

  // 3. 문항 리스트 및 카운트 레이블 갱신 (중요: v18.3 카운트 즉시 반영)
  renderReviewerList(window.currentReviewingQuestions || []);

  setPdfStatus("선택한 인식 영역을 숨겼습니다.", "info");
}

function refreshAutoExtractSummary(lastAddedCount = null) {
  const reportArea = document.getElementById("autoExtractReport");
  if (!reportArea) return;

  try {
    const data = getCurrentAnswerData();
    const qs = data.questions || [];

    let html = `<div class="p-1">`;

    if (lastAddedCount !== null) {
      html += `<div class="mb-3 p-2 bg-emerald-50 border border-emerald-200 rounded text-emerald-800 text-center font-bold text-xs">
                      <i class="fas fa-plus-circle mr-1"></i>방금 ${lastAddedCount}개의 문항이 새롭게 추가되었습니다!
                    </div>`;
    }

    if (!qs.length) {
      html += `<p class="text-slate-400 text-xs text-center py-4">저장된 문항 데이터가 없습니다.</p>`;
    } else {
      const countsByRound = {};
      qs.forEach((q) => {
        const r = q.examRound || "미지정";
        countsByRound[r] = (countsByRound[r] || 0) + 1;
      });

      html += `<div class="text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-wider border-b pb-1">데이터베이스 검색 요약 (${qs.length}문항)</div>`;
      html += `<div class="grid grid-cols-2 gap-2">`;
      Object.entries(countsByRound)
        .sort()
        .forEach(([round, count]) => {
          html += `<div class="flex justify-between items-center bg-white p-2 rounded shadow-sm border border-slate-100">
                        <span class="text-xs font-bold text-slate-700">${escapeHtml(round)}</span>
                        <span class="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">${count}</span>
                      </div>`;
        });
      html += `</div>`;
    }

    html += `</div>`;
    reportArea.innerHTML = html;
  } catch (e) {
    console.error("Summary refresh failed:", e);
  }
}

function findAndGoToPage(
  searchText,
  targetPage = null,

  targetIndex = null,
) {
  if (!window.visualTextCache) return;

  // ──── 좌표/인덱스 기반 직접 이동 (v12.0 고도화) ────

  if (targetPage !== null) {
    window.currentHighlightedBoxIndex = targetIndex;

    window.currentHighlightedBoxPage = targetPage;

    if (visualCurrentPage === targetPage || revCurrentPage === targetPage) {
      updateVisualOverlayBoxes(targetPage, currentVisualViewport);

      if (
        typeof updateReviewerOverlayBoxes === "function" &&
        currentReviewerViewport
      ) {
        updateReviewerOverlayBoxes(targetPage, currentReviewerViewport);
      }
    } else {
      window.revCurrentPage = targetPage;
      window.visualCurrentPage = targetPage;
      renderReviewerPdf(window.revCurrentPage);
      renderVisualPage(window.visualCurrentPage);
    }

    // 스크롤 포커스 (선택 사항: 필요한 경우 추가 가능)

    return;
  }

  if (!searchText) return;

  const cleanSearch = searchText.replace(/\s+/g, "").toLowerCase();

  for (const entry of visualTextCache) {
    if (entry.texts && !entry.groupedBlocks) {
      entry.groupedBlocks = groupTextItems(entry.texts);
      entry.texts = null; // 원본 해제
    }
    const grouped = entry.groupedBlocks || [];

    const pageFullText = grouped
      .map((b) => b.str)
      .join("")
      .replace(/\s+/g, "")
      .toLowerCase();

    if (pageFullText.includes(cleanSearch)) {
      const boxIndex = grouped.findIndex((b) =>
        b.str

          .replace(/\s+/g, "")

          .toLowerCase()

          .includes(cleanSearch.slice(0, 10)),
      );

      window.currentHighlightedBoxIndex = boxIndex;

      window.currentHighlightedBoxPage = entry.page;

      if (visualCurrentPage === entry.page || revCurrentPage === entry.page) {
        updateVisualOverlayBoxes(entry.page, currentVisualViewport);

        if (
          typeof updateReviewerOverlayBoxes === "function" &&
          currentReviewerViewport
        ) {
          updateReviewerOverlayBoxes(entry.page, currentReviewerViewport);
        }
      } else {
        revCurrentPage = entry.page;

        visualCurrentPage = entry.page;

        renderReviewerPdf(revCurrentPage);

        renderVisualPage(visualCurrentPage);
      }

      return;
    }
  }
}

function highlightQuestionOnPdf(index) {
  const q = window.currentReviewingQuestions[index];
  if (!q) return;

  // 좌표 데이터가 있으면 즉시 이동, 없으면 좌표 할당 모드(Assign Mode)로 전환 (v18.4)
  if (q.rect && q.rect.page) {
    window.pendingAssignIndex = null; // 이미 좌표가 있으면 할당 모드 해제
    findAndGoToPage(null, q.rect.page, index);
  } else {
    window.pendingAssignIndex = index;
    renderReviewerList(window.currentReviewingQuestions); // 상태 UI 반영
    setPdfStatus(
      `"${q.title}" 문항의 위치를 지정하세요. PDF 영역을 클릭하거나 드래그하면 좌표가 연결됩니다.`,
      "info",
    );
  }
}

function scrollReviewerListItemIntoView(qId) {
  const safeQId = String(qId).replace(/"/g, '\\"');
  // data-q-id를 가진 아이템 탐색 방식으로 교체 (reviewer-item- 방식 대신 안정적)
  const item = document.querySelector(
    `.reviewer-list-item[data-q-id="${safeQId}"]`,
  );
  if (item) {
    item.scrollIntoView({ behavior: "smooth", block: "center" });
    // 시각적 피드백: 잠시 동안 강조 효과
    item.classList.add("ring-2", "ring-blue-500", "bg-blue-50");
    setTimeout(() => {
      item.classList.remove("ring-2", "ring-blue-500", "bg-blue-50");
    }, 1500);
  } else {
    // 모달 리스트에도 시도
    const modalItem = document.querySelector(
      `#modalCaptureList [data-q-id="${safeQId}"]`,
    );
    if (modalItem) {
      modalItem.scrollIntoView({ behavior: "smooth", block: "center" });
      modalItem.classList.add("ring-2", "ring-blue-500", "bg-blue-50");
      setTimeout(() => {
        modalItem.classList.remove("ring-2", "ring-blue-500", "bg-blue-50");
      }, 1500);
    }
  }
}

function setHoverHighlight(qId, isHover) {
  const safeQId = String(qId).replace(/"/g, '\\"');
  // 1. PDF 오버레이 박스 강조
  const boxes = document.querySelectorAll(`[data-q-id="${safeQId}"]`);
  boxes.forEach((box) => {
    // 오버레이 박스인지 확인하기 위해 class checking 필요 (폼이나 버튼 방지용)
    if (!box.classList.contains("group-box")) return;

    if (isHover) {
      box.classList.add("ring-4", "ring-blue-400", "z-50", "scale-[1.02]");
    } else {
      box.classList.remove("ring-4", "ring-blue-400", "z-50", "scale-[1.02]");
    }
  });

  // 2. 리스트 아이템 강조
  const listItems = document.querySelectorAll(
    `.reviewer-list-item[data-q-id="${safeQId}"], #modalCaptureList [data-q-id="${safeQId}"]`,
  );
  listItems.forEach((item) => {
    if (isHover) {
      item.classList.add("bg-blue-50", "border-blue-400", "shadow-md");
    } else {
      item.classList.remove("bg-blue-50", "border-blue-400", "shadow-md");
    }
  });
}

function addResizeHandles(box, qId, viewport) {
  const handles = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
  const size = 12; // px, 클릭하기 쉬운 크기
  const half = size / 2;
  handles.forEach((type) => {
    const h = document.createElement("div");
    h.className = `absolute bg-orange-600 border-2 border-white handle-${type} resizer shadow-md z-50`;
    h.setAttribute("data-handle", type);
    h.style.width = `${size}px`;
    h.style.height = `${size}px`;
    h.style.cursor = `${type}-resize`;
    h.style.pointerEvents = "auto";

    // 위치 설정 (박스 가장자리 바깥쪽으로 살짝)
    if (type.includes("n")) h.style.top = `${-half}px`;
    if (type.includes("s")) h.style.bottom = `${-half}px`;
    if (type.includes("w")) h.style.left = `${-half}px`;
    if (type.includes("e")) h.style.right = `${-half}px`;
    if (type === "n" || type === "s") h.style.left = `calc(50% - ${half}px)`;
    if (type === "w" || type === "e") h.style.top = `calc(50% - ${half}px)`;

    h.onmousedown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      startBoxResize(e, qId, type, viewport);
    };
    box.appendChild(h);
  });
}

function startBoxMove(e, qId, viewport) {
  console.log(`[START_BOX_MOVE] Called with qId=${qId}`);
  window.activeQuestionId = qId;
  window.activeHandleType = "move";
  window.activeViewport = viewport;
  window.mouseInitialPos = { x: e.clientX, y: e.clientY };
  const questions = window.currentReviewingQuestions || [];
  const q = questions.find((item) => item.id === qId);

  if (!q) {
    console.error(
      `[START_BOX_MOVE_FAIL] Question not found in currentReviewingQuestions. qId=${qId}`,
    );
    return;
  }
  if (!q.rect) {
    console.error(
      `[START_BOX_MOVE_FAIL] Question does not have rect property. qId=${qId}`,
    );
    return;
  }

  window.boxInitialPos = JSON.parse(JSON.stringify(q.rect)); // 확실한 Deep Copy
  console.log(`[START_BOX_MOVE] Success. Listeners attached.`);
  document.addEventListener("mousemove", handleMouseInteraction);
  document.addEventListener("mouseup", endMouseInteraction);
}

function startBoxResize(e, qId, type, viewport) {
  console.log(`[START_BOX_RESIZE] Called with qId=${qId}, type=${type}`);
  window.activeQuestionId = qId;
  window.activeHandleType = type;
  window.activeViewport = viewport;
  window.mouseInitialPos = { x: e.clientX, y: e.clientY };
  const questions = window.currentReviewingQuestions || [];
  const q = questions.find((item) => item.id === qId);
  if (!q || !q.rect) return;

  window.boxInitialPos = JSON.parse(JSON.stringify(q.rect)); // 확실한 Deep Copy
  document.addEventListener("mousemove", handleMouseInteraction);
  document.addEventListener("mouseup", endMouseInteraction);
}

function handleMouseInteraction(e) {
  if (!window.activeQuestionId || !window.activeViewport) return;
  const questions = window.currentReviewingQuestions || [];
  const q = questions.find((item) => item.id === window.activeQuestionId);
  if (!q || !q.rect) return;

  // 마우스 이동 거리 (Screen coordinate)
  const mouseDx = e.clientX - window.mouseInitialPos.x;
  const mouseDy = e.clientY - window.mouseInitialPos.y;

  // PDF 좌표계에서의 변화량 계산 (v21.0: 뷰포트 기반 정밀 계산)
  const [vStartX, vStartY] = window.activeViewport.convertToViewportPoint(
    window.boxInitialPos.x,
    window.boxInitialPos.y,
  );
  const [newPdfX, newPdfY] = window.activeViewport.convertToPdfPoint(
    vStartX + mouseDx,
    vStartY + mouseDy,
  );

  const pdfDx = newPdfX - window.boxInitialPos.x;
  const pdfDy = newPdfY - window.boxInitialPos.y;

  if (window.activeHandleType === "move") {
    // 이동 시 크기(w, h)는 절대 변경하지 않음 (v21.0 안정성 강화)
    q.rect.x = window.boxInitialPos.x + pdfDx;
    q.rect.y = window.boxInitialPos.y + pdfDy;
    q.rect.w = window.boxInitialPos.w;
    q.rect.h = window.boxInitialPos.h;
  } else {
    // Resize (PDF 좌표계: y는 위로 증가, (x, y)는 좌측 하단)
    const MIN_SIZE = 5;

    if (window.activeHandleType.includes("n")) {
      // North: 상단 경계(y+h) 조절 -> y는 고정, h = 현재 PDF Y - 시작점 Y
      const newH = newPdfY - window.boxInitialPos.y;
      if (newH > MIN_SIZE) q.rect.h = newH;
    }
    if (window.activeHandleType.includes("s")) {
      // South: 하단 경계(y) 조절 -> y = 현재 PDF Y, h = 기존 상단 - 현재 PDF Y
      const newY = newPdfY;
      const newH = window.boxInitialPos.y + window.boxInitialPos.h - newPdfY;
      if (newH > MIN_SIZE) {
        q.rect.y = newY;
        q.rect.h = newH;
      }
    }
    if (window.activeHandleType.includes("e")) {
      // East: 우측 경계(x+w) 조절 -> x는 고정, w = 현재 PDF X - 시작점 X
      const newW = newPdfX - window.boxInitialPos.x;
      if (newW > MIN_SIZE) q.rect.w = newW;
    }
    if (window.activeHandleType.includes("w")) {
      // West: 좌측 경계(x) 조절 -> x = 현재 PDF X, w = 기존 우측 - 현재 PDF X
      const newX = newPdfX;
      const newW = window.boxInitialPos.x + window.boxInitialPos.w - newPdfX;
      if (newW > MIN_SIZE) {
        q.rect.x = newX;
        q.rect.w = newW;
      }
    }
  }

  // 화면 내 위치한 동일 문항 상자 전체의 node style을 즉시 업데이트 (비주얼/리뷰어 양방향 전역 동기화)
  const safeQId = String(window.activeQuestionId).replace(/"/g, '\\"');
  const boxNodes = document.querySelectorAll(`[data-q-id="${safeQId}"]`);

  if (boxNodes.length > 0 && q.rect) {
    const [vx1, vy1, vx2, vy2] =
      window.activeViewport.convertToViewportRectangle([
        q.rect.x,
        q.rect.y,
        q.rect.x + q.rect.w,
        q.rect.y + q.rect.h,
      ]);

    const vx = Math.min(vx1, vx2);
    const vy = Math.min(vy1, vy2);
    const vw = Math.abs(vx2 - vx1);
    const vh = Math.abs(vy2 - vy1);

    console.log(
      `[DRAG OUTPUT] Left=${vx}px, Top=${vy}px, Width=${vw}px, Height=${vh}px`,
    );

    boxNodes.forEach((node) => {
      node.style.left = `${vx}px`;
      node.style.top = `${vy}px`;
      node.style.width = `${vw}px`;
      node.style.height = `${vh}px`;
    });
  }
}

function endMouseInteraction() {
  if (window.activeQuestionId !== null) {
    const data = getCurrentAnswerData();
    const qIdxInDb = data.questions.findIndex(
      (dbQ) => dbQ.id === window.activeQuestionId,
    );
    const qInReview = window.currentReviewingQuestions.find(
      (rQ) => rQ.id === window.activeQuestionId,
    );

    if (qIdxInDb !== -1 && qInReview) {
      data.questions[qIdxInDb].rect = JSON.parse(
        JSON.stringify(qInReview.rect),
      );
      syncJsonAndRender(data, "영역 정보가 동기화되었습니다.", true);
      // v21.0: 리스트 UI도 즉시 갱신하여 인덱스/좌표 정합성 확보
      renderReviewerList(window.currentReviewingQuestions);
    }

    // 마우스 상호작용 종류 후 최종 DOM 업데이트 확정 (버튼 누락이나 DOM 꼬임 방지)
    if (window.activeViewport) {
      updateVisualOverlayBoxes(window.visualCurrentPage, window.activeViewport);
    }
  }

  window.activeQuestionId = null;
  window.activeHandleType = null;
  window.activeViewport = null;
  document.removeEventListener("mousemove", handleMouseInteraction);
  document.removeEventListener("mouseup", endMouseInteraction);
}

function initDragSelection(overlay, viewport, pageNum) {
  let dragStart = null;
  let dragRect = null;

  // v21.6.20: overlay.onclick 방식으로 변경 (addEventListener는 페이지 전환 시 이벤트가 누적됨)
  overlay.onclick = (e) => {
    if (
      !e.target.closest(".group-box") &&
      !e.target.closest(".group-candidate") &&
      !e.target.closest("button") &&
      !e.target.closest(".resizer")
    ) {
      if (document.activeElement) document.activeElement.blur();
      window.selectedBoxIds = [];
      window.selectedCandidateRects = [];
      window.currentHighlightedBoxIndex = null;
      updateVisualOverlayBoxes(pageNum, viewport);
      setPdfStatus("선택이 해제되었습니다.", "info");
    }
  };

  overlay.onmousedown = (e) => {
    if (e.button !== 0) return;
    // 기존 박스/핸들/후보 박스/버튼 위에서는 드래그 진입하지 않음
    if (
      e.target.closest(".group-box") ||
      e.target.closest(".resizer") ||
      e.target.closest(".group-candidate") ||
      e.target.closest("button")
    )
      return;

    const rectObj = overlay.getBoundingClientRect();
    dragStart = {
      x: e.clientX - rectObj.left,
      y: e.clientY - rectObj.top,
    };

    dragRect = document.createElement("div");
    // v21.6.14: 전역 상태 참조 통일 (window.isAddAreaMode)
    if (window.isAddAreaMode) {
      dragRect.className =
        "absolute border-2 border-dashed border-emerald-500 bg-emerald-500/10 z-50 pointer-events-none shadow-md rounded-sm animate-pulse";
    } else {
      dragRect.className =
        "absolute border-2 border-dashed border-blue-500 bg-blue-500/20 z-50 pointer-events-none shadow-md rounded-sm";
    }
    overlay.appendChild(dragRect);
  };

  overlay.onmousemove = (e) => {
    if (!dragStart) return;
    const rectObj = overlay.getBoundingClientRect();
    const current = {
      x: e.clientX - rectObj.left,
      y: e.clientY - rectObj.top,
    };

    const x = Math.min(dragStart.x, current.x);
    const y = Math.min(dragStart.y, current.y);
    const w = Math.abs(dragStart.x - current.x);
    const h = Math.abs(dragStart.y - current.y);

    dragRect.style.left = `${x}px`;
    dragRect.style.top = `${y}px`;
    dragRect.style.width = `${w}px`;
    dragRect.style.height = `${h}px`;
  };

  overlay.onmouseleave = (e) => {
    if (!dragStart) return;
    if (dragRect) dragRect.remove();
    dragStart = null;
    dragRect = null;
  };

  overlay.onmouseup = (e) => {
    if (!dragStart) return;
    const rectObj = overlay.getBoundingClientRect();
    const endX = e.clientX - rectObj.left;
    const endY = e.clientY - rectObj.top;

    const selX = dragStart.x;
    const selY = dragStart.y;

    const minX = Math.min(selX, endX);
    const maxX = Math.max(selX, endX);
    const minY = Math.min(selY, endY);
    const maxY = Math.max(selY, endY);

    // 드래그가 너무 작으면 무시 (오클릭 방지)
    if (Math.abs(maxX - minX) < 5 && Math.abs(maxY - minY) < 5) {
      if (dragRect) dragRect.remove();
      dragStart = null;
      dragRect = null;
      return;
    }

    const p1 = viewport.convertToPdfPoint(minX, minY);
    const p2 = viewport.convertToPdfPoint(maxX, maxY);

    const pdfRect = {
      page: pageNum,
      x: Math.min(p1[0], p2[0]),
      y: Math.min(p1[1], p2[1]),
      w: Math.abs(p1[0] - p2[0]),
      h: Math.abs(p1[1] - p2[1]),
    };

    if (isAddAreaMode) {
      // 영역 추가 로직: 녹색 박스 생성
      const pageData = visualTextCache.find((d) => d.page === pageNum);
      if (pageData) {
        // v21.6.17: texts가 null이어도 groupedBlocks에서 영역 내 텍스트 추출
        if (pageData.texts && !pageData.groupedBlocks) {
          pageData.groupedBlocks = groupTextItems(pageData.texts);
          pageData.texts = null;
        }

        let fullText = "수동 지정 영역";

        if (pageData.groupedBlocks && pageData.groupedBlocks.length > 0) {
          // groupedBlocks 중 드래그 영역과 겹치는 블록들을 수집
          const blocksInRect = pageData.groupedBlocks.filter((block) => {
            const [vx1, vy1, vx2, vy2] = viewport.convertToViewportRectangle([
              block.x,
              block.y,
              block.x + (block.w || 20),
              block.y + (block.h || 10),
            ]);
            const cx = Math.min(vx1, vx2) + Math.abs(vx2 - vx1) / 2;
            const cy = Math.min(vy1, vy2) + Math.abs(vy2 - vy1) / 2;
            return cx >= minX && cx <= maxX && cy >= minY && cy <= maxY;
          });

          if (blocksInRect.length > 0) {
            fullText = blocksInRect
              .map((b) => b.str)
              .join(" ")
              .trim();
          }
        }

        captureManualQuestion(fullText, pdfRect);
      }
    } else {
      // 다중 선택 모드: 기존 박스 일괄 선택
      window.selectedBoxIds = [];
      window.selectedCandidateRects = [];

      // 1. 등록된 질문 중 겹치는 것
      const questions = window.currentReviewingQuestions || [];
      questions.forEach((q) => {
        if (!q.rect || q.rect.page !== pageNum) return;
        if (
          q.rect.x < pdfRect.x + pdfRect.w &&
          q.rect.x + q.rect.w > pdfRect.x &&
          q.rect.y < pdfRect.y + pdfRect.h &&
          q.rect.y + q.rect.h > pdfRect.y
        ) {
          window.selectedBoxIds.push(q.id);
        }
      });

      // 2. 파란 박스(후보 영역) 중 겹치는 것
      const pageData = visualTextCache.find((d) => d.page === pageNum);
      if (pageData && !hideAllVisualCandidates) {
        if (pageData.texts && !pageData.groupedBlocks) {
          pageData.groupedBlocks = groupTextItems(pageData.texts);
          pageData.texts = null; // 메모리 해제 유지
        }
        const blocks = pageData.groupedBlocks || [];
        const normalize = (str) =>
          (str || "").replace(/\s+/g, "").replace(/[.·,]/g, "").slice(0, 30);
        const capturedTexts = questions.map((q) =>
          normalize(q.rawQuestion || q.title || ""),
        );

        const sc = blocks.filter((b) => {
          const cs = normalize(b.str);
          const isC = capturedTexts.some(
            (ct) => ct.includes(cs) || cs.includes(ct),
          );
          if (isC) return false;

          return (
            b.x < pdfRect.x + pdfRect.w &&
            b.x + b.w > pdfRect.x &&
            b.y < pdfRect.y + pdfRect.h &&
            b.y + b.h > pdfRect.y
          );
        });

        sc.forEach((c) => {
          const isAlreadyIn = window.selectedCandidateRects.some(
            (scr) =>
              scr.page === pageNum &&
              Math.abs(scr.x - c.x) < 2 &&
              Math.abs(scr.y - c.y) < 2,
          );
          if (!isAlreadyIn) {
            window.selectedCandidateRects.push({
              page: pageNum,
              x: c.x,
              y: c.y,
              str: c.str,
              w: c.w,
              h: c.h,
            });
          }
        });
      }

      // v21.6 캔버스 초기화 버그 방지 - 오버레이 구조만 즉시 갱신
      updateVisualOverlayBoxes(visualCurrentPage, currentVisualViewport);
      const totalSel =
        (window.selectedBoxIds?.length || 0) +
        (window.selectedCandidateRects?.length || 0);
      if (totalSel > 0) {
        setPdfStatus(
          `다중 선택 완료: 등록항목 ${window.selectedBoxIds.length}개, 후보항목 ${window.selectedCandidateRects.length}개 (DEL 키로 일괄 삭제 가능)`,
          "success",
        );
      }
    }

    if (dragRect) dragRect.remove();
    dragStart = null;
    dragRect = null;
  };
}

/**
 * ──────────── v4.1: Consolidated Modal Control Functions ────────────
 */

/**
 * v21.6.18: '적용' 버튼 - 창을 닫지 않고 메인 DB에 저장하고 현재 상태를 백업합니다.
 */
function applyAndClosePdfModal() {
  try {
    const data = getCurrentAnswerData();
    const currentQuestions = window.currentReviewingQuestions || [];

    if (currentQuestions.length === 0) {
      setPdfStatus("등록된 문항이 없습니다.", "info");
      return;
    }

    // 기존 데이터와 병합 (ID가 같은 경우 덮어쓰기)
    currentQuestions.forEach((rq) => {
      const existingIdx = data.questions.findIndex((q) => q.id === rq.id);
      if (existingIdx !== -1) {
        data.questions[existingIdx] = JSON.parse(JSON.stringify(rq));
      } else {
        data.questions.push(JSON.parse(JSON.stringify(rq)));
      }
    });

    syncJsonAndRender(
      data,
      `${currentQuestions.length}개 항목이 저장되었습니다. (창은 계속 열려 있습니다)`,
      true,
    );

    // v21.6.18: 현재 상태를 백업 (재오픈 시 복원용)
    window._savedVisualQuestions = JSON.parse(JSON.stringify(currentQuestions));
    window._savedIgnoredBlocks = JSON.parse(
      JSON.stringify(window.ignoredVisualBlocks || []),
    );

    setPdfStatus(
      `✅ ${currentQuestions.length}개 문항이 저장되었습니다. 창을 계속 사용하거나 '닫기'로 종료하세요.`,
      "success",
    );
  } catch (e) {
    console.error("적용 저장 실패:", e);
    setPdfStatus("데이터 반영 중 오류가 발생했습니다.", "error");
  }
}

/**
 * v21.6.18: '닫기' 버튼 - 변경사항 확인 후 창을 닫습니다.
 */
function applyAndClosePdfModalWithClose() {
  applyAndClosePdfModal();
  closePdfVisualModal();
}

function closePdfVisualModal() {
  document.getElementById("pdfVisualModal").classList.add("hidden");
  document.getElementById("pdfVisualModal").classList.remove("flex");

  // v21.6.15: 대규모 리소스 명시적 정리 (GC 유도)
  window.selectedBoxIds = [];
  window.selectedCandidateRects = [];
  window.isAddAreaMode = false;
  window._isUpdatingOverlay = false;
  window._needsCandidateRefresh = true; // 다음 오픈 시 다시 계산

  // 메모리 해제: 대규모 텍스트 캐시의 원본은 이미 날렸겠지만, 캐시 자체도 정리 고려
  // 만약 아예 파일을 다시 읽게 할 거라면 window.visualTextCache = []; 가능
  // 여기서는 단순히 카운트 캐시만 초기화
  window._cachedGlobalCandidateCount = undefined;

  const addBtn = document.getElementById("toggleAddAreaBtn");
  if (addBtn) {
    addBtn.classList.remove("bg-blue-600", "text-white", "border-blue-700");
    addBtn.classList.add("bg-white", "text-slate-600", "border-slate-200");
  }
}

// End of pdf.js
