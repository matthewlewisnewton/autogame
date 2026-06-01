# 01 — Server: Overclock key item definition and handler

Update the `overclock` key item definition with correct parameters and implement the `useKeyItem` handler block that grants the player 2 charges.

## Acceptance Criteria

- `KEY_ITEM_DEFS.overclock` has `cooldownMs: 13000` (within the 12–15s range), `charges: 2`, and an updated description mentioning slot cooldown bypass.
- `overclock` is added to the implementation gate whitelist in the `useKeyItem` socket handler.
- Player object is initialized with `overclockChargesRemaining: 0`; the field is reset to `0` on run start.
- Sending `useKeyItem({ keyItemId: 'overclock' })` while in a running dungeon sets `player.overclockChargesRemaining = 2` and applies the shared key item cooldown.
- The `keyItemUsed` response includes `ok: true`, `keyItemId: 'overclock'`, `charges: 2`, and `cooldownUntil`.
- `overclockChargesRemaining` is included in the `stateSnapshot()` per-player data so clients can see remaining charges.

## Technical Specs

- **`game/server/progression.js`**:
  - Update `KEY_ITEM_DEFS.overclock`: set `cooldownMs: 13000`, add `charges: 2`, update `description` to "Next 2 card uses ignore slot cooldown".
  - In `stateSnapshot()` (line ~2990), add `overclockChargesRemaining: p.overclockChargesRemaining || 0` to the per-player object.
- **`game/server/index.js`**:
  - Add `overclockChargesRemaining: 0` to player object initialization (line ~876, near `slotCooldowns`).
  - Reset `player.overclockChargesRemaining = 0` on run start (line ~919, near `slotCooldowns` reset).
  - Add `'overclock'` to the implementation gate whitelist (line ~2524).
  - Add `if (keyItemId === 'overclock')` handler block after existing key item blocks (~line 2758):
    - Read `charges` from `def` (default 2)
    - Set `player.overclockChargesRemaining = charges`
    - Set `player.keyItemCooldownUntil = now + (def.cooldownMs || 13000)`
    - Emit `keyItemUsed` response: `{ ok: true, keyItemId, charges: player.overclockChargesRemaining, cooldownUntil: player.keyItemCooldownUntil }`
    - Broadcast `stateUpdate`

## Verification: code
