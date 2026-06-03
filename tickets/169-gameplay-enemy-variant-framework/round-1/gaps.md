1. `applyVariant` tags enemies but never invokes the selected variant definition's behavior hook, so future affixes cannot modify stats/AI through the registry seam.
   Files: `game/server/enemyVariants.js`, `game/server/test/enemy_variants.test.js`
   Fix: After selecting a registry id, look up the definition and call `def.apply(enemy)` when it is a function; add a regression test proving a registry hook mutates the enemy while the test/no-op variant remains safe.

2. Variant initialization is only applied in `spawnCombatEnemies`, not the generic `spawnEnemy` path, so direct spawn callers and spawner-created adds bypass the framework and often lack a `variant` field.
   Files: `game/server/progression.js`, `game/server/simulation.js`, `game/server/test/server.test.js`
   Fix: Centralize variant initialization in the spawn flow, with known combat spawns passing the resolved `encounterTier`/seeded `rng` and unknown-tier spawns defaulting to tier 0; add tests that spawned enemies consistently expose `variant` as a tag or `null`.
