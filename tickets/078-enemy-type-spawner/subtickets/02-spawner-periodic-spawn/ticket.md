# Spawner Periodic Spawn Mechanic

Implement the core spawner behavior: every `spawnIntervalMs` milliseconds, a living spawner enemy spawns a new skirmisher at a nearby valid position, up to `spawnMaxAlive` concurrent adds.

## Acceptance Criteria

- During each `updateEnemies()` tick, if an enemy's type is `spawner` and it is alive:
  - Track the last spawn time per spawner (add `lastSpawnTime` field on spawn).
  - When `Date.now() - lastSpawnTime >= spawnIntervalMs` and the spawner has fewer than `spawnMaxAlive` living adds, spawn a new skirmisher.
- Spawned skirmishers get a `spawnedBy` field set to the spawner's enemy `id` for cap counting.
- Add position is placed within ~3 units of the spawner, using `randomRoomPosition()` as fallback if wall collision prevents nearby placement.
- Adds use standard skirmisher stats from `ENEMY_DEFS.skirmisher`.
- On spawner death, existing adds **remain** (no mass despawn).
- Unit tests verify: spawn interval timing, `spawnMaxAlive` cap, `spawnedBy` tagging, and that adds survive spawner death.

## Technical Specs

- **File:** `game/server/index.js` — add spawn logic inside `updateEnemies()` tick loop (after the existing chasing/wandering logic, or as a separate per-enemy block). Add `lastSpawnTime: Date.now()` in `spawnEnemy()` when type is `spawner`.
- **File:** `game/server/test/server.test.js` — unit tests for the periodic spawn logic: advance `Date.now()` past interval, verify new enemy appears with `spawnedBy`, verify cap enforcement, verify add survival after spawner removal.

## Verification: code
