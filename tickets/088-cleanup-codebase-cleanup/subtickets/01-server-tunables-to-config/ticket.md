# Move server runtime tunables into config

Extract remaining inline numeric literals in `game/server/index.js` into `game/server/config.js` so all server-side balance and timing values are centrally configurable.

## Acceptance Criteria
- `game/server/config.js` exports constants for: `RESPAWN_DELAY_MS` (3000), `LOOT_LIFETIME_MS` (120000), `LOOT_SPAWN_CHANCE` (0.5), `STALE_CLEANUP_INTERVAL_MS` (5000).
- `game/server/index.js` imports and uses those four constants instead of inline literals.
- The inline values `3000` (respawn setTimeout), `120000` (loot expiry filter), `0.5` (loot spawn guard), and `5000` (stale cleanup setInterval) no longer appear as magic numbers in `index.js`.
- Existing server tests continue to pass.
- No other changes — do not touch client code, styling, or unrelated server logic.

## Technical Specs
- **Files to change:** `game/server/config.js` (add 4 exports), `game/server/index.js` (import + replace 4 literals)
- Add to `config.js`:
  - `RESPAWN_DELAY_MS = 3000`
  - `LOOT_LIFETIME_MS = 120000`
  - `LOOT_SPAWN_CHANCE = 0.5`
  - `STALE_CLEANUP_INTERVAL_MS = 5000`
- In `index.js`, add `const { … } = require('./config');` (or append to existing require) and replace each inline literal with its named constant.
- No other changes.

## Verification: code
