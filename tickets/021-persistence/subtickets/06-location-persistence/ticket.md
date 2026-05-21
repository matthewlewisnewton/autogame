# Persist Player Location

Include authoritative location fields (`x`, `y`, `z`, `rotation`) in `extractPersistentData()` so that a player's position is saved alongside currency, inventory, and deck.

## Acceptance Criteria
- `extractPersistentData()` in `game/server/index.js` returns `x`, `y`, `z`, and `rotation` in the persisted data object.
- The returned object shape is `{ currency, ownedCards, selectedDeck, x, y, z, rotation }`.
- Existing persisted fields (currency, ownedCards, selectedDeck) are unchanged.

## Technical Specs
- **File**: `game/server/index.js`
- Modify `extractPersistentData(player)` to add `x: player.x`, `y: player.y`, `z: player.z`, `rotation: player.rotation` to the returned object.

## Verification: code
