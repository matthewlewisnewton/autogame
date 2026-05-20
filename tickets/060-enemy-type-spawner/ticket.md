# Enemy Type: Spawner (Summons Skirmishers)

## Dependencies

- `059-enemy-types-skirmisher-miniboss` — requires `ENEMY_DEFS`, `skirmisher`
  type, and per-type AI/stat plumbing.

## Context

Add a third **new** archetype (fourth type overall): a medium-HP **spawner**
that periodically creates additional **skirmisher** enemies while alive. This
adds pressure without another high-damage melee threat.

## Goal

During combat, players must decide whether to focus the spawner or clean up
its adds. Adds use existing skirmisher stats from `ENEMY_DEFS`.

## Spawner Definition

Extend `ENEMY_DEFS` with:

| id | role | hp | chaseSpeed | attackDamage | spawnIntervalMs | spawnMaxAlive | spawnType |
|----|------|-----|------------|--------------|-----------------|---------------|-----------|
| `spawner` | summoner | 60 | 1.8 | 8 | 4000 | 3 | `skirmisher` |

Suggested behavior:

- Uses the same chase/windup AI as other enemies but does **not** need a unique
  attack pattern beyond defs.
- Every `spawnIntervalMs` while alive and in `playing` run:
  - If fewer than `spawnMaxAlive` skirmishers tagged as this spawner’s adds are
    alive, spawn one `skirmisher` at a valid nearby position (within ~3 units,
    not inside walls — reuse `randomRoomPosition()` or wall-aware helper if
    available).
- Optional: store `spawnedBy: spawnerEnemyId` on adds for cap counting and cleanup.
- On spawner death: existing adds remain (no mass despawn) unless tuning says
  otherwise — document choice in implementation.

## Spawning in Runs

- Adjust the run-start spawn table from 059 to include **one** spawner, e.g.:
  - 2× skirmisher, 1× grunt, 1× miniboss, 1× spawner
- Keep total initial spawn count ~5; spawner may raise enemy count mid-run.

## Client

- Distinct mesh/color for spawner (e.g. octahedron or scaled cone + emissive pulse).
- Optional subtle telegraph or log when a spawn occurs; no full VFX ticket required.

## Acceptance Criteria

- `spawner` exists in `ENEMY_DEFS` and appears in the default spawn mix.
- While alive, spawner creates skirmishers on an interval, respecting `spawnMaxAlive`.
- Spawned skirmishers use skirmisher stats and participate in run objective counts.
- Spawner respects dungeon bounds / wall collision if 024 or 048 land first; otherwise
  use same placement rules as `randomRoomPosition()`.
- Integration test: start run with spawner, advance time or tick loop, assert enemy
  count increases and at least one add has `skirmisher` type.
- No regression to grunt/miniboss behavior from 059.

## Files

- `game/server/index.js`
- `game/client/main.js`
- `game/server/test/integration.test.js`

## Out of Scope

- Card drops per enemy type (042)
- Quest-specific spawn tables (040/041)
