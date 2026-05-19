# Client Unit Tests

Write unit tests for the client-side pure functions and data modules in `game/client/`. The `cards.js` module is a clean ES module and can be tested directly. Functions in `main.js` that are DOM-independent (card logic, collision math) should be tested by importing the module or extracting pure helpers.

## Acceptance Criteria
- Tests cover `cards.js` exports:
  - `CARD_DEFS` has exactly 4 entries with correct `type`, `charges`, and (for summons) `magicStoneCost` / `damage`.
  - `createStartingDeck()` returns exactly 8 card IDs with the expected composition (iron_sword ×3, flame_blade ×2, battle_familiar ×2, dungeon_drake ×1).
  - `CARD_TYPE_STYLE` has entries for `weapon`, `summon`, `monster`, each with `color` and `icon`.
  - `weaponCardIds`, `summonCardIds`, `monsterCardIds` Sets contain the correct card IDs.
- Tests cover `wallAABB(wall, halfThickness)` in `main.js` — verify it returns correct min/max bounds for a given wall segment.
- Tests cover `resolveWallCollision(newX, newZ)` — verify it pushes a position outside an AABB back to the edge along the axis of least penetration.
- Tests cover `drawCard()` — verify it pops from `deck` and returns a card object with `charges` set to the card def's max.
- Tests cover `initHand()` — verify it builds a 4-card hand and leaves the remaining cards in `deck`.
- All tests pass with `npm test` in `game/client/`.

## Technical Specs
- **Files to create**:
  - `game/client/test/cards.test.js` — tests for all exports of `cards.js`.
  - `game/client/test/main.test.js` — tests for `wallAABB`, `resolveWallCollision`, `drawCard`, `initHand`.
- **Files to modify**:
  - `game/client/main.js` — add conditional exports (e.g., `if (typeof window === 'undefined') { module.exports = { wallAABB, resolveWallCollision, drawCard, initHand }; }`) so Vitest can access internal functions. Alternatively, refactor `wallAABB` and `resolveWallCollision` into a small pure helper module under `game/client/` and import from both `main.js` and tests.
- **Key detail**: `drawCard` and `initHand` depend on module-level state (`hand`, `deck`, `slotCooldowns`). Tests should reset this state before each test or use a factory/reset function.

## Verification: code
