# Centralize simulation tuning constants in config

Remove duplicated and inline tuning literals from `simulation.js` by importing shared values from `config.js`, and decouple minion chase speeds from direct `ENEMY_DEFS.grunt` / `ENEMY_DEFS.skirmisher` references.

## Acceptance Criteria

- `game/server/simulation.js` has **no** local `const PROJECTILE_HIT_WIDTH = 1.2;` — it imports `PROJECTILE_HIT_WIDTH` from `./config` and all usages (~L874, ~L907, ~L1105) reference the import.
- `MINION_FOLLOW_DISTANCE` and `MINION_FOLLOW_SPEED` are defined once in `game/server/config.js`, exported from `module.exports`, and imported in `simulation.js` (local definitions at ~L783–784 removed).
- New named exports in `config.js` for minion chase tuning used in `updateMinions` (~L1984–2195): at minimum `MINION_CHASE_SPEED_GRUNT` (`2.5`) and `MINION_CHASE_SPEED_SKIRMISHER` (`4.5`). Replace every `ENEMY_DEFS.grunt.chaseSpeed` and `ENEMY_DEFS.skirmisher.chaseSpeed` reference inside `updateMinions` / `updateWyrmMinionAI` call sites with these config constants (including the bulkhead `* 0.75` case — use `MINION_CHASE_SPEED_GRUNT * 0.75` or a named `MINION_BULKHEAD_CHASE_SPEED` if clearer).
- `MINION_FOLLOW_SPEED` in config is the literal `2.5` (same numeric value as grunt chase speed today), **not** derived from `ENEMY_DEFS`.
- `game/server/index.js` re-exports updated config/simulation constants as needed for tests (`PROJECTILE_HIT_WIDTH` already exported from config; keep `MINION_FOLLOW_*` export path working).
- `game/server/test/server.test.js`: update `MINION_FOLLOW_SPEED` assertion (~L1351–1353) to expect `2.5` directly instead of `ENEMY_DEFS.grunt.chaseSpeed`.
- `grep -r 'PROJECTILE_HIT_WIDTH = 1.2' game/server/simulation.js` returns no matches; `grep 'ENEMY_DEFS\.(grunt|skirmisher)\.chaseSpeed' game/server/simulation.js` returns no matches inside minion AI.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- `game/server/config.js`: add `MINION_FOLLOW_DISTANCE = 3`, `MINION_FOLLOW_SPEED = 2.5`, `MINION_CHASE_SPEED_GRUNT = 2.5`, `MINION_CHASE_SPEED_SKIRMISHER = 4.5` near existing combat constants (~L8–17). Export them in `module.exports`.
- `game/server/simulation.js`: extend config destructuring import (~L6–24) with `PROJECTILE_HIT_WIDTH`, `MINION_FOLLOW_DISTANCE`, `MINION_FOLLOW_SPEED`, `MINION_CHASE_SPEED_GRUNT`, `MINION_CHASE_SPEED_SKIRMISHER`. Delete local duplicates (~L783–785). Swap minion-movement literals in `updateMinions` and the `updateWyrmMinionAI` options object (~L2182).
- `game/server/index.js`: ensure destructuring/re-exports include any new config constants tests import.
- `game/server/test/server.test.js`: adjust minion constant test expectations.
- Do **not** move `ENEMY_DEFS` itself to config — enemy type defs stay in `simulation.js`.
- Depends on sub-ticket **02-spawn-enemy-spreads-stats** (enemy AI no longer needs def lookup; this ticket cleans minion/config drift only).

## Verification: code
