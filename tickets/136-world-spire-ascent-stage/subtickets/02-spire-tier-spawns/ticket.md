# Spire Ascent — tier enemy & objective placement

Teach progression/spawn helpers to recognize the spire-ascent profile and distribute combat enemies across multiple tier bands while placing collect objectives on the top treasure tier (never on ramps).

## Acceptance Criteria

- `isSpireAscentLayout(layout)` is true when `layout.profile === 'spire-ascent'`.
- After `spawnEnemies()` on a spire-ascent layout with a typical enemy count (≥ 5), at least one enemy sits on the bottom tier (`tierIndex === 0`), at least one on a non-bottom, non-top tier when tier count ≥ 3, and at least one on the top treasure tier — and not all enemies share the same tier.
- No enemy spawn position resolves to a ramp/connector room (`band === 'ramp'` or `role === 'connector'`).
- `spawnCrystals` / collect-objective loot for spire-ascent places crystals only in the treasure-tier room (top `band: 'tier'` with `role: 'treasure'`).
- Spawn positions are deterministic for a fixed `layoutSeed` (same enemy coordinates on repeat).
- New server test file (e.g. `game/server/test/spire_ascent_spawn.test.js`) exercises the above using `generateLayout(seed, 'spire-ascent')` without starting the HTTP server.

## Technical Specs

- **`game/server/progression.js`**
  - Add `isSpireAscentLayout`, `spireAscentRoomsByTierIndex` (or by `tierIndex` / top-bottom band).
  - Add `pickSpireAscentEnemySpawn(layout, rng, spawnIndex, enemyCount)` — round-robin or quota slots across bottom/middle/top tier rooms; mirror `pickSunkenCanyonEnemySpawn` structure.
  - Branch `pickEnemySpawnPosition`, `spawnCrystals`, and `spawnLoot` when `isSpireAscentLayout(layout)`.
- **`game/server/test/spire_ascent_spawn.test.js`**
  - Import `generateLayout`, `spawnEnemies`, `spawnCrystals`, `resetGameState`, etc. from `../index.js` (same pattern as `sunken_canyon_spawn.test.js`).

## Verification: code
