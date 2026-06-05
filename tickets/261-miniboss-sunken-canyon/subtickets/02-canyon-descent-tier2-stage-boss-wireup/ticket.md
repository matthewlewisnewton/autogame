# 02 — Canyon Descent Tier 2 stage-boss wire-up

Apply the ticket-258 stage-boss encounter framework to `canyon_descent` Tier 2 as the canyon miniboss: dormant boss on the monolith below the plateau, adds across both elevations, canyon-themed lobby copy, debug shortcut, and end-to-end defeat → victory rewards. Depends on sub-ticket 01.

## Acceptance Criteria

- `canyon_descent` Tier 2 uses `objectiveType: 'stage_boss'` with `encounter: { bossType: 'miniboss', landmark: 'canyon_monolith', addCount: 4 }` instead of `defeat_enemies` / `enemyCount`.
- Deploying Tier 2 spawns adds plus one dormant stage boss on `canyon_monolith`; activating the encounter starts the fight; defeating the boss completes the run with victory rewards (currency + unlock plumbing unchanged).
- Tier 1 `canyon_descent` remains `defeat_enemies` with unchanged behavior and still unlocks Tier 2 on victory.
- `formatObjectiveSummary` shows canyon-specific copy (e.g. “Defeat the canyon warden and 4 supports”) via new `THEME.objectives` strings — not the arena “trial warden” wording.
- Debug scenario `canyon-descent-tier-2` deploys the Tier-2 stage-boss run: `run.objective.type === 'stage_boss'`, `run.encounter` present with `bossEnemyId`, `run.questTier === 2`.
- `game/server/test/canyon_descent_tier2.test.js` covers catalog, deploy spawn shape (boss at monolith, vertical add split), encounter activation, boss-kill victory, and Tier-1 unlock regression; `debug-scenarios.test.js` and `quests.test.js` updated; `pnpm test:quick` passes.

## Technical Specs

- **`game/server/quests.js`** — Change `canyon_descent.tiers[2]` to `objectiveType: 'stage_boss'` + encounter metadata; remove `enemyCount`; keep `layoutProfile`, `layoutMode: 'rigid'`, `unlockRequires`, reward fields intact.
- **`game/shared/theme.json`** — Add `defeatCanyonWarden` and `defeatCanyonWardenWithSupports` under `objectives`.
- **`game/server/quests.js`** + **`game/client/questBoard.js`** — Branch `formatObjectiveSummary` for `canyon_descent` stage-boss tiers (or an `encounter.objectiveKey`) to use the new theme strings.
- **`game/client/test/questBoard.test.js`** — Assert canyon Tier-2 summary text.
- **`game/server/debugScenarios.js`** — Update `canyon-descent-tier-2` to expect stage-boss objective after `enterPlayingPhase` / `spawnEnemies` (follow `arena-trials-tier-2` pattern; player stays on plateau spawn).
- **`game/server/test/canyon_descent_tier2.test.js`** — Replace/adjust tests that assumed `defeat_enemies` + `enemyCount`; add stage-boss encounter flow assertions mirroring `arena_trials_tier2.test.js`.
- **`game/server/test/debug-scenarios.test.js`** — Assert `stage_boss` objective, `run.encounter`, and boss+add enemy counts on `canyon-descent-tier-2`.
- **`game/server/test/quests.test.js`** — Expect `canyon_descent` Tier 2 `objectiveType: 'stage_boss'` and canyon warden summary in `listQuestVariants()`.

## Verification: code
