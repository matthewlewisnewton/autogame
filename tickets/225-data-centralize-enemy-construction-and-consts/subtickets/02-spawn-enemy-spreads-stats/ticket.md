# Spawn enemy: spread combat stats onto entity

Make every spawned enemy self-describing by copying all combat-relevant fields from `ENEMY_DEFS` onto the entity at construction time, then refactor enemy AI to read stats from the entity instead of re-looking-up `ENEMY_DEFS` each tick.

## Acceptance Criteria

- `spawnEnemy` (`progression.js` ~L2456–2486) copies every combat stat from the resolved def onto the new enemy: `chaseSpeed`, `wanderSpeed`, `attackDamage`, `attackWindupMs`, `attackStyle`, and type-specific fields (`attackConeAngle`, `attackRange`, `spawnIntervalMs`, `spawnMaxAlive`, `spawnType`) when present on the def.
- Entity-only runtime fields (`id`, `x`, `z`, `type`, `hp`, `maxHp`, `state`, `attackState`, `wanderTarget`, `lastSpawnTime`, `spawnedBy`, `variant`, variant-applied fields like `shieldHp`) are not overwritten by the spread.
- `updateEnemies` (`simulation.js` ~L1743–1912) reads combat stats from the enemy entity (`enemy.chaseSpeed`, `enemy.attackDamage`, etc.) rather than from `enemyDefFor(enemy.type)` / `ENEMY_DEFS` lookup. Spawner tick logic uses `enemy.spawnIntervalMs`, `enemy.spawnMaxAlive`, `enemy.spawnType` from the entity.
- `isEntityInEnemyAttack` / windup strike paths use entity stat fields (pass enemy or a stats object derived from entity fields, not a separate def lookup).
- New tests in `game/server/test/server.test.js`: after `spawnEnemy(0, 0, 'skirmisher')`, entity has `attackStyle: 'cone'`, `attackConeAngle`, and `chaseSpeed: 4.5`; after `spawnEnemy(0, 0, 'spawner')`, entity has `spawnIntervalMs: 4000` and `spawnMaxAlive: 3`.
- Existing spawn/type/variant/combat tests still pass (`spawnEnemy() type validation`, enemy attack windup tests, spawner add tests).
- `cd game && pnpm test:quick` passes.

## Technical Specs

- `game/server/progression.js`: in `spawnEnemy`, after resolving `def` via `enemyDefFor(type)`, spread stat fields onto the enemy object before variant application. Suggested shape: build `{ id, x, z, type, hp, maxHp, state, attackState, wanderTarget, …statFieldsFromDef }` — exclude `hp` duplication from spread (keep explicit `hp`/`maxHp` from `def.hp`). Apply `applyVariant` after the spread so variant `apply()` hooks can still mutate entity fields.
- `game/server/simulation.js`: refactor `updateEnemies` to use entity fields for `chaseSpeed`, `attackWindupMs`, `attackDamage`, `wanderSpeed`, `attackRange`, spawner config, and cone/radial checks. Update `isEntityInEnemyAttack(enemy, target, def)` signature/callers to read `attackStyle`, `attackConeAngle`, `attackRange` from `enemy` (or rename third arg to `stats` sourced from enemy).
- `game/server/test/server.test.js`: extend `spawnEnemy()` describe blocks with stat-field assertions for at least skirmisher and spawner.
- Client files unchanged — extra stat fields on serialized enemies are additive; renderer already keys off `enemy.type` only.
- Depends on sub-ticket **01-enemy-def-for-throws** (`enemyDefFor` used at spawn).

## Verification: code
