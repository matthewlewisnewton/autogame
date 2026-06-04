# Remove duplicate questError listener

The client registers two identical `s.on('questError', …)` handlers in the socket setup block, causing `showQuestError` to fire twice for every server-emitted quest error.

## Acceptance Criteria

- Exactly one `s.on('questError', …)` registration remains in `game/client/main.js` (grep confirms a single match).
- The retained listener still guards on `data` / `data.reason` and calls `showQuestError(data.reason)`.
- Removing the duplicate does not alter any other socket event wiring in the same setup function.

## Technical Specs

- **File:** `game/client/main.js`
  - Delete the duplicate listener at lines ~1365–1368 (the second copy immediately after the `questUpdate` handler).
  - Keep the listener at ~1258–1261 grouped with the other error handlers (`cardEvolutionError`, etc.).

## Verification: code
