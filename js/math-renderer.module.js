/**
 * Math Renderer Module
 * 담당: KaTeX 라이브러리를 사용한 텍스트 내 수식($...$, $$...$$) 렌더링
 */

/**
 * 지정된 요소 내의 수식을 KaTeX로 렌더링합니다.
 * @param {HTMLElement} element - 렌더링 대상 요소 (생략 시 document.body)
 */
export function renderMath(element) {
  if (typeof renderMathInElement !== "function") {
    // 가끔 라이브러리 로드가 늦어질 수 있으므로 재시도 로직 고려 가능
    return;
  }

  const target = element || document.body;
  
  try {
    renderMathInElement(target, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
        { left: "\\(", right: "\\)", display: false },
        { left: "\\[", right: "\\]", display: true },
        // 기술사 답안에서 가끔 쓰이는 패턴 추가
        { left: "\\begin{equation}", right: "\\end{equation}", display: true },
        { left: "\\begin{align}", right: "\\end{align}", display: true },
        { left: "\\begin{gather}", right: "\\end{gather}", display: true },
      ],
      throwOnError: false,
      trust: true,
      strict: false,
    });
  } catch (e) {
    console.error("KaTeX Rendering Error:", e);
  }
}

/**
 * 일정 시간 간격으로 수식을 렌더링하는 헬퍼 (동적 콘텐츠 대응)
 */
export function renderMathDebounced(element, delay = 100) {
  if (window._mathRenderTimer) clearTimeout(window._mathRenderTimer);
  window._mathRenderTimer = setTimeout(() => {
    renderMath(element);
  }, delay);
}
