#!/bin/bash

TICKETS_DIR="tickets/data"

echo "Current Tickets:"
echo "-----------------------------------"

for file in $TICKETS_DIR/TICK-*.md; do
  if [ -f "$file" ]; then
    TITLE=$(head -n 1 "$file" | sed 's/# //')
    STATUS=$(grep "**Status:**" "$file" | sed 's/\*\*Status:\*\* //')
    FILENAME=$(basename "$file")
    echo "$FILENAME | $STATUS | $TITLE"
  fi
done
echo "-----------------------------------"
