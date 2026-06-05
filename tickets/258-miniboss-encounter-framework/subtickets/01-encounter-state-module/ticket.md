# 01 — Boss encounter state module

Introduce a reusable server-side boss-encounter module and attach encounter state to active runs when a quest tier declares a stage-boss encounter. This is the foundation for spawn, trigger, lock, and defeat hooks in later sub-tickets.

## Acceptance Criteria

- A new module exports a documented encounter config shape (e.g. `bossType`, `trigger`, optional `roomRole`, optional `rewardCurrencyBonus`, optional `unlockOnClear`) and helpers to read it from a quest tier definition.
- `run.encounter` is initialized on run start when the selected quest tier includes a stage-boss encounter config; shape includes at least `status` (`pending` | `active` | `cleared`), `bossType`, and `bossEnemyId` (null until spawned).
- Helpers exist for `isEncounterLocked(run)`, `getEncounterConfig(quest)`, and pure state transitions (`pending` → `active` → `cleared`) without spawning enemies yet.
- Runs without a stage-boss config have no `run.encounter` (or it remains undefined); existing Tier-1 / non-boss quests are unchanged.
- Unit tests cover config resolution, init on `createRunState`, and state transitions; `pnpm test:quick` passes.

## Technical Specs

- **`game/server/bossEncounter.js`** (new) — Registry/helpers: `getStageBossEncounterConfig(quest)`, `initRunEncounter(run, quest)`, `setEncounterActive`, `setEncounterCleared`, `isEncounterLocked`, `isStageBossEnemy(enemy, run)`.
- **`game/server/quests.js`** — Add optional `stageBossEncounter` on quest tier defs (schema only in this sub-ticket; no quest wired yet).
- **`game/server/progression.js`** — Call `initRunEncounter` from `createRunState` when config is present; export any hooks needed by tests.
- **`game/server/test/boss_encounter.test.js`** (new) — Init, transitions, locked predicate, no encounter on quests without config.
- Do **not** spawn enemies, change bulk spawn behavior, or wire a playable quest in this sub-ticket.

## Verification: code
