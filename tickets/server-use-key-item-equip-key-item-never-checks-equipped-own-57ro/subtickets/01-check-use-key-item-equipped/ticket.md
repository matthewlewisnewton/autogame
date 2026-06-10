# Reject USE_KEY_ITEM when keyItemId does not match player's equipped key item

## Description

`handleUseKeyItem` in `game/server/keyItemEffects.js` validates that `data.keyItemId` resolves to a known def but never checks `player.equippedKeyItemId === keyItemId`. A modified client can fire `USE_KEY_ITEM` with any known key item ID (dodge_roll, barrier_dome, overclock, phase_step, etc.) regardless of what the player actually has equipped. Fix: add an ownership check after the `getKeyItemDef()` guard and reject with a new `not_equipped` reason when the IDs don't match.

## Acceptance Criteria

- `handleUseKeyItem` rejects with `{ ok: false, reason: 'not_equipped' }` when `data.keyItemId !== player.equippedKeyItemId`
- The rejection occurs BEFORE any effect logic runs (no cooldown burn, no state mutation)
- Using the correctly equipped key item still works (existing dodge_roll, overclock, phase_step, etc. tests pass)
- New unit test in `game/server/test/key-items.test.js` covering the `not_equipped` rejection path

## Technical Specs

- **File:** `game/server/keyItemEffects.js` — add check after line ~78 (`getKeyItemDef` guard), before the cooldown check:
  ```js
  if (keyItemId !== player.equippedKeyItemId) {
    socket.emit(SERVER_TO_CLIENT.KEY_ITEM_USED, { ok: false, reason: 'not_equipped' });
    return;
  }
  ```
- **File:** `game/server/test/key-items.test.js` — add test: connect client, start run, set `player.equippedKeyItemId = 'dodge_roll'`, emit `useKeyItem` with `keyItemId: 'overclock'`, assert `ok: false` and `reason: 'not_equipped'`

## Verification: code
