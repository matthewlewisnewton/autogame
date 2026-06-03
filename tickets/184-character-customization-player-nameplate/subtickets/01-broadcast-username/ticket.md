# Broadcast username in server state snapshot

Add `username` to the per-player object in `stateSnapshot()` so the client can display each player's name above their avatar.

## Acceptance Criteria
- `stateSnapshot()` in `game/server/progression.js` includes a `username` field for each player in the returned `players` map.
- The `username` value equals the player record's `username` (set by `buildPlayerRecord()` in `index.js`).
- The field is present for all players, including self.
- Existing snapshot fields are unchanged (no regression in broadcast shape).
- Tests pass (`pnpm test` from `game/`).

## Technical Specs
- `game/server/progression.js`: In the `stateSnapshot()` function (~line 3145), add `username: p.username` to the player object literal built inside the `for (const [id, p] of Object.entries(_gameState.players))` loop, alongside the existing `cosmetic` field.

## Verification: code
