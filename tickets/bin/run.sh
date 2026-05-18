#!/bin/bash

if [ -z "$1" ]; then
  echo "Usage: ./tickets/bin/run.sh <TICKET_ID> (e.g. TICK-001)"
  exit 1
fi

TICKET_ID=$1
TICKET_FILE="tickets/data/$TICKET_ID.md"

if [ ! -f "$TICKET_FILE" ]; then
  echo "Error: Ticket $TICKET_ID not found at $TICKET_FILE"
  exit 1
fi

# Run the harness
cd game/
../harness/agent_loop.sh "../$TICKET_FILE"
