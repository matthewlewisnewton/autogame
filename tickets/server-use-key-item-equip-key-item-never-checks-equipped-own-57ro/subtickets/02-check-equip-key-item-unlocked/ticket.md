# Validate ownership/unlock in EQUIP_KEY_ITEM handler

## Description

The `EQUIP_KEY_ITEM` handler in `game/server/socketHandlers/keyItemHandlers.js` accepts any known key item ID and sets `player.equippedKeyItemId` without checking whether the player has unlocked that item. Fix: import and call `isKeyItemUnlocked` from `progression.js` before equipping; reject with `not_unlocked` reason when the check fails. (Currently all 14 key items are unlocked at start, so this is a forward-compatible guard for future unlock-gating.)

## Acceptance Criteria

- `EQUIP_KEY_ITEM` rejects with `{ reason: 'not_unlocked' }` when `isKeyItemUnlocked(player, keyItemId)` returns false
- Equipping a key item the player has unlocked still works (existing `equipKeyItem` test passes)
- New unit test in `game/server/test/key-items.test.js` covering the `not_unlocked` rejection path

## Technical Specs

- **File:** `game/server/socketHandlers/keyItemHandlers.js` — import `isKeyItemUnlocked` from `../progression`, add check after the `getKeyItemDef` guard (line ~24):
  ```js
  if (!isKeyItemUnlocked(player, keyItemId)) {
    socket.emit(SERVER_TO_CLIENT.KEY_ITEM_ERROR, { reason: 'not_unlocked' });
    return;
  }
  ```
- **File:** `game/server/test/key-items.test.js` — add test mocking `isKeyItemUnlocked` to return false for a specific key item ID, emit `equipKeyItem`, assert `keyItemError` with `reason: 'not_unlocked'` and that `equippedKeyItemId` was not changed

## Verification: code
