#!/usr/bin/env bash
# Shared helpers for the autogame harness. Sourced by run_*.sh.
# Provides: paths, config, logging, game process control, prompt rendering,
# CLI wrappers, verdict parsing, and git helpers.

HARNESS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HARNESS_DIR/.." && pwd)"
PROMPTS_DIR="$HARNESS_DIR/prompts"
cd "$REPO_ROOT"

# The harness may be launched with a minimal PATH (e.g. from tmux) that lacks
# ~/.local/bin — where the cursor `agent` CLI lives. Ensure it is reachable.
case ":$PATH:" in *":$HOME/.local/bin:"*) ;; *) export PATH="$HOME/.local/bin:$PATH" ;; esac

# --- Tunables (override via environment) ---
MAX_ITER="${MAX_ITER:-5}"                 # qwen+gemini iterations per sub-ticket
TICKET_MAX_ROUNDS="${TICKET_MAX_ROUNDS:-3}" # decompose -> subs -> review cycles
GAME_URL="${GAME_URL:-http://localhost:5173}"
QWEN_MODEL="${QWEN_MODEL:-}"               # empty = qwen default
GEMINI_MODEL="${GEMINI_MODEL:-gemini-3-flash-preview}"
CLAUDE_MODEL="${CLAUDE_MODEL:-}"           # empty = claude default
QWEN_TIMEOUT="${QWEN_TIMEOUT:-1200}"
GEMINI_TIMEOUT="${GEMINI_TIMEOUT:-600}"
CLAUDE_TIMEOUT="${CLAUDE_TIMEOUT:-900}"
AGENT_MODEL="${AGENT_MODEL:-composer-2}"   # cursor-agent QA fallback model
AGENT_TIMEOUT="${AGENT_TIMEOUT:-600}"
CLI_RETRIES="${CLI_RETRIES:-2}"            # retries on timeout/empty output
CLI_RETRY_BACKOFF="${CLI_RETRY_BACKOFF:-20}"

# Exit-code convention used across run_*.sh:
#   0 = passed   1 = genuine task failure   2 = harness/tool failure (escalate)

# --- Logging ---
log() { echo "[$(date '+%F %T')] $*"; }

# --- Game process control ---
GAME_PIDS=()
start_game() {  # start_game <logdir>
  local logdir="$1"
  ( node game/server/index.js ) </dev/null >"$logdir/server.log" 2>&1 &
  GAME_PIDS+=("$!")
  ( cd game/client && npx vite --port 5173 --strictPort ) </dev/null >"$logdir/client.log" 2>&1 &
  GAME_PIDS+=("$!")
}

stop_game() {
  local p
  for p in "${GAME_PIDS[@]:-}"; do
    [ -n "$p" ] && kill "$p" 2>/dev/null
  done
  GAME_PIDS=()
  pkill -f 'node game/server/index.js' 2>/dev/null
  pkill -f 'vite --port 5173' 2>/dev/null
  sleep 1
}

wait_for_game() {  # wait_for_game [timeout-seconds] ; 0 if both ports respond
  local deadline=$(( $(date +%s) + ${1:-45} )) up_c=0 up_s=0
  while [ "$(date +%s)" -lt "$deadline" ]; do
    [ $up_c -eq 0 ] && curl -s -o /dev/null "http://localhost:5173/" && up_c=1
    [ $up_s -eq 0 ] && curl -s -o /dev/null "http://localhost:3000/" && up_s=1
    [ $up_c -eq 1 ] && [ $up_s -eq 1 ] && return 0
    sleep 1
  done
  return 1
}

# --- Prompt rendering: render_prompt <template> <KEY> <val> [<KEY> <val>...] ---
render_prompt() {
  local content; content="$(cat "$1")"; shift
  while [ "$#" -ge 2 ]; do
    content="${content//__${1}__/$2}"
    shift 2
  done
  printf '%s' "$content"
}

# --- CLI runner: retries on timeout / empty output. ---
# _run_cli <label> <outfile> <timeout> <cmd...>  ->  0 = ok, 2 = tool-failure
_run_cli() {
  local label="$1" out="$2" tmo="$3"; shift 3
  local attempt=1 rc
  while :; do
    # </dev/null: a CLI that reads stdin (gemini -p does) must NOT inherit the
    #   harness's TTY — a backgrounded process reading a TTY gets SIGTTIN and
    #   hangs in stopped state. -k 30: SIGKILL 30s after the SIGTERM so a wedged
    #   or stopped process is always reaped (rc 124 = SIGTERM'd, 137 = SIGKILL'd).
    timeout -k 30 "$tmo" "$@" </dev/null >"$out" 2>&1; rc=$?
    if [ "$rc" -ne 124 ] && [ "$rc" -ne 137 ] && [ -s "$out" ]; then
      return 0
    fi
    if [ "$attempt" -gt "$CLI_RETRIES" ]; then
      log "[tool-failure] $label failed after $attempt attempts (last rc=$rc, $([ "$rc" -eq 124 ] && echo timeout || echo 'empty output'))"
      return 2
    fi
    log "[tool-retry] $label attempt $attempt failed (rc=$rc) — backoff ${CLI_RETRY_BACKOFF}s"
    sleep "$CLI_RETRY_BACKOFF"
    attempt=$((attempt + 1))
  done
}

# CLI wrappers — all non-interactive / unattended. Return 0 = ok, 2 = tool-failure.
run_qwen() {  # run_qwen <prompt> <outfile>
  local a=(qwen -y); [ -n "$QWEN_MODEL" ] && a+=(-m "$QWEN_MODEL"); a+=("$1")
  _run_cli qwen "$2" "$QWEN_TIMEOUT" "${a[@]}"
}
run_gemini() {  # run_gemini <prompt> <outfile>
  local a=(gemini -y --skip-trust); [ -n "$GEMINI_MODEL" ] && a+=(-m "$GEMINI_MODEL"); a+=(-p "$1")
  _run_cli gemini "$2" "$GEMINI_TIMEOUT" "${a[@]}"
}
run_agent() {  # run_agent <prompt> <outfile> — cursor-agent, QA fallback
  local a=(agent -p --force --trust --mode ask)
  [ -n "$AGENT_MODEL" ] && a+=(--model "$AGENT_MODEL")
  a+=("$1")
  _run_cli agent "$2" "$AGENT_TIMEOUT" "${a[@]}"
}
run_claude() {  # run_claude <prompt> <outfile>
  local a=(claude -p --dangerously-skip-permissions); [ -n "$CLAUDE_MODEL" ] && a+=(--model "$CLAUDE_MODEL"); a+=("$1")
  _run_cli claude "$2" "$CLAUDE_TIMEOUT" "${a[@]}"
}

# A QA/review output is usable iff it ended with a real verdict line. This is
# the correct "did the agent actually do the job" signal — unlike grepping for
# scary words, it is NOT fooled by transient retry noise (e.g. gemini printing
# "exhausted ... retrying" before it goes on to succeed).
has_verdict() {  # has_verdict <outfile>
  [ -f "$1" ] && grep -qxE 'VERDICT: (PASS|FAIL)' "$1"
}

# --- Verdict parsing: a passing artifact ends with the exact line VERDICT: PASS ---
is_pass() {  # is_pass <file>
  [ -f "$1" ] && grep -qxF 'VERDICT: PASS' "$1"
}

# --- Git helpers ---
# commit_verified <message> — HARD GATE for verified progress.
# Stages everything, commits, and asserts HEAD advanced.
#   0 = committed (or nothing to commit — state already in HEAD)
#   2 = commit could not be made → caller MUST escalate, never proceed
commit_verified() {
  git add -A
  if git diff --cached --quiet; then
    log "[git] no changes to commit — verified state already in HEAD"
    return 0
  fi
  local before; before="$(git rev-parse HEAD 2>/dev/null)"
  if ! git commit -q -m "$1" -m "Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"; then
    log "[git] ERROR: commit failed for: $1"
    return 2
  fi
  if [ "$(git rev-parse HEAD 2>/dev/null)" = "$before" ]; then
    log "[git] ERROR: HEAD did not advance after commit"
    return 2
  fi
  log "[git] committed $(git rev-parse --short HEAD): $1"
  return 0
}

# Discard uncommitted changes under game/. Safe: verified progress is always
# committed (commit_verified) before the harness moves on, so this can only
# ever discard the current failed attempt.
revert_game_changes() {
  git checkout -- game/ 2>/dev/null || true
  git clean -fdq game/ 2>/dev/null || true
}

next_version_tag() {  # echoes v0.<n> where n = (#existing v0.* tags)+1
  echo "v0.$(( $(git tag -l 'v0.*' | wc -l | tr -d ' ') + 1 ))"
}
