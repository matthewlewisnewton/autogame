# Loot Pickup Logic (Verification)

The full pickup flow — client proximity detection, server validation, currency
update, and loot removal — was implemented in a previous round and reviewed as
code-correct. This sub-ticket verifies the existing implementation is intact.

## Acceptance Criteria
- `game/client/main.js` checks distance from player (`myX`, `myZ`) to each loot
  item every frame; when distance ≤ 2.0, it emits
  `socket.emit('lootPickup', { lootId })` and breaks (one per frame)
- `game/server/index.js` handles `lootPickup` by:
  - Finding the loot item by `id` in `gameState.loot`
  - Computing server-side distance from player to loot's `{x, z}`
  - If distance ≤ 3.0: adding `loot.value` to `player.currency`, removing the
    loot from `gameState.loot`, and logging the pickup
  - If distance > 3.0: ignoring the event (anti-cheat)
  - If `findIndex` returns `-1`: returning early (prevents double pickup)
- After pickup, the next `stateUpdate` reflects the increased `currency` and
  reduced `loot` array

## Technical Specs
- **Files** (read-only verification): `game/server/index.js`,
  `game/client/main.js`
- No code changes expected — this sub-ticket confirms the existing
  implementation is present and correct.

## Verification: code
