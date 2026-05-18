#!/bin/bash

# Usage: ./harness/run_task.sh 001-card-deck-ui
# Reads ticket.md from the ticket folder, runs qwen -> gemini -> claude,
# and accumulates feedback in the ticket folder.

set -e

if [ -z "$1" ]; then
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

TASK_DESC=$(cat "$TICKET_FILE")
MAX_ITERATIONS=5
ITERATION=1
LOG_FILE="$TICKET_DIR/log.txt"

echo "=== Running: $1 ===" | tee "$LOG_FILE"

while [ $ITERATION -le $MAX_ITERATIONS ]; do
  echo "" | tee -a "$LOG_FILE"
  echo "--- Iteration $ITERATION/$MAX_ITERATIONS ---" | tee -a "$LOG_FILE"

  # Step 1: qwen implements, given the ticket folder as context
  echo "[qwen] Implementing..." | tee -a "$LOG_FILE"
  QWEN_OUT=$(qwen "You are working in the game/ directory. Here is your task and all accumulated context from $TICKET_DIR: $TASK_DESC" 2>&1) || true
  echo "$QWEN_OUT" > "$TICKET_DIR/qwen_iter${ITERATION}.txt"

  sleep 2

  # Step 2: gemini verifies visually
  echo "[gemini] Verifying visually..." | tee -a "$LOG_FILE"
  GEMINI_OUT=$(gemini "Does the game at http://localhost:5173 satisfy these criteria? $TASK_DESC — Reply YES or list remaining issues." 2>&1) || true
  echo "$GEMINI_OUT" > "$TICKET_DIR/gemini_iter${ITERATION}.txt"

  if echo "$GEMINI_OUT" | grep -qi "YES"; then
    echo "[gemini] PASSED" | tee -a "$LOG_FILE"

    # Step 3: claude does final review
    echo "[claude] Final code review..." | tee -a "$LOG_FILE"
    CLAUDE_OUT=$(claude "Review the game/ codebase. Is this task fully complete and robust? $TASK_DESC — Reply YES or list issues." 2>&1) || true
    echo "$CLAUDE_OUT" > "$TICKET_DIR/claude_iter${ITERATION}.txt"

    if echo "$CLAUDE_OUT" | grep -qi "YES"; then
      echo "" | tee -a "$LOG_FILE"
      echo "✅ DONE: $1" | tee -a "$LOG_FILE"
      # Move from Backlog to Done in TASKS.md
      sed -i "s/^- \[ \] \[$1\]/- [x] [$1]/" TASKS.md
      exit 0
    else
      echo "[claude] Needs work." | tee -a "$LOG_FILE"
      TASK_DESC="$TASK_DESC\n\n## Claude feedback (iter $ITERATION)\n$CLAUDE_OUT"
    fi
  else
    echo "[gemini] Needs work." | tee -a "$LOG_FILE"
    TASK_DESC="$TASK_DESC\n\n## Gemini feedback (iter $ITERATION)\n$GEMINI_OUT"
  fi

  ((ITERATION++))
done

echo "❌ FAILED after $MAX_ITERATIONS iterations: $1" | tee -a "$LOG_FILE"
exit 1
