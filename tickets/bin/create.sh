#!/bin/bash

# Lightweight Ticket Creation
if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: ./tickets/bin/create.sh \"Ticket Title\" \"Ticket Description\""
  exit 1
fi

TITLE=$1
DESC=$2
TICKETS_DIR="tickets/data"

# Find next ticket ID
NEXT_ID=$(ls -1q $TICKETS_DIR/TICK-*.md 2>/dev/null | wc -l)
NEXT_ID=$((NEXT_ID + 1))
TICKET_FILE="$TICKETS_DIR/TICK-$(printf "%03d" $NEXT_ID).md"

cat <<EOF > "$TICKET_FILE"
# $TITLE

**Status:** [ ] TODO

## Description
$DESC
EOF

echo "Created ticket: $TICKET_FILE"
