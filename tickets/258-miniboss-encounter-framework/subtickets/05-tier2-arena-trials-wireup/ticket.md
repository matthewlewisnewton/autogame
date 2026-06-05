# 05 — Arena Trials Tier 2 wire-up

Apply the stage-boss encounter framework to `arena_trials` Tier 2 as the reference Tier-2 implementation, with debug shortcut, HUD copy, and end-to-end tests.

## Acceptance Criteria

- `arena_trials` Tier 2 uses `objectiveType: 'stage_boss'` with encounter metadata (`bossType: 'miniboss'`, `landmark: 'arena_dais'`, sensible `addCount` e.g. 4–5) instead of plain `defeat_enemies` bulk spawn.
- Deploying Tier 2 spawns adds plus one dormant stage boss on the arena dais; activating the encounter (per sub-ticket 03) starts the boss fight; defeating the boss completes the run with victory rewards.
- Tier 1 `arena_trials` remains `defeat_enemies` with unchanged behavior and still unlocks Tier 2 on victory.
- Debug scenario `arena-trials-tier-2` (behind `ALLOW_DEBUG_SCENARIOS=1`) deploys the Tier-2 stage-boss run: `run.objective.type === 'stage_boss'`, `run.encounter` present with `bossEnemyId`, `run.questTier === 2`.
- `formatObjectiveSummary` in `game/client/questBoard.js` describes stage-boss contracts (e.g. “Defeat the trial warden” using `THEME.objectives` or a new theme string in `game/shared/theme.json`).
- `game/server/test/arena_trials_tier2.test.js` extended (or companion `arena_trials_stage_boss.test.js`) for catalog, deploy spawn shape, encounter activation, boss kill victory, and Tier-1 unlock regression; `pnpm test:quick` passes.

## Technical Specs

- **`game/server/quests.js`** — Change `arena_trials.tiers[2]` to `objectiveType: 'stage_boss'` + `encounter: { bossType: 'miniboss', landmark: 'arena_dais', addCount: <n> }`; keep layout/rigid/unlock fields intact.
- **`game/server/debugScenarios.js`** + **`game/server/index.js`** allowlist — Update `arena-trials-tier-2` scenario expectations for stage-boss objective (follow existing scenario pattern).
- **`game/client/questBoard.js`** + **`game/shared/theme.json`** — Lobby summary string for `stage_boss` quests.
- **`game/server/test/arena_trials_tier2.test.js`** — Replace/adjust tests that assumed `defeat_enemies` + `totalEnemies === enemyCount` for Tier 2 deploy; add boss-encounter flow assertions.
- **`game/server/test/debug-scenarios.test.js`** — Assert `stage_boss` objective and `run.encounter` on `arena-trials-tier-2`.
- Depends on sub-tickets 01–04; do not reimplement encounter core logic here.

## Verification: code
