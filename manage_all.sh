#!/usr/bin/env bash
#
# manage_all.sh — manage the Herdr stack: Python backend, Next.js frontend,
# and the Cloudflare tunnel that exposes the frontend.
#
# Usage:
#   ./manage_all.sh start               start backend + frontend + tunnel
#   ./manage_all.sh stop                stop everything (tunnel, frontend, backend)
#   ./manage_all.sh restart             stop then start
#   ./manage_all.sh status              show pid, uptime, and health per service
#   ./manage_all.sh logs [svc]          tail -f logs (svc: backend|frontend|tunnel|all)
#   ./manage_all.sh pid [svc]           print PID file(s)
#   ./manage_all.sh clean               stop everything and remove stale pidfiles
#
# Logs live in ./logs/ (backend.log, frontend.log, tunnel.log, *.pid).
# All knobs below are overridable via environment variables.

set -u
set -o pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ------------------------------------------------------------------ config
PY_DIR="${PY_DIR:-$ROOT/python}"
LOGS_DIR="${LOGS_DIR:-$ROOT/logs}"
RUN_DIR="${RUN_DIR:-$LOGS_DIR}"

PY_PORT="${PY_PORT:-8000}"
PY_HOST="${PY_HOST:-127.0.0.1}"
PY_VENV="${PY_VENV:-$PY_DIR/.venv/bin}"
PY_MODULE="${PY_MODULE:-app.main:app}"

FRONTEND_PORT="${FRONTEND_PORT:-3001}"

TUNNEL_NAME="${TUNNEL_NAME:-herdr}"
TUNNEL_HOST="${TUNNEL_HOST:-herdr.gobblemon.com}"
TUNNEL_CONFIG="${TUNNEL_CONFIG:-$HOME/.cloudflared/herdr.yml}"

START_TIMEOUT="${START_TIMEOUT:-60}"   # seconds to wait for readiness

BACKEND_PID="$RUN_DIR/backend.pid"
BACKEND_LOG="$LOGS_DIR/backend.log"
FRONTEND_PID="$RUN_DIR/frontend.pid"
FRONTEND_LOG="$LOGS_DIR/frontend.log"
TUNNEL_PID="$RUN_DIR/tunnel.pid"
TUNNEL_LOG="$LOGS_DIR/tunnel.log"

mkdir -p "$LOGS_DIR" "$RUN_DIR"

# ------------------------------------------------------------------ helpers
log()  { printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }
die()  { log "ERROR: $*" >&2; exit 1; }

pid_is_alive() { kill -0 "$1" 2>/dev/null; }

read_pid() {
  local f="$1"
  [[ -f "$f" ]] && tr -d ' \n' < "$f" || true
}

# read_pid_of <pidfile>: echoes the stored PID if the process is alive, else ""
alive_pid() {
  local pid; pid="$(read_pid "$1")"
  [[ -n "$pid" ]] && pid_is_alive "$pid" && echo "$pid"
}

# kill_pid_graceful <pid>: TERM, wait up to 5s, then KILL.
kill_pid_graceful() {
  local pid="$1" grace=5 i=0
  kill "$pid" 2>/dev/null || return 0
  while pid_is_alive "$pid" && (( i < grace )); do sleep 1; i=$((i+1)); done
  if pid_is_alive "$pid"; then kill -9 "$pid" 2>/dev/null; fi
}

# kill_everything_on_port <port>: TERM then KILL anything listening on port.
kill_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti "tcp:$port" 2>/dev/null)" || return 0
  local p
  for p in $pids; do kill_pid_graceful "$p"; done
}

# banner <log> <msg>: timestamped restart marker inside a log.
banner() {
  { printf '\n### ---- %s : %s ----\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$2"; } >> "$1"
}

# wait_for_curl <url> <seconds>: true when the URL answers 2xx/3xx.
wait_for_curl() {
  local url="$1" seconds="$2" i=0
  until (( i >= seconds )); do
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "$url" 2>/dev/null || true)"
    [[ "$code" =~ ^[23] ]] && return 0
    i=$((i+1)); sleep 1
  done
  return 1
}

# ------------------------------------------------------------------ services
service_up() {
  local name="$1" port="$2" pid
  pid="$(alive_pid "$RUN_DIR/$name.pid")"
  [[ -n "$pid" ]] && return 0
  # fall back: an existing listener on the port counts as up
  [[ -n "$(lsof -ti "tcp:$port" 2>/dev/null)" ]]
}

start_backend() {
  if [[ -n "$(alive_pid "$BACKEND_PID")" ]]; then
    log "backend already running (pid $(alive_pid "$BACKEND_PID"))"; return 0
  fi
  if [[ -n "$(lsof -ti "tcp:$PY_PORT" 2>/dev/null)" ]]; then
    log "backend already up on port $PY_PORT (adopted, no pidfile)"; return 0
  fi
  [[ -x "$PY_VENV/uvicorn" ]] || die "backend venv missing — run: cd $PY_DIR && python3 -m venv .venv && ./.venv/bin/pip install -r requirements.txt"
  banner "$BACKEND_LOG" "start"
  ( cd "$PY_DIR" && exec ./.venv/bin/uvicorn "$PY_MODULE" --host "$PY_HOST" --port "$PY_PORT" >> "$BACKEND_LOG" 2>&1 ) &
  echo $! > "$BACKEND_PID"
  if wait_for_curl "http://$PY_HOST:$PY_PORT/health" "$START_TIMEOUT"; then
    log "backend up    (pid $(read_pid "$BACKEND_PID")) http://$PY_HOST:$PY_PORT/health"
  else
    log "backend failed to become ready — see $BACKEND_LOG"; return 1
  fi
}

start_frontend() {
  if [[ -n "$(alive_pid "$FRONTEND_PID")" ]]; then
    log "frontend already running (pid $(alive_pid "$FRONTEND_PID"))"; return 0
  fi
  if [[ -n "$(lsof -ti "tcp:$FRONTEND_PORT" 2>/dev/null)" ]]; then
    log "frontend already up on port $FRONTEND_PORT (adopted, no pidfile)"; return 0
  fi
  [[ -d "$ROOT/node_modules" ]] || die "frontend deps missing — run: npm install"
  banner "$FRONTEND_LOG" "start"
  ( cd "$ROOT" && exec npm run dev -- -p "$FRONTEND_PORT" >> "$FRONTEND_LOG" 2>&1 ) &
  echo $! > "$FRONTEND_PID"
  if wait_for_curl "http://localhost:$FRONTEND_PORT/" "$START_TIMEOUT"; then
    log "frontend up  (pid $(read_pid "$FRONTEND_PID")) http://localhost:$FRONTEND_PORT/"
  else
    log "frontend failed to become ready — see $FRONTEND_LOG"; return 1
  fi
}

start_tunnel() {
  [[ -n "$(alive_pid "$TUNNEL_PID")" ]] && { log "tunnel already running (pid $(alive_pid "$TUNNEL_PID"))"; return 0; }
  command -v cloudflared >/dev/null 2>&1 || die "cloudflared not found — install via: brew install cloudflared"
  [[ -f "$TUNNEL_CONFIG" ]] || die "tunnel config missing: $TUNNEL_CONFIG"
  banner "$TUNNEL_LOG" "start"
  ( exec cloudflared --config "$TUNNEL_CONFIG" tunnel run "$TUNNEL_NAME" >> "$TUNNEL_LOG" 2>&1 ) &
  echo $! > "$TUNNEL_PID"
  if wait_for_curl "https://$TUNNEL_HOST/" "$START_TIMEOUT"; then
    log "tunnel up    (pid $(read_pid "$TUNNEL_PID")) https://$TUNNEL_HOST/"
  else
    log "tunnel not reachable yet — see $TUNNEL_LOG"; return 1
  fi
}

stop_service() {
  local label="$1" pidfile="$2" port="$3"
  local pid; pid="$(alive_pid "$pidfile")"
  if [[ -n "$pid" ]]; then
    log "stopping $label (pid $pid)"
    kill_pid_graceful "$pid"
  fi
  # clear any orphan still holding the port (e.g. npm => next child)
  if [[ -n "$port" ]]; then
    local leftovers; leftovers="$(lsof -ti "tcp:$port" 2>/dev/null)" || true
    if [[ -n "$leftovers" ]]; then
      local p
      for p in $leftovers; do
        log "stopping $label orphan (pid $p) on port $port"
        kill_pid_graceful "$p"
      done
    fi
  fi
  rm -f "$pidfile"
}

stop_all() {
  stop_service "tunnel"    "$TUNNEL_PID"     ""
  stop_service "frontend"  "$FRONTEND_PID"   "$FRONTEND_PORT"
  stop_service "backend"   "$BACKEND_PID"    "$PY_PORT"
  log "all services stopped"
}

status_one() {
  local label="$1" pidfile="$2" port="$3" url="$4"
  local pid; pid="$(alive_pid "$pidfile")"
  if [[ -z "$pid" && -n "$port" ]]; then
    pid="$(lsof -ti "tcp:$port" 2>/dev/null | head -1 || true)"
  fi
  local state=down uptime=""
  if [[ -n "$pid" ]]; then
    state=up
    uptime="$(ps -o etime= -p "$pid" 2>/dev/null | tr -d ' ')"
  fi
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 4 "$url" 2>/dev/null || echo down)"
  printf '%-9s %-4s pid=%-8s up=%-8s http=%s\n' "$label" "$state" "${pid:-none}" "$uptime" "$code"
}

# ------------------------------------------------------------------ actions
cmd_start() {
  log "starting Herdr stack…"
  start_backend && start_frontend && start_tunnel
  log "done. public URL: https://$TUNNEL_HOST/"
}

cmd_stop()  { stop_all; }

cmd_status() {
  echo "service   state pid       up        http"
  status_one "backend"  "$BACKEND_PID"   "$PY_PORT"          "http://$PY_HOST:$PY_PORT/health"
  status_one "frontend" "$FRONTEND_PID"  "$FRONTEND_PORT"    "http://localhost:$FRONTEND_PORT/"
  status_one "tunnel"   "$TUNNEL_PID"    ""                  "https://$TUNNEL_HOST/"
}

cmd_logs() {
  local svc="${1:-all}"
  case "$svc" in
    backend)  tail -f "$BACKEND_LOG";;
    frontend) tail -f "$FRONTEND_LOG";;
    tunnel)   tail -f "$TUNNEL_LOG";;
    all)      tail -f "$BACKEND_LOG" "$FRONTEND_LOG" "$TUNNEL_LOG";;
    *) die "unknown service '$svc' (backend|frontend|tunnel|all)";;
  esac
}

cmd_pid() {
  local svc="${1:-all}"
  case "$svc" in
    backend)  cat "$BACKEND_PID" 2>/dev/null;;
    frontend) cat "$FRONTEND_PID" 2>/dev/null;;
    tunnel)   cat "$TUNNEL_PID" 2>/dev/null;;
    all)      echo "backend  $(cat "$BACKEND_PID" 2>/dev/null || echo -)"
              echo "frontend $(cat "$FRONTEND_PID" 2>/dev/null || echo -)"
              echo "tunnel   $(cat "$TUNNEL_PID" 2>/dev/null || echo -)";;
    *) die "unknown service '$svc'";;
  esac
}

cmd_clean() { stop_all; }

# ------------------------------------------------------------------ dispatch
case "${1:-}" in
  start)   cmd_start ;;
  stop)    cmd_stop ;;
  restart) cmd_stop; cmd_start ;;
  status)  cmd_status ;;
  logs)    cmd_logs "${2:-all}" ;;
  pid)     cmd_pid "${2:-all}" ;;
  clean)   cmd_clean ;;
  *) cat <<EOF
manage_all.sh — manage the Herdr stack (backend + frontend + Cloudflare tunnel)

Usage:  ./manage_all.sh <command> [args]

  start              Start backend, frontend, and cloudflare tunnel
  stop               Stop all services gracefully
  restart            Stop, then start
  status             Show pid / uptime / health per service
  logs [svc]         Tail -f logs; svc = backend|frontend|tunnel|all
  pid [svc]          Show PID; svc = backend|frontend|tunnel|all
  clean              Stop all and remove stale state

Public URL:  https://$TUNNEL_HOST/
Logs:        $LOGS_DIR/
EOF
    exit 0 ;;
esac