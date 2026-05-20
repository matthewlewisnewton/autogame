# Cleanup nits from 077-enemy-types-skirmisher-miniboss

> **Staleness note.** This follow-up ticket was written against commit
> `c480e74` (2026-05-20). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `077-enemy-types-skirmisher-miniboss`.
None blocked acceptance — clean them up when convenient.

## QA capture scenario shows only the nearby grunt

Round-5 QA used the `summon-ready` scenario, which leaves the
`spawnEnemies()` pack scattered across random rooms and only places a
single nearby grunt via `ensureNearbyEnemy()`. Result: the three
verification screenshots (`01-mixed-spawn.png`, `02-enemy-movement.png`,
`03-combat-feedback.png`) all show a single red grunt cone, so the
distinct skirmisher / miniboss visuals are never actually pictured.
Switching the capture plan to the new `mixed-enemies` debug scenario (or
having the QA player walk to where the spawn pack lives) would give
genuine visual evidence of "distinguishable meshes per type" — the
acceptance criterion the screenshots are meant to back.

### Acceptance Criteria
- Update the agent capture plan for enemy-type tickets to prefer
  `?debugScenario=mixed-enemies`, or include an explicit screenshot of
  the three-type lineup near the player.
- At least one screenshot in the capture clearly shows the orange
  skirmisher cone (small), purple miniboss cone (large), and red grunt
  cone together.

## Stale enemy combat constants

`ENEMY_ATTACK_DAMAGE`, `ENEMY_ATTACK_WINDUP_MS`, `CHASE_SPEED`, and
`WANDER_SPEED` in `game/server/index.js` (lines 132-138) are no longer
the runtime source of truth — `updateEnemies()` reads per-type values
from `ENEMY_DEFS`. They duplicate `ENEMY_DEFS.grunt.*`. The constants
are still exported and asserted in tests, which keeps them load-bearing
for tests but invites drift from the defs.

### Acceptance Criteria
- Either delete `ENEMY_ATTACK_DAMAGE` / `ENEMY_ATTACK_WINDUP_MS` /
  `CHASE_SPEED` / `WANDER_SPEED` and update tests to read from
  `ENEMY_DEFS.grunt` instead, **or** define them as `ENEMY_DEFS.grunt.*`
  references so there is a single source of truth.
- Server tests still pass with no duplicated literals.

## Client `ENEMY_MESH_HEIGHT` duplicates `createEnemyMesh` geometry

`game/client/main.js:761-765` hard-codes per-type cone half-heights in a
side-table that must be kept in sync with the `ConeGeometry(...)` calls
inside `createEnemyMesh()` (lines 779-797). If a future ticket tweaks a
mesh size, the health-bar / mesh y-position will silently drift.

### Acceptance Criteria
- Refactor so the half-height comes from a single per-type record
  (e.g. include geometry args in one map and derive both the mesh and
  `ENEMY_MESH_HEIGHT` from it), or compute half-height from the geometry
  itself.
- No behaviour change; existing client tests still pass.
