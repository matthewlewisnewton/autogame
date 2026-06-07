# Ember Descent level-exclusive spawn pool

Wire `ember_wraith` into the `ember_descent` quest enemy pool so it spawns during fire-level runs and appears in no other quest's pool (level-exclusive, mirroring `spawner` on `spire_ascent`).

## Acceptance Criteria

- `QUEST_DEFS.ember_descent.enemyPool` includes `{ type: 'ember_wraith', weight: … }` with a positive weight (suggested 2, alongside existing grunt/skirmisher entries).
- `ember_wraith` appears in **exactly one** quest's `enemyPool`: `ember_descent`. No other quest's base or `tier2EnemyPool` contains it.
- `getEnemyPool('ember_descent')` and `getEnemyPool('ember_descent', 1)` return a pool whose types include `ember_wraith`.
- `pickWeightedEnemyType` / seeded draws on the `ember_descent` pool can return `ember_wraith`; draws on every other quest pool never return it.
- Spawn wiring paths that draw from quest pools (e.g. `spawnCombatEnemies` in `progression.js`, survive/stage-boss pools in `objectives.js`) produce `ember_wraith` enemies on `ember_descent` tier-1 runs when the weighted draw selects it (integration or wiring test with a fixed seed).
- Vitest passes.

## Technical Specs

- `game/server/quests.js`:
  - Add `{ type: 'ember_wraith', weight: 2 }` (tunable) to `ember_descent.enemyPool`.
- `game/server/test/quests-spawn-pools.test.js`:
  - Extend `EXPECTED_POOLS` with `ember_descent: [['ember_wraith', 2], ['grunt', 3], ['skirmisher', 2]]` (adjust if weights differ).
  - Add exclusivity test: `ember_wraith` appears only in `ember_descent`, analogous to the existing `spawner` / `spire_ascent` test.
  - Assert weighted draws can select `ember_wraith` for `ember_descent` and never for other quests.
- `game/server/test/enemy-spawn-pools-wiring.test.js` (extend) or new focused test:
  - Deploy / spawn combat enemies for `ember_descent` with a seed known to pick `ember_wraith`; assert `gameState.enemies` contains at least one `type === 'ember_wraith'`.
  - Assert a non-fire quest (e.g. `training_caverns`) never spawns `ember_wraith`.
- Do **not** implement burning-on-hit or client mesh in this sub-ticket.

## Verification: code
