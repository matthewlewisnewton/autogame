# 03 — Encounter trigger

Wire automatic encounter activation so a pending stage-boss fight starts without manual test hooks: on deploy for open-plaza reference quests, and on room entry for multi-room layouts.

## Acceptance Criteria

- `tryStartStageBossEncounter(gameState)` runs during the playing-phase simulation tick (or immediately after deploy / `spawnEnemies` when `trigger: 'deploy'`) and promotes `pending` → `active` only once.
- For `trigger: 'deploy'`, the stage boss spawns as soon as the dungeon run is live and bulk spawns are skipped (arena_trials open-plaza path).
- For `trigger: 'enter_room'` with a `roomRole`, any active non-extracted player entering a layout room with that role starts the encounter (use existing room containment helpers such as `roomTierAt` / room bounds).
- After trigger, `run.encounter.status` is `active`, the stage boss exists, and ambient spawns remain locked per sub-ticket 02.
- Unit/integration tests cover deploy-trigger (open-plaza layout) and, if feasible with a minimal two-room layout fixture, enter-room trigger.
- `pnpm test:quick` passes.

## Technical Specs

- **`game/server/bossEncounter.js`** — `tryStartStageBossEncounter(gameState, { now })` with trigger dispatch; `playerInRoomWithRole(layout, x, z, role)`.
- **`game/server/simulation.js`** or **`game/server/progression.js`** — Call `tryStartStageBossEncounter` from the main playing tick (after movement) and/or at end of deploy / `startDungeonRun` + initial `spawnEnemies` when trigger is `deploy`.
- **`game/server/index.js`** — Only if deploy path does not already reach the hook after `spawnEnemies`; prefer a single call site in progression.
- **`game/server/test/boss_encounter_trigger.test.js`** (new) — Deploy trigger on open-plaza; optional compact layout test for `enter_room` + `roomRole: 'treasure'`.
- Depends on sub-tickets **01–02**.

## Verification: code
