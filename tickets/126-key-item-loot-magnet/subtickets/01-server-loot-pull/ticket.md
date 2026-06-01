# Server: loot magnet pull logic

Wire `loot_magnet` into the `useKeyItem` handler: on activation, pull all uncollected ground loot within ~8 m toward the player, respecting wall collisions. If pulled loot ends up within `LOOT_PICKUP_RADIUS` (3.5), auto-collect it.

## Acceptance Criteria

- `loot_magnet` is added to the implementation gate in `useKeyItem` (no longer returns `not_implemented`).
- `KEY_ITEM_DEFS.loot_magnet` is updated: `cooldownMs` ≈ 8000, `attractRadius` ≈ 8; remove `durationMs` (instant pull, not persistent).
- All loot entities in `state.loot` within `attractRadius` of the player are moved toward the player.
- Loot movement respects wall collisions — loot cannot be pulled through walls (use `tryPlayerMove` or `isInsideDungeon` from `simulation.js`).
- Loot that ends up within `LOOT_PICKUP_RADIUS` (3.5) of the player after the pull is auto-collected (same logic as `lootPickup`: credit currency/MS, splice from `state.loot`).
- Loot already collected (not in `state.loot`) is silently ignored.
- Loot outside `attractRadius` is untouched.
- Cooldown is set on `player.keyItemCooldownUntil`; `persistenceDirty` is flagged.
- Response: `{ ok: true, keyItemId: 'loot_magnet', pulled: <count>, collected: <count>, cooldownUntil }`.
- Existing test in `key-items.test.js` that uses `loot_magnet` to verify `not_implemented` is updated to use a different unimplemented item (e.g. `overclock`).

## Technical Specs

**Files to change:**

- `game/server/progression.js` (~line 610): Update `KEY_ITEM_DEFS.loot_magnet`:
  - `cooldownMs: 8000`
  - `attractRadius: 8`
  - Remove `durationMs` (instant pull)
- `game/server/index.js` (~line 2508): Add `'loot_magnet'` to the implementation gate whitelist
- `game/server/index.js` (after existing key item blocks, ~line 2700): New `if (keyItemId === 'loot_magnet')` block:
  - Iterate `state.loot`; for each loot within `attractRadius`, compute direction toward player
  - Use `tryPlayerMove(loot.x, loot.z, dirX, dirZ, dist, getWallColliders())` to compute wall-aware new position (or fall back to `isInsideDungeon` boundary check)
  - If resulting distance ≤ `LOOT_PICKUP_RADIUS`, auto-collect: credit `player.currency` / `addMagicStones`, `splice` from `state.loot`
  - Set `player.keyItemCooldownUntil`, `player.persistenceDirty = true`
  - Emit `socket.emit('keyItemUsed', { ok: true, keyItemId, pulled, collected, cooldownUntil })`
  - Emit `io.to(lobby.id).emit('stateUpdate', stateSnapshot())`
- `game/server/test/key-items.test.js` (~line 267): Change `loot_magnet` → `overclock` in the `not_implemented` test

## Verification: code
