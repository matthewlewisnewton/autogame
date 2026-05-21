# Stop Player ID Drift on Reconnect

Each cold reconnect (after disconnect removes the player from memory) generates a new UUID, loads persisted data under the old ID, but saves under the new ID — orphaning the old save file. Over repeated reconnects, the `data/` directory accumulates stale JSON files while the active save drifts to a new key each time.

## Acceptance Criteria
- When a client reconnects with a `providedPlayerId` that is **not** in the in-memory `gameState.players` map, the server checks whether persisted data exists for that ID via `provider.loadPlayer(providedPlayerId)`.
- If persisted data **is** found for `providedPlayerId`, the server **reuses** `providedPlayerId` as the authoritative `playerId` (does NOT generate a new UUID).
- All subsequent saves (periodic, disconnect, run complete, return to lobby) write to the same file keyed by the reused `providedPlayerId`.
- If persisted data is **not** found for `providedPlayerId`, the server generates a new UUID (current fallback behavior) — this handles corrupted client-side storage or first-time connections with a stale ID.
- After a disconnect-then-reconnect cycle, the `data/` directory contains only one JSON file for that player (no orphaned stale files accumulate).

## Technical Specs
- **File**: `game/server/index.js`
- In the connect handler, change the branch where `providedPlayerId` is not in `gameState.players`:
  - First attempt `provider.loadPlayer(providedPlayerId)`.
  - If the result is non-null, set `playerId = providedPlayerId` (reuse the client's ID).
  - If the result is null, fall through to `playerId = crypto.randomUUID()` (existing fallback).
- Remove or adjust the secondary `provider.loadPlayer(playerId)` fallback load that currently runs after the new UUID is generated — it becomes unnecessary since the ID is either reused or brand new.
- **File**: `game/server/test/persistence.test.js` (or equivalent test file)
- Add an integration test that simulates: connect → earn currency → disconnect → reconnect → verify that the same `playerId` is returned in `init` and that only one save file exists in the data directory.

## Verification: code
