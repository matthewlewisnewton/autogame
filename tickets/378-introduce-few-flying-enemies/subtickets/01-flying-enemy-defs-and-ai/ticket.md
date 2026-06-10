# Define flying enemy types with airborne AI + cross-height attacks

Add two new flying enemy types to the server enemy catalog that hover at
altitude (376), move in 3D, and attack across heights — one via a spherical
radial AoE (374) and one via a height-aware projectile (375). Their display
metadata and lock-on panel entries (251/252) flow automatically from the
catalog because they carry `name` / `description` / `surfacedStats`.

## Acceptance Criteria
- `ENEMY_DEFS` in `game/server/simulation.js` gains exactly two new entries:
  - `void_seraph`: `flying: true` with a finite `altitude` (~3.0), `attackStyle: 'radial'`,
    a finite `attackRange`, plus `hp`/`chaseSpeed`/`wanderSpeed`/`attackDamage`/`attackWindupMs`,
    and a `name`, `description`, and `surfacedStats` array (including `attackStyle` and `attackRange`).
  - `rime_drifter`: `flying: true` with a finite `altitude` (~3.5), `attackStyle: 'ice_ball'`
    (reusing the existing height-aware projectile path), its own ice-ball tuning fields
    (`iceBallSpeed`, `iceBallRadius`, `iceBallMaxRange`, `iceBallSlowDurationMs`, `iceBallSlowFactor`),
    plus the standard combat fields, and a `name`, `description`, and `surfacedStats` array.
- Both new defs hover: with a non-default floor, `getEntityWorldY()` for a spawned
  instance equals `sampledFloorY + altitude` (never re-grounded), matching `ember_wraith`.
- `void_seraph`'s radial attack resolves with true 3D (spherical) distance: a player
  who is XZ-close but far above/below (beyond `attackRange` in 3D) is NOT hit, while a
  player within the 3D sphere IS hit (`isEntityInEnemyAttack`).
- `rime_drifter` launches a traveling ice-ball on wind-up resolution whose velocity has a
  non-zero `dirY` component when its target is at a different height, and the in-flight ball
  damages a player via the existing 3D contact check in `updateEnemyProjectiles`.
- `buildEnemyDisplayCatalog()` output includes `void_seraph` and `rime_drifter` under `types`,
  each with `name`, `description`, and a populated `surfacedStats` list (so lock-on panel entries exist).
- New/updated vitest server tests cover: hover Y for both types, `void_seraph` spherical
  cross-height hit/miss, `rime_drifter` projectile launch with vertical aim, and catalog presence.
- `pnpm test` (server suite) passes.

## Technical Specs
- `game/server/simulation.js`: add the two `ENEMY_DEFS` entries near the existing
  `ember_wraith` / `glacial_thrower` defs. Reuse the existing machinery — no new attack
  style or projectile system: `radial` already resolves spherically in `isEntityInEnemyAttack`,
  and `attackStyle: 'ice_ball'` already flows through the wind-up resolution branch
  (`spawnIceBall` → `updateEnemyProjectiles`) which carries `dirY` for height-awareness.
  Confirm the `...statFieldsFromDef` spread in `spawnEnemy` propagates `flying`/`altitude`
  onto spawned instances (as it does for `ember_wraith`).
- `game/server/enemyDisplay.js`: no code change expected — the catalog auto-derives from
  `ENEMY_DEFS`; just ensure `surfacedStats` keys exist on the defs so values surface.
- Tests under `game/server/test/` (e.g. new `flying_enemies.test.js`); reference patterns in
  `airborne.test.js`, `enemy_aoe_spherical.test.js`, `ice_enemy.test.js`, `enemy_display_catalog.test.js`.

## Verification: code
