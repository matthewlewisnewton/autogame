#!/bin/bash

# Usage: ./harness/run_task.sh 001-card-deck-ui
# Reads ticket.md from the ticket folder, runs qwen -> gemini -> claude,
# and accumulates feedback in the ticket folder.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# --- Preflight checks ---
if [ -z "${1:-}" ]; then
  echo "Usage: $0 <ticket-folder-name>"
  echo "Example: $0 001-card-deck-ui"
  exit 1
fi

TICKET_DIR="tickets/$1"
TICKET_FILE="$TICKET_DIR/ticket.md"

if [ ! -f "$TICKET_FILE" ]; then
  echo "Error: $TICKET_FILE not found."
  exit 1
fi

for cmd in qwen claude; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "Error: '$cmd' CLI not found in PATH."
    exit 1
  fi
done

# gemini is optional (falls back to qwen)
HAS_GEMINI=true
if ! command -v gemini &>/dev/null; then
  echo "Warning: 'gemini' CLI not found. Will use qwen for visual verification."
  HAS_GEMINI=false
fi

# --- Load context ---
PROJECT_CONTEXT=$(cat CONTEXT.md)
TASK_DESC=$(cat "$TICKET_FILE")

# Load any prior iteration feedback
for f in "$TICKET_DIR"/*_iter*.txt; do
  [ -f "$f" ] || continue
  TASK_DESC="$(printf '%s\n\n## Prior feedback (%s)\n%s' "$TASK_DESC" "$(basename "$f")" "$(cat "$f")")"
done

MAX_ITERATIONS=5
ITERATION=1
LOG_FILE="$TICKET_DIR/log.txt"

echo "=== Running: $1 ===" | tee "$LOG_FILE"

# --- Start dev servers ---
echo "Starting dev servers..." | tee -a "$LOG_FILE"
(cd game && npm run dev) &
DEV_PID=$!
cleanup() {
  echo "Shutting down dev servers (PID $DEV_PID)..."
  kill $DEV_PID 2>/dev/null || true
  wait $DEV_PID 2>/dev/null || true
}
trap cleanup EXIT

# Wait for servers to be ready
echo "Waiting for servers..." | tee -a "$LOG_FILE"
sleep 8

# --- Create a branch for this ticket ---
BRANCH_NAME="ticket/$1"
git checkout -b "$BRANCH_NAME" 2>/dev/null || git checkout "$BRANCH_NAME" 2>/dev/null || true

# --- Helper: call gemini for vision. Returns "FALLBACK" if unavailable. ---
call_gemini_vision() {
  local prompt="$1"
  local image_path="${2:-}"
  local output=""

  if [ "$HAS_GEMINI" = true ]; then
    if [ -n "$image_path" ] && [ -f "$image_path" ]; then
      output=$(gemini -p "$prompt" --image "$image_path" 2>&1) || { echo "FALLBACK"; return; }
    else
      output=$(gemini -p "$prompt" 2>&1) || { echo "FALLBACK"; return; }
    fi

    # Check for quota/error
    if echo "$output" | grep -qi "quota\|exhausted\|rate.limit"; then
      echo "FALLBACK"; return
    fi

    echo "$output"
  else
    echo "FALLBACK"
  fi
}

# --- Main loop ---
while [ $ITERATION -le $MAX_ITERATIONS ]; do
  echo "" | tee -a "$LOG_FILE"
  echo "--- Iteration $ITERATION/$MAX_ITERATIONS ---" | tee -a "$LOG_FILE"

  # Step 1: qwen implements
  echo "[qwen] Implementing..." | tee -a "$LOG_FILE"
  FULL_PROMPT="$(printf '%s\n\n---\n\n## Task\n%s' "$PROJECT_CONTEXT" "$TASK_DESC")"
  QWEN_OUT=$(qwen -p "You are working in the game/ directory. Implement the following task. $FULL_PROMPT" 2>&1) || true
  echo "$QWEN_OUT" > "$TICKET_DIR/qwen_iter${ITERATION}.txt"

  sleep 3

  # Step 2: Take a screenshot with Playwright
  echo "[playwright] Capturing screenshot..." | tee -a "$LOG_FILE"
  SCREENSHOT_PATH="$TICKET_DIR/screenshot_iter${ITERATION}.png"
  node "$SCRIPT_DIR/screenshot.js" "http://localhost:5173" "$SCREENSHOT_PATH" 2>&1 || true

  # Step 3: Visual verification (gemini, with claude-combined fallback)
  echo "[visual-qa] Verifying..." | tee -a "$LOG_FILE"
  VISUAL_PROMPT="Does this screenshot show completion of these acceptance criteria? If ALL criteria are met, reply with exactly YES on the first line. Otherwise describe what is missing.

$TASK_DESC"
  VISUAL_OUT=$(call_gemini_vision "$VISUAL_PROMPT" "$SCREENSHOT_PATH")

  if [ "$VISUAL_OUT" = "FALLBACK" ]; then
    # Gemini unavailable — claude does BOTH visual + code review
    echo "[gemini] Unavailable. Promoting claude to do visual + code review..." | tee -a "$LOG_FILE"
    CLAUDE_OUT=$(claude -p "You are doing TWO jobs: (1) Look at the screenshot at $SCREENSHOT_PATH and verify it meets the visual acceptance criteria. (2) Review the game/ codebase for correctness and robustness. If BOTH visual and code are complete, reply with exactly YES on the first line. Otherwise list all issues.

$TASK_DESC" 2>&1) || true
    echo "$CLAUDE_OUT" > "$TICKET_DIR/claude_combined_iter${ITERATION}.txt"

    CLAUDE_FIRST=$(echo "$CLAUDE_OUT" | grep -m1 '.' | tr -d '[:space:]')
    if [ "$CLAUDE_FIRST" = "YES" ]; then
      echo "" | tee -a "$LOG_FILE"
      echo "✅ DONE: $1" | tee -a "$LOG_FILE"
      sed -i "s/^- \[ \] \[$1\]/- [x] [$1]/" TASKS.md
      git add -A
      git commit -m "Complete ticket: $1" || true
      exit 0
    else
      echo "[claude] Needs work." | tee -a "$LOG_FILE"
      TASK_DESC="$(printf '%s\n\n## Claude combined feedback (iter %d)\n%s' "$TASK_DESC" "$ITERATION" "$CLAUDE_OUT")"
    fi
  else
    # Gemini available — normal two-step flow
    echo "$VISUAL_OUT" > "$TICKET_DIR/visual_iter${ITERATION}.txt"

    FIRST_LINE=$(echo "$VISUAL_OUT" | grep -m1 '.' | tr -d '[:space:]')
    if [ "$FIRST_LINE" = "YES" ]; then
      echo "[visual-qa] PASSED" | tee -a "$LOG_FILE"

      # Step 4: Claude final code review
      echo "[claude] Final review..." | tee -a "$LOG_FILE"
      CLAUDE_OUT=$(claude -p "Review the game/ codebase. Is this task fully complete and robust? If yes, reply with exactly YES on the first line. Otherwise list the issues.

$TASK_DESC" 2>&1) || true
      echo "$CLAUDE_OUT" > "$TICKET_DIR/claude_iter${ITERATION}.txt"

      CLAUDE_FIRST=$(echo "$CLAUDE_OUT" | grep -m1 '.' | tr -d '[:space:]')
      if [ "$CLAUDE_FIRST" = "YES" ]; then
        echo "" | tee -a "$LOG_FILE"
        echo "✅ DONE: $1" | tee -a "$LOG_FILE"
        sed -i "s/^- \[ \] \[$1\]/- [x] [$1]/" TASKS.md
        git add -A
        git commit -m "Complete ticket: $1" || true
        exit 0
      else
        echo "[claude] Needs work." | tee -a "$LOG_FILE"
        TASK_DESC="$(printf '%s\n\n## Claude feedback (iter %d)\n%s' "$TASK_DESC" "$ITERATION" "$CLAUDE_OUT")"
      fi
    else
      echo "[visual-qa] Needs work." | tee -a "$LOG_FILE"
      TASK_DESC="$(printf '%s\n\n## Visual QA feedback (iter %d)\n%s' "$TASK_DESC" "$ITERATION" "$VISUAL_OUT")"
    fi
  fi

  ITERATION=$((ITERATION + 1))
done

echo "" | tee -a "$LOG_FILE"
echo "❌ FAILED after $MAX_ITERATIONS iterations: $1" | tee -a "$LOG_FILE"

# Revert on failure
echo "Reverting changes on failure..." | tee -a "$LOG_FILE"
git checkout -- game/ || true

exit 1
