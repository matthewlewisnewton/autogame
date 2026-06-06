# Add open-plaza / arena_trials encounter debug scenarios (near-adds, boss-approach, boss-low-hp)

The open-plaza / `arena_trials` Tier 2 stage-boss run has the deploy/dormant/active
debug shortcuts (`arena-trials-tier-2`, `stage-boss-dormant`, `stage-boss-active`)
but is missing the per-phase scenarios the other levels have. Add three new
debug-only scenarios mirroring `canyon-descent-*` / `training-caverns-*`: an
adds-cluster scenario, a boss-approach scenario that drops the player inside the
encounter trigger radius of the `arena_champion`, and a boss-low-hp scenario.
These make open-plaza encounter QA deterministic without changing normal play.

## Acceptance Criteria

- A new `arena-trials-near-adds` debug scenario exists: it requires an active
  `arena_trials` Tier 2 stage-boss run (`gamePhase === 'playing'`,
  `selectedQuestId === 'arena_trials'`, `selectedQuestTier === 2`,
  `state.run.encounter` present) and otherwise returns `{ ok: false, reason }`.
  On success it clusters every live non-boss add (wounded to 1 HP, shields
  stripped) around the start/plaza anchor, repositions the player beside the
  nearest add, forces a fully-charged weapon into hand slot 0, refills player HP
  and magic stones, and returns `{ ok: true, scenario: 'arena-trials-near-adds' }`.
- A new `arena-trials-boss-approach` debug scenario exists: it requires the same
  active arena_trials Tier 2 stage-boss run, requires all non-boss adds cleared
  and the encounter `phase === 'dormant'` (else `{ ok: false, reason }`), and on
  success places the player just outside the encounter trigger radius of the
  arena dais / encounter anchor, refills HP/stones, sets
  `player.debugScenarioNudgeAfter`, and returns
  `{ ok: true, scenario: 'arena-trials-boss-approach' }`. The scenario is added
  to the boss-approach nudge set so the headless harness walk inches into the
  trigger radius and activates the encounter.
- A new `arena-trials-boss-low-hp` debug scenario exists: it requires the same
  active run, kills all non-boss enemies, finds the `arena_champion` boss (else
  `{ ok: false, reason }`), repositions it beside the player, sets boss HP to 1
  with shields stripped, refills player HP/stones, activates+locks the encounter
  if still dormant, and returns `{ ok: true, scenario: 'arena-trials-boss-low-hp' }`.
- All three scenario names are registered in the `DEBUG_SCENARIOS` set and in
  `DEBUG_SCENARIOS_WITHOUT_DEFAULT_SPAWN` in `game/server/index.js`.
- Each scenario keeps its target state reachable via normal play (debug-only
  shortcut; no new always-on behavior) and is gated behind the existing debug
  gate.
- Vitest server tests cover all three new scenarios (success path + the
  precondition guard rejection), following the `canyon-descent-near-adds` /
  `-boss-approach` / `-boss-low-hp` cases in `debug-scenarios.test.js`.
- `pnpm test` (server + client vitest) passes.

## Technical Specs

- `game/server/debugScenarios.js`:
  - Add a `liveArenaTrialsAdds(state, bossType = 'arena_champion')` helper
    mirroring `liveCanyonDescentAdds` / `liveTrainingCavernsAdds` (filter live
    `grunt`/`skirmisher` non-boss enemies).
  - Add three new `if (name === ...)` branches inside `applyDebugScenario`
    closely mirroring the existing `canyon-descent-near-adds`,
    `canyon-descent-boss-approach`, and `canyon-descent-boss-low-hp` blocks,
    but for `arena_trials` Tier 2 and boss type `arena_champion`. Reuse
    `resolveArenaDaisAnchor(state)` / `resolveEncounterAnchor(state.run, state)`
    for the anchor, `ENCOUNTER_TRIGGER_RADIUS`, `repositionNearEnemy`,
    `firstRoomPosition`, `sampleFloorY`/`resolveFloorY`, and the
    `isEncounterDormant` / `activateEncounter` / `lockEncounter` helpers already
    imported at the top of the file.
  - Add `'arena-trials-boss-approach'` to the `BOSS_APPROACH_NUDGE_SCENARIOS` set
    so `nudgeDebugBossApproachPlayers` drives it.
- `game/server/index.js`: add `'arena-trials-near-adds'`,
  `'arena-trials-boss-approach'`, `'arena-trials-boss-low-hp'` to both the
  `DEBUG_SCENARIOS` set (around line 461) and the
  `DEBUG_SCENARIOS_WITHOUT_DEFAULT_SPAWN` set (around line 677).
- `game/server/test/debug-scenarios.test.js`: add a
  `describe('debugScenario — arena-trials-*')` block (or extend an existing one)
  exercising the three new scenarios via socket `debugScenario` emits, following
  the canyon-descent test cases (lines ~683–895) as the template.

## Verification: code
