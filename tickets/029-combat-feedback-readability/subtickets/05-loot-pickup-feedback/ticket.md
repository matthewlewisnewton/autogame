# Loot Pickup Feedback

When the player picks up a loot coin, produce immediate visual feedback so the collection is obvious.

## Acceptance Criteria
- A `markLootCollected(lootId)` helper function exists in `game/client/main.js`.
- When `lootPickup` is confirmed by the server (loot disappears from `gameState.loot` in the next `stateUpdate`), the loot mesh at that position plays a brief "collected" animation before disappearing.
- The currency display (`#currency-display`) updates to show the new total (already works via `stateUpdate`, but verify it still functions).
- A small floating "+N" number appears at the pickup position showing the gold amount gained.

## Technical Specs
- **File:** `game/client/main.js`
  - Add `markLootCollected(lootId, value)` — triggers a brief scale-up + fade animation on the loot mesh, then removes it. Also spawns a floating "+N" text at the loot's position using `spawnDamageNumber` (from sub-ticket 03).
  - In `syncLootMeshes()`, when a loot ID is no longer in `gameState.loot` but still has a mesh, call `markLootCollected` to play the removal animation instead of immediately removing the mesh.
  - Track the previous currency value; when it increases, optionally show a brief flash on the `#currency-display` element.
- **File:** `game/client/test/main.test.js`
  - Test that `markLootCollected` exists and schedules mesh removal.

## Verification: code
