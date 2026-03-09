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

function flashPdfMessage(message, type = "info", duration = 1800) {
  const host = document.getElementById("pdfVisualWorkspaceContainer");
  if (!host) return;

  let badge = document.getElementById("pdfCaptureFeedback");
  if (!badge) {
    badge = document.createElement("div");
    badge.id = "pdfCaptureFeedback";
    badge.style.position = "absolute";
    badge.style.right = "16px";
    badge.style.bottom = "16px";
    badge.style.zIndex = "999";
    badge.style.padding = "10px 12px";
    badge.style.borderRadius = "10px";
    badge.style.fontSize = "12px";
    badge.style.fontWeight = "700";
    badge.style.boxShadow = "0 8px 24px rgba(0,0,0,0.18)";
    badge.style.transition = "opacity 180ms ease, transform 180ms ease";
    badge.style.opacity = "0";
    badge.style.transform = "translateY(6px)";
    host.appendChild(badge);
  }

  const theme = {
    info: { bg: "#1d4ed8", fg: "#ffffff" },
    success: { bg: "#047857", fg: "#ffffff" },
    error: { bg: "#b91c1c", fg: "#ffffff" },
  };
  const colors = theme[type] || theme.info;
  badge.style.background = colors.bg;
  badge.style.color = colors.fg;
  badge.textContent = message;

  requestAnimationFrame(() => {
    badge.style.opacity = "1";
    badge.style.transform = "translateY(0)";
  });

  clearTimeout(window.__pdfFlashTimer);
  window.__pdfFlashTimer = setTimeout(() => {
    badge.style.opacity = "0";
    badge.style.transform = "translateY(6px)";
  }, Math.max(900, duration));
}

function syncAddAreaButtonState(btn, enabled) {
  if (!btn) return;
  btn.setAttribute("aria-pressed", enabled ? "true" : "false");
  btn.title = enabled ? "영역 지정 모드: ON" : "영역 지정 모드: OFF";
  const icon = btn.querySelector("i");
  if (icon) {
    icon.className = enabled ? "fas fa-draw-polygon" : "fas fa-plus";
  }
  const textNode = btn.childNodes[btn.childNodes.length - 1];
  if (textNode && textNode.nodeType === Node.TEXT_NODE) {
    textNode.textContent = enabled
      ? " 영역 지정 ON"
      : " 영역 지정 (Add Area)";
  }
}

function openPdfVisualModal() {
  bindAddAreaButton();
  if (window.Debug) {
    window.Debug.log("pdf", "openPdfVisualModal called", {
      hasPdf: !!window.visualPdfDoc,
      currentPage: window.visualCurrentPage || 1,
    });
  }
  if (!window.visualPdfDoc) {
    // PDF가 없으면 빈 화면이라도 유지하거나 안내 메시지 출력
    setPdfStatus("PDF 파일을 선택 후 추출을 누르세요.", "info");
    return;
  }
  // Modal logic removed - now persistent in #studio section
  window.visualCurrentPage = window.visualCurrentPage || 1;

  // v21.6.18: 저장된 상태가 있으면 복원, 없으면 빈 배열로 시작
  const state = window.App.State.pdf || { questions: [], ignoredBlocks: [] };
  if (window._savedVisualQuestions && window._savedVisualQuestions.length > 0) {
    window.currentReviewingQuestions = JSON.parse(JSON.stringify(window._savedVisualQuestions));
    state.ignoredBlocks = Array.isArray(window._savedIgnoredBlocks)
      ? JSON.parse(JSON.stringify(window._savedIgnoredBlocks))
      : [];
    setPdfStatus(`상태 복원: ${window.currentReviewingQuestions.length}개 영역`, "success");
  } else {
    window.currentReviewingQuestions = window.currentReviewingQuestions || [];
    state.ignoredBlocks = state.ignoredBlocks || [];
  }

  window.selectedBoxIds = [];
  window._needsCandidateRefresh = true;

  // v21.6.19: 키보드 이벤트 리스너를 한 번만 등록 (중복 방지)
  if (!window._pdfKeyListenerAttached) {
    window._pdfKeyListenerAttached = true;
    document.addEventListener("keydown", (e) => {
      // v21.6.24: 모달 구조 제거 후에도 Studio 뷰에서 단축키 동작하도록 가드 보정
      const modal = document.getElementById("pdfVisualModal");
      const studio = document.getElementById("studio");
      const isActive = modal
        ? !modal.classList.contains("hidden")
        : !!(studio && studio.classList.contains("active"));
      if (!isActive) return;

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

// ui.js에서 동일 이름 함수가 래퍼로 재정의되므로, 실제 구현을 전역 포인터로 보존
window._openPdfVisualModalImpl = openPdfVisualModal;

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

// v21.6.21: 자동 좌표 매칭용 문자열 유사도 계산(Levenshtein Distance)
function calculateLevenshteinDistance(a = "", b = "") {
  const s = String(a);
  const t = String(b);

  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;

  const sLen = s.length;
  const tLen = t.length;
  const prev = new Array(tLen + 1);
  const curr = new Array(tLen + 1);

  for (let j = 0; j <= tLen; j++) prev[j] = j;

  for (let i = 1; i <= sLen; i++) {
    curr[0] = i;
    const sChar = s.charCodeAt(i - 1);

    for (let j = 1; j <= tLen; j++) {
      const cost = sChar === t.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost, // substitution
      );
    }

    for (let j = 0; j <= tLen; j++) prev[j] = curr[j];
  }

  return prev[tLen];
}

// Consolidated at the bottom of the file or kept here if needed.
// Removing redundant/simple stubs to avoid conflicts.

async function renderVisualPage(pageNum) {
  if (window.Debug) {
    window.Debug.log("pdf", "renderVisualPage start", {
      pageNum,
      hasPdf: !!window.visualPdfDoc,
      zoom: window.pdfZoomLevel || 1.5,
    });
  }
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
    let scale = window.pdfZoomLevel || 1.5;
    // v21.6.27: 첫 진입/자동 렌더 시 컨테이너 너비에 맞춰 배율 자동 보정 (조작 안정성 향상)
    if (!window._userZoomTouched) {
      const container = document.getElementById("pdfVisualWorkspaceContainer");
      if (container) {
        const baseViewport = page.getViewport({ scale: 1 });
        const fitScale = (container.clientWidth - 64) / baseViewport.width;
        if (Number.isFinite(fitScale) && fitScale > 0) {
          scale = Math.min(2.2, Math.max(0.5, fitScale));
          window.pdfZoomLevel = scale;
        }
      }
    }

    const viewport = page.getViewport({ scale });
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
    if (window.Debug) {
      window.Debug.log("pdf", "renderVisualPage success", {
        pageNum,
        canvasW: canvas.width,
        canvasH: canvas.height,
      });
    }
  } catch (err) {
    if (err.name === "RenderingCancelledException") {
      console.log(`[PDF] Page ${pageNum} rendering cancelled.`);
    } else {
      console.error(`[PDF] Render Error on Page ${pageNum}:`, err);
      if (window.Debug) {
        window.Debug.error("pdf", "renderVisualPage failed", {
          pageNum,
          message: err?.message || String(err),
        });
      }
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
  ensureLowConfidenceFilterInitialized();
  const container = document.getElementById("revQuestionList");
  const countLabel = document.getElementById("revCountLabel");
  const modalCount = document.getElementById("modalCaptureCount");

  if (!container) return;

  // 전역 참조용 업데이트
  window.currentReviewingQuestions = Array.isArray(questions)
    ? [...questions]
    : [];
  if (!Array.isArray(window.selectedQuestionIdsForAi)) {
    window.selectedQuestionIdsForAi = [];
  }
  const currentIdSet = new Set(
    window.currentReviewingQuestions.map((q) => String(q.id || "")),
  );
  window.selectedQuestionIdsForAi = window.selectedQuestionIdsForAi.filter(
    (id) => currentIdSet.has(String(id)),
  );

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
  const selectedForAiSet = new Set(window.selectedQuestionIdsForAi || []);

  const modalEl = document.getElementById("pdfVisualModal");
  const isModalOpen = modalEl ? !modalEl.classList.contains("hidden") : true;
  const targetPage = isModalOpen ? visualCurrentPage : revCurrentPage;
  const lowConfidenceOnly = !!window.lowConfidenceOnly;

  const indexedPageQuestions = window.currentReviewingQuestions
    .map((q, i) => ({ q, i }))
    .filter(({ q }) => !q.rect || q.rect.page === targetPage);
  const visibleIndexedQuestions = lowConfidenceOnly
    ? indexedPageQuestions.filter(({ q }) => isLowConfidenceQuestion(q))
    : indexedPageQuestions;
  const pageCountAll = indexedPageQuestions.length;
  const pageCountVisible = visibleIndexedQuestions.length;
  const lowConfidenceCount = indexedPageQuestions.filter(({ q }) =>
    isLowConfidenceQuestion(q),
  ).length;

  if (!qs.length) {
    container.innerHTML = `<p class="text-xs text-slate-400 text-center mt-10">인식된 문항이 없습니다.<br>PDF의 파란 박스를 클릭하여 직접 추가하세요.</p>`;
    if (countLabel) countLabel.textContent = "표시할 문항 0개";
    if (modalCount)
      modalCount.textContent = `현재 선택된 문항: 0개 (인식영역: ${displayBlocksCount})`;
  } else {
    if (countLabel) {
      countLabel.textContent = lowConfidenceOnly
        ? `표시 중: ${pageCountVisible}개 (저신뢰 필터)`
        : `표시 중: ${pageCountVisible}개`;
    }
    if (modalCount)
      modalCount.textContent =
        `현재 페이지 문항: ${pageCountVisible}개` +
        `${lowConfidenceOnly ? ` (전체 ${pageCountAll} 중)` : ""}` +
        ` (AI 선택: ${selectedForAiSet.size}개 / 전체: ${qs.length}개 / 인식후보: ${displayBlocksCount})`;
  }

  const listHtml = visibleIndexedQuestions
    .map(({ q, i }) => {
      const pending = isPending(i);
      const selectedForAi = selectedForAiSet.has(String(q.id || ""));
      const safeQId = String(q.id || "").replace(/'/g, "\\'");
      const analysisModeLabel = q.analysisMode
        ? getContentModeLabel(q.analysisMode)
        : "";
      const analysisConfidenceText =
        typeof q.analysisConfidence === "number"
          ? `${Math.round(q.analysisConfidence * 100)}%`
          : "";
      const analysisBadgeToneClass = getAnalysisBadgeToneClass(
        q.analysisConfidence,
      );
      const analysisBadgeHtml = analysisModeLabel
        ? `<div class="mt-1 text-[10px] inline-flex items-center gap-1 px-1.5 py-0.5 rounded border ${analysisBadgeToneClass}">서버분석 ${analysisModeLabel}${analysisConfidenceText ? ` · ${analysisConfidenceText}` : ""}</div>`
        : "";
      const analysisMetaBadge = getAnalysisMetaBadgeData(q.analysisMeta || null);
      const analysisMetaHtml = analysisBadgeHtml && analysisMetaBadge
        ? `<div class="mt-1 text-[10px] inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-600" title="${analysisMetaBadge.text} | ${analysisMetaBadge.tooltip}">meta ⓘ</div>`
        : "";
      const analysisRowHtml = analysisBadgeHtml || analysisMetaHtml
        ? `<div class="mt-1 inline-flex items-center gap-1">${analysisBadgeHtml}${analysisMetaHtml}</div>`
        : "";
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
                    selectedForAi
                      ? "ring-2 ring-indigo-300 border-indigo-400 bg-indigo-50/60"
                      : ""
                  } ${
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
                    <label class="inline-flex items-center gap-1 text-[10px] text-indigo-700 mb-1" onclick="event.stopPropagation()">
                      <input type="checkbox" ${selectedForAi ? "checked" : ""} onclick="event.stopPropagation(); toggleAiQuestionSelection('${safeQId}', this.checked)" class="accent-indigo-600" />
                      AI 작성 대상
                    </label>
                    <h5 class="text-sm font-bold text-slate-800 line-clamp-2 mb-1 group-hover:text-blue-700">${escapeHtml(q.title)}</h5>
                    ${analysisRowHtml}
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
    const filterNoticeHtml = lowConfidenceOnly
      ? `<div class="mb-2 text-[11px] px-2 py-1 rounded border border-amber-200 bg-amber-50 text-amber-700">저신뢰 필터 적용 중 (기준: 70% 미만)</div>`
      : "";
    const listBodyHtml = listHtml
      ? listHtml
      : `<p class="text-xs text-slate-400 text-center mt-8">필터 조건에 맞는 문항이 없습니다.<br>저신뢰만 보기 OFF로 전환해 전체 문항을 확인하세요.</p>`;
    container.innerHTML = `
      ${filterNoticeHtml}
      <div class="mb-2 flex items-center justify-between text-[11px]">
        <div class="text-slate-500">AI 대상 선택: ${selectedForAiSet.size}개</div>
        <div class="flex gap-1.5">
          <button type="button" onclick="event.stopPropagation(); toggleLowConfidenceFilter()" class="px-2 py-1 rounded border ${lowConfidenceOnly ? "border-amber-300 bg-amber-50 text-amber-700" : "border-slate-200 bg-white text-slate-600"} hover:bg-slate-50">${lowConfidenceOnly ? `저신뢰만 보기 ON (${lowConfidenceCount})` : `저신뢰만 보기 OFF (${lowConfidenceCount})`}</button>
          <button type="button" onclick="event.stopPropagation(); selectAllAiQuestionsOnCurrentPage()" class="px-2 py-1 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50">현재 페이지 전체선택</button>
          <button type="button" onclick="event.stopPropagation(); clearAiQuestionSelection()" class="px-2 py-1 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50">선택해제</button>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-2 h-full content-start">${listBodyHtml}</div>
    `;
  }

  // v4.0: 모달 내부 리스트도 함께 업데이트
  updateModalNavigation(targetPage);
}

function toggleAiQuestionSelection(qId, checked) {
  if (!Array.isArray(window.selectedQuestionIdsForAi)) {
    window.selectedQuestionIdsForAi = [];
  }
  const key = String(qId || "");
  const set = new Set(window.selectedQuestionIdsForAi.map((id) => String(id)));
  if (checked) set.add(key);
  else set.delete(key);
  window.selectedQuestionIdsForAi = Array.from(set);
  renderReviewerList(window.currentReviewingQuestions || []);
}

function selectAllAiQuestionsOnCurrentPage() {
  const modalEl = document.getElementById("pdfVisualModal");
  const isModalOpen = modalEl ? !modalEl.classList.contains("hidden") : true;
  const targetPage = isModalOpen ? visualCurrentPage : revCurrentPage;
  const questions = (window.currentReviewingQuestions || []).filter(
    (q) => !q.rect || q.rect.page === targetPage,
  );
  window.selectedQuestionIdsForAi = questions.map((q) => String(q.id || ""));
  renderReviewerList(window.currentReviewingQuestions || []);
}

function clearAiQuestionSelection() {
  window.selectedQuestionIdsForAi = [];
  renderReviewerList(window.currentReviewingQuestions || []);
}

function toggleLowConfidenceFilter() {
  window.lowConfidenceOnly = !window.lowConfidenceOnly;
  persistLowConfidenceFilterPreference(window.lowConfidenceOnly);
  renderReviewerList(window.currentReviewingQuestions || []);
}

// v21.6.20: 절대 사용하지 마세요. 신버전은 1626줄 켜지고 실제를 위임하는 실제 신버전에서 제어합니다.
// 중복 정의: 있지만 1626줄 버전이 우선적으로 사용되어야 함. 이전 버전(931줄)은 필요 없음.
function _highlightQuestionOnPdfLegacy(index) {
  // Legacy stub - delegates to new highlightQuestionOnPdf at line 1626
  // DO NOT CALL THIS DIRECTLY
}

// Redundant version removed. See consolidated version below.

// Redundant version removed. See consolidated version below.

function updateModalNavigation(targetPage) {
  ensureLowConfidenceFilterInitialized();
  const modalList = document.getElementById("modalCaptureList");
  if (!modalList) {
    console.warn("modalCaptureList element not found. targetPage:", targetPage);
    return;
  }

  const currentQuestions = window.currentReviewingQuestions || [];
  const lowConfidenceOnly = !!window.lowConfidenceOnly;

  if (!currentQuestions.length) {
    modalList.innerHTML = `<p class="text-center text-[11px] text-slate-400 mt-10">캡처된 문항이 없습니다.<br />PDF 박스를 클릭하세요.</p>`;
  } else {
    // 폼 요소는 이미 HTML (solve_120.html) 쪽에 고정 위치하므로, 동적 리스트만 삽입
    const filtered = currentQuestions
      .map((q, i) => ({ q, i }))
      .filter(({ q }) => !q.rect || q.rect.page === targetPage)
      .filter(({ q }) => !lowConfidenceOnly || isLowConfidenceQuestion(q))
      .map(({ q, i }) => {
        const analysisModeLabel = q.analysisMode
          ? getContentModeLabel(q.analysisMode)
          : "";
        const analysisConfidenceText =
          typeof q.analysisConfidence === "number"
            ? `${Math.round(q.analysisConfidence * 100)}%`
            : "";
        const analysisBadgeToneClass = getAnalysisBadgeToneClass(
          q.analysisConfidence,
        );
        const analysisBadgeHtml = analysisModeLabel
          ? `<div class="mt-1 text-[10px] inline-flex items-center gap-1 px-1.5 py-0.5 rounded border ${analysisBadgeToneClass}">서버분석 ${analysisModeLabel}${analysisConfidenceText ? ` · ${analysisConfidenceText}` : ""}</div>`
          : "";
        const analysisMetaBadge = getAnalysisMetaBadgeData(q.analysisMeta || null);
        const analysisMetaHtml = analysisBadgeHtml && analysisMetaBadge
          ? `<div class="mt-1 text-[10px] inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-600" title="${analysisMetaBadge.text} | ${analysisMetaBadge.tooltip}">meta ⓘ</div>`
          : "";
        const analysisRowHtml = analysisBadgeHtml || analysisMetaHtml
          ? `<div class="mt-1 inline-flex items-center gap-1">${analysisBadgeHtml}${analysisMetaHtml}</div>`
          : "";
        return `
          <div
            onclick="highlightQuestionOnPdf(${i})"
            onmouseenter="setHoverHighlight('${q.id}', true)"
            onmouseleave="setHoverHighlight('${q.id}', false)"
            class="p-2 border border-slate-100 rounded bg-slate-50 relative group cursor-pointer hover:border-blue-300 transition-colors item-${q.id}"
          >
            <div class="text-[11px] font-bold text-slate-700 truncate pr-5">${escapeHtml(q.title)}</div>
            ${analysisRowHtml}
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
  if (index < 0) {
    if (!questions.length) {
      setPdfStatus("삭제할 문항이 없습니다.", "info");
      return;
    }

    if (!confirm(`현재 인식/등록된 문항 ${questions.length}개를 전체 삭제하시겠습니까?`)) {
      return;
    }

    const removedIds = new Set(questions.map((q) => q.id));
    window.currentReviewingQuestions = [];
    window.selectedBoxIds = [];
    window.selectedCandidateRects = [];
    window.pendingAssignIndex = null;
    window._needsCandidateRefresh = true;

    try {
      const data = getCurrentAnswerData();
      data.questions = data.questions.filter((q) => !removedIds.has(q.id));
      syncJsonAndRender(data, "모든 인식 문항을 삭제했습니다.", true);
    } catch (e) {
      console.error("데이터 동기화 실패:", e);
    }

    renderReviewerList(window.currentReviewingQuestions);
    if (currentVisualViewport) {
      updateVisualOverlayBoxes(visualCurrentPage, currentVisualViewport);
    }
    renderReviewerPdf(visualCurrentPage);
    refreshAutoExtractSummary();
    setPdfStatus("전체 삭제가 완료되었습니다.", "success");
    return;
  }

  if (index >= questions.length) return;

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

function captureManualQuestion(text, rectData = null, mediaData = null) {
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
  window.pendingManualCaptureMedia = mediaData || null;
  const panelEl = document.getElementById("manualCapturePanel");
  const rectHintEl = document.getElementById("manualCaptureRectHint");
  const previewEl = document.getElementById("manualCapturePreview");
  const imagePreviewEl = ensureManualCaptureImagePreviewElement();
  if (panelEl) {
    const panelScroller = panelEl.closest(".overflow-y-auto");
    if (panelScroller) {
      const scrollerRect = panelScroller.getBoundingClientRect();
      const panelRect = panelEl.getBoundingClientRect();
      const padding = 20;
      const outOfView =
        panelRect.top < scrollerRect.top + padding ||
        panelRect.bottom > scrollerRect.bottom - padding;

      if (outOfView) {
        const targetTop = Math.max(0, panelEl.offsetTop - padding);
        panelScroller.scrollTo({ top: targetTop, behavior: "smooth" });
      }
    }
    panelEl.classList.add("ring-2", "ring-indigo-200", "rounded-lg");
    setTimeout(() => {
      panelEl.classList.remove("ring-2", "ring-indigo-200", "rounded-lg");
    }, 1200);
  }

  if (rectHintEl) {
    if (rectData) {
      rectHintEl.textContent = `지정 영역: ${rectData.page}페이지 · x:${Math.round(rectData.x)}, y:${Math.round(rectData.y)}, w:${Math.round(rectData.w)}, h:${Math.round(rectData.h)}`;
      rectHintEl.classList.remove("hidden");
    } else {
      rectHintEl.classList.add("hidden");
    }
  }

  if (previewEl) {
    const compact = String(text || "").replace(/\s+/g, " ").trim();
    const preview = compact.length > 120 ? `${compact.slice(0, 120)}…` : compact;
    previewEl.textContent = preview
      ? `캡처 텍스트 미리보기: ${preview}`
      : "캡처 텍스트가 비어 있습니다.";
    previewEl.classList.remove("hidden");
  }

  if (imagePreviewEl) {
    if (mediaData && mediaData.thumbnailDataUrl) {
      imagePreviewEl.src = mediaData.thumbnailDataUrl;
      imagePreviewEl.classList.remove("hidden");
    } else {
      imagePreviewEl.src = "";
      imagePreviewEl.classList.add("hidden");
    }
  }

  setPdfStatus(
    "영역 텍스트 추출됨. 우측 폼에서 명칭 부여 후 '확정 및 저장' 하세요.",
    "info",
  );
  flashPdfMessage("영역 캡처 완료 ✅", "success", 1700);

  if (inputEl) {
    inputEl.classList.add("bg-blue-100", "border-blue-400");
    inputEl.focus({ preventScroll: true });
    inputEl.setSelectionRange(0, 0);
    setTimeout(
      () => inputEl.classList.remove("bg-blue-100", "border-blue-400"),
      800,
    );
  }

  // 렌더링을 즉시 다시 수행하여 방금 추가된 녹색(대기) 영역이 그려지도록 함
  const modalEl = document.getElementById("pdfVisualModal");
  const isModalOpen = modalEl ? !modalEl.classList.contains("hidden") : true;
  if (isModalOpen) {
    renderVisualPage(visualCurrentPage);
  } else {
    renderReviewerPdf(revCurrentPage);
  }
}

function ensureManualCaptureImagePreviewElement() {
  const panel = document.getElementById("manualCapturePanel");
  if (!panel) return null;

  let img = document.getElementById("manualCaptureImagePreview");
  if (img) return img;

  img = document.createElement("img");
  img.id = "manualCaptureImagePreview";
  img.alt = "캡처 이미지 미리보기";
  img.className =
    "hidden mt-2 w-full max-h-56 object-contain rounded border border-slate-200 bg-white";

  const previewEl = document.getElementById("manualCapturePreview");
  if (previewEl && previewEl.parentElement) {
    previewEl.parentElement.insertBefore(img, previewEl.nextSibling);
  } else {
    panel.appendChild(img);
  }

  return img;
}

function extractSelectionImagePayload(overlay, minX, minY, maxX, maxY, pdfRect) {
  if (!overlay) return null;

  const canvasId = overlay.id === "revPdfOverlay" ? "revPdfCanvas" : "pdfVisualCanvas";
  const sourceCanvas = document.getElementById(canvasId);
  if (!sourceCanvas) return null;

  const viewW = overlay.clientWidth || sourceCanvas.width;
  const viewH = overlay.clientHeight || sourceCanvas.height;
  if (!viewW || !viewH) return null;

  const scaleX = sourceCanvas.width / viewW;
  const scaleY = sourceCanvas.height / viewH;

  const sx = Math.max(0, Math.floor(minX * scaleX));
  const sy = Math.max(0, Math.floor(minY * scaleY));
  const sw = Math.min(sourceCanvas.width - sx, Math.ceil((maxX - minX) * scaleX));
  const sh = Math.min(sourceCanvas.height - sy, Math.ceil((maxY - minY) * scaleY));

  if (sw < 4 || sh < 4) return null;

  const crop = document.createElement("canvas");
  crop.width = sw;
  crop.height = sh;
  const cropCtx = crop.getContext("2d", { willReadFrequently: false });
  if (!cropCtx) return null;

  cropCtx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
  const imageDataUrl = crop.toDataURL("image/jpeg", 0.9);

  const thumbMax = 320;
  const thumbScale = Math.min(1, thumbMax / Math.max(sw, sh));
  const tw = Math.max(1, Math.round(sw * thumbScale));
  const th = Math.max(1, Math.round(sh * thumbScale));
  const thumbCanvas = document.createElement("canvas");
  thumbCanvas.width = tw;
  thumbCanvas.height = th;
  const thumbCtx = thumbCanvas.getContext("2d");
  if (!thumbCtx) return null;
  thumbCtx.drawImage(crop, 0, 0, sw, sh, 0, 0, tw, th);
  const thumbnailDataUrl = thumbCanvas.toDataURL("image/jpeg", 0.8);

  return {
    hasImage: true,
    imageDataUrl,
    thumbnailDataUrl,
    width: sw,
    height: sh,
    sourceCanvasId: canvasId,
    rect: pdfRect ? { ...pdfRect } : null,
  };
}

function extractSelectionTextFromBlocks(pageData, viewport, minX, minY, maxX, maxY) {
  if (!pageData) return "";

  if (pageData.texts && !pageData.groupedBlocks) {
    pageData.groupedBlocks = groupTextItems(pageData.texts);
    pageData.texts = null;
  }

  const blocks = pageData.groupedBlocks || [];
  if (!blocks.length) return "";

  const selected = blocks
    .map((block) => {
      const [vx1, vy1, vx2, vy2] = viewport.convertToViewportRectangle([
        block.x,
        block.y,
        block.x + (block.w || 20),
        block.y + (block.h || 10),
      ]);
      const bx1 = Math.min(vx1, vx2);
      const by1 = Math.min(vy1, vy2);
      const bx2 = Math.max(vx1, vx2);
      const by2 = Math.max(vy1, vy2);

      const interW = Math.max(0, Math.min(maxX, bx2) - Math.max(minX, bx1));
      const interH = Math.max(0, Math.min(maxY, by2) - Math.max(minY, by1));
      const interArea = interW * interH;
      const blockArea = Math.max(1, (bx2 - bx1) * (by2 - by1));
      const overlapRatio = interArea / blockArea;

      const cx = (bx1 + bx2) / 2;
      const cy = (by1 + by2) / 2;
      const centerInside = cx >= minX && cx <= maxX && cy >= minY && cy <= maxY;

      if (!centerInside && overlapRatio < 0.12 && interArea < 30) {
        return null;
      }

      return {
        str: block.str || "",
        sortY: by1,
        sortX: bx1,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.sortY - b.sortY || a.sortX - b.sortX);

  return selected
    .map((b) => String(b.str || "").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function deriveTitleFromCapturedText(rawText) {
  const lines = String(rawText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const firstMeaningful =
    lines.find((line) => line.replace(/[^가-힣a-zA-Z0-9]/g, "").length >= 4) ||
    lines[0] ||
    "";

  const compact = firstMeaningful.replace(/\s+/g, " ").trim();
  if (!compact) return "";

  return compact.length > 60 ? `${compact.slice(0, 60)}...` : compact;
}

function tokenizeSimple(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2);
}

function buildKnowledgeContextForDraft(rawQuestion) {
  try {
    const data = getCurrentAnswerData();
    const theories = Array.isArray(data?.theories) ? data.theories : [];
    if (!theories.length) {
      return "- 연관 이론 데이터 없음";
    }

    const qTokens = tokenizeSimple(rawQuestion);
    if (!qTokens.length) {
      return "- 연관 이론 매칭 불가(질문 토큰 부족)";
    }

    const qSet = new Set(qTokens);
    const scored = theories
      .map((theory) => {
        const text = [
          theory?.title,
          theory?.category,
          ...(Array.isArray(theory?.tags) ? theory.tags : []),
          theory?.content,
        ]
          .filter(Boolean)
          .join(" ");
        const tTokens = tokenizeSimple(text);
        if (!tTokens.length) return { theory, score: 0 };
        let hit = 0;
        tTokens.forEach((token) => {
          if (qSet.has(token)) hit += 1;
        });
        return { theory, score: hit / Math.max(1, qSet.size) };
      })
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    if (!scored.length) {
      return "- 연관 이론 매칭 결과 없음";
    }

    return scored
      .map(({ theory }, idx) => {
        const tags = Array.isArray(theory?.tags) ? theory.tags.join(", ") : "";
        const body = String(theory?.content || "").replace(/\s+/g, " ").trim();
        return [
          `- 참조 이론 ${idx + 1}: ${theory?.title || "(제목없음)"}`,
          `  분류/태그: ${theory?.category || "일반"}${tags ? ` / ${tags}` : ""}`,
          `  핵심: ${body.slice(0, 260)}`,
        ].join("\n");
      })
      .join("\n");
  } catch {
    return "- 연관 이론 컨텍스트 로딩 실패";
  }
}

function appendDraftPlanHistoryForManual(question, planText, maxItems = 5) {
  const plan = String(planText || "").trim();
  const existing = Array.isArray(question?.draftPlanHistory)
    ? question.draftPlanHistory
    : [];
  const normalizedExisting = existing
    .map((item) => {
      if (typeof item === "string") {
        const text = String(item || "").trim();
        return text ? { text, createdAt: "" } : null;
      }
      if (!item || typeof item !== "object") return null;
      const text = String(item.text || item.plan || "").trim();
      if (!text) return null;
      return {
        text,
        createdAt: String(item.createdAt || "").trim(),
      };
    })
    .filter(Boolean);

  if (!plan) {
    return normalizedExisting.slice(0, maxItems);
  }

  if (normalizedExisting[0]?.text === plan) {
    return normalizedExisting.slice(0, maxItems);
  }

  return [
    {
      text: plan,
      createdAt: new Date().toISOString(),
    },
    ...normalizedExisting,
  ].slice(0, maxItems);
}

function getActiveCaptureImagePayload() {
  return window.pendingManualCaptureMedia || null;
}

function getDesignatedReferenceImagePayload() {
  return window.pendingManualReferenceImage || null;
}

function classifyManualContentMode(rawText, mediaPayload, referencePayload) {
  const text = String(rawText || "").trim();
  const compact = text.replace(/\s+/g, "");
  const textLen = compact.length;
  const hasCaptureImage = !!mediaPayload?.imageDataUrl;
  const hasReferenceImage = !!referencePayload?.imageDataUrl;
  const hasImage = hasCaptureImage || hasReferenceImage;
  const isPlaceholderText = /^\[(이미지 영역|선택 영역)\]/.test(text);

  let mode = "text";
  if (!textLen && hasImage) {
    mode = "image";
  } else if ((textLen < 12 || isPlaceholderText) && hasImage) {
    mode = "image";
  } else if (hasImage && textLen >= 12) {
    mode = "mixed";
  } else {
    mode = "text";
  }

  return {
    mode,
    hasText: textLen > 0,
    hasImage,
    textLen,
    hasCaptureImage,
    hasReferenceImage,
  };
}

function getContentModeLabel(mode) {
  const labelMap = {
    text: "텍스트 중심",
    image: "이미지 중심",
    mixed: "혼합(텍스트+이미지)",
  };
  return labelMap[String(mode || "").toLowerCase()] || "미지정";
}

function getAnalysisMetaBadgeData(analysisMeta) {
  if (!analysisMeta || typeof analysisMeta !== "object") {
    return null;
  }

  const bits = [];
  const details = [];

  if (typeof analysisMeta.hasText === "boolean") {
    bits.push(`text:${analysisMeta.hasText ? "Y" : "N"}`);
    details.push(`hasText=${analysisMeta.hasText}`);
  }
  if (typeof analysisMeta.hasImage === "boolean") {
    bits.push(`img:${analysisMeta.hasImage ? "Y" : "N"}`);
    details.push(`hasImage=${analysisMeta.hasImage}`);
  }
  if (typeof analysisMeta.textLength === "number") {
    bits.push(`len:${analysisMeta.textLength}`);
    details.push(`textLength=${analysisMeta.textLength}`);
  }

  if (!bits.length) {
    return null;
  }

  const tooltip = details
    .join(" | ")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return {
    text: `meta ${bits.join(" · ")}`,
    tooltip,
  };
}

function getAnalysisBadgeToneClass(confidence) {
  const score = Number(confidence);
  if (!Number.isFinite(score)) {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }
  if (score >= 0.85) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (score >= 0.7) {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function isLowConfidenceQuestion(question, threshold = 0.7) {
  return (
    typeof question?.analysisConfidence === "number" &&
    question.analysisConfidence < threshold
  );
}

const LOW_CONFIDENCE_FILTER_STORAGE_KEY = "pdfReviewer.lowConfidenceOnly";

function readLowConfidenceFilterPreference() {
  try {
    return window.localStorage.getItem(LOW_CONFIDENCE_FILTER_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function persistLowConfidenceFilterPreference(enabled) {
  try {
    window.localStorage.setItem(
      LOW_CONFIDENCE_FILTER_STORAGE_KEY,
      enabled ? "1" : "0",
    );
  } catch {}
}

function ensureLowConfidenceFilterInitialized() {
  if (typeof window.lowConfidenceOnly === "boolean") return;
  window.lowConfidenceOnly = readLowConfidenceFilterPreference();
}

function updateManualContentModeBadge(rawText = null) {
  const badge = document.getElementById("manualContentModeBadge");
  if (!badge) return;

  const media = getActiveCaptureImagePayload();
  const ref = getDesignatedReferenceImagePayload();
  const currentText = rawText !== null ? String(rawText) : String(document.getElementById("manualInputText")?.value || "");
  const verdict = classifyManualContentMode(currentText, media, ref);
  window.pendingManualContentMode = verdict.mode;

  const styleMap = {
    text: "bg-sky-50 text-sky-700 border-sky-200",
    image: "bg-amber-50 text-amber-700 border-amber-200",
    mixed: "bg-violet-50 text-violet-700 border-violet-200",
  };
  badge.className = `text-[10px] rounded px-2 py-1 border ${styleMap[verdict.mode] || styleMap.text}`;
  const feedback = window.pendingManualAnalysisFeedback || null;
  const confidencePart =
    typeof feedback?.confidence === "number"
      ? ` · 서버신뢰도:${Math.round(feedback.confidence * 100)}%`
      : "";
  const serverPart = feedback?.mode
    ? ` · 서버모드:${getContentModeLabel(feedback.mode)}`
    : "";

  badge.textContent =
    `분석 모드: ${getContentModeLabel(verdict.mode)} · text:${verdict.textLen} · image:${verdict.hasImage ? "Y" : "N"}` +
    `${serverPart}${confidencePart}`;
  badge.classList.remove("hidden");
}

function updateManualImageHint() {
  const hintEl = document.getElementById("manualImageRectHint");
  if (!hintEl) return;

  const ref = getDesignatedReferenceImagePayload();
  if (!ref || !ref.rect) {
    hintEl.classList.add("hidden");
    hintEl.textContent = "";
    return;
  }

  hintEl.textContent = `지정 이미지: ${ref.rect.page}페이지 · x:${Math.round(ref.rect.x)}, y:${Math.round(ref.rect.y)}, w:${Math.round(ref.rect.w)}, h:${Math.round(ref.rect.h)}`;
  hintEl.classList.remove("hidden");
  updateManualContentModeBadge();
}

async function ensureTesseractAvailable() {
  if (window.Tesseract && typeof window.Tesseract.recognize === "function") {
    return true;
  }

  const existing = document.getElementById("dynamic-tesseract-loader");
  if (existing) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    return !!(window.Tesseract && typeof window.Tesseract.recognize === "function");
  }

  const script = document.createElement("script");
  script.id = "dynamic-tesseract-loader";
  script.src = "vendor/js/tesseract.min.js";

  await new Promise((resolve, reject) => {
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  }).catch(() => null);

  return !!(window.Tesseract && typeof window.Tesseract.recognize === "function");
}

async function extractTextByOcrFromImage(imageDataUrl) {
  if (!imageDataUrl) return "";

  const ok = await ensureTesseractAvailable();
  if (!ok) {
    throw new Error("OCR 라이브러리를 로드하지 못했습니다.");
  }

  const result = await window.Tesseract.recognize(imageDataUrl, "kor+eng", {
    logger: () => {},
  });

  return String(result?.data?.text || "")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function markCurrentAreaAsImage() {
  const media = getActiveCaptureImagePayload();
  const rect = window.pendingManualRect || null;

  if (!media || !media.imageDataUrl) {
    setPdfStatus("이미지로 지정할 영역이 없습니다. 먼저 PDF에서 영역을 선택하세요.", "error");
    return;
  }

  window.pendingManualReferenceImage = {
    imageDataUrl: media.imageDataUrl,
    thumbnailDataUrl: media.thumbnailDataUrl,
    width: media.width,
    height: media.height,
    rect: rect ? { ...rect } : null,
  };

  updateManualImageHint();
  updateManualContentModeBadge();
  setPdfStatus("이미지 참조 영역이 지정되었습니다. 이제 텍스트 영역을 선택해 AI 분석을 실행하세요.", "success");
  if (typeof window.showToast === "function") {
    window.showToast("이미지 영역 지정 완료", "success");
  }
}

async function analyzeCurrentArea() {
  const textEl = document.getElementById("manualInputText");
  const numEl = document.getElementById("manualQNum");

  let rawText = textEl ? textEl.value.trim() : "";
  const media = getActiveCaptureImagePayload();
  const referenceImage = getDesignatedReferenceImagePayload();
  const needsOcr =
    !rawText ||
    /^\[(이미지 영역|선택 영역)\]/.test(rawText) ||
    rawText.replace(/\s+/g, "").length < 8;

  updateManualContentModeBadge(rawText);

  if (needsOcr) {
    if (!media || !media.imageDataUrl) {
      setPdfStatus(
        "텍스트 인식 데이터가 없습니다. 먼저 텍스트 영역을 선택하거나 이미지 지정 후 다시 시도하세요.",
        "error",
      );
      return;
    }

    try {
      setPdfStatus("텍스트 레이어가 약해 OCR 보강 중입니다...", "info");
      const ocrText = await extractTextByOcrFromImage(media.imageDataUrl);
      if (ocrText) {
        rawText = ocrText;
        if (textEl) textEl.value = ocrText;
      }
    } catch (ocrErr) {
      console.warn("OCR fallback failed:", ocrErr);
    }
  }

  if (!rawText) {
    setPdfStatus(
      "텍스트를 인식하지 못했습니다. 텍스트/이미지 영역을 다시 지정한 뒤 재시도하세요.",
      "error",
    );
    return;
  }

  updateManualContentModeBadge(rawText);

  const extractedTitle = deriveTitleFromCapturedText(rawText);
  if (numEl && extractedTitle) {
    numEl.value = extractedTitle;
  }

  setPdfStatus("AI 분석 중...", "info");
  try {
    const verdict = classifyManualContentMode(rawText, media, referenceImage);
    // Cloudflare Worker API 또는 Local Endpoint 호출
    const response = await fetch(
      "http://localhost:8787/api/analyze-questions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: rawText,
          imageDataUrl: media?.imageDataUrl || null,
          referenceImageDataUrl: referenceImage?.imageDataUrl || null,
          rect: window.pendingManualRect || null,
          referenceRect: referenceImage?.rect || null,
          contentMode: verdict.mode,
          hasText: verdict.hasText,
          hasImage: verdict.hasImage,
          textLength: verdict.textLen,
        }),
      },
    );

    if (!response.ok) throw new Error("API 연동 실패");

    const resData = await response.json();
    window.pendingManualAnalysisFeedback = {
      mode: typeof resData?.analysisMode === "string" ? resData.analysisMode : verdict.mode,
      confidence:
        typeof resData?.confidence === "number" ? resData.confidence : null,
      meta: resData?.meta || null,
    };
    updateManualContentModeBadge(rawText);

    if (resData.questions && resData.questions.length > 0) {
      const q = resData.questions[0];
      if (numEl && extractedTitle) {
        numEl.value = extractedTitle;
      } else if (numEl && q.title) {
        numEl.value = q.title;
      }
      if (textEl && q.rawQuestion) textEl.value = q.rawQuestion;
      setPdfStatus(
        "AI 분석 완료. 제목이 지정되었습니다. '확정 저장' 후 '초안 작성'을 실행하세요.",
        "success",
      );
    } else {
      setPdfStatus("분석 결과가 없습니다. 기존 내용을 유지합니다.", "warning");
    }
  } catch (e) {
    console.error("AI Analyzer Error:", e);
    window.pendingManualAnalysisFeedback = null;
    updateManualContentModeBadge(rawText);
    setPdfStatus("API 분석에 실패했습니다. 형식만 확정합니다.", "warning");

    let previewTitle = numEl && numEl.value.trim() ? numEl.value.trim() : "";
    if (!previewTitle) {
      previewTitle = deriveTitleFromCapturedText(rawText);
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
  const mediaData = window.pendingManualCaptureMedia || null;
  const referenceImage = getDesignatedReferenceImagePayload();
  const modeVerdict = classifyManualContentMode(text, mediaData, referenceImage);
  const analysisFeedback = window.pendingManualAnalysisFeedback || null;
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
    contentMode: modeVerdict.mode,
    analysisMode: analysisFeedback?.mode || null,
    analysisMeta: analysisFeedback?.meta || null,
    analysisConfidence:
      typeof analysisFeedback?.confidence === "number"
        ? analysisFeedback.confidence
        : null,
    reviewed: false,
    captureImage:
      mediaData && mediaData.thumbnailDataUrl
        ? {
            thumbnailDataUrl: mediaData.thumbnailDataUrl,
            width: mediaData.width,
            height: mediaData.height,
          }
        : null,
    referenceImage:
      referenceImage && referenceImage.thumbnailDataUrl
        ? {
            thumbnailDataUrl: referenceImage.thumbnailDataUrl,
            width: referenceImage.width,
            height: referenceImage.height,
            rect: referenceImage.rect || null,
          }
        : null,
  };

  window.currentReviewingQuestions.push(newQ);
  window.selectedBoxIds = [newQ.id];
  window.currentHighlightedBoxIndex = window.currentReviewingQuestions.length - 1;
  window.currentHighlightedBoxPage = rectData?.page || window.visualCurrentPage || -1;
  window._needsCandidateRefresh = true;

  // v21.6.25: 확정 저장 즉시 JSON 데이터에도 반영하여 사용자 체감 일관성 확보
  try {
    const data = getCurrentAnswerData();
    if (!Array.isArray(data.questions)) data.questions = [];
    data.questions.push({ ...newQ });
    syncJsonAndRender(data, `문항이 저장되었습니다: ${newQ.title}`, true);
  } catch (e) {
    console.error("commitAreaToList 데이터 동기화 실패:", e);
  }

  renderReviewerList(window.currentReviewingQuestions);
  // v21.6 캔버스 날아감 방지: 백그라운드 렌더링 대신 오버레이만 갱신
  if (currentVisualViewport) {
    updateVisualOverlayBoxes(visualCurrentPage, currentVisualViewport);
  }
  setPdfStatus(
    "문항이 확정 저장되었습니다. 옆의 '초안 작성' 버튼으로 답안을 생성할 수 있습니다.",
    "success",
  );

  // 입력 폼 초기화
  if (textEl) textEl.value = "";
  if (numEl) numEl.value = "";
  window.pendingManualRect = null;
  window.pendingManualCaptureMedia = null;
  window.pendingManualReferenceImage = null;
  window.pendingManualContentMode = null;
  window.pendingManualAnalysisFeedback = null;
  updateManualImageHint();
  const badge = document.getElementById("manualContentModeBadge");
  if (badge) {
    badge.classList.add("hidden");
    badge.textContent = "";
  }

  const imagePreviewEl = document.getElementById("manualCaptureImagePreview");
  if (imagePreviewEl) {
    imagePreviewEl.src = "";
    imagePreviewEl.classList.add("hidden");
  }
}

async function generateDraftForCurrentArea() {
  const textEl = document.getElementById("manualInputText");
  const numEl = document.getElementById("manualQNum");
  const roundEl = document.getElementById("manualExamRound");
  const sessionEl = document.getElementById("manualSession");

  const reviewingQuestions = window.currentReviewingQuestions || [];
  const selectedQuestionId =
    (Array.isArray(window.selectedBoxIds) && window.selectedBoxIds[0]) || null;
  const highlightedQuestion =
    Number.isInteger(window.currentHighlightedBoxIndex) &&
    window.currentHighlightedBoxIndex >= 0
      ? reviewingQuestions[window.currentHighlightedBoxIndex]
      : null;
  const selectedQuestion = selectedQuestionId
    ? reviewingQuestions.find((q) => String(q.id) === String(selectedQuestionId)) ||
      highlightedQuestion ||
      reviewingQuestions[reviewingQuestions.length - 1] ||
      null
    : highlightedQuestion || reviewingQuestions[reviewingQuestions.length - 1] || null;

  const hasDirectInput = !!String(textEl?.value || "").trim();
  let rawQuestion = String(textEl?.value || "").trim();
  if (!rawQuestion && selectedQuestion?.rawQuestion) {
    rawQuestion = String(selectedQuestion.rawQuestion).trim();
    if (textEl) textEl.value = rawQuestion;
  }
  if (!rawQuestion) {
    setPdfStatus(
      "초안을 생성할 문제 텍스트가 없습니다. 문항을 선택하거나 수동 캡처 후 다시 시도하세요.",
      "error",
    );
    return;
  }

  const derivedTitle = deriveTitleFromCapturedText(rawQuestion);
  const title =
    String(numEl?.value || "").trim() ||
    String(selectedQuestion?.title || "").trim() ||
    derivedTitle ||
    "문제";
  if (numEl && !numEl.value.trim() && title) {
    numEl.value = title;
  }

  let examRound = "";
  if (roundEl && roundEl.value.trim()) examRound += roundEl.value.trim();
  if (sessionEl && sessionEl.value !== "미지정" && sessionEl.value !== "선택") {
    examRound += (examRound ? " " : "") + sessionEl.value;
  }
  if (!examRound && selectedQuestion?.examRound) {
    examRound = String(selectedQuestion.examRound).trim();
    if (roundEl && !roundEl.value.trim()) {
      roundEl.value = examRound;
    }
  }
  if (!examRound) examRound = "미지정";

  if (hasDirectInput) {
    setPdfStatus("입력된 캡처 텍스트 기준으로 초안을 생성합니다.", "info");
  } else if (selectedQuestion?.id) {
    setPdfStatus(
      `선택 문항(${selectedQuestion.title || selectedQuestion.id}) 기준으로 초안을 생성합니다.`,
      "info",
    );
  }

  const selectedToken = String(
    document.getElementById("aiAvailableModelSelect")?.value || "",
  ).trim();
  const providerFromToken = selectedToken.includes("::")
    ? selectedToken.split("::")[0]
    : "";
  const modelFromToken = selectedToken.includes("::")
    ? selectedToken.split("::").slice(1).join("::")
    : selectedToken;
  const provider =
    providerFromToken ||
    String(document.getElementById("aiProvider")?.value || "").trim() ||
    "gemini";
  const model = modelFromToken || "";

  const knowledgeContext = buildKnowledgeContextForDraft(rawQuestion);
  const instruction = [
    "당신은 토목구조기술사 고득점 답안 코치다.",
    "딥리서치(핵심 원리/기준/실무 포인트)와 기존 지식 컨텍스트를 결합해 답안을 작성하라.",
    "답안 형식: 번호형(1,2,3...), 도해/비교표 지시 포함, KDS 기준 근거 포함.",
    "결론에는 기술사 관점 제언(시공성/유지관리/리스크) 3~4줄 포함.",
    "",
    `[문제 제목] ${title}`,
    `[회차/교시] ${examRound}`,
    `[문제 원문] ${rawQuestion}`,
    "",
    "[기존 지식 컨텍스트]",
    knowledgeContext,
  ].join("\n");

  const planInstruction = [
    "역할: 토목구조기술사 답안 설계자",
    "요구: 답안을 쓰기 전에 작성 계획(Plan)만 먼저 제시",
    "출력 형식:",
    "1) 문제 인식 요약",
    "2) 답안 섹션 구성(5~6개)",
    "3) 도해 계획(최소 2개)",
    "4) 비교표 계획(최소 1개)",
    "5) 기준/수치/KDS 반영 계획",
    "금지: 완성 답안 본문 작성",
    "",
    `[문제 제목] ${title}`,
    `[회차/교시] ${examRound}`,
    `[문제 원문] ${rawQuestion}`,
    "",
    "[기존 지식 컨텍스트]",
    knowledgeContext,
  ].join("\n");

  const question = {
    id: selectedQuestion?.id || "MANUAL-DRAFT",
    title,
    examRound,
    rawQuestion,
    tags: ["수동지정", "AI초안"],
  };

  const endpointInput = String(
    document.getElementById("aiEndpointUrl")?.value || "",
  ).trim();
  const apiKey = String(document.getElementById("aiApiKey")?.value || "").trim();
  let endpoint = endpointInput || "http://localhost:8787/api/generate-answer";
  if (/\/v1\/chat\/completions/i.test(endpoint) || /:1234/i.test(endpoint)) {
    endpoint = "http://localhost:8787/api/generate-answer";
  } else if (!/\/api\/generate-answer\/?$/i.test(endpoint)) {
    endpoint = endpoint.replace(/\/$/, "") + "/api/generate-answer";
  }

  const ensureAnswerEditorVisible = () => {
    if (typeof window.showSection === "function") {
      window.showSection("studio");
    }
    if (window.Studio && typeof window.Studio.switchTab === "function") {
      window.Studio.switchTab("answers");
    }

    const answerEl = document.getElementById("studio-q-modelAnswer");
    const formEl = document.getElementById("answerForm");
    const anchor = answerEl || formEl;
    if (anchor && typeof anchor.scrollIntoView === "function") {
      anchor.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    if (answerEl && typeof answerEl.focus === "function") {
      answerEl.focus();
    }
  };

  const buildLocalManualDraft = () => {
    const contextPreview = String(knowledgeContext || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 260);

    return [
      `1) 핵심 개념 및 배경`,
      `- ${title}의 정의와 적용 범위를 먼저 명확히 제시한다.`,
      `- 관련 기준(KDS/설계기준/시방)에서 요구하는 검토 항목을 연결한다.`,
      "",
      `2) 메커니즘·원인 분석`,
      `- 문제 원문: ${rawQuestion.slice(0, 200)}${rawQuestion.length > 200 ? "..." : ""}`,
      `- 하중전달/재료거동/상세(정착·이음·접합) 관점에서 원인을 단계적으로 설명한다.`,
      "",
      `3) 설계·시공 대책`,
      `- 설계 검토(안전율, 한계상태, 상세치수)와 시공 품질관리(공정·검측·시험)를 분리해 기술한다.`,
      `- 필요한 경우 비교표(대안별 장단점) 및 도해 포인트를 함께 제시한다.`,
      "",
      `4) 기술사형 결론`,
      `- 경제성·시공성·유지관리·리스크를 종합해 최적 대안을 제시한다.`,
      contextPreview ? `- 참고 컨텍스트: ${contextPreview}` : "- 참고 컨텍스트: (없음)",
    ].join("\n");
  };

  const upsertDraftIntoData = (answerText, draftSource, draftPlanText = "") => {
    const data = getCurrentAnswerData();
    const arr = Array.isArray(data.questions) ? data.questions : [];
    const normalizedPlan = String(draftPlanText || "").trim();

    const selectedIndexInData = selectedQuestion?.id
      ? arr.findIndex((q) => String(q?.id) === String(selectedQuestion.id))
      : -1;
    if (selectedIndexInData >= 0) {
      const target = arr[selectedIndexInData];
      target.modelAnswer = String(answerText || "").trim();
      target.draftPlan = normalizedPlan || String(target.draftPlan || "").trim();
      target.draftPlanHistory = appendDraftPlanHistoryForManual(
        target,
        normalizedPlan,
      );
      target.source = target.source
        ? `${target.source} + ${draftSource}`
        : draftSource;
      target.rawQuestion = target.rawQuestion || rawQuestion;
      target.title = target.title || title;
      target.examRound = target.examRound || examRound;
      syncJsonAndRender(data, `초안 작성 완료: ${target.title || title}`, true);
      return selectedIndexInData;
    }

    const normalizedRaw = rawQuestion.replace(/\s+/g, " ").trim();
    const reverseIdx = arr
      .slice()
      .reverse()
      .findIndex((q) => {
        const qRaw = String(q?.rawQuestion || "").replace(/\s+/g, " ").trim();
        return qRaw && qRaw === normalizedRaw;
      });
    const targetIndex = reverseIdx >= 0 ? arr.length - 1 - reverseIdx : -1;

    if (targetIndex >= 0) {
      const target = arr[targetIndex];
      target.modelAnswer = String(answerText || "").trim();
      target.draftPlan = normalizedPlan || String(target.draftPlan || "").trim();
      target.draftPlanHistory = appendDraftPlanHistoryForManual(
        target,
        normalizedPlan,
      );
      target.source = target.source
        ? `${target.source} + ${draftSource}`
        : draftSource;
      syncJsonAndRender(data, `초안 작성 완료: ${target.title || title}`, true);
      return targetIndex;
    }

    const newQuestion = {
      id: `MANUAL-${Date.now()}`,
      title,
      examRound,
      rawQuestion,
      tags: ["수동지정", "AI초안"],
      modelAnswer: String(answerText || "").trim(),
      draftPlan: normalizedPlan,
      draftPlanHistory: appendDraftPlanHistoryForManual({}, normalizedPlan),
      source: draftSource,
      reviewed: false,
    };
    arr.push(newQuestion);
    data.questions = arr;
    syncJsonAndRender(data, `초안 작성 완료: ${title}`, true);
    return arr.length - 1;
  };

  setPdfStatus(`초안 작성 중... (${provider}${model ? ` / ${model}` : ""})`, "info");

  let planText = "";

  try {
    try {
      setPdfStatus("문제 인식/작성 계획 수립 중...", "info");
      const planResp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          question,
          instruction: planInstruction,
          provider,
          model,
        }),
      });
      if (planResp.ok) {
        const planPayload = await planResp.json().catch(() => ({}));
        planText = String(
          planPayload?.answer ||
            planPayload?.content ||
            planPayload?.result ||
            planPayload?.choices?.[0]?.message?.content ||
            "",
        ).trim();
      }
    } catch {
      planText = "";
    }

    const instructionWithPlan = planText
      ? [
          instruction,
          "",
          "[사전 작성 계획 - 반드시 반영]",
          planText,
          "",
          "[작성 규칙] 위 계획의 섹션/도해/비교표 계획을 실제 초안에 반영할 것.",
        ].join("\n")
      : instruction;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        question,
        instruction: instructionWithPlan,
        provider,
        model,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    const answer =
      payload?.answer ||
      payload?.content ||
      payload?.result ||
      payload?.choices?.[0]?.message?.content ||
      "";

    if (!String(answer).trim()) {
      throw new Error("응답에 답안 텍스트가 없습니다.");
    }

    const generatedSource = `Draft(${provider}${model ? `:${model}` : ""})`;
    let updatedIndex = -1;
    try {
      updatedIndex = upsertDraftIntoData(answer, generatedSource, planText);
    } catch {
      // 저장 동기화 실패 시에도 생성 텍스트는 에디터에 반영
    }

    const formIdEl = document.getElementById("studio-q-id");
    const formRoundEl = document.getElementById("studio-q-examRound");
    const formTitleEl = document.getElementById("studio-q-title");
    const formSourceEl = document.getElementById("studio-q-source");
    const formAnswerEl = document.getElementById("studio-q-modelAnswer");
    const formPlanEl = document.getElementById("studio-q-draftPlan");

    if (formRoundEl) formRoundEl.value = examRound;
    if (formTitleEl) formTitleEl.value = title;
    if (formSourceEl) formSourceEl.value = generatedSource;
    if (formAnswerEl) {
      formAnswerEl.value = String(answer).trim();
    }
    if (formPlanEl) {
      formPlanEl.value = String(planText || "").trim();
    }

    if (updatedIndex >= 0 && typeof window.editModelAnswerEntry === "function") {
      window.editModelAnswerEntry(updatedIndex);
    } else if (formIdEl && !formIdEl.value) {
      formIdEl.value = `MANUAL-${Date.now()}`;
    }

    if (typeof window.updateAttachmentBoostButtonState === "function") {
      window.updateAttachmentBoostButtonState();
    }
    if (window.Studio && typeof window.Studio.refreshDraftPlanUi === "function") {
      window.Studio.refreshDraftPlanUi();
    }

    ensureAnswerEditorVisible();

    setPdfStatus("초안 작성이 완료되었습니다. 답안 에디터에서 검토 후 저장하세요.", "success");
    if (typeof window.showToast === "function") {
      window.showToast("초안 생성 완료: 답안 에디터에 자동 반영되었습니다.", "success");
    }
  } catch (error) {
    console.error("Draft generation failed:", error);
    const hint = [
      "점검 순서: ① 분석 백엔드(8787) 실행 ② LM Studio 모델 로드 ③ 상단 Provider/Model 선택 확인",
      "④ 필요 시 AI Endpoint를 /api/generate-answer 로 유지",
    ].join(" ");
    const fallbackAnswer = buildLocalManualDraft();
    const fallbackSource = `DraftFallback(Local:${provider}${model ? `:${model}` : ""})`;

    const formRoundEl = document.getElementById("studio-q-examRound");
    const formTitleEl = document.getElementById("studio-q-title");
    const formSourceEl = document.getElementById("studio-q-source");
    const formAnswerEl = document.getElementById("studio-q-modelAnswer");
    const formPlanEl = document.getElementById("studio-q-draftPlan");

    if (formRoundEl) formRoundEl.value = examRound;
    if (formTitleEl) formTitleEl.value = title;
    if (formSourceEl) formSourceEl.value = fallbackSource;
    if (formAnswerEl) formAnswerEl.value = fallbackAnswer;
    if (formPlanEl) formPlanEl.value = String(planText || "").trim();

    try {
      const fallbackIndex = upsertDraftIntoData(
        fallbackAnswer,
        fallbackSource,
        planText,
      );
      if (
        fallbackIndex >= 0 &&
        typeof window.editModelAnswerEntry === "function"
      ) {
        window.editModelAnswerEntry(fallbackIndex);
      }
    } catch {}

    if (typeof window.updateAttachmentBoostButtonState === "function") {
      window.updateAttachmentBoostButtonState();
    }
    if (window.Studio && typeof window.Studio.refreshDraftPlanUi === "function") {
      window.Studio.refreshDraftPlanUi();
    }

    ensureAnswerEditorVisible();
    setPdfStatus(
      `백엔드 응답 실패로 로컬 초안을 자동 생성했습니다. (${error.message || "unknown"})`,
      "success",
    );
    if (typeof window.showToast === "function") {
      window.showToast(
        `백엔드 연결 오류로 로컬 초안을 채웠습니다. (${hint})`,
        "info",
      );
    }
  }
}

function toggleAddAreaMode() {
  window.isAddAreaMode = !window.isAddAreaMode;
  const btn = document.getElementById("addAreaBtn");
  const overlay = document.getElementById("pdfVisualOverlay");
  const pageNum = window.visualCurrentPage || 1;
  const viewport = window.currentVisualViewport;
  if (window.Debug) {
    window.Debug.log("area", "toggleAddAreaMode", {
      enabled: !!window.isAddAreaMode,
      hasOverlay: !!overlay,
      hasButton: !!btn,
      hasViewport: !!viewport,
      pageNum,
    });
  }
  if (!btn) {
    setPdfStatus("영역 지정 버튼을 찾지 못했습니다.", "error");
    return;
  }
  if (window.isAddAreaMode) {
    // v21.6.26: 재진입 직후(렌더 타이밍) 첫 드래그 누락 방지를 위해 즉시 핸들러 재바인딩
    if (overlay && viewport && typeof initDragSelection === "function") {
      initDragSelection(overlay, viewport, pageNum);
      if (window.Debug) {
        window.Debug.log("area", "drag selection rebound on enable", {
          pageNum,
        });
      }
    } else if (window.visualPdfDoc && typeof renderVisualPage === "function") {
      renderVisualPage(pageNum);
      if (window.Debug) {
        window.Debug.warn("area", "viewport not ready, forced render", {
          pageNum,
        });
      }
    }

    btn.classList.add("bg-blue-600", "text-white", "border-blue-700");
    btn.classList.remove("bg-white", "text-slate-600", "border-slate-200");
    syncAddAreaButtonState(btn, true);
    if (overlay) overlay.style.cursor = "crosshair";
    setPdfStatus(
      "영역 추가 모드가 활성화되었습니다. 드래그하여 영역을 지정하세요.",
      "info",
    );
    flashPdfMessage("영역 지정 모드 ON", "info", 1300);
  } else {
    btn.classList.remove("bg-blue-600", "text-white", "border-blue-700");
    btn.classList.add("bg-white", "text-slate-600", "border-slate-200");
    syncAddAreaButtonState(btn, false);
    if (overlay) overlay.style.cursor = "default";
    setPdfStatus("영역 추가 모드가 해제되었습니다.", "info");
    flashPdfMessage("영역 지정 모드 OFF", "info", 1100);
  }
}

function bindAddAreaButton() {
  const btn = document.getElementById("addAreaBtn");
  if (!btn) return;
  if (btn.dataset.boundAddArea === "1") return;
  btn.dataset.boundAddArea = "1";
  syncAddAreaButtonState(btn, !!window.isAddAreaMode);

  btn.addEventListener("pointerdown", () => {
    if (window.Debug) {
      window.Debug.log("area", "addAreaBtn pointerdown", {
        isAddAreaMode: !!window.isAddAreaMode,
      });
    }
  });

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.Debug) {
      window.Debug.log("area", "addAreaBtn click handler", {
        before: !!window.isAddAreaMode,
      });
    }
    toggleAddAreaMode();
    if (window.Debug) {
      window.Debug.log("area", "addAreaBtn click applied", {
        after: !!window.isAddAreaMode,
      });
    }
  });
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
  window.pendingManualCaptureMedia = null;
  window.pendingManualReferenceImage = null;
  window.pendingManualContentMode = null;
  window.pendingManualAnalysisFeedback = null;
  window.currentHighlightedBoxIndex = null;
  updateManualImageHint();
  const badge = document.getElementById("manualContentModeBadge");
  if (badge) {
    badge.classList.add("hidden");
    badge.textContent = "";
  }

  const imagePreviewEl = document.getElementById("manualCaptureImagePreview");
  if (imagePreviewEl) {
    imagePreviewEl.src = "";
    imagePreviewEl.classList.add("hidden");
  }

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
  const modalEl = document.getElementById("pdfVisualModal");
  const isModalOpen = modalEl ? !modalEl.classList.contains("hidden") : true;
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
  let suppressOverlayClickOnce = false;

  // v21.6.20: overlay.onclick 방식으로 변경 (addEventListener는 페이지 전환 시 이벤트가 누적됨)
  overlay.onclick = (e) => {
    if (suppressOverlayClickOnce) {
      suppressOverlayClickOnce = false;
      if (window.Debug) {
        window.Debug.log("area", "overlay click suppressed after drag", {
          pageNum,
        });
      }
      return;
    }

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
    const addAreaMode = !!window.isAddAreaMode;
    if (window.Debug) {
      window.Debug.log("area", "overlay mousedown", {
        addAreaMode,
        targetClass: e.target?.className || "",
        pageNum,
      });
    }
    // 기본 모드에서는 기존 박스/핸들/후보/버튼 위에서 드래그 진입하지 않음
    // 단, 영역 지정 모드(addAreaMode)에서는 후보 박스 위에서도 드래그를 허용해야 함
    if (
      e.target.closest(".group-box") ||
      e.target.closest(".resizer") ||
      (!addAreaMode && e.target.closest(".group-candidate")) ||
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

    // 드래그 완료 직후 발생하는 click 이벤트가 선택 해제/상태 덮어쓰기를 유발하지 않도록 1회 억제
    suppressOverlayClickOnce = true;

    const p1 = viewport.convertToPdfPoint(minX, minY);
    const p2 = viewport.convertToPdfPoint(maxX, maxY);

    const pdfRect = {
      page: pageNum,
      x: Math.min(p1[0], p2[0]),
      y: Math.min(p1[1], p2[1]),
      w: Math.abs(p1[0] - p2[0]),
      h: Math.abs(p1[1] - p2[1]),
    };

    if (window.Debug) {
      window.Debug.log("area", "overlay mouseup selection", {
        pageNum,
        addAreaMode: !!window.isAddAreaMode,
        pdfRect,
      });
    }

    if (window.isAddAreaMode) {
      // 영역 추가 로직: 녹색 박스 생성
      const pageData = visualTextCache.find((d) => d.page === pageNum);
      let fullText = extractSelectionTextFromBlocks(
        pageData,
        viewport,
        minX,
        minY,
        maxX,
        maxY,
      );
      const imagePayload = extractSelectionImagePayload(
        overlay,
        minX,
        minY,
        maxX,
        maxY,
        pdfRect,
      );

      if (!fullText) {
        fullText = imagePayload
          ? "[이미지 영역] 텍스트 레이어 미검출 (필요 시 AI/OCR 분석 사용)"
          : "[선택 영역] 텍스트 레이어 미검출";
      }

      captureManualQuestion(fullText, pdfRect, imagePayload);
      updateManualContentModeBadge(fullText);
      if (window.Debug) {
        window.Debug.log("area", "manual capture requested", {
          textLen: (fullText || "").length,
          pageNum,
          hasPageData: !!pageData,
          hasImage: !!(imagePayload && imagePayload.hasImage),
          pdfRect,
        });
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

// v21.6.22: Zoom Support for persistent viewer
window.pdfZoomLevel = 1.5;
window.zoomIn = function() {
  window._userZoomTouched = true;
  window.pdfZoomLevel += 0.2;
  if (window.pdfZoomLevel > 3.0) window.pdfZoomLevel = 3.0;
  if (window.visualCurrentPage) renderVisualPage(window.visualCurrentPage);
};
window.zoomOut = function() {
  window._userZoomTouched = true;
  window.pdfZoomLevel -= 0.2;
  if (window.pdfZoomLevel < 0.5) window.pdfZoomLevel = 0.5;
  if (window.visualCurrentPage) renderVisualPage(window.visualCurrentPage);
};

// End of pdf.js

// v21.6.23: PDF 파일 선택 인풋 리스너 연결 (studio-pdf-input)
// 상단 "파일 선택" 버튼 클릭 → input.click() → 이 리스너에서 PDF 로드 처리
(function attachStudioPdfInputListener() {
  function bindInput() {
    bindAddAreaButton();
    const pdfInput = document.getElementById("studio-pdf-input");
    if (!pdfInput) return;
    if (pdfInput.dataset.listenerAttached) return; // 중복 방지
    pdfInput.dataset.listenerAttached = "1";

    pdfInput.addEventListener("change", async function (e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        if (typeof setPdfStatus === "function") {
          setPdfStatus("PDF 파일만 지원됩니다.", "error");
        }
        return;
      }

      if (typeof setPdfStatus === "function") {
        setPdfStatus(`'${file.name}' 로딩 중...`, "info");
      }

      try {
        const reader = new FileReader();
        reader.onload = async function (ev) {
          try {
            const typedarray = new Uint8Array(ev.target.result);
            const pdfjsLib = window.pdfjsLib || window["pdfjs-dist/build/pdf"];
            if (!pdfjsLib) {
              if (typeof setPdfStatus === "function") setPdfStatus("PDF.js 미로딩", "error");
              return;
            }
            const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
            window.visualPdfDoc = pdf;
            window.visualCurrentPage = 1;
            window.ignoredVisualBlocks = [];
            window.currentReviewingQuestions = window.currentReviewingQuestions || [];

            // 파일 선택 즉시 Studio 뷰를 노출하여 "로드됐는데 안 보임" 체감을 방지
            if (typeof window.showSection === "function") {
              window.showSection("studio");
            }

            if (typeof openPdfVisualModal === "function") {
              openPdfVisualModal();
            }

            // 레이아웃 반영 직후 한 번 더 렌더링해 숨김→표시 전환 타이밍 이슈를 완화
            if (typeof requestAnimationFrame === "function") {
              requestAnimationFrame(() => {
                if (window.visualPdfDoc && typeof renderVisualPage === "function") {
                  renderVisualPage(window.visualCurrentPage || 1);
                }
              });
            }

            if (typeof setPdfStatus === "function") {
              setPdfStatus(`${file.name} (${pdf.numPages}페이지) 로드 완료`, "success");
            }
            if (typeof showToast === "function") {
              showToast(`PDF '${file.name}' 로드 완료 (${pdf.numPages}p)`, "success");
            }
          } catch (err) {
            console.error("[studio-pdf-input] PDF 로드 오류:", err);
            if (typeof setPdfStatus === "function") setPdfStatus("PDF 로드 실패: " + err.message, "error");
          }
        };
        reader.readAsArrayBuffer(file);
      } catch (err) {
        console.error("[studio-pdf-input] 파일 읽기 실패:", err);
      }

      // 같은 파일 재선택을 허용하기 위해 값 초기화
      e.target.value = "";
    });
  }

  // DOM 준비 후 바인딩
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindInput);
  } else {
    bindInput();
  }
})();
