# 273-socketHandlers-extract-deck

## Difficulty: medium

## Goal

Slice 2: move the DECK handlers into server/socketHandlers/deckHandlers.js. Chained after slice 1 so only one ticket rewrites index.js at a time.

## Acceptance Criteria

- Deck handlers moved + registered; behaviour-preserving; tests green.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
