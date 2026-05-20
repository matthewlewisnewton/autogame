# Exclude dead players from collecting loot

A dead player (`player.dead === true`) should not be able to collect loot. Add a guard on both the client (proximity check) and the server (`lootPickup` handler) to skip loot collection for dead players.

## Acceptance Criteria
- A dead player does not emit `lootPickup` from the client proximity check.
- The server `lootPickup` handler rejects requests from dead players (ignores them).
- A revived player (`player.dead === false`) can collect loot normally again.

## Technical Specs
- **File:** `game/client/main.js` — `animate()` function, loot proximity block (~line 1441). Add a check: skip the emit if the local player's `dead` flag is `true` (read from `gameState.players[myId].dead`).
- **File:** `game/server/index.js` — `lootPickup` handler (~line 1276). Add `if (player.dead) return;` after the existing `if (!player) return;` guard.
- **File:** `game/server/test/integration.test.js` — add a test: emit `lootPickup` as a dead player and verify the loot remains in `gameState.loot` and currency is unchanged.

## Verification: code
