#!/usr/bin/env bash
# Shared helpers for the autogame harness. Sourced by run_*.sh.
# Provides: paths, config, logging, game process control, prompt rendering,
# CLI wrappers, verdict parsing, and git helpers.

HARNESS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HARNESS_DIR/.." && pwd)"
# PROMPTS_DIR is consumed by the run_*.sh scripts that source this file.
# shellcheck disable=SC2034
PROMPTS_DIR="$HARNESS_DIR/prompts"
cd "$REPO_ROOT" || exit 1

# The harness may be launched with a minimal PATH (e.g. from tmux) that lacks
# ~/.local/bin — where the cursor `agent` CLI lives. Ensure it is reachable.
case ":$PATH:" in *":$HOME/.local/bin:"*) ;; *) export PATH="$HOME/.local/bin:$PATH" ;; esac

# --- Tunables (override via environment) ---
MAX_ITER="${MAX_ITER:-5}"                 # qwen+gemini iterations per sub-ticket
TICKET_MAX_ROUNDS="${TICKET_MAX_ROUNDS:-10}" # decompose -> subs -> review cycles
GAME_URL="${GAME_URL:-http://localhost:5173}"
QWEN_MODEL="${QWEN_MODEL:-}"               # empty = qwen default
GEMINI_MODEL="${GEMINI_MODEL:-gemini-3-flash-preview}"
CLAUDE_MODEL="${CLAUDE_MODEL:-}"           # empty = claude default
QWEN_TIMEOUT="${QWEN_TIMEOUT:-7200}"
GEMINI_TIMEOUT="${GEMINI_TIMEOUT:-600}"
GEMINI_QUOTA_FAST_FAIL="${GEMINI_QUOTA_FAST_FAIL:-1}"
GEMINI_QUOTA_FAST_FAIL_SECONDS="${GEMINI_QUOTA_FAST_FAIL_SECONDS:-12}"
CLAUDE_TIMEOUT="${CLAUDE_TIMEOUT:-900}"
AGENT_MODEL="${AGENT_MODEL:-composer-2.5-fast}" # cursor-agent QA fallback model
REVIEW_EASY_MODEL="${REVIEW_EASY_MODEL:-composer-2.5}" # top-level review for easy tickets
REVIEW_MEDIUM_MODEL="${REVIEW_MEDIUM_MODEL:-gpt-5.5-medium-fast}" # top-level review for medium tickets
REVIEW_HARD_MODEL="${REVIEW_HARD_MODEL:-gpt-5.5-extra-high}" # top-level review for hard tickets
AGENT_TIMEOUT="${AGENT_TIMEOUT:-720}"  # 12 min — composer is now the primary QA reviewer (gemini dropped)
# IMPL_MODEL selects the sub-ticket IMPLEMENTER (run_subtask.sh step 1).
#   ""              = default, route to run_qwen (local qwen CLI)
#   "composer-2.5-fast" / "composer-2.5" / "gpt-5.5-*" / …  = cursor-agent --model <X>
# The implementer must write files, so the cursor-agent path uses the WRITABLE
# wrapper (no --mode ask). IMPL_TIMEOUT overrides AGENT_TIMEOUT for the impl call
# only — composer can need longer than the 12-min QA ceiling on a real diff.
IMPL_MODEL="${IMPL_MODEL:-}"
IMPL_TIMEOUT="${IMPL_TIMEOUT:-1800}"   # 30 min — implementer ceiling when routed via cursor-agent
# QA_MODEL prepends a cursor-agent reviewer as the PRIMARY sub-ticket QA hop
# (run_subtask.sh step 3). When set, the chain becomes:
#   1. cursor-agent/$QA_MODEL (NEW primary)        — READ-ONLY (--mode ask) so
#      the QA agent cannot edit the code it judges (same rule as the existing
#      cursor-agent QA fallback at run_agent_model).
#   2. qwen self-review (was primary, now fallback)
#   3. cursor-agent/$AGENT_MODEL (composer-2.5-fast fallback)
#   4. agy / Gemini 3.5 Flash (High)
#   5. claude (last resort)
# Empty (default) leaves the original qwen-first chain untouched.
QA_MODEL="${QA_MODEL:-}"
# DECOMP_MODEL routes the ticket DECOMPOSER (run_ticket.sh, once per round)
# through cursor-agent --model <X>. Uses the WRITABLE wrapper because the
# decomposer creates `subtickets/*/ticket.md` files. Empty = qwen (legacy).
DECOMP_MODEL="${DECOMP_MODEL:-}"
DECOMP_TIMEOUT="${DECOMP_TIMEOUT:-1800}"
# QWEN_DISABLED short-circuits run_qwen / run_qwen_vision so the local qwen
# process can be unloaded (free up GPU) without every fallback chain stalling
# on CLI timeouts. Pair with IMPL_MODEL/QA_MODEL/DECOMP_MODEL so the qwen
# primary slots are replaced by cursor-agent. Other qwen callers (commit,
# qwen-vision feedback, qwen_extract_review_files) already have graceful
# fallbacks — fast-failing here lets those fallbacks fire immediately instead
# of after a full QWEN_TIMEOUT.
QWEN_DISABLED="${QWEN_DISABLED:-0}"
# Antigravity CLI (Gemini 3.5 Flash, High). Model is pinned globally via the
# interactive `/model` slash command and persisted server-side; there is NO
# --model flag, so the harness has nothing to set per call. AGY_MODEL_LABEL is
# recorded for usage telemetry only.
AGY_MODEL_LABEL="${AGY_MODEL_LABEL:-Gemini 3.5 Flash (High)}"
AGY_TIMEOUT="${AGY_TIMEOUT:-720}"        # match AGENT_TIMEOUT — agy's internal --print-timeout is set from this
CLI_RETRIES="${CLI_RETRIES:-2}"            # retries on timeout/empty output
CLI_RETRY_BACKOFF="${CLI_RETRY_BACKOFF:-20}"
QWEN_VISION_FEEDBACK="${QWEN_VISION_FEEDBACK:-1}" # screenshot feedback for failed visual QA
QWEN_VISION_MODEL="${QWEN_VISION_MODEL:-${QWEN_MODEL:-qwen3.6:27b-q8_0}}"
QWEN_VISION_BASE_URL="${QWEN_VISION_BASE_URL:-http://localhost:11434/v1}"
QWEN_VISION_API_KEY="${QWEN_VISION_API_KEY:-ollama}"
QWEN_VISION_TIMEOUT="${QWEN_VISION_TIMEOUT:-900}"
QWEN_OPENAI_LOGGING="${QWEN_OPENAI_LOGGING:-1}"
QWEN_VISION_OPENAI_LOGGING="${QWEN_VISION_OPENAI_LOGGING:-0}"
PIPELINE_LOCAL_CHECKS="${PIPELINE_LOCAL_CHECKS:-1}" # run deterministic checks while screenshots/server startup happen
PIPELINE_CHECK_CWD="${PIPELINE_CHECK_CWD:-game}"
PIPELINE_CHECK_COMMAND="${PIPELINE_CHECK_COMMAND:-pnpm test -- --coverage.enabled=false}"
PIPELINE_SERVER_TIMEOUT="${PIPELINE_SERVER_TIMEOUT:-300}"
PIPELINE_CLIENT_TIMEOUT="${PIPELINE_CLIENT_TIMEOUT:-120}"
PIPELINE_CHECK_TIMEOUT="${PIPELINE_CHECK_TIMEOUT:-$((PIPELINE_SERVER_TIMEOUT + PIPELINE_CLIENT_TIMEOUT))}"
PIPELINE_COVERAGE_ENABLED="${PIPELINE_COVERAGE_ENABLED:-1}" # run coverage on changed files before top-level review
PIPELINE_COVERAGE_TIMEOUT="${PIPELINE_COVERAGE_TIMEOUT:-120}"
# HARNESS_BROAD_PORT_KILL=1 restores legacy fuser -k cleanup on game ports
# 5173/3000. Default 0 limits kills to harness-started game/server + vite
# processes (or tracked GAME_PIDS) so unrelated local dev servers survive.
HARNESS_BROAD_PORT_KILL="${HARNESS_BROAD_PORT_KILL:-0}"

# --- Live runtime overrides ---
# Optional file sourced AFTER the default-assignment block above so its values
# WIN over the `${X:-default}` defaults. Lets a long-running supervisor swap
# tunables (IMPL_MODEL, MAX_ITER, *_TIMEOUT, …) between iterations without a
# restart: edit the file, the next `bash run_ticket.sh` / `bash run_subtask.sh`
# re-sources lib.sh and picks up the new values. Missing file is the normal
# case — do not create it just to record defaults. Path can be overridden via
# the RUNTIME_ENV env var if you want a per-experiment override file.
RUNTIME_ENV="${RUNTIME_ENV:-$HARNESS_DIR/tmp/runtime.env}"
if [ -f "$RUNTIME_ENV" ]; then
  # shellcheck disable=SC1090
  source "$RUNTIME_ENV"
fi

# Exit-code convention used across run_*.sh:
#   0 = passed   1 = genuine task failure   2 = harness/tool failure (escalate)

# --- Progress stream events (best-effort, never affects harness control flow) ---
json_string() {  # json_string <value>
  node -e 'process.stdout.write(JSON.stringify(process.argv[1] ?? ""))' "$1" 2>/dev/null || printf '""'
}

emit_progress_event() {  # emit_progress_event <type> [payload-json]
  [ "${PROGRESS_EVENTS:-1}" = "0" ] && return 0
  local type="$1" payload="${2:-{}}" ts line dir="$HARNESS_DIR/progress"
  ts="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  mkdir -p "$dir" 2>/dev/null || return 0
  line="$(printf '{"ts":%s,"type":%s,"payload":%s}' "$(json_string "$ts")" "$(json_string "$type")" "$payload")"
  if [ -s "$dir/events.ndjson" ] && [ -n "$(tail -c 1 "$dir/events.ndjson" 2>/dev/null)" ]; then
    printf '\n' >> "$dir/events.ndjson" 2>/dev/null || true
  fi
  printf '%s\n' "$line" >> "$dir/events.ndjson" 2>/dev/null || true
  if [ -n "${PROGRESS_SERVER_URL:-}" ]; then
    curl -sS -X POST -H 'content-type: application/json' --data-binary "$line" "$PROGRESS_SERVER_URL/events" >/dev/null 2>&1 || true
  fi
  return 0
}

# --- Logging ---
log() { echo "[$(date '+%F %T')] $*"; }

# --- Game process control ---
GAME_PIDS=()
# port_in_use <port> — returns 0 if any TCP socket (LISTEN, TIME-WAIT, etc.)
# occupies the port.  Uses `ss` which sees kernel-held sockets that `fuser`
# misses after a process is killed.
port_in_use() {  # port_in_use <port>
  ss -tlnp "sport = :$1" 2>/dev/null | grep -qv '^State'
}

# pids_on_port <port> — prints unique PIDs listening on the port (one per line).
pids_on_port() {  # pids_on_port <port>
  ss -tlnp "sport = :$1" 2>/dev/null \
    | grep -oE 'pid=[0-9]+' \
    | sed 's/pid=//' \
    | sort -u
}

# pid_cmdline <pid> — prints the process command line (empty on failure).
pid_cmdline() {  # pid_cmdline <pid>
  local pid="$1"
  [ -r "/proc/$pid/cmdline" ] || return 1
  tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null | sed 's/ $//'
}

# cmdline_is_harness_game <cmdline> <port> — true when cmdline matches a
# harness-managed game server (3000) or vite client (5173). Uses anchored
# patterns first; broader fallbacks mirror start_game/stop_game pkill rules.
cmdline_is_harness_game() {  # cmdline_is_harness_game <cmdline> <port>
  local cmdline="$1" port="$2"
  [ -n "$cmdline" ] || return 1
  case "$port" in
    5173)
      printf '%s\n' "$cmdline" | grep -qE '(^|[[:space:]])vite[[:space:]]+--port[[:space:]]+5173($|[[:space:]])|vite.*--port.*5173'
      ;;
    3000)
      printf '%s\n' "$cmdline" | grep -qE '(^|[[:space:]])node[[:space:]]+game/server/index\.js($|[[:space:]])|node.*game/server/index'
      ;;
    *)
      return 1
      ;;
  esac
}

# pid_is_tracked_game <pid> — true when pid was started by this harness session.
pid_is_tracked_game() {  # pid_is_tracked_game <pid>
  local target="$1" p
  for p in "${GAME_PIDS[@]:-}"; do
    [ "$p" = "$target" ] && return 0
  done
  return 1
}

# log_port_blockers <port> — describe processes still holding the port.
log_port_blockers() {  # log_port_blockers <port>
  local port="$1" pid cmdline
  port_in_use "$port" || return 0
  log "[port] :$port still bound — blockers:"
  while IFS= read -r pid; do
    [ -n "$pid" ] || continue
    cmdline="$(pid_cmdline "$pid" 2>/dev/null || true)"
    log "[port]   pid $pid: ${cmdline:-<unknown>}"
  done < <(pids_on_port "$port")
  if [ "${HARNESS_BROAD_PORT_KILL:-0}" != "1" ]; then
    log "[port] Set HARNESS_BROAD_PORT_KILL=1 to force-kill any process on :$port (dangerous on shared machines)."
  fi
}

# cleanup_port <port> — stop harness-owned holders; broad fuser kill is opt-in.
cleanup_port() {  # cleanup_port <port>
  local port="$1" pid cmdline
  case "$port" in
    5173)
      pkill -9 -f '(^|[[:space:]])vite[[:space:]]+--port[[:space:]]+5173($|[[:space:]])' 2>/dev/null || true
      pkill -9 -f 'vite.*--port.*5173' 2>/dev/null || true
      ;;
    3000)
      pkill -9 -f '(^|[[:space:]])node[[:space:]]+game/server/index\.js($|[[:space:]])' 2>/dev/null || true
      pkill -9 -f 'node.*game/server/index' 2>/dev/null || true
      ;;
  esac
  while IFS= read -r pid; do
    [ -n "$pid" ] || continue
    cmdline="$(pid_cmdline "$pid" 2>/dev/null || true)"
    if pid_is_tracked_game "$pid" || cmdline_is_harness_game "$cmdline" "$port"; then
      log "[port] stopping harness-owned pid $pid on :$port (${cmdline:-unknown})"
      kill -9 "$pid" 2>/dev/null || true
    fi
  done < <(pids_on_port "$port")
  if [ "${HARNESS_BROAD_PORT_KILL:-0}" = "1" ]; then
    fuser -k -9 "$port"/tcp 2>/dev/null || true
  fi
}

# wait_port_free <port> [timeout-seconds] — blocks until the TCP port is no
# longer bound (including TIME-WAIT).  Returns 0 on success, 1 on timeout.
wait_port_free() {  # wait_port_free <port> [timeout-seconds]
  local port="$1" deadline=$(( $(date +%s) + ${2:-15} ))
  while [ "$(date +%s)" -lt "$deadline" ]; do
    port_in_use "$port" || return 0
    cleanup_port "$port"
    sleep 0.2
  done
  log_port_blockers "$port"
  return 1
}

start_game() {  # start_game <logdir>
  local logdir="$1"
  emit_progress_event "game_start" "{\"logdir\":$(json_string "$logdir")}"

  # --- Port cleanup: prefer harness-owned processes; broad kill is opt-in ---
  cleanup_port 5173
  cleanup_port 3000

  # Block until ports are actually free (kernel releases the socket).
  # Uses `ss` to detect TIME-WAIT sockets that `fuser` cannot see — this is
  # the critical fix for EADDRINUSE after process kill.
  wait_port_free 5173 15 || log "[warn] port 5173 still bound after 15s"
  wait_port_free 3000 15 || log "[warn] port 3000 still bound after 15s"

  # --- Launch dev servers (with retry on EADDRINUSE) ---
  ( node game/server/index.js ) </dev/null >"$logdir/server.log" 2>&1 &
  GAME_PIDS+=("$!")

  # Retry Vite up to 3 times if the port is still occupied at bind time.
  local vite_started=0
  local attempt=0
  while [ $vite_started -eq 0 ] && [ $attempt -lt 3 ]; do
    attempt=$((attempt + 1))
    ( cd game/client && npx vite --port 5173 --strictPort ) </dev/null >"$logdir/client.log" 2>&1 &
    GAME_PIDS+=("$!")
    # Wait for Vite to either bind successfully or fail.
    sleep 3
    if grep -q 'EADDRINUSE\|already in use' "$logdir/client.log" 2>/dev/null; then
      log "[warn] Vite EADDRINUSE on attempt $attempt — retrying after harness port cleanup"
      kill "${GAME_PIDS[-1]}" 2>/dev/null || true
      GAME_PIDS=("${GAME_PIDS[@]:0:${#GAME_PIDS[@]}-1}")
      cleanup_port 5173
      wait_port_free 5173 10 || log "[warn] port 5173 still bound after EADDRINUSE cleanup"
    else
      vite_started=1
    fi
  done
  [ $vite_started -eq 1 ] || log "[error] Vite failed to start after 3 attempts"
}

stop_game() {
  local p
  emit_progress_event "game_stop" "{}"
  for p in "${GAME_PIDS[@]:-}"; do
    [ -n "$p" ] && kill "$p" 2>/dev/null
  done
  GAME_PIDS=()
  # Keep cleanup patterns anchored to real process command lines. Agent prompts
  # mention these commands verbatim, so broad pkill -f patterns can kill Qwen.
  pkill -f '(^|[[:space:]])node[[:space:]]+game/server/index\.js($|[[:space:]])' 2>/dev/null
  pkill -f '(^|[[:space:]])vite[[:space:]]+--port[[:space:]]+5173($|[[:space:]])' 2>/dev/null
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

# game_smoke_status <artifacts_dir> — prints "ok" or a machine-readable reason.
# Used by the baseline-protection gate: the harness must never advance the
# backlog on top of a game that does not run, but it must also not revert on
# teardown noise. Only explicit failure signals count.
game_smoke_status() {  # game_smoke_status <artifacts_dir>
  local d="$1"
  [ -f "$d/metrics.json" ] || { echo "missing_metrics"; return 1; }
  local metrics_reason
  metrics_reason="$(node - "$d/metrics.json" <<'NODE' 2>/dev/null
const { readFileSync } = require('node:fs');
try {
  const metrics = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  if (metrics.ok === false) {
    console.log(metrics.error === 'servers did not start' ? 'servers_did_not_start' : 'metrics_not_ok');
    process.exit(1);
  }
  if (String(metrics.error || '').includes('servers did not start')) {
    console.log('servers_did_not_start');
    process.exit(1);
  }
  console.log('ok');
} catch {
  console.log('metrics_unreadable');
  process.exit(1);
}
NODE
  )" || { echo "${metrics_reason:-metrics_unreadable}"; return 1; }
  [ "$metrics_reason" = "ok" ] || { echo "$metrics_reason"; return 1; }
  if [ -f "$d/console.log" ] && grep -qE '\[[A-Z]:pageerror\]|\[fatal\]' "$d/console.log"; then
    echo "console_pageerror_or_fatal"
    return 1
  fi
  echo "ok"
  return 0
}

# game_smoke_ok <artifacts_dir> — 0 if a captured run shows a RUNNABLE game,
# 1 if it is broken.
game_smoke_ok() {  # game_smoke_ok <artifacts_dir>
  [ "$(game_smoke_status "$1" 2>/dev/null)" = "ok" ]
}

game_smoke_reason() {  # game_smoke_reason <artifacts_dir>
  game_smoke_status "$1" 2>/dev/null || true
}

confirm_game_broken() {  # confirm_game_broken <suspect-artifacts-dir> <confirmation-dir>
  local suspect="$1" confirm_dir="$2" reason confirm_reason
  reason="$(game_smoke_reason "$suspect")"
  log "[gate] suspect smoke failed: ${reason:-unknown} ($suspect)"
  log "[gate] recapturing once before treating the game as broken..."
  capture_run "$confirm_dir"
  if game_smoke_ok "$confirm_dir"; then
    log "[gate] confirmation smoke passed — treating prior failure as transient harness noise"
    return 1
  fi
  confirm_reason="$(game_smoke_reason "$confirm_dir")"
  log "[gate] confirmation smoke also failed: ${confirm_reason:-unknown} ($confirm_dir)"
  return 0
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
cli_failure_reason() {  # cli_failure_reason <rc> <outfile>
  local rc="$1" out="$2"
  if [ "$rc" -eq 124 ]; then
    echo "timeout"
  elif [ "$rc" -eq 137 ]; then
    echo "killed_after_timeout"
  elif [ "$rc" -eq 143 ]; then
    echo "terminated_by_signal"
  elif [ ! -s "$out" ]; then
    echo "empty_output"
  elif cli_output_has_quota_error "$out" && ! has_verdict "$out"; then
    echo "quota_or_rate_limit"
  elif cli_output_is_only_error "$out"; then
    echo "api_error_only_output"
  else
    echo "exit_$rc"
  fi
}

cli_output_is_only_error() {  # cli_output_is_only_error <outfile>
  local out="$1"
  [ -s "$out" ] || return 1
  node - "$out" <<'NODE' 2>/dev/null
const { readFileSync } = require('node:fs');
const text = readFileSync(process.argv[2], 'utf8').trim();
if (!text) process.exit(1);
const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
const errorOnly = lines.length > 0 && lines.every(line =>
  /^\[API Error:/.test(line) ||
  /^API Error:/.test(line) ||
  /^Operation cancelled\.$/.test(line) ||
  /^Terminated$/.test(line)
);
process.exit(errorOnly ? 0 : 1);
NODE
}

cli_output_has_quota_error() {  # cli_output_has_quota_error <outfile>
  local out="$1"
  [ -s "$out" ] || return 1
  node - "$out" <<'NODE' 2>/dev/null
const { readFileSync } = require('node:fs');
const text = readFileSync(process.argv[2], 'utf8').toLowerCase();
// Match ONLY a TERMINAL quota-exhaustion message. The gemini CLI's own
// transient "Attempt N failed: ... rate limit ... Retrying" lines recover on
// their own, and bare words like "quota" / "429" / "rate limit" also appear
// legitimately in an agent's review of the code — matching those falsely
// kills a perfectly healthy gemini run. A terminal signal means gemini has
// actually given up on the model.
const terminal = text.split(/\r?\n/).some(line => {
  const l = line.trim();
  if (/attempt\s+\d+\s+failed/.test(l) && /retry/.test(l)) return false;
  return l.includes('exhausted your capacity on this model')
      || l.includes('quota will reset after');
});
process.exit(terminal ? 0 : 1);
NODE
}

filter_agent_feedback_noise() {  # filter_agent_feedback_noise <outfile>
  local out="$1"
  if [ ! -s "$out" ]; then
    return 0
  fi
  node - "$out" <<'NODE' 2>/dev/null || cat "$out"
const { readFileSync } = require('node:fs');
const text = readFileSync(process.argv[2], 'utf8');
const noisy = [
  /^YOLO mode is enabled\./,
  /^Ripgrep is not available\./,
  /^Attempt \d+ failed: .*?(exhausted your capacity|quota|rate limit|resource has been exhausted|too many requests|429).*?Retrying after/i,
  /^You have exhausted your capacity on this model\./i,
  /^.*quota will reset after .*$/i,
];
const lines = text.split(/\r?\n/);
const filtered = lines.filter(line => !noisy.some(pattern => pattern.test(line.trim())));
const output = filtered.join('\n').replace(/\n{3,}/g, '\n\n').trim();
if (output) {
  process.stdout.write(`${output}\n`);
} else {
  process.stdout.write('[agent output contained only transient tool/quota noise; see raw artifact]\n');
}
NODE
}

agent_bucket_for_label() {  # agent_bucket_for_label <label>
  case "$1" in
    qwen|qwen-vision) echo "local" ;;
    *) echo "remote" ;;
  esac
}

agent_model_for_label() {  # agent_model_for_label <label>
  case "$1" in
    qwen) echo "${QWEN_MODEL:-default}" ;;
    qwen-vision) echo "${QWEN_VISION_MODEL:-default}" ;;
    gemini) echo "${GEMINI_MODEL:-default}" ;;
    claude) echo "${CLAUDE_MODEL:-default}" ;;
    agent) echo "${AGENT_MODEL:-default}" ;;
    agent/*) echo "${1#agent/}" ;;
    composer/*) echo "${1#composer/}" ;;
    agy) echo "${AGY_MODEL_LABEL:-default}" ;;
    *) echo "default" ;;
  esac
}

# ticket_difficulty <ticket.md> — prints easy|medium|hard, or empty if unset.
ticket_difficulty() {
  local ticket_file="$1"
  grep -ioE '^## Difficulty: *(easy|medium|hard)' "$ticket_file" 2>/dev/null \
    | grep -ioE 'easy|medium|hard' | head -1 | tr 'A-Z' 'a-z'
}

# review_agent_for_difficulty <easy|medium|hard> — label used in logs/progress (composer/… or agent/…).
review_agent_for_difficulty() {
  case "$1" in
    easy) echo "composer/$REVIEW_EASY_MODEL" ;;
    hard) echo "agent/$REVIEW_HARD_MODEL" ;;
    *) echo "agent/$REVIEW_MEDIUM_MODEL" ;;
  esac
}

record_agent_usage() {  # record_agent_usage <label> <outfile> <attempt> <rc> <status> <reason> <started-ms> <ended-ms> <prompt>
  local label="$1" out="$2" attempt="$3" rc="$4" status="$5" reason="$6" started_ms="$7" ended_ms="$8" prompt="$9"
  local model bucket out_dir usage_file payload
  model="$(agent_model_for_label "$label")"
  bucket="$(agent_bucket_for_label "$label")"
  out_dir="$(dirname "$out")"
  usage_file="$out_dir/agent-usage.ndjson"
  mkdir -p "$out_dir" 2>/dev/null || true

  payload="$(
    node - "$label" "$model" "$bucket" "$attempt" "$rc" "$status" "$reason" "$started_ms" "$ended_ms" "${#prompt}" "$out" <<'NODE'
const { existsSync, readFileSync, readdirSync, statSync } = require('node:fs');
const { dirname, join } = require('node:path');

const [
  agent,
  model,
  bucket,
  attemptRaw,
  rcRaw,
  status,
  reason,
  startedRaw,
  endedRaw,
  promptCharsRaw,
  outfile,
] = process.argv.slice(2);

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function tokenEstimateFromChars(chars) {
  const n = Number(chars);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.max(1, Math.ceil(n / 4));
}

function firstNumber(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return Number(match[1]);
  }
  return null;
}

function usageFromText(text) {
  if (!text) return {};
  return {
    inputTokens: firstNumber(text, [
      /"prompt_tokens"\s*:\s*(\d+)/i,
      /"input_tokens"\s*:\s*(\d+)/i,
      /"promptTokenCount"\s*:\s*(\d+)/i,
      /"inputTokenCount"\s*:\s*(\d+)/i,
      /\b(?:prompt|input)[ _-]?tokens?\b\s*[:=]\s*(\d+)/i,
    ]),
    outputTokens: firstNumber(text, [
      /"completion_tokens"\s*:\s*(\d+)/i,
      /"output_tokens"\s*:\s*(\d+)/i,
      /"candidatesTokenCount"\s*:\s*(\d+)/i,
      /"outputTokenCount"\s*:\s*(\d+)/i,
      /\b(?:completion|output|candidate)[ _-]?tokens?\b\s*[:=]\s*(\d+)/i,
    ]),
    totalTokens: firstNumber(text, [
      /"total_tokens"\s*:\s*(\d+)/i,
      /"totalTokenCount"\s*:\s*(\d+)/i,
      /\btotal[ _-]?tokens?\b\s*[:=]\s*(\d+)/i,
    ]),
  };
}

function mergeUsage(target, next) {
  for (const key of ['inputTokens', 'outputTokens', 'totalTokens']) {
    if (Number.isFinite(next[key])) target[key] = next[key];
  }
}

function collectJsonUsage(value, target) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) collectJsonUsage(item, target);
    return;
  }
  for (const [rawKey, rawValue] of Object.entries(value)) {
    const key = rawKey.toLowerCase();
    if (Number.isFinite(rawValue)) {
      if ((key.includes('prompt') || key.includes('input')) && key.includes('token')) {
        target.inputTokens = rawValue;
      } else if ((key.includes('completion') || key.includes('output') || key.includes('candidate')) && key.includes('token')) {
        target.outputTokens = rawValue;
      } else if (key.includes('total') && key.includes('token')) {
        target.totalTokens = rawValue;
      }
    }
    collectJsonUsage(rawValue, target);
  }
}

function scanUsageFile(file, target) {
  let text = '';
  try {
    const st = statSync(file);
    if (!st.isFile() || st.size > 1024 * 1024) return;
    text = readFileSync(file, 'utf8');
  } catch {
    return;
  }
  mergeUsage(target, usageFromText(text));
  try {
    collectJsonUsage(JSON.parse(text), target);
  } catch {
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim().startsWith('{')) continue;
      try {
        collectJsonUsage(JSON.parse(line), target);
      } catch {
        // Ignore non-JSON log lines.
      }
    }
  }
}

function scanUsageDir(dir, target, remaining = { count: 120 }) {
  if (!existsSync(dir) || remaining.count <= 0) return;
  let entries = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (remaining.count <= 0) return;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      scanUsageDir(path, target, remaining);
    } else {
      remaining.count -= 1;
      scanUsageFile(path, target);
    }
  }
}

function parseHumanDuration(label) {
  const s = String(label || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!s) return null;
  let m = s.match(/^([\d.]+)\s*ms$/);
  if (m) return Math.max(0, Math.round(Number(m[1])));
  m = s.match(/^([\d.]+)\s*s$/);
  if (m) return Math.max(0, Math.round(Number(m[1]) * 1000));
  m = s.match(/^(\d+)\s*h(?:\s+(\d+)\s*m)?$/);
  if (m) return (Number(m[1]) * 3600 + (Number(m[2]) || 0) * 60) * 1000;
  m = s.match(/^(\d+)\s*m(?:\s+(\d+)\s*s)?$/);
  if (m) return (Number(m[1]) * 60 + (Number(m[2]) || 0)) * 1000;
  return null;
}

function qwenSessionStatsFromOutput(text) {
  if (!text || !text.includes('Task Completed')) return null;
  const durationMatch = text.match(/Duration:\s*([^|\n]+)/i);
  const wallMs = durationMatch ? parseHumanDuration(durationMatch[1].trim()) : null;
  const tokensMatch = text.match(/Tokens:\s*([\d,]+)/i);
  const summaryTokens = tokensMatch ? Number(tokensMatch[1].replace(/,/g, '')) : null;
  let toolMs = 0;
  const toolSection = text.split(/Top tools:/i)[1];
  if (toolSection) {
    for (const line of toolSection.split('\n').slice(0, 16)) {
      if (!/^\s*-\s+/.test(line)) break;
      const m = line.match(/:\s*(\d+)\s+calls\b[^]*?\bavg\s+([\d.]+\s*(?:ms|s)|\d+\s*m(?:\s+\d+\s*s)?)/i);
      if (!m) continue;
      const count = Number(m[1]);
      const avgMs = parseHumanDuration(m[2].trim());
      if (count > 0 && avgMs > 0) toolMs += count * avgMs;
    }
  }
  return {
    wallMs: Number.isFinite(wallMs) ? wallMs : null,
    toolMs: toolMs > 0 ? Math.round(toolMs) : 0,
    summaryTokens: Number.isFinite(summaryTokens) ? summaryTokens : null,
    hasSummary: true,
  };
}

function collectOpenaiLogTimestamps(dir, times, remaining = { count: 120 }) {
  if (!existsSync(dir) || remaining.count <= 0) return;
  let entries = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (remaining.count <= 0) return;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectOpenaiLogTimestamps(path, times, remaining);
      continue;
    }
    if (!entry.name.startsWith('openai-') || !entry.name.endsWith('.json')) continue;
    remaining.count -= 1;
    try {
      const st = statSync(path);
      if (!st.isFile() || st.size > 1024 * 1024) continue;
      const data = JSON.parse(readFileSync(path, 'utf8'));
      const ts = Date.parse(data.timestamp);
      if (Number.isFinite(ts)) times.push(ts);
    } catch {
      // Ignore unreadable log files.
    }
  }
}

function toolMsFromOpenaiLogGaps(dir) {
  const times = [];
  collectOpenaiLogTimestamps(dir, times);
  if (times.length < 2) return 0;
  times.sort((a, b) => a - b);
  let gapMs = 0;
  for (let i = 1; i < times.length; i += 1) {
    gapMs += Math.max(0, times[i] - times[i - 1]);
  }
  return Math.round(gapMs);
}

let outputText = '';
try {
  outputText = readFileSync(outfile, 'utf8');
} catch {
  outputText = '';
}

const usage = usageFromText(outputText);
const outputDir = dirname(outfile);
scanUsageDir(join(outputDir, 'qwen-openai-logs'), usage);
scanUsageDir(join(outputDir, 'openai-logs'), usage);

let inputTokens = Number.isFinite(usage.inputTokens) ? usage.inputTokens : null;
let outputTokens = Number.isFinite(usage.outputTokens) ? usage.outputTokens : null;
let totalTokens = Number.isFinite(usage.totalTokens) ? usage.totalTokens : null;
const hasExactUsage = inputTokens !== null || outputTokens !== null || totalTokens !== null;

if (!hasExactUsage) {
  inputTokens = tokenEstimateFromChars(promptCharsRaw);
  outputTokens = tokenEstimateFromChars(outputText.trim().length);
  totalTokens = inputTokens + outputTokens;
}

if (totalTokens === null && inputTokens !== null && outputTokens !== null) {
  totalTokens = inputTokens + outputTokens;
}

const startedAtMs = toNumber(startedRaw);
const endedAtMs = toNumber(endedRaw);
const usageKind = process.env.HARNESS_USAGE_KIND || null;
const isQwen = /^qwen(?:-|$)/i.test(agent);
let wallDurationMs = startedAtMs !== null && endedAtMs !== null ? Math.max(0, endedAtMs - startedAtMs) : null;
let toolDurationMs = null;
let modelDurationMs = null;
let tokensPerSecond = null;

if (isQwen) {
  const qwenStats = qwenSessionStatsFromOutput(outputText);
  const logToolMs = toolMsFromOpenaiLogGaps(join(outputDir, 'qwen-openai-logs'));
  if (qwenStats?.wallMs) wallDurationMs = qwenStats.wallMs;
  const parsedToolMs = qwenStats?.toolMs || 0;
  const toolMs = Math.max(parsedToolMs, logToolMs || 0);
  if (toolMs > 0) toolDurationMs = toolMs;
  if (wallDurationMs && wallDurationMs > 0) {
    modelDurationMs = Math.max(1000, wallDurationMs - toolMs);
  }
  if (qwenStats?.summaryTokens && qwenStats.summaryTokens > 0) {
    totalTokens = qwenStats.summaryTokens;
  }
  if (modelDurationMs && totalTokens) {
    tokensPerSecond = totalTokens / (modelDurationMs / 1000);
  }
}

const usagePayload = {
  key: `${outfile}#${attemptRaw}`,
  agent,
  model: model || null,
  bucket,
  usageKind,
  outfile,
  attempt: Number(attemptRaw) || 0,
  rc: Number(rcRaw) || 0,
  status,
  reason: reason || null,
  startedAtMs,
  endedAtMs,
  durationMs: wallDurationMs,
  wallDurationMs,
  toolDurationMs,
  modelDurationMs,
  tokensPerSecond,
  inputTokens,
  outputTokens,
  totalTokens: totalTokens || 0,
  estimated: !hasExactUsage,
  source: hasExactUsage ? 'cli_usage' : 'per_call_estimate',
};

process.stdout.write(JSON.stringify(usagePayload));
NODE
  )" || return 0

  [ -n "$payload" ] || return 0
  printf '%s\n' "$payload" >> "$usage_file" 2>/dev/null || true
  emit_progress_event "agent_usage" "$payload"
}

_run_cli() {
  local label="$1" out="$2" tmo="$3" prompt="$4"; shift 4
  local attempt=1 rc reason cli_pid quota_seen_at quota_fast_failed now started_ms ended_ms
  local quota_fast_fail_seconds="${GEMINI_QUOTA_FAST_FAIL_SECONDS:-12}"
  # Per-label retry budget. gemini and agy have none on purpose: when the
  # primary QA call fails (timeout, empty output, generic error), run_subtask's
  # tier chain (cursor-agent -> agy -> qwen-self -> claude) *is* the retry.
  # Burning ~31 min (3 × 600s + 2 × 20s backoff) on the same broken cloud-QA
  # call before falling through to the next tier is dead wall-clock.
  local max_retries
  case "$label" in
    gemini|agy) max_retries=0 ;;
    *)          max_retries="$CLI_RETRIES" ;;
  esac
  while :; do
    started_ms="$(date +%s%3N 2>/dev/null || date +%s000)"
    emit_progress_event "agent_start" "{\"agent\":$(json_string "$label"),\"outfile\":$(json_string "$out"),\"attempt\":$attempt,\"timeoutSeconds\":$tmo}"
    # </dev/null: a CLI that reads stdin (gemini -p does) must NOT inherit the
    #   harness's TTY — a backgrounded process reading a TTY gets SIGTTIN and
    #   hangs in stopped state. -k 30: SIGKILL 30s after the SIGTERM so a wedged
    #   or stopped process is always reaped (rc 124 = SIGTERM'd, 137 = SIGKILL'd).
    : >"$out"
    timeout -k 30 "$tmo" "$@" </dev/null >"$out" 2>&1 &
    cli_pid=$!
    quota_seen_at=0
    quota_fast_failed=0
    while kill -0 "$cli_pid" 2>/dev/null; do
      if [ "$label" = "gemini" ] && [ "$GEMINI_QUOTA_FAST_FAIL" = "1" ] &&
          cli_output_has_quota_error "$out" && ! has_verdict "$out"; then
        now="$(date +%s)"
        [ "$quota_seen_at" -eq 0 ] && quota_seen_at="$now"
        if [ $((now - quota_seen_at)) -ge "$quota_fast_fail_seconds" ]; then
          log "[tool-fallback] gemini quota/rate limit detected — falling back to cursor-agent/$AGENT_MODEL"
          kill "$cli_pid" 2>/dev/null || true
          wait "$cli_pid" 2>/dev/null || true
          rc=75
          quota_fast_failed=1
          break
        fi
      fi
      sleep 1
    done
    if [ "$quota_fast_failed" -ne 1 ]; then
      wait "$cli_pid"; rc=$?
    fi
    ended_ms="$(date +%s%3N 2>/dev/null || date +%s000)"
    if [ "$rc" -ne 124 ] && [ "$rc" -ne 137 ] && [ -s "$out" ] &&
        ! cli_output_is_only_error "$out" &&
        { [ "$label" != "gemini" ] || ! cli_output_has_quota_error "$out" || has_verdict "$out"; }; then
      record_agent_usage "$label" "$out" "$attempt" "$rc" "ok" "" "$started_ms" "$ended_ms" "$prompt"
      emit_progress_event "agent_finish" "{\"agent\":$(json_string "$label"),\"outfile\":$(json_string "$out"),\"attempt\":$attempt,\"rc\":$rc,\"status\":\"ok\"}"
      return 0
    fi
    reason="$(cli_failure_reason "$rc" "$out")"
    if [ "$label" = "gemini" ] && [ "$reason" = "quota_or_rate_limit" ]; then
      if [ "$quota_fast_failed" -ne 1 ]; then
        log "[tool-fallback] gemini unavailable (reason=$reason) — using cursor-agent/$AGENT_MODEL"
      fi
      record_agent_usage "$label" "$out" "$attempt" "$rc" "tool_failure" "$reason" "$started_ms" "$ended_ms" "$prompt"
      emit_progress_event "agent_finish" "{\"agent\":$(json_string "$label"),\"outfile\":$(json_string "$out"),\"attempt\":$attempt,\"rc\":$rc,\"status\":\"tool_failure\",\"reason\":$(json_string "$reason")}"
      return 2
    fi
    if [ "$attempt" -gt "$max_retries" ]; then
      log "[tool-failure] $label failed after $attempt attempts (last rc=$rc, reason=$reason)"
      record_agent_usage "$label" "$out" "$attempt" "$rc" "tool_failure" "$reason" "$started_ms" "$ended_ms" "$prompt"
      emit_progress_event "agent_finish" "{\"agent\":$(json_string "$label"),\"outfile\":$(json_string "$out"),\"attempt\":$attempt,\"rc\":$rc,\"status\":\"tool_failure\",\"reason\":$(json_string "$reason")}"
      return 2
    fi
    log "[tool-retry] $label attempt $attempt failed (rc=$rc, reason=$reason) — backoff ${CLI_RETRY_BACKOFF}s"
    record_agent_usage "$label" "$out" "$attempt" "$rc" "retry" "$reason" "$started_ms" "$ended_ms" "$prompt"
    emit_progress_event "agent_retry" "{\"agent\":$(json_string "$label"),\"outfile\":$(json_string "$out"),\"attempt\":$attempt,\"rc\":$rc,\"reason\":$(json_string "$reason")}"
    sleep "$CLI_RETRY_BACKOFF"
    attempt=$((attempt + 1))
  done
}

# CLI wrappers — all non-interactive / unattended. Return 0 = ok, 2 = tool-failure.
run_qwen() {  # run_qwen <prompt> <outfile>
  local outfile="$2" logdir
  if [ "$QWEN_DISABLED" = "1" ]; then
    # Fast-fail when qwen is intentionally offline (e.g. GPU freed for another
    # workload). Returns the standard tool-failure rc so every chain that
    # currently treats qwen-timeout as "try the next tier" fires immediately.
    mkdir -p "$(dirname "$outfile")" 2>/dev/null || true
    printf '[qwen disabled — QWEN_DISABLED=1]\n' > "$outfile" 2>/dev/null || true
    return 2
  fi
  logdir="$(dirname "$outfile")/qwen-openai-logs"
  mkdir -p "$(dirname "$outfile")" 2>/dev/null || true
  local a=(qwen -y)
  if [ "$QWEN_OPENAI_LOGGING" = "1" ]; then
    a+=(--openai-logging --openai-logging-dir "$logdir")
  fi
  [ -n "$QWEN_MODEL" ] && a+=(-m "$QWEN_MODEL")
  a+=("$1")
  _run_cli qwen "$outfile" "$QWEN_TIMEOUT" "$1" "${a[@]}"
}
write_qwen_vision_settings() {  # write_qwen_vision_settings <settings-file> <mcp-output-dir>
  local settings_file="$1" mcp_output_dir="$2"
  mkdir -p "$(dirname "$settings_file")" "$mcp_output_dir"
  QWEN_VISION_MODEL="$QWEN_VISION_MODEL" \
  QWEN_VISION_BASE_URL="$QWEN_VISION_BASE_URL" \
  QWEN_VISION_API_KEY="$QWEN_VISION_API_KEY" \
  QWEN_VISION_MCP_OUTPUT_DIR="$mcp_output_dir" \
  node - "$settings_file" <<'NODE'
const { writeFileSync } = require('node:fs');

const out = process.argv[2];
const model = process.env.QWEN_VISION_MODEL || 'qwen3.6:27b-q8_0';
const baseUrl = process.env.QWEN_VISION_BASE_URL || 'http://localhost:11434/v1';
const apiKey = process.env.QWEN_VISION_API_KEY || 'ollama';
const outputDir = process.env.QWEN_VISION_MCP_OUTPUT_DIR;

const config = {
  env: { OLLAMA_API_KEY: apiKey },
  model: {
    name: model,
    generationConfig: {
      contextWindowSize: 131072,
      modalities: { image: true },
      splitToolMedia: true,
      samplingParams: { temperature: 0.2, top_p: 0.95 },
    },
  },
  modelProviders: {
    openai: [{
      id: model,
      name: `${model} local vision`,
      envKey: 'OLLAMA_API_KEY',
      baseUrl,
      generationConfig: {
        contextWindowSize: 131072,
        modalities: { image: true },
        splitToolMedia: true,
        samplingParams: { temperature: 0.2, top_p: 0.95 },
      },
    }],
  },
  mcpServers: {
    playwright: {
      command: 'npx',
      args: ['-y', '@playwright/mcp', '--headless', '--isolated', '--caps', 'vision', '--output-dir', outputDir],
      trust: true,
      timeout: 30000,
    },
  },
  mcp: { allowed: ['playwright'] },
  $version: 4,
};

writeFileSync(out, `${JSON.stringify(config, null, 2)}\n`);
NODE
}
run_qwen_vision() {  # run_qwen_vision <prompt> <outfile> <artifacts-dir>
  local prompt="$1" out="$2" artifacts_dir="$3"
  if [ "$QWEN_DISABLED" = "1" ]; then
    mkdir -p "$artifacts_dir" 2>/dev/null || true
    printf '[qwen vision disabled — QWEN_DISABLED=1]\n' > "$out" 2>/dev/null || true
    return 2
  fi
  local settings_file="$artifacts_dir/qwen-vision-settings.json"
  local mcp_output_dir="$artifacts_dir/qwen-vision-mcp"
  write_qwen_vision_settings "$settings_file" "$mcp_output_dir" || return 2
  local a=(env QWEN_CODE_SYSTEM_SETTINGS_PATH="$settings_file" qwen -y -p "$prompt")
  if [ "$QWEN_VISION_OPENAI_LOGGING" = "1" ]; then
    a+=(--openai-logging --openai-logging-dir "$artifacts_dir/qwen-openai-logs")
  fi
  _run_cli qwen-vision "$out" "$QWEN_VISION_TIMEOUT" "$prompt" "${a[@]}"
}
run_gemini() {  # run_gemini <prompt> <outfile>
  local a=(gemini -y --skip-trust); [ -n "$GEMINI_MODEL" ] && a+=(-m "$GEMINI_MODEL"); a+=(-p "$1")
  _run_cli gemini "$2" "$GEMINI_TIMEOUT" "$1" "${a[@]}"
}
run_agent() {  # run_agent <prompt> <outfile> — cursor-agent, QA fallback
  run_agent_model "${AGENT_MODEL:-composer-2.5-fast}" "$1" "$2"
}
run_agent_model() {  # run_agent_model <model> <prompt> <outfile> — cursor-agent QA / read-only
  local model="$1" prompt="$2" out="$3"
  local a=(agent -p --force --trust --mode ask --model "$model")
  a+=("$prompt")
  _run_cli "agent/$model" "$out" "$AGENT_TIMEOUT" "$prompt" "${a[@]}"
}
# Writable variant for TOP-LEVEL REVIEWERS ONLY (composer-2.5 / gpt-5.5-*).
# The review.md prompt asks the agent to write review.md / gaps.md / nits.md
# to specific paths; under `--mode ask` it cannot, and silently falls back to
# printing the contents as chat — which the harness then has to recover via
# qwen_extract_review_files (~72s) or the awk extractor. Dropping `--mode
# ask` here so the agent has its full toolset is the happy path: the agent
# writes the three files directly, the harness picks them up, and round
# N+1's decomposer reads gaps.md without any recovery hop.
#
# TRUST CAVEAT: a reviewer in this mode CAN write anywhere the harness can.
# That includes game/, harness/, and the git index. The mitigating factors
# are (1) the prompt explicitly tells it to write ONLY the three target
# files and forbids editing game/ or harness/, (2) the harness's
# recover_review_files() is still wired up as a safety net for the case
# where a reviewer DOES revert to chat-only output, and (3) the next round
# would catch any reviewer-driven game/ edits via git diff. We accept the
# residual risk in exchange for skipping the recovery hop on the happy path.
# This is for REVIEW callers only — keep QA chains on read-only
# run_agent_model so a QA agent never accidentally edits the code it judges.
run_agent_model_writable() {  # run_agent_model_writable <model> <prompt> <outfile>
  local model="$1" prompt="$2" out="$3"
  local a=(agent -p --force --trust --model "$model")
  a+=("$prompt")
  HARNESS_USAGE_KIND=final_review _run_cli "agent/$model" "$out" "$AGENT_TIMEOUT" "$prompt" "${a[@]}"
}

# Sub-ticket IMPLEMENTER dispatcher. Selected by $IMPL_MODEL (see top of file).
# Empty -> qwen (legacy default). Any non-empty value routes through cursor-agent
# in writable mode so the implementer can actually edit files. Logs under
# `impl/<model>` so progress UI can tell qwen-impl runs apart from cursor-impl
# runs without scraping the wrapper's chosen output filename.
run_impl() {  # run_impl <prompt> <outfile>
  local prompt="$1" out="$2"
  if [ -z "$IMPL_MODEL" ]; then
    run_qwen "$prompt" "$out"
    return $?
  fi
  local a=(agent -p --force --trust --model "$IMPL_MODEL")
  a+=("$prompt")
  HARNESS_USAGE_KIND=implementer \
    _run_cli "impl/$IMPL_MODEL" "$out" "$IMPL_TIMEOUT" "$prompt" "${a[@]}"
}

# Recover a "write this file" block from a reviewer transcript when the agent
# ran in a read-only mode and printed the content as chat instead of writing
# it to disk. The review.md prompt tells the agent to write review.md/gaps.md/
# nits.md to specific paths; cursor-agent's `--mode ask` is read-only and the
# observed fallback pattern (across composer-2.5 and gpt-5.5-extra-high) is to
# emit each file as a fenced markdown block preceded by a marker line that
# contains the filename in backticks, e.g.
#
#     `gaps.md` content:
#
#     ```markdown
#     ...file body...
#     ```
#
# or as a markdown heading like `## gaps.md` or `## \`gaps.md\``. Both shapes
# are recognised: the first target filename marker "arms" the extractor, the
# next fenced block (delimited by lines starting with ```) is captured, the
# opening fence's language tag is stripped, and the body is printed to stdout.
# Returns the empty string if no marker / no fenced block is found.
extract_file_block() {  # extract_file_block <transcript> <target-file>
  awk -v target="$2" '
    function trim(s) {
      sub(/^[[:space:]]+/, "", s)
      sub(/[[:space:]]+$/, "", s)
      return s
    }
    function is_marker(line, heading) {
      if (index(line, "`" target "`") > 0) return 1
      heading = line
      if (heading !~ /^[[:space:]]*#[#]*[[:space:]]+/) return 0
      sub(/^[[:space:]]*#[#]*[[:space:]]+/, "", heading)
      heading = trim(heading)
      gsub(/`/, "", heading)
      sub(/:[[:space:]]*$/, "", heading)
      return trim(heading) == target
    }
    BEGIN { found=0; inblock=0 }
    {
      if (!inblock && !found) {
        if (is_marker($0)) { found=1 }
        next
      }
      if (found && !inblock) {
        if ($0 ~ /^[[:space:]]*```/) { inblock=1; next }
        if ($0 ~ /^[[:space:]]*$/) next
        # non-blank non-fence: the marker was prose mentioning the filename
        # (e.g. "see gaps.md below"). Re-check this very line for a fresh
        # marker and otherwise resume scanning.
        found = is_marker($0) ? 1 : 0
        next
      }
      if (inblock) {
        if ($0 ~ /^[[:space:]]*```/) { exit }
        print
      }
    }
  ' "$1"
}

# Walk the three expected review output files. If review.md is already on disk
# and non-empty, the agent wrote it correctly and no recovery is needed
# (gaps.md/nits.md may legitimately be absent on PASS or on FAIL-with-no-nits).
# Otherwise, try deterministic transcript recovery first for each missing file.
# qwen is only invoked as a last resort if review.md is still missing after the
# deterministic pass; optional gaps.md/nits.md stay absent when the reviewer did
# not print them. Never overwrites a non-empty file.
recover_review_files() {  # recover_review_files <transcript> <dir>
  local t="$1" d="$2" f path body preserve_dir qwen_ok
  [ -f "$t" ] || return 0

  # Skip recovery entirely if review.md is already populated — the agent wrote
  # it, so any missing gaps.md / nits.md is intentional.
  if [ -s "$d/review.md" ]; then
    log "[review-recover] review.md already present — skipping transcript recovery"
    return 0
  fi

  log "[review-recover] review.md missing — trying deterministic transcript recovery"
  for f in review.md gaps.md nits.md; do
    path="$d/$f"
    [ -s "$path" ] && continue
    body="$(extract_file_block "$t" "$f")"
    if [ -n "$body" ]; then
      printf '%s\n' "$body" > "$path"
      log "[review-recover deterministic] wrote $f from transcript ($(wc -c < "$path" | tr -d ' ') bytes)"
    fi
  done

  if [ -s "$d/review.md" ]; then
    log "[review-recover] deterministic recovery found review.md; optional missing files left absent"
    return 0
  fi

  preserve_dir="$(mktemp -d)"
  for f in review.md gaps.md nits.md; do
    [ -s "$d/$f" ] && cp "$d/$f" "$preserve_dir/$f"
  done

  log "[review-recover] deterministic recovery did not find review.md — invoking qwen extractor as last resort"
  qwen_ok=0
  if qwen_extract_review_files "$t" "$d"; then
    qwen_ok=1
  else
    log "[review-recover] qwen extractor failed after deterministic recovery"
  fi
  for f in review.md gaps.md nits.md; do
    if [ -s "$preserve_dir/$f" ]; then
      cp "$preserve_dir/$f" "$d/$f"
      log "[review-recover] preserved existing non-empty $f after qwen fallback"
    fi
  done
  if [ "$qwen_ok" -eq 1 ]; then
    for f in review.md gaps.md nits.md; do
      [ -s "$d/$f" ] && log "[review-recover qwen] $f present ($(wc -c < "$d/$f" | tr -d ' ') bytes)"
    done
  fi
  rm -rf "$preserve_dir"
}

# Use qwen to recover review.md / gaps.md / nits.md from a reviewer transcript
# only when deterministic recovery cannot find review.md. Qwen has native
# file-write tools (Write/Edit), so the last-resort path gives it the *trimmed*
# transcript and three target paths and asks it to copy each fenced block
# verbatim. Deterministic recovery remains the normal path for common marker and
# heading formats.
#
# CONTEXT-SIZE GUARD — qwen runs locally on ollama with a small context
# (~32k tokens ≈ 128kB text). A fat reviewer transcript would force
# mid-conversation compaction and yield garbled output. We trim by anchoring
# at the first `\`<file>\`` marker in the transcript (everything before is
# preamble — model/CLI noise, "I can't write..." apologies) and capping the
# total size at 48kB. For typical reviewer transcripts (~4–10 kB) this is a
# no-op; for huge ones it preserves the entire fenced-block region at the end
# where file content actually lives.
qwen_extract_review_files() {  # qwen_extract_review_files <transcript> <dir>
  local t="$1" d="$2" prompt outfile trimmed start_line
  outfile="$d/qwen-extract.txt"
  trimmed="$(mktemp)"

  # Anchor at the first file-marker line, if any. If none found, fall back to
  # the full transcript — the size cap below still protects qwen's context.
  start_line="$(grep -n -m1 -E '`review\.md`|`gaps\.md`|`nits\.md`' "$t" 2>/dev/null | cut -d: -f1)"
  if [ -n "$start_line" ]; then
    tail -n +"$start_line" "$t" > "$trimmed"
  else
    cp "$t" "$trimmed"
  fi
  # Hard cap at 48 kB. Last bytes win (file contents tend to be at the end
  # after preamble + analysis), and trimming is safe because the marker
  # anchoring above already discarded the front matter.
  if [ "$(wc -c < "$trimmed")" -gt 49152 ]; then
    tail -c 49152 "$trimmed" > "$trimmed.t" && mv "$trimmed.t" "$trimmed"
  fi

  # Heredoc with quoted EOF: no expansion, then sprintf-style replace below.
  prompt=$(cat <<'EOF'
You are recovering reviewer output files from a chat transcript in an
autonomous game-development harness.

A read-only review agent was asked to write three files at the paths below
but, because it ran in ask mode, it printed their contents in chat instead.
Your only job is to copy that content into the requested files verbatim.

Transcript file (read-only — do not modify). It has been pre-trimmed to the
region after the first file marker so you can read it in one pass without
filling context:
  __TRANSCRIPT__

Target output files:
  __REVIEW__   <- the full review body, verbatim
  __GAPS__     <- the blocking gaps list (only present on a FAIL verdict)
  __NITS__     <- the non-blocking nits backlog (only present if the
                  reviewer wrote one)

In the transcript, each file is typically a fenced markdown block whose
opening fence is preceded by a marker line that contains the filename in
backticks — e.g. `` `gaps.md` content: `` or `` ## `gaps.md` ``. The opening
fence often has a language tag like ```markdown — strip the fence and tag,
keep only the body.

RULES:
- Copy verbatim. Do NOT paraphrase, summarise, reformat, or "improve".
- Strip only the surrounding fence (```) and its optional language tag.
- If a file does NOT appear in the transcript, do NOT create it (omit).
  In particular, nits.md is absent on most PASS verdicts and on FAIL
  verdicts when the reviewer noted no nits.
- Do NOT modify any file outside the three target paths.
- Do NOT touch `game/`, `harness/`, or any source code.

When finished, print one line per file you wrote, in this exact form:
  WROTE: <absolute-or-relative-path> (<bytes> bytes)

That is all. Do not commit, run servers, or anything else.
EOF
)
  prompt="${prompt//__TRANSCRIPT__/$trimmed}"
  prompt="${prompt//__REVIEW__/$d/review.md}"
  prompt="${prompt//__GAPS__/$d/gaps.md}"
  prompt="${prompt//__NITS__/$d/nits.md}"
  run_qwen "$prompt" "$outfile"
  local rc=$?
  rm -f "$trimmed" "$trimmed.t" 2>/dev/null || true
  return $rc
}
run_agy() {  # run_agy <prompt> <outfile> — Antigravity / Gemini 3.5 Flash (High), QA tier
  # No --model flag exists (model is globally pinned server-side via /model).
  # Override agy's internal --print-timeout from AGY_TIMEOUT so it doesn't cap
  # at its own default 5min before the harness's outer timeout fires. Go duration
  # syntax accepts `<seconds>s`.
  local a=(agy -p --dangerously-skip-permissions "--print-timeout=${AGY_TIMEOUT}s")
  a+=("$1")
  _run_cli agy "$2" "$AGY_TIMEOUT" "$1" "${a[@]}"
}
run_claude() {  # run_claude <prompt> <outfile>
  local a=(claude -p --dangerously-skip-permissions); [ -n "$CLAUDE_MODEL" ] && a+=(--model "$CLAUDE_MODEL"); a+=("$1")
  _run_cli claude "$2" "$CLAUDE_TIMEOUT" "$1" "${a[@]}"
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
# Stages every working-tree change EXCEPT harness/ by default — in-flight
# harness edits are operator state, not ticket work, and excluding them keeps
# the original guarantee that a harness fix sitting in the working tree can
# never be swept into a normal game-ticket commit. Harness-scoped tickets set
# COMMIT_INCLUDE_HARNESS=1 from run_subtask.sh so their verified harness edits
# can still be committed by the deterministic fallback. Wider than the legacy
# explicit allowlist
# (`game/ TASKS.md LOGBOOK.md tickets/`) so sub-tickets that legitimately
# edit CONTEXT.md, README.md, .github/, or root configs (package.json,
# pnpm-lock.yaml, etc.) actually persist when qwen's own commit step fails
# and this fallback fires. Commits and asserts HEAD advanced.
#   0 = committed (or nothing to commit — state already in HEAD)
#   2 = commit could not be made → caller MUST escalate, never proceed
commit_verified() {
  if [ "${COMMIT_INCLUDE_HARNESS:-0}" = "1" ]; then
    git add -- .
  else
    git add -- . ':!harness'
  fi
  if git diff --cached --quiet; then
    log "[git] no changes to commit — verified state already in HEAD"
    emit_progress_event "commit_skipped" "{\"message\":$(json_string "$1"),\"reason\":\"no_changes\"}"
    return 0
  fi
  local before; before="$(git rev-parse HEAD 2>/dev/null)"
  emit_progress_event "commit_start" "{\"message\":$(json_string "$1"),\"base\":$(json_string "$(git rev-parse --short HEAD 2>/dev/null)")}"
  if ! git commit -q -m "$1" -m "autogame"; then
    log "[git] ERROR: commit failed for: $1"
    emit_progress_event "commit_failed" "{\"message\":$(json_string "$1"),\"reason\":\"git_commit_failed\",\"base\":$(json_string "$(git rev-parse --short HEAD 2>/dev/null)")}"
    return 2
  fi
  if [ "$(git rev-parse HEAD 2>/dev/null)" = "$before" ]; then
    log "[git] ERROR: HEAD did not advance after commit"
    emit_progress_event "commit_failed" "{\"message\":$(json_string "$1"),\"reason\":\"head_did_not_advance\",\"base\":$(json_string "$(git rev-parse --short HEAD 2>/dev/null)")}"
    return 2
  fi
  log "[git] committed $(git rev-parse --short HEAD): $1"
  emit_progress_event "commit" "{\"message\":$(json_string "$1"),\"sha\":$(json_string "$(git rev-parse --short HEAD)")}"
  return 0
}

# Discard uncommitted changes from a failed sub-ticket attempt. Wider than
# the historical name suggests: reverts every tracked file and removes every
# untracked file EXCEPT under harness/ (in-flight harness edits — operator
# state) and tickets/ (per-ticket bookkeeping — log.txt, feedback.md,
# handoff.md, .passed markers, and any newly decomposed sub-ticket
# folders whose ticket.md is not yet tracked). Safe: verified progress is
# always committed (commit_verified) before the harness moves on, so this
# can only ever discard the current failed attempt. Wider revert prevents
# a failed sub-ticket's edits to CONTEXT.md, README.md, .github/, or root
# configs from leaking into the NEXT sub-ticket's diff in the same round.
revert_game_changes() {
  git checkout HEAD -- . ':!harness' ':!tickets' 2>/dev/null || true
  git clean -fdq -- . ':!harness' ':!tickets' 2>/dev/null || true
}

next_version_tag() {  # echoes v0.<n> where n = (#existing v0.* tags)+1
  echo "v0.$(( $(git tag -l 'v0.*' | wc -l | tr -d ' ') + 1 ))"
}
