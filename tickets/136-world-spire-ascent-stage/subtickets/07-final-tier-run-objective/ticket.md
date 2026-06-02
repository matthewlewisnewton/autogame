# Final Tier Run Objective

Ensure the spire-ascent **top tier** participates in the `spire_ascent` defeat-enemies run: at least one counted combat enemy (or equivalent objective target) spawns on the final `treasure` tier so clearing the quest requires reaching and fighting on the summit.

## Acceptance Criteria

- For `generateLayout(..., { stage: 'spire-ascent' })`, the highest `tierIndex` room (`role: 'treasure'`) can host combat spawns for `spire_ascent` — not only intermediate `combat` tiers.
- When a run starts with quest `spire_ascent`, at least one entry in `_gameState.enemies` has a position inside the treasure tier room bounds (sample or compare XZ against that room's `x`, `z`, `width`, `depth`).
- `run.objective.totalEnemies` includes that final-tier enemy; defeating all spawned enemies (including the summit one) satisfies `isRunObjectiveComplete` for the quest.
- Layout role assignment in `assignSpireRoomRoles` may stay as-is (`treasure` on top) if spawn logic explicitly targets the treasure room for spire-ascent; alternatively, document a minimal role tweak only if required for spawn helpers — prefer extending spawn logic over breaking treasure loot placement.
- Unit test in `game/server/test/dungeon.test.js` or `game/server/test/server.test.js`: after `spawnEnemies()` (or the internal spawn path used on deploy) with `spire_ascent` layout, assert ≥1 enemy on the top tier room.
- Unit or integration test: `spire_ascent` quest layout's top room is the farthest/highest tier and is the room that receives the summit objective spawn.

## Technical Specs

- **Files:** `game/server/progression.js` (primary: `spawnCombatEnemies`, `pickEnemySpawnPosition`), `game/server/dungeon.js` (only if role/spawn metadata changes), `game/server/test/dungeon.test.js`, `game/server/test/server.test.js`.
- **Spawn strategy:** When `layout.stage === 'spire-ascent'` and quest `objectiveType === 'defeat_enemies'`, reserve one spawn slot (e.g. last index or dedicated pass) for `roomsByRole(layout, 'treasure')[0]` using `randomPositionInRoom` / existing padding helpers; distribute remaining enemies across combat tiers via existing `spreadAcrossTiers` logic.
- **Enemy type:** Use an existing type already in the spawn rotation (e.g. `miniboss` or `grunt`) for the summit slot so defeat tracking needs no new objective type.
- **Sync:** `syncRunObjectiveToEnemies` should already count all enemies; verify no filter excludes treasure-tier spawns.
- **Do not change** client rendering in this ticket.
- **Quest def:** `game/server/quests.js` `spire_ascent` entry unchanged unless `enemyCount` must bump to guarantee summit + spread; if bumped, update tests that assert enemy count.

## Verification: code
