# Server: Leeching variant heals on player damage

Add the `leeching` enemy variant to the registry and wire it into `damagePlayer` so a Leeching-tagged attacker heals itself for a fixed fraction of HP actually removed from a player, capped at `maxHp`. Reuse the existing `attackerEnemyId` option on `damagePlayer` (enemy melee wind-up and any other call sites that pass it) so all player-damage paths funnel through one hook.

## Acceptance Criteria

- `VARIANT_DEFS` includes a `leeching` entry (`id`, `name`, `bonusDrop`, and a documented `leechFraction` constant, e.g. `0.25`).
- When `damagePlayer` reduces a player's HP and `options.attackerEnemyId` refers to a living enemy with `variant === 'leeching'`, that enemy gains `floor(leechFraction * damageDealt)` HP (or equivalent rounding documented in code), where `damageDealt` is the amount actually applied to the player after shields/blocking (the `remaining` value applied to `player.hp`), not the raw pre-mitigation amount.
- Leech healing never raises `enemy.hp` above `enemy.maxHp`.
- No healing occurs when player damage is fully prevented (invulnerability, barrier block, one-hit shield absorb, `remaining <= 0`, etc.) or when the attacker is missing, dead, or not Leeching-tagged.
- A dedicated server test file (or `enemy_variants.test.js` / `server.test.js` section) asserts heal amount, max-HP cap, and the no-heal cases above; `pnpm test:quick` passes.

## Technical Specs

- `game/server/enemyVariants.js`: add `leeching` to `VARIANT_DEFS` with `apply: null` (no spawn-time stat mutation) and `bonusDrop` consistent with other variants. Export a helper such as `applyLeechHeal(attackerEnemyId, damageDealt, enemies)` that looks up the attacker, checks `variant === 'leeching'`, reads `leechFraction` from the def, and mutates `enemy.hp` with the cap. Export the fraction constant for tests.
- `game/server/simulation.js`: in `damagePlayer`, after `player.hp` is reduced with `remaining > 0`, call the leech helper when `options.attackerEnemyId` is set. Do not duplicate heal logic at individual call sites.
- `game/server/test/leeching_variant.test.js` (preferred) or extend `game/server/test/enemy_variants.test.js`: set up `gameState` with a player and leeching enemy, call `damagePlayer` with `{ attackerEnemyId }`, assert HP deltas. Cover cap-at-max, non-leeching attacker, and blocked damage (`remaining` never applied).
- No client changes in this sub-ticket.

## Verification: code
