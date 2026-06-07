# 01 — Ice enemy server: glacial ball thrower, traveling ice-ball projectile, slow-on-hit

Add the ice level's signature foe — a ranged enemy that lobs a slow-moving GIANT ICE BALL.
The new traveling projectile entity is simulated server-side: on hit it applies the SLOW
status (`applySlow`) plus damage to the player. Register the enemy's display metadata so the
lock-on info panel surfaces its name/stats/description automatically, and wire it into the
ice level's per-level spawn pool. Cover the projectile travel and slow-on-hit with server tests.

## Acceptance Criteria

- A new enemy type (e.g. `glacial_thrower`) exists in `ENEMY_DEFS` in `game/server/simulation.js`
  with `name`, `description`, `surfacedStats`, `hp`, `chaseSpeed`, `wanderSpeed`, `attackDamage`,
  `attackWindupMs`, `attackRange`, and a ranged `attackStyle` (e.g. `'ice_ball'`).
- The enemy def carries ice-ball tuning fields: a projectile travel speed (slow — clearly below
  any player's move speed), a slow duration (ms), and a slow factor (0–1).
- The ice enemy is added to the ice level's spawn pool: an entry for the new type is present in
  the `frost_crossing` quest's `enemyPool` in `game/server/quests.js` (level-exclusive / thematic —
  do not add it to non-ice quests).
- When the enemy completes its attack wind-up it SPAWNS a traveling ice-ball projectile aimed at
  the locked wind-up direction (it does NOT deal instant melee/cone damage like other enemies).
- Ice-ball projectiles are stored in game state (e.g. `_gameState.iceBalls`), initialized in
  `game/server/game-state.js`, advanced each tick by a new update function called from the server
  tick loop, and travel in a straight line at the configured speed.
- A projectile that reaches a player (within a hit radius) calls `applySlow(player, durationMs, factor)`
  AND `damagePlayer(playerId, attackDamage, { attackerEnemyId })`, then is removed. Projectiles also
  expire when they exceed their max range/lifetime or leave the dungeon, so they never accumulate.
- Each living ice-ball projectile is included in the broadcast state snapshot
  (`buildWorldSnapshot` in `game/server/progression.js`) so clients can render it.
- The lock-on display catalog (`buildEnemyDisplayCatalog` / `game/server/enemyDisplay.js`) returns an
  entry for the new type with its name, description, and surfaced stat values (this flows automatically
  from `ENEMY_DEFS`; verify it appears).
- A server test file under `game/server/test/` (vitest) asserts: (a) a wind-up completion spawns an
  ice-ball projectile, (b) the projectile travels over successive update ticks, and (c) a projectile
  reaching a player applies SLOW (player becomes `isSlowed`) and reduces the player's HP.
- `pnpm test` passes (server + client suites).

## Technical Specs

- `game/server/simulation.js`:
  - Add the new entry to `ENEMY_DEFS` (mirror the shape of `field_medic`/`grunt`: `name`,
    `description`, `surfacedStats`, combat stats). Choose `surfacedStats` from real fields
    (e.g. `['hp', 'attackDamage', 'attackStyle', 'attackRange']`).
  - In `updateEnemies()` wind-up resolution (~line 2462), special-case the ranged ice attack style:
    instead of the instant `damagePlayer`/`damageMinion` strike, spawn an ice-ball projectile using
    the enemy's locked `windupDirX/windupDirZ`, then go to `recovering`.
  - Add `updateEnemyProjectiles()` (new): advance each projectile by `speed * dt`, test collision vs
    players (`Math.hypot`, hit radius), on hit call `applySlow` + `damagePlayer` and remove it, and
    drop projectiles past their lifetime/range or outside the dungeon. `applySlow`, `damagePlayer`,
    and `isSlowed` already exist in this file.
  - Export the new update function (and any helper) in `module.exports`.
- `game/server/game-state.js`: add `iceBalls: []` (or chosen name) to the initial state object
  alongside `enemies/minions/loot`.
- `game/server/index.js`: call `updateEnemyProjectiles()` in the tick loop right after
  `updateEnemies()` (~line 1356); import it from simulation alongside the other sim functions.
- `game/server/quests.js`: add `{ type: '<newType>', weight: <n> }` to `frost_crossing.enemyPool`.
- `game/server/progression.js`: add the projectile array to `buildWorldSnapshot()` (~line 2961) so it
  ships in every state update.
- `game/server/enemyDisplay.js`: no change expected (catalog is derived from `ENEMY_DEFS`); confirm
  the new type surfaces.
- New test: `game/server/test/ice_enemy.test.js` — reference `game/server/test/slow_status.test.js`
  and `game/server/test/field_medic.test.js` for harness setup (`setGameState`, spawning an enemy,
  driving ticks, asserting `applySlow`/`isSlowed` and HP).

## Verification: code
