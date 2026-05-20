# Derive minion chase speed from `ENEMY_DEFS.grunt.chaseSpeed`

Remove the `MINION_CHASE_SPEED` constant and have `updateMinions()` read chase speed directly from `ENEMY_DEFS.grunt.chaseSpeed` so there is a single source of truth.

## Acceptance Criteria
- `updateMinions()` reads chase speed from `ENEMY_DEFS.grunt.chaseSpeed` instead of a local `MINION_CHASE_SPEED` constant.
- The `MINION_CHASE_SPEED` constant is removed from `game/server/index.js`.
- All existing server unit and integration tests pass.

## Technical Specs
- **File:** `game/server/index.js`
  - Delete `const MINION_CHASE_SPEED = 2.5;` (line ~907).
  - Replace the reference `MINION_CHASE_SPEED * dt` in `updateMinions()` (line ~940) with `ENEMY_DEFS.grunt.chaseSpeed * dt`.
- **No other files changed.**

## Verification: code
