#!/bin/bash

# Agentic Task Orchestration Loop
# Usage: ./scripts/agent_loop.sh <path_to_task_markdown>

if [ -z "$1" ]; then
  echo "Usage: $0 <path_to_task_markdown>"
  exit 1
fi

TASK_FILE=$1
if [ ! -f "$TASK_FILE" ]; then
  echo "Error: Task file not found!"
  exit 1
fi

TASK_DESC=$(cat "$TASK_FILE")
MAX_ITERATIONS=5
ITERATION=1

echo "Starting Agentic Loop for Task: $TASK_FILE"
echo "---------------------------------------------------"

while [ $ITERATION -le $MAX_ITERATIONS ]; do
  echo "[Iteration $ITERATION] Executing Qwen CLI to iterate on code..."
  # Assume qwen cli alters the codebase to fulfill the prompt
  qwen_output=$(qwen "You are a developer. Implement the following task. Modify the codebase as needed. Task: $TASK_DESC")
  echo "Qwen finished implementation."

  # Wait a moment for dev server to catch up via HMR/restart
  sleep 3

  echo "[Iteration $ITERATION] Capturing screenshot of local game..."
  # Placeholder for an actual screenshot tool (like puppeteer/playwright script)
  # screenshot http://localhost:5173 current_state.png
  touch current_state.png

  echo "[Iteration $ITERATION] Requesting Gemini CLI for visual verification..."
  # Assume gemini returns "YES" if it passes, or critique if it fails
  gemini_output=$(gemini "Does this screenshot show completion of this task? Task: $TASK_DESC. If yes, respond strictly with 'YES'. If no, list the remaining issues." --image current_state.png)
  
  if [[ "$gemini_output" == *"YES"* ]]; then
    echo "Gemini Visual Verification: PASSED."
    
    echo "[Iteration $ITERATION] Requesting Claude CLI for final code review..."
    claude_output=$(claude "Review the entire codebase. Does the current code robustly and completely fulfill this task? Task: $TASK_DESC. If yes, respond strictly with 'YES'. If no, describe the bugs or missing features.")
    
    if [[ "$claude_output" == *"YES"* ]]; then
      echo "Claude Code Verification: PASSED."
      echo "---------------------------------------------------"
      echo "✅ TASK COMPLETED SUCCESSFULLY: $TASK_FILE"
      
      # Mark task as done in the file
      sed -i 's/\[ \]/\[x\]/g' "$TASK_FILE"
      
      exit 0
    else
      echo "Claude Code Verification: FAILED."
      echo "Claude Feedback: $claude_output"
      # Append feedback to the task desc for next loop
      TASK_DESC="$TASK_DESC\n\nCode Review Feedback from Claude:\n$claude_output"
    fi
    
  else
    echo "Gemini Visual Verification: FAILED."
    echo "Gemini Feedback: $gemini_output"
    # Append feedback to the task desc for next loop
    TASK_DESC="$TASK_DESC\n\nVisual Feedback from Gemini:\n$gemini_output"
  fi

  ((ITERATION++))
  echo "Retrying task based on feedback..."
  echo "---------------------------------------------------"
done

echo "❌ TASK FAILED: Maximum iterations ($MAX_ITERATIONS) reached without consensus."
exit 1
