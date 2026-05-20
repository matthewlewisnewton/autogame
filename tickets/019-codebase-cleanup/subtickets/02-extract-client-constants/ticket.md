# Extract Client Constants into Shared Config Module

Move all client-side magic numbers and configuration values currently scattered inline in `client/main.js` into a dedicated `client/config.js` ES module. This includes `DECK_MIN_SIZE`, `DECK_MAX_SIZE`, `ENEMY_ATTACK_RANGE`, `MAX_HP`, `MAX_MS`, `CARD_HIT_GRACE_MS`, `ATTACK_EFFECT_DURATION`, `ATTACK_EFFECT_SPEED`, `SUMMON_EFFECT_DURATION`, `SUMMON_EXPAND_MS`, `HIT_SPARK_DURATION`, `LOOT_COLLECT_DURATION`, `acceleration`, `friction`, `CAMERA_OFFSET`, and `SOUND_CONFIG`.

## Acceptance Criteria
- A new file `game/client/config.js` exists and exports all constants listed above.
- `client/main.js` imports constants from `./config.js` instead of defining them inline.
- Duplicate constants between `client/main.js` and `client/dungeon.js` (e.g. `PASSAGE_WIDTH`) are consolidated — `main.js` imports from `config.js`, and `dungeon.js` either imports from `config.js` or keeps its own copy if it's a distinct concern (document the choice).
- All existing client tests continue to pass without modification.
- No other behavioral changes — rendering, movement, and socket messages are identical.

## Technical Specs
- **New file**: `game/client/config.js` — ES module exporting all client constants.
- **Modified file**: `game/client/main.js` — replace inline `const` declarations with `import` from `./config.js`.
- **Possibly modified**: `game/client/dungeon.js` — if `PASSAGE_WIDTH` is consolidated, update import. Otherwise leave unchanged.
- Do not touch `client/cards.js`, `client/hand.js`, `client/collision.js`, `client/delta.js`, or any test files.
- Do not modify `ENEMY_GEOMETRY` or `_playSoundCallLog` — those are data/infrastructure, not config constants.

## Verification: code
