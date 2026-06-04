# Frenzied enrage: chase and attack speed below 50% HP

When a `frenzied` variant enemy drops to 50% HP or below, boost its chase speed and
attack speed by writing per-enemy overrides that the existing enemy AI loop already
reads via `chaseSpeed` and `attackWindupMs`. Prove the boost with a focused server
test.

## Acceptance Criteria

- A living enemy with `variant === 'frenzied'` and `hp > maxHp * 0.5` uses base
  type speeds from `ENEMY_DEFS` (no enrage yet).
- Once `hp <= maxHp * 0.5`, the same enemy's effective chase speed is strictly
  greater than the base `ENEMY_DEFS[type].chaseSpeed` and its effective attack
  windup is strictly less than base `attackWindupMs` (faster attacks). Enrage
  latches when the threshold is first crossed and is not reverted if HP heals above
  50% later.
- Enemy movement and wind-up logic in `updateEnemies` consult per-enemy
  `chaseSpeed` / `attackWindupMs` when present, falling back to `ENEMY_DEFS[type]`
  for all other enemies (including non-frenzied variants).
- Enrage is recomputed after damage (all server damage paths that reduce enemy HP)
  and is safe when `maxHp` is missing (treat as no enrage).
- A server test demonstrates measurable chase-speed increase after dropping a
  frenzied grunt below half HP (assert on resolved `chaseSpeed` or on movement
  distance over one tick with fixed `dt`, not merely that a flag exists).
- Existing server + client tests pass.

## Technical Specs

- `game/server/enemyVariants.js` (or `game/server/simulation.js`): export tunable
  constants, e.g. `FRENZIED_HP_THRESHOLD = 0.5`, `FRENZIED_CHASE_SPEED_MULT`,
  `FRENZIED_ATTACK_SPEED_MULT` (attack speed = divide `attackWindupMs` by this
  factor). Add `applyFrenziedEnrage(enemy)` that no-ops unless
  `enemy.variant === 'frenzied'`, sets `enemy.frenziedEnraged = true` once latched,
  and copies boosted `chaseSpeed` / `attackWindupMs` onto the enemy from
  `ENEMY_DEFS[enemy.type]`.
- `game/server/simulation.js`: in `updateEnemies` (~1680–1838), resolve
  `chaseSpeed` and `attackWindupMs` from the enemy instance when set; replace
  `def.chaseSpeed` / `def.attackWindupMs` in chase, taunt-chase, and wind-up
  elapsed checks. Call `applyFrenziedEnrage(enemy)` at the top of each living
  enemy's AI iteration and from shared enemy-damage helpers after `enemy.hp` changes.
- `game/server/test/frenzied_variant.test.js` (new): spawn or construct a frenzied
  grunt, assert base speeds above half HP, damage to `hp <= maxHp * 0.5`, call
  enrage helper or one `updateEnemies` tick, assert boosted `chaseSpeed` (and lower
  windup). Optionally assert a plain `variant: null` grunt is unchanged.
- `game/server/debugScenarios.js`: extend `variant-enemy` or add `frenzied-enemy`
  that spawns a `frenzied` grunt already below half HP so manual playtesting shows
  faster pursuit (optional but recommended).

## Verification: code
