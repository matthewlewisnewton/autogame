# 01 — Glacial Tyrant enemy type (server def + drops + scaling + client visuals)

Add the Glacial Tyrant (`glacial_tyrant`) as a new unique boss enemy type: a Tier-II ice miniboss that hurls massive slowing ice balls. This registers the type everywhere an enemy type must exist (server def, drop tables, party-size HP scaling, client geometry/telegraph/model registry) so sub-ticket 03 can use it as the frost_crossing Tier II stage boss. Do NOT touch quests.js in this sub-ticket.

## Acceptance Criteria

- `ENEMY_DEFS.glacial_tyrant` exists in `game/server/simulation.js` with `name: 'Glacial Tyrant'`, `attackStyle: 'ice_ball'`, boss-tier HP (≥ 420, above permafrost_warden's 360), and its own ice-ball tuning fields (`iceBallSpeed`, `iceBallSlowDurationMs`, `iceBallSlowFactor`, `iceBallRadius`, `iceBallMaxRange`). `iceBallSpeed` stays below player MOVE_SPEED (12).
- `enemyDefFor('glacial_tyrant')` returns the def (no throw), and `buildEnemyDisplayCatalog().types.glacial_tyrant` is present with name/description/surfacedStats (automatic once the def exists — assert it in the test).
- `ENEMY_CARD_DROPS.glacial_tyrant` and `ENEMY_MS_DROPS.glacial_tyrant` are set in `game/server/config.js` (card: `dungeon_drake` like the other bosses; magic stones: 70, matching the arena_champion boss tier).
- The miniboss party-size HP scaling branch in `game/server/progression.js` (the `resolvedType === 'miniboss' || ... || resolvedType === 'permafrost_warden'` condition) also covers `glacial_tyrant`, so spawning one with > 4 live players yields scaled hp/maxHp.
- A spawned `glacial_tyrant` that attacks launches an ice ball using its own def tuning (the generic `attackStyle === 'ice_ball'` path in simulation.js — verify via test that the launched ball carries the tyrant's speed/radius/slow values).
- `game/client/renderer.js` has `ENEMY_GEOMETRY.glacial_tyrant` (cone, larger than glacial_thrower — e.g. radius 1.3, height 2.8, deep-ice palette distinct from permafrost_warden) and `ENEMY_ATTACK_VISUAL.glacial_tyrant` (`style: 'projectile'`, range matching the def's `attackRange`, `hitWidth` matching `iceBallRadius`).
- `game/client/models.js` `MODEL_REGISTRY` has a `glacial_tyrant: null` entry alongside the other boss types.
- New server test `game/server/test/glacial_tyrant.test.js` covers the def fields, drop tables, display catalog inclusion, and party-size HP scaling (model it on `permafrost_warden.test.js` / `arena_champion_hp.test.js`).
- Existing vitest server + client suites still pass (`cd game && pnpm test:quick`).

## Technical Specs

- `game/server/simulation.js` — add to `ENEMY_DEFS` (next to `permafrost_warden`):
  ```js
  glacial_tyrant: {
    name: 'Glacial Tyrant',
    description: 'Tier-II tyrant of the frozen crossing — hurls massive glacial spheres that chill (SLOW) and crush whatever they strike.',
    surfacedStats: ['hp', 'attackDamage', 'attackStyle', 'attackRange'],
    hp: 440, chaseSpeed: 1.3, wanderSpeed: 0.6, attackDamage: 24, attackWindupMs: 1300,
    attackStyle: 'ice_ball', attackRange: 9,
    iceBallSpeed: 7.5,
    iceBallSlowDurationMs: 3200,
    iceBallSlowFactor: 0.45,
    iceBallRadius: 1.2,
    iceBallMaxRange: 22,
  },
  ```
  The ice-ball launch path (`launch…` around line 3095, reading `enemy.iceBall*` with `??` fallbacks) is already def-driven — no logic change needed.
- `game/server/config.js` — `ENEMY_CARD_DROPS.glacial_tyrant = 'dungeon_drake'`; `ENEMY_MS_DROPS.glacial_tyrant = 70`.
- `game/server/progression.js` — extend the boss HP-scaling condition (~line 2542) with `|| resolvedType === 'glacial_tyrant'`.
- `game/client/renderer.js` — add entries:
  - `ENEMY_GEOMETRY.glacial_tyrant: { type: 'cone', radius: 1.3, height: 2.8, segments: 14, color: 0x0c4a6e, emissive: 0x38bdf8, emissiveIntensity: 0.45 }`
  - `ENEMY_ATTACK_VISUAL.glacial_tyrant: { style: 'projectile', range: 9, color: 0x7dd3fc, emissive: 0x0ea5e9, hitWidth: 1.2 }`
- `game/client/models.js` — `glacial_tyrant: null` in the enemy-types block of `MODEL_REGISTRY`.
- `game/server/test/glacial_tyrant.test.js` — new file; use `spawnEnemies`/`spawnEnemy` helpers the way `permafrost_warden.test.js` does. For the HP-scaling assertion follow `arena_champion_hp.test.js`-style setup with > 4 players.

## Verification: code
