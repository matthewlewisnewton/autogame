# 03 — Training Caverns Tier 2 stage-boss wire-up

Apply the ticket-258 stage-boss encounter framework to `training_caverns` Tier 2 (rooms / crowded rigid layout) using the vault arena and Annex Overseer boss from sub-tickets 01–02.

## Acceptance Criteria

- `training_caverns.tiers[2]` uses `objectiveType: 'stage_boss'` with encounter metadata `{ bossType: 'annex_overseer', landmark: 'vault_dais', addCount: 3–4 }` instead of plain `defeat_enemies` bulk spawn; layout/rigid/unlock/reward fields stay intact.
- Deploying Tier 2 spawns adds plus one dormant stage boss on `vault_dais`; clearing adds and entering the encounter trigger (ticket-258 flow) starts the fight; defeating the boss completes the run with victory rewards and currency grant.
- Tier 1 `training_caverns` remains `defeat_enemies` with unchanged behavior and still unlocks Tier 2 on victory.
- Lobby objective copy names the rooms boss (e.g. “Defeat the annex overseer …”) via `game/shared/theme.json` and `formatObjectiveSummary` in both `game/server/quests.js` and `game/client/questBoard.js` — not the arena “trial warden” strings.
- Debug scenario `training-caverns-tier-2` (behind `ALLOW_DEBUG_SCENARIOS=1`) deploys the Tier-2 stage-boss run: `run.objective.type === 'stage_boss'`, `run.encounter` present with `bossEnemyId`, boss type `annex_overseer`, `run.questTier === 2`, rigid crowded layout includes `vault_dais`.
- `game/server/test/training_caverns_tier2.test.js` extended (or companion `training_caverns_stage_boss.test.js`) for catalog, deploy spawn shape, encounter activation, boss kill victory, and Tier-1 unlock regression; `game/server/test/debug-scenarios.test.js` updated for the new run shape; `pnpm test:quick` passes.

## Technical Specs

- **`game/server/quests.js`** — Change `training_caverns.tiers[2]` to `objectiveType: 'stage_boss'` + `encounter: { bossType: 'annex_overseer', landmark: 'vault_dais', addCount: <n> }`; remove `enemyCount` for Tier 2; add vault-specific objective strings in `formatObjectiveSummary` (or branch on encounter/quest id).
- **`game/shared/theme.json`** — Add objectives strings for the annex overseer contract (solo and with supports), parallel to existing trial warden keys.
- **`game/client/questBoard.js`** — Mirror server objective summary for `stage_boss` when the quest is rooms/vault themed (prefer shared theme keys over hard-coded trial warden text).
- **`game/server/debugScenarios.js`** + **`game/server/index.js`** allowlist — Update `training-caverns-tier-2` expectations for stage-boss objective; optional dormant/active shortcuts following the `arena-trials-tier-2` / `stage-boss-*` pattern if useful for QA.
- **`game/server/test/training_caverns_tier2.test.js`** — Replace/adjust tests that assumed `defeat_enemies` + `totalEnemies === enemyCount`; add boss-encounter flow assertions modeled on `arena_trials_tier2.test.js`.
- **`game/server/test/debug-scenarios.test.js`** — Assert `stage_boss` objective, `vault_dais` landmark, and `annex_overseer` boss on `training-caverns-tier-2`.
- **`game/server/test/quests.test.js`** — Update Tier 2 variant expectations (`objectiveType`, objective summary contains annex overseer wording).
- Depends on sub-tickets 01–02; do not reimplement encounter core logic from ticket 258.

## Verification: code
