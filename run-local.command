#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

BACKEND_PORT_CANDIDATES="${BACKEND_PORT_CANDIDATES:-8787 8788 8789}"
WEB_PORT_CANDIDATES="${WEB_PORT_CANDIDATES:-18000 18001 8000}"

BACKEND_PID_FILE=".run-local-backend.pid"
WEB_PID_FILE=".run-local-web.pid"

log() {
  printf '%s\n' "$1"
}

is_pid_running() {
  local pid="$1"
  [ -n "$pid" ] && kill -0 "$pid" >/dev/null 2>&1
}

is_port_in_use() {
  local port="$1"
  lsof -iTCP:"$port" -sTCP:LISTEN -n -P >/dev/null 2>&1
}

pick_port() {
  local port
  for port in $1; do
    if ! is_port_in_use "$port"; then
      echo "$port"
      return 0
    fi
  done
  return 1
}

stop_services() {
  if [ -f "$BACKEND_PID_FILE" ]; then
    local pid
    pid="$(cat "$BACKEND_PID_FILE" 2>/dev/null || true)"
    if is_pid_running "$pid"; then kill "$pid" >/dev/null 2>&1 || true; fi
    rm -f "$BACKEND_PID_FILE"
  fi

  if [ -f "$WEB_PID_FILE" ]; then
    local pid
    pid="$(cat "$WEB_PID_FILE" 2>/dev/null || true)"
    if is_pid_running "$pid"; then kill "$pid" >/dev/null 2>&1 || true; fi
    rm -f "$WEB_PID_FILE"
  fi

  for p in $BACKEND_PORT_CANDIDATES $WEB_PORT_CANDIDATES; do
    lsof -tiTCP:"$p" -sTCP:LISTEN | xargs kill -9 2>/dev/null || true
  done
}

if [ "${1:-}" = "stop" ]; then
  log "서비스 종료 중..."
  stop_services
  log "완료"
  exit 0
fi

if [ -f "$HOME/.zshrc" ]; then
  # shellcheck disable=SC1090
  source "$HOME/.zshrc" >/dev/null 2>&1 || true
fi

export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
fi

command -v node >/dev/null 2>&1 || { log "오류: node 없음"; exit 1; }
command -v npm >/dev/null 2>&1 || { log "오류: npm 없음"; exit 1; }
command -v python3 >/dev/null 2>&1 || { log "오류: python3 없음"; exit 1; }

if [ ! -d node_modules ]; then
  log "npm install 실행..."
  npm install
fi

BACKEND_PORT="$(pick_port "$BACKEND_PORT_CANDIDATES")" || { log "백엔드 포트 없음"; exit 1; }
WEB_PORT="$(pick_port "$WEB_PORT_CANDIDATES")" || { log "웹 포트 없음"; exit 1; }
WEB_URL="http://localhost:${WEB_PORT}/solve_120.html"

log "백엔드 시작: ${BACKEND_PORT}"
PORT="$BACKEND_PORT" node server/index.js > .run-local-backend.log 2>&1 &
BACKEND_PID=$!
echo "$BACKEND_PID" > "$BACKEND_PID_FILE"

sleep 1
is_pid_running "$BACKEND_PID" || { log "백엔드 시작 실패"; exit 1; }

log "웹 시작: ${WEB_PORT}"
python3 -m http.server "$WEB_PORT" > .run-local-web.log 2>&1 &
WEB_PID=$!
echo "$WEB_PID" > "$WEB_PID_FILE"

sleep 1
is_pid_running "$WEB_PID" || {
  log "웹 시작 실패"
  kill "$BACKEND_PID" >/dev/null 2>&1 || true
  rm -f "$BACKEND_PID_FILE"
  exit 1
}

open "$WEB_URL"

log "실행 완료"
log "- backend: http://localhost:${BACKEND_PORT}"
log "- web: ${WEB_URL}"
log "종료: ./run-local.command stop"
