# Server: Frenzied variant enrage speed

Add the `frenzied` enemy variant to the 169 registry and wire `updateEnemies` in `game/server/simulation.js` so a Frenzied-tagged enemy moves and attacks faster once its HP falls below 50% of `maxHp`, reusing the existing `ENEMY_DEFS` chase and wind-up fields with runtime multipliers. Cover the chase-speed change with a deterministic server vitest.

## Acceptance Criteria

- `VARIANT_DEFS.frenzied` exists in `game/server/enemyVariants.js` with `id`, `name`, `apply: null`, documented tuning fields (e.g. `chaseSpeedMult > 1` and a wind-up factor that shortens `attackWindupMs` while enraged), and a `bonusDrop` consistent with other variants.
- When `enemy.variant === 'frenzied'` and `enemy.hp < enemy.maxHp * 0.5`, `updateEnemies` uses a higher effective chase speed than the base `ENEMY_DEFS[enemy.type].chaseSpeed` for movement toward players, minions, and taunt targets.
- Under the same enrage condition, wind-up duration uses a shorter effective `attackWindupMs` than the type default (faster attacks).
- Above 50% HP (or when not Frenzied-tagged), chase speed and wind-up match today's type defaults.
- A dedicated server test (e.g. `game/server/test/frenzied_variant.test.js`) asserts: one Frenzied grunt at full HP and the same grunt damaged below 50% `maxHp`, both chasing a player at equal distance, travel farther per `updateEnemies()` tick when enraged; and that a non-Frenzied grunt does not speed up when damaged. Optionally assert a shorter wind-up-to-strike interval with fake timers.
- `pnpm test:quick` passes.

## Technical Specs

- `game/server/enemyVariants.js`: register `frenzied` in `VARIANT_DEFS`. Export a small helper such as `getFrenziedCombatMultipliers(enemy)` returning `{ chaseSpeedMult, attackWindupMult }` (both `1` when not enraged) so simulation and tests share one threshold check (`variant === 'frenzied'` and `hp < maxHp * 0.5`).
- `game/server/simulation.js`: in `updateEnemies`, after `const def = ENEMY_DEFS[enemy.type]`, derive effective `chaseSpeed` and `attackWindupMs` (local variables or inline) from `def` × multipliers. Apply them everywhere this tick uses `def.chaseSpeed * dt` for that enemy (player chase, minion chase, taunt chase) and where wind-up completion compares `elapsed >= def.attackWindupMs`. Do not mutate `ENEMY_DEFS` or add per-enemy stat fields unless an existing variant already does so.
- `game/server/test/frenzied_variant.test.js` (preferred): use `resetGameState`, `addPlayer`, `updateEnemies` from the existing harness; mirror the distance pattern in `server.test.js` (`per-type chase speed in updateEnemies`). Set `maxHp` explicitly on test enemies.
- No client changes in this sub-ticket.

## Verification: code
