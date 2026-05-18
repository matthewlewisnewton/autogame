#!/bin/bash

# Usage: ./harness/run_task.sh <task_number>
# Reads a task from TASKS.md by number, runs it through qwen -> gemini -> claude.

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <task_number>"
  echo "Example: $0 1"
  exit 1
fi

TASK_NUM=$1
TASK_LINE=$(grep -E "^\- \[ \] $TASK_NUM:" TASKS.md)

if [ -z "$TASK_LINE" ]; then
  echo "Error: Task $TASK_NUM not found or already completed."
  exit 1
fi

# Extract description after the number and colon
TASK_DESC=$(echo "$TASK_LINE" | sed "s/^- \[ \] $TASK_NUM: //")
MAX_ITERATIONS=5
ITERATION=1

echo "=== Task $TASK_NUM: $TASK_DESC ==="

while [ $ITERATION -le $MAX_ITERATIONS ]; do
  echo ""
  echo "--- Iteration $ITERATION/$MAX_ITERATIONS ---"

  echo "[qwen] Implementing..."
  QWEN_OUT=$(qwen "Implement this in the game/ directory: $TASK_DESC" 2>&1) || true

  sleep 2

  echo "[gemini] Verifying visually..."
  GEMINI_OUT=$(gemini "Does the game at http://localhost:5173 now show: $TASK_DESC? Reply YES or describe what's wrong." 2>&1) || true

  if echo "$GEMINI_OUT" | grep -qi "YES"; then
    echo "[claude] Final review..."
    CLAUDE_OUT=$(claude "Review the game/ codebase. Is this task complete and robust? $TASK_DESC Reply YES or describe issues." 2>&1) || true

    if echo "$CLAUDE_OUT" | grep -qi "YES"; then
      echo ""
      echo "✅ Task $TASK_NUM completed!"
      sed -i "s/^- \[ \] $TASK_NUM:/- [x] $TASK_NUM:/" TASKS.md
      exit 0
    else
      echo "[claude] Needs work: $CLAUDE_OUT"
      TASK_DESC="$TASK_DESC | Claude feedback: $CLAUDE_OUT"
    fi
  else
    echo "[gemini] Needs work: $GEMINI_OUT"
    TASK_DESC="$TASK_DESC | Gemini feedback: $GEMINI_OUT"
  fi

  ((ITERATION++))
done

echo "❌ Task $TASK_NUM failed after $MAX_ITERATIONS iterations."
exit 1
