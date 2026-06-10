# Server: USE_KEY_ITEM/EQUIP_KEY_ITEM never checks equipped/owned key item (any client can use any key item)

## Difficulty: easy

## Goal

handleUseKeyItem (game/server/keyItemEffects.js:54-100) validates only that data.keyItemId resolves to a known def — it never checks player.equippedKeyItemId === keyItemId. EQUIP_KEY_ITEM (game/server/socketHandlers/keyItemHandlers.js:11-33) also accepts any known id with no ownership check. A modified client can fire USE_KEY_ITEM with dodge_roll, barrier_dome, overclock, phase_step etc. on demand regardless of loadout; the only gate is the shared keyItemCooldownUntil, letting players rotate the whole key-item kit on one cooldown track. Fix: in handleUseKeyItem reject when keyItemId !== player.equippedKeyItemId; add ownership check in the equip handler. Found in code review 2026-06-09.

## Acceptance Criteria

- USE_KEY_ITEM with a keyItemId that is not the player equipped key item is rejected server-side; EQUIP_KEY_ITEM validates ownership/unlock; existing key item tests still pass plus a new test covering the rejection path

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
