/**
 * 안전하게 이벤트 리스너를 추가합니다.
 * @param {string} id - DOM 요소의 id
 * @param {string} event - 이벤트 타입 (예: 'click')
 * @param {Function} handler - 이벤트 핸들러 함수
 */
export function safeAddListener(id, event, handler) {
  const el = getEl(id);
  if (el) el.addEventListener(event, handler);
}
// SolveCivil 공통 DOM 유틸리티
// getElement, on, off, qs, qsa 등 자주 쓰는 DOM 접근/이벤트 함수 제공

/**
 * id로 DOM 요소를 반환합니다.
 * @param {string} id - DOM 요소의 id
 * @returns {HTMLElement|null}
 */
export function getEl(id) {
  return document.getElementById(id);
}

/**
 * CSS 선택자로 단일 요소를 반환합니다.
 * @param {string} selector
 * @param {ParentNode} [parent=document]
 * @returns {Element|null}
 */
export function qs(selector, parent = document) {
  return parent.querySelector(selector);
}

/**
 * CSS 선택자로 모든 일치 요소를 배열로 반환합니다.
 * @param {string} selector
 * @param {ParentNode} [parent=document]
 * @returns {Element[]}
 */
export function qsa(selector, parent = document) {
  return Array.from(parent.querySelectorAll(selector));
}

export function on(el, event, handler, opts) {
  if (el) el.addEventListener(event, handler, opts);
}

export function off(el, event, handler, opts) {
  if (el) el.removeEventListener(event, handler, opts);
}

export function setAttr(el, key, value) {
  if (el) el.setAttribute(key, value);
}

export function getAttr(el, key) {
  return el ? el.getAttribute(key) : undefined;
}

export function hasClass(el, cls) {
  return el && el.classList ? el.classList.contains(cls) : false;
}

export function addClass(el, cls) {
  if (el && el.classList) el.classList.add(cls);
}

export function removeClass(el, cls) {
  if (el && el.classList) el.classList.remove(cls);
}
