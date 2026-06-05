# 05 — Arena Trials Tier 2 boss reference

Wire `arena_trials` Tier 2 as the reference Tier-2 stage-boss experience using the encounter framework from sub-tickets 01–04, plus a debug scenario and end-to-end tests so the top-level ticket is demonstrably playable.

## Acceptance Criteria

- `arena_trials` Tier 2 quest tier includes `stageBossEncounter` (`bossType: 'miniboss'`, `trigger: 'deploy'`, optional `rewardCurrencyBonus`) and an objective suited to a single stage boss (`defeat_enemies` with `totalEnemies: 1` / `enemyCount: 0` with bulk spawn skipped).
- Deploying `arena_trials` Tier 2 (with account unlock) spawns no full mob pack; after deploy the stage boss is present, `run.encounter.status` is `active`, and ambient spawns stay locked until the boss dies.
- Defeating the stage boss clears the encounter, grants the configured bonus, and completes the run (victory + `runComplete`); Tier-1 `arena_trials` behavior is unchanged (normal mob spawn, no `run.encounter`).
- A debug scenario (e.g. `arena-trials-tier2-boss` or extend `arena-trials-tier-2`) deploys Tier 2 with the boss encounter for harness QA.
- `stateUpdate` includes `run.encounter` on the wire (via existing full `run` snapshot); no client UI required unless objective label already flows from server text.
- Integration or extended unit tests cover catalog, deploy, boss present, kill → victory; `pnpm test:quick` passes.

## Technical Specs

- **`game/server/quests.js`** — Extend `arena_trials.tiers[2]` with `stageBossEncounter` and boss-focused objective/spawn fields.
- **`game/server/debugScenarios.js`** — Add or adjust a Tier-2 scenario that deploys with encounter active and documents the scenario name for harness.
- **`game/server/test/arena_trials_tier2_boss_encounter.test.js`** (new) and/or extend **`game/server/test/arena_trials_tier2.test.js`**, **`game/server/test/debug-scenarios.test.js`** — End-to-end boss encounter on Tier 2; assert Tier 1 regression.
- **`game/client/test/questBoard.test.js`** — Update only if hard-coded variant/objective summaries break due to Tier-2 metadata changes.
- Reuse **`game/server/bossEncounter.js`** and hooks from sub-tickets **01–04**; do not duplicate encounter logic here.

## Verification: code
