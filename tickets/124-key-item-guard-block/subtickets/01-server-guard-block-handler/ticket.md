# 01 — Server: Guard Block handler & player state

Wire the `guard_block` key item into the `useKeyItem` socket handler so the server accepts the action, sets a blocking window, and enforces cooldown.

## Acceptance Criteria

- `guard_block` is removed from the `not_implemented` gate in `useKeyItem` (server/index.js)
- On successful use:
  - `player.blockingUntil` is set to `now + durationMs` (default 600ms)
  - `player.blockingYaw` is set to the player's current facing yaw (or derived from input direction if non-zero)
  - `player.keyItemCooldownUntil` is set to `now + cooldownMs`
  - Movement is slowed to 20% of normal speed while blocking (or player is rooted — either is acceptable)
- Socket response: `keyItemUsed` emits `{ ok: true, keyItemId: 'guard_block', blockingUntil, cooldownUntil }`
- `KEY_ITEM_DEFS.guard_block.cooldownMs` is adjusted to ~3500ms (ticket spec says 3–4s, currently 12000ms)
- `KEY_ITEM_DEFS.guard_block.durationMs` is adjusted to ~700ms (ticket spec says 0.5–0.8s, currently 2000ms)
- Player object is initialized with `blockingUntil: 0` and `blockingYaw: 0` in `createPlayer`
- Existing test `key-items.test.js` "useKeyItem for non-implemented items returns not_implemented" is updated to use a different key item ID (since guard_block is now implemented)

## Technical Specs

- **server/index.js** (~line 2489): Remove `'guard_block'` from the `not_implemented` gate; add handler block after `field_medic_kit` that:
  - Reads `player.rotation` for facing yaw
  - Sets `player.blockingUntil = now + (def.durationMs || 600)`
  - Sets `player.blockingYaw = player.rotation || 0`
  - Sets `player.keyItemCooldownUntil = now + (def.cooldownMs || 3500)`
  - Emits `keyItemUsed` with `blockingUntil` and `cooldownUntil`
  - Broadcasts `stateUpdate`
- **server/index.js** (~line 844): Add `blockingUntil: 0` and `blockingYaw: 0` to the player object in `createPlayer`
- **server/progression.js** (~line 592): Update `guard_block` definition:
  - `cooldownMs: 3500` (was 12000)
  - `durationMs: 700` (was 2000)
- **server/test/key-items.test.js** (~line 267): Change the `not_implemented` test to use a different key item (e.g. `'flare_beacon'`) since `guard_block` is now implemented

## Verification: code
