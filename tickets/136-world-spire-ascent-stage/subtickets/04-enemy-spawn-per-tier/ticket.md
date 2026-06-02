# 04 — Enemy spawns distributed across Spire tiers

When a layout is Spire Ascent (rooms carry `tierIndex`), spread combat enemy spawns across low, middle, and top tiers instead of clustering by RNG on combat rooms alone.

## Acceptance Criteria

- For `layout.stage === 'spire-ascent'` with ≥ 3 tiers and `enemyCount ≥ 3`, `spawnCombatEnemies` places at least one enemy on the lowest combat tier, at least one on a non-bottom non-top tier when such a tier exists, and at least one on the highest combat tier (treasure tier may be excluded from combat picks).
- With `enemyCount` less than tier count, spawns still cycle distinct `tierIndex` values before reusing a tier (round-robin), never placing all enemies on tier 0 when multiple tiers exist.
- Non-spire layouts (`generateLayout` default and `{ slopes: true }`) keep existing spawn distribution (no behavior change).
- Enemies spawned on elevated tiers get `y` from `sampleFloorY` at spawn position (existing `spawnEnemy` / floor follow path).
- Unit tests in `game/server/test/` assert tier distribution for a fixed spire layout seed and quest `enemyCount: 5`.

## Technical Specs

- **`game/server/progression.js`**:
  - Update `pickEnemySpawnPosition` (or add `pickSpireEnemySpawnPosition`) to bucket `layout.rooms` by `tierIndex`, skip `role === 'start'`, prefer `combat` rooms, and round-robin tiers.
  - Gate on `layout.stage === 'spire-ascent'` (or presence of `tierIndex` on all rooms).
- **`game/server/test/dungeon.test.js`** or new **`game/server/test/spireSpawn.test.js`**: generate spire layout, call spawn helper with mocked `_gameState` / exported test hook if needed; assert distinct tier indices among enemy positions.

## Verification: code
