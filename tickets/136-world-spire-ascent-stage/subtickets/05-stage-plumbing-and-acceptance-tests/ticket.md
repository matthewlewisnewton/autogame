# Stage Plumbing, Enemy Spread, and Acceptance Tests

Wire the spire-ascent stage into quest/layout selection, ensure enemies and objectives use the full tower, and add the remaining acceptance tests from the parent ticket.

## Acceptance Criteria

- A quest or debug path selects spire-ascent in live server flow: e.g. `layoutStage: 'spire-ascent'` on a quest def and `applyLayoutForQuest` passes `{ stage: layoutStage, slopes: true }` into `generateLayout`.
- At least one way to exercise the stage in dev (new quest id such as `spire_ascent` in `game/server/quests.js`, or an existing debug scenario in `game/server/index.js` that regenerates layout with `stage: 'spire-ascent'`).
- **Enemy distribution:** when `layout.stage === 'spire-ascent'` (or `tierIndex` present), `spawnCombatEnemies` places enemies on ≥ 2 distinct combat tiers when `enemyCount ≥ 2` and the layout has ≥ 2 combat tiers — never all on the start tier, never all on the treasure tier. Unit test asserts tier spread for a seeded spire layout.
- **Objective / exit:** treasure room is on the highest `tierIndex`; BFS from start reaches treasure using only room + passage graph (foot path, no jumps).
- **Camera / avatar:** local avatar Y uses `sampleFloorY` on spire layouts (already in renderer); no code path forces `y = 0.5` when `layout.stage === 'spire-ascent'`. Regression test or movement test confirms `player.y` increases after simulated movement up one ramp in a spire fixture.
- Parent ticket unit tests consolidated: tier count, monotonic Y, reachability, ramp slopes, total Y gain ≥ 10, determinism, enemy tier spread — all pass under `pnpm test:quick` / dungeon test suite.
- Document the stage key in `game/docs/design.md` (one short bullet under Floor Geometry or a new "Stage variants" note).

## Technical Specs

- **Files:** `game/server/quests.js`, `game/server/index.js` (`applyLayoutForQuest`), `game/server/progression.js` (`spawnCombatEnemies` / `pickEnemySpawnPosition`), `game/server/dungeon.js` (set `layout.stage = 'spire-ascent'` on output), `game/server/test/dungeon.test.js`, `game/server/test/server.test.js` (optional integration), `game/docs/design.md`.
- **Enemy spread approach:** sort `roomsByRole('combat')` by `tierIndex`; round-robin spawn picks across sorted tiers before falling back to random combat room.
- **Quest stub:** minimal quest def (name, `enemyCount` ≥ 3, `layoutStage: 'spire-ascent'`, `layoutProfile: 'crowded'`) so playtests can deploy into the spire without changing default quest for all users (gate behind quest selection if needed).
- Do not change unrelated lobby or card systems.

## Verification: code
