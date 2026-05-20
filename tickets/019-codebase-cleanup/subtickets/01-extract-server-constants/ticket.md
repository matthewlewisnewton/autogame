# Extract Server Constants into Shared Config Module

Move all server-side magic numbers and configuration values currently scattered inline in `server/index.js` into a dedicated `server/config.js` module. This includes `TICK_RATE`, `DETECTION_RADIUS`, `ENEMY_ATTACK_RANGE`, `ENEMY_ATTACK_RECOVERY_MS`, `MAX_MAGIC_STONES`, `MAGIC_STONES_REGEN_PER_TICK`, `SUMMON_RADIUS`, `ATTACK_RANGE`, `ATTACK_CONE_ANGLE`, `STALE_THRESHOLD`, `BOUNDS_MARGIN`, `SPAWN_PADDING`, `DECK_MIN_SIZE`, `DECK_MAX_SIZE`, `MAX_HP`, and the `VICTORY_REWARD_ROTATION` array.

## Acceptance Criteria
- A new file `game/server/config.js` exists and exports all constants listed above.
- `server/index.js` imports constants from `./config` instead of defining them inline.
- All existing exports from `server/index.js` (used by tests) continue to work — no test breakage.
- The `MAX_HP` constant is defined in `config.js` and used in place of all hardcoded `100` values for player HP in `server/index.js` (at least 6 occurrences).
- No other behavioral changes — game logic, socket messages, and test outputs are identical.

## Technical Specs
- **New file**: `game/server/config.js` — exports all server constants via `module.exports`.
- **Modified file**: `game/server/index.js` — replace inline `const` declarations with `require('./config')` imports; replace all `hp: 100` / `hp = 100` with `hp: MAX_HP` / `hp = MAX_HP`.
- Do not touch `server/dungeon.js`, `server/test/`, or any client files.
- Do not modify `CARD_DEFS`, `ENEMY_DEFS`, `STARTING_DECK_IDS`, or `DEBUG_SCENARIOS` — those remain in `index.js` (they are data definitions, not config constants).

## Verification: code
