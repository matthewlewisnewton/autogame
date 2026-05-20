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
AGENT_TIMEOUT="${AGENT_TIMEOUT:-720}"  # 12 min — composer is now the primary QA reviewer (gemini dropped)
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
QWEN_VISION_OPENAI_LOGGING="${QWEN_VISION_OPENAI_LOGGING:-0}"
PIPELINE_LOCAL_CHECKS="${PIPELINE_LOCAL_CHECKS:-1}" # run deterministic checks while screenshots/server startup happen
PIPELINE_CHECK_CWD="${PIPELINE_CHECK_CWD:-game}"
PIPELINE_CHECK_COMMAND="${PIPELINE_CHECK_COMMAND:-npm test -- --coverage.enabled=false}"
PIPELINE_CHECK_TIMEOUT="${PIPELINE_CHECK_TIMEOUT:-300}"

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
start_game() {  # start_game <logdir>
  local logdir="$1"
  emit_progress_event "game_start" "{\"logdir\":$(json_string "$logdir")}"
  ( node game/server/index.js ) </dev/null >"$logdir/server.log" 2>&1 &
  GAME_PIDS+=("$!")
  ( cd game/client && npx vite --port 5173 --strictPort ) </dev/null >"$logdir/client.log" 2>&1 &
  GAME_PIDS+=("$!")
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
    agy) echo "${AGY_MODEL_LABEL:-default}" ;;
    *) echo "default" ;;
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
const usagePayload = {
  key: `${outfile}#${attemptRaw}`,
  agent,
  model: model || null,
  bucket,
  outfile,
  attempt: Number(attemptRaw) || 0,
  rc: Number(rcRaw) || 0,
  status,
  reason: reason || null,
  startedAtMs,
  endedAtMs,
  durationMs: startedAtMs !== null && endedAtMs !== null ? Math.max(0, endedAtMs - startedAtMs) : null,
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
  local a=(qwen -y); [ -n "$QWEN_MODEL" ] && a+=(-m "$QWEN_MODEL"); a+=("$1")
  _run_cli qwen "$2" "$QWEN_TIMEOUT" "$1" "${a[@]}"
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
  local a=(agent -p --force --trust --mode ask)
  [ -n "$AGENT_MODEL" ] && a+=(--model "$AGENT_MODEL")
  a+=("$1")
  _run_cli agent "$2" "$AGENT_TIMEOUT" "$1" "${a[@]}"
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
# Stages the loop's OWN files only — game/ plus backlog bookkeeping — and never
# harness/, so an in-flight harness edit can't be swept into a ticket commit.
# Commits, and asserts HEAD advanced.
#   0 = committed (or nothing to commit — state already in HEAD)
#   2 = commit could not be made → caller MUST escalate, never proceed
commit_verified() {
  git add -- game/ TASKS.md LOGBOOK.md tickets/
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
