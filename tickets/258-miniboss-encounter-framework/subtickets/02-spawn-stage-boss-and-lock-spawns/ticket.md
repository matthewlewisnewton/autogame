# 02 — Spawn stage boss and lock ambient spawns

When an encounter becomes active, spawn the designated stage boss through the existing `spawnEnemy` path (so per-player miniboss HP scaling from ticket 270 applies automatically), mark it as the stage boss, and suppress ambient enemy spawning while the encounter is locked.

## Acceptance Criteria

- `startStageBossEncounter(gameState, spawnCtx)` (or equivalent) transitions `run.encounter` to `active`, spawns one enemy of `encounter.bossType` at a deterministic arena position (open-plaza: seeded center/floor sample; multi-room: first room matching configured `roomRole` when present), sets `encounter.bossEnemyId`, and flags the enemy (`isStageBoss: true` or equivalent).
- The stage boss uses `spawnEnemy` — with 5+ active players its `hp`/`maxHp` are scaled at spawn; with 1–4 players they match `ENEMY_DEFS` baseline (reuse assertions from `miniboss_hp_scaling.test.js` patterns).
- While `isEncounterLocked(run)` is true, `spawnCombatEnemies`, `updateSurviveSpawns` / objective `tickSpawns`, and ad-hoc spawner ticks do not add new enemies (existing non-boss enemies may be cleared on encounter start if needed for a clean arena — document the chosen behavior in code).
- Quest tiers with `stageBossEncounter` skip bulk combat spawn on deploy (via objective `skipBulkCombatSpawn` hook or encounter-aware guard) so the stage boss is the primary threat, not a full mob pack.
- Unit tests prove: start encounter → exactly one stage boss present, locked spawns blocked, HP scaling path exercised for `bossType: 'miniboss'`.

## Technical Specs

- **`game/server/bossEncounter.js`** — Implement `startStageBossEncounter`, `resolveStageBossSpawnPosition(layout, quest, rng)`, `clearNonBossEnemiesOnEncounterStart` (if used).
- **`game/server/progression.js`** — Gate `spawnCombatEnemies`, `updateSurviveSpawns`, and spawner AI spawn paths with `isEncounterLocked`; invoke start helper from the module (manual call in tests until sub-ticket 03 adds triggers).
- **`game/server/objectives.js`** — Optional `skipBulkCombatSpawn` when quest has `stageBossEncounter`, or centralize skip in `spawnCombatEnemies`.
- **`game/server/test/boss_encounter_spawn.test.js`** (new) — Start encounter manually, assert boss id, `isStageBoss`, scaled HP at high player count, and no additional enemies after a blocked `spawnCombatEnemies` / survive tick.
- Depends on sub-ticket **01** (`run.encounter` + config).

## Verification: code
