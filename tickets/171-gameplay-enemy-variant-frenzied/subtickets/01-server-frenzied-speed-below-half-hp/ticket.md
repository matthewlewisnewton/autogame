# Server: Frenzied variant speed below 50% HP

Add the `frenzied` enemy variant to the registry and wire its combat-speed boost into enemy AI so a Frenzied-tagged enemy moves and attacks faster only while `hp < 0.5 * maxHp`. Reuse the existing `chaseSpeed` and `attackWindupMs` values from `ENEMY_DEFS` via a small resolver used by `updateEnemies`, rather than duplicating movement math.

## Acceptance Criteria

- `VARIANT_DEFS` includes a `frenzied` entry (`id`, `name`, `bonusDrop`, and documented constants for the HP threshold, e.g. `0.5`, and a speed multiplier, e.g. `1.5`).
- While `enemy.variant === 'frenzied'` and `enemy.hp > 0` and `enemy.hp < enemy.maxHp * threshold`, effective chase speed used in `updateEnemies` is strictly greater than the base `ENEMY_DEFS[type].chaseSpeed`; at or above the threshold (or when not Frenzied-tagged), effective chase speed equals the base value.
- While frenzied-active (same HP/variant conditions), effective `attackWindupMs` used for wind-up completion is strictly less than the base `ENEMY_DEFS[type].attackWindupMs`.
- Healing back above 50% HP removes the boost; non-`frenzied` enemies are unaffected at any HP.
- A dedicated server test file asserts the resolver outputs (base vs boosted chase speed and windup) for above-threshold, below-threshold, and non-frenzied cases; `pnpm test:quick` passes.
- No client changes in this sub-ticket.

## Technical Specs

- `game/server/enemyVariants.js`: add `frenzied` to `VARIANT_DEFS` with `apply: null` and `bonusDrop` consistent with other variants. Export constants such as `FRENZIED_HP_THRESHOLD` and `FRENZIED_SPEED_MULT`, plus helpers `isFrenziedActive(enemy)` and `getEffectiveEnemyCombatStats(enemy, baseDef)` returning `{ chaseSpeed, attackWindupMs }` derived from the base def and frenzied state.
- `game/server/simulation.js`: in `updateEnemies`, replace direct `def.chaseSpeed` / `def.attackWindupMs` reads for player/minion chase, taunt chase, and wind-up elapsed checks with the effective stats from the helper (keep using `ENEMY_DEFS[enemy.type]` as the base def).
- `game/server/test/frenzied_variant.test.js` (preferred): unit-test the resolver with plain objects (no full tick sim required if the helper is pure). Assert numeric ordering: boosted chase > base, boosted windup < base, and equality when HP is high or `variant` is not `frenzied`. Optionally import `ENEMY_DEFS` for a grunt baseline.
- Do not mutate spawn-time stats; the boost is dynamic from current HP only.

## Verification: code
