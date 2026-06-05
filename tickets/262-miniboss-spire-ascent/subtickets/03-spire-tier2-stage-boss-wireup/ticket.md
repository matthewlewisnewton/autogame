# 03 — Spire Ascent Tier 2 stage-boss wire-up

Apply the ticket-258 stage-boss encounter framework to `spire_ascent` Tier 2: dormant summit boss on `spire_summit`, adds on lower tiers, encounter activation, boss defeat grants victory rewards.

## Acceptance Criteria

- `spire_ascent` Tier 2 uses `objectiveType: 'stage_boss'` with `encounter: { bossType: 'spire_warden', landmark: 'spire_summit', addCount: <n> }` instead of `defeat_enemies` bulk spawn; Tier 1 remains unchanged and still unlocks Tier 2 on victory.
- Deploying Tier 2 spawns `addCount` regular adds plus one dormant `spire_warden` on the `spire_summit` landmark; `run.encounter.bossEnemyId` is wired; activating the encounter starts the fight; defeating the boss completes the run with victory rewards (currency + loot hooks).
- Lobby contract summary uses spire-specific copy (not "trial warden") via `formatObjectiveSummary` / `THEME.objectives`.
- Debug scenario `spire-ascent-tier-2` deploys the Tier-2 stage-boss run: `run.objective.type === 'stage_boss'`, `run.encounter` present with `bossEnemyId`, boss type `spire_warden`.
- `game/server/test/spire_ascent_tier2.test.js` extended for catalog, deploy spawn shape, encounter activation, boss-kill victory, Tier-1 unlock regression, and variant tagging on adds; `debug-scenarios.test.js` and `quests.test.js` updated; `pnpm test:quick` passes.

## Technical Specs

- **`game/server/quests.js`** — Change `spire_ascent.tiers[2]` to `objectiveType: 'stage_boss'` + encounter metadata (`bossType: 'spire_warden'`, `landmark: 'spire_summit'`, `addCount` e.g. 4–5); remove `enemyCount`; keep layout/rigid/unlock/reward fields intact.
- **`game/shared/theme.json`** + **`game/client/questBoard.js`** — Add spire stage-boss objective strings (e.g. `defeatSummitWarden`, `defeatSummitWardenWithSupports`) and branch `formatObjectiveSummary` for `spire_ascent` stage-boss tiers.
- **`game/client/test/questBoard.test.js`** — Assert spire Tier-2 summary strings.
- **`game/server/debugScenarios.js`** — Update `spire-ascent-tier-2` scenario expectations for stage-boss objective (follow `arena-trials-tier-2` pattern: unlock → layout → `enterPlayingPhase` → `spawnEnemies`).
- **`game/server/test/spire_ascent_tier2.test.js`** — Replace/adjust tests that assumed `defeat_enemies` + `enemyCount`; add boss-encounter flow assertions modeled on `arena_trials_tier2.test.js`.
- **`game/server/test/debug-scenarios.test.js`** — Assert `stage_boss` objective, `run.encounter`, and `spire_warden` boss on `spire-ascent-tier-2`.
- **`game/server/test/quests.test.js`** — Expect `spire_ascent` Tier 2 `objectiveType: 'stage_boss'` and spire-specific `objectiveSummary`.
- **`game/server/test/spire_ascent_spawn.test.js`** — Adjust Tier-2 deploy cases if they still assume bulk `enemyCount` spawn.
- Reuse encounter core from ticket 258 (sub-tickets 01–04); depends on sub-tickets 01 and 02.

## Verification: code
