# Citadel debug scenarios and full-run e2e coverage

Add the three QA shortcut scenarios for the citadel capstone (gating unlocked,
gating locked, dormant boss run) mirroring the rift-convergence trio, plus a
run-level e2e test proving the Citadel Sovereign encounter plays out end to
end: dormant spawn → activation → defeat → reward. Depends on sub-tickets 01
and 02.

## Acceptance Criteria

- `game/server/debugScenarios.js` handles three new scenario names, each
  documented with the "reachable normally by …" comment style used by the
  rift scenarios:
  - `citadel-unlocked`: hub lobby with ALL THREE prerequisites
    (canyon_descent Tier 2, spire_ascent Tier 2, arena_trials Tier 2) recorded
    as cleared, so `citadel_assault` is selectable on the quest board /
    level map.
  - `citadel-one-prereq`: hub lobby with only ONE of the three Tier-II
    prerequisites cleared, so `citadel_assault` is still locked.
  - `citadel-boss`: a `citadel_assault` boss-level run with the dormant
    Citadel Sovereign and its five supports on the boss arena, the player
    placed just OUTSIDE the encounter trigger radius (same positioning as
    `rift-convergence-boss`: `anchor.x + ENCOUNTER_TRIGGER_RADIUS + 2`, floor
    Y resolved via `sampleFloorY`).
- Each scenario returns `{ ok: true }` through the existing
  `__requestDebugScenarioForTest` path (vital for harness playthrough QA).
- New `game/server/test/citadel_capstone_e2e.test.js` (mirror the run section
  of `rift_convergence_e2e.test.js`) covering:
  - Deploying `citadel_assault` spawns exactly one dormant `citadel_sovereign`
    at the `arena_dais` with `hp === 460` plus five live adds drawn only from
    the quest's enemy pool types.
  - The dormant boss takes no damage before activation; after activation a
    fixed damage chip reduces `hp` by exactly that amount (same
    dormant/active contract `dormant_boss_damage.test.js` establishes).
  - Killing the boss completes the `stage_boss` objective and pays the
    `rewardCurrency: 26` purse.
  - The three debug scenarios above succeed (`ok: true`) and produce the
    states described (quest unlocked / locked / dormant boss run).
- Full server suite (`pnpm test:quick` from `game/`) passes, including the
  socket-event drift guard.

## Technical Specs

- `game/server/debugScenarios.js`: model the three handlers on
  `rift-convergence-unlocked` (~line 892), `rift-convergence-one-prereq`
  (~line 920), and `rift-convergence-boss` (~line 1327) plus its setup helper
  (`setupRiftConvergenceBossDebug`, quest wiring near line 190). Add a
  `setupCitadelBossDebug`-style helper rather than inlining; reuse
  `resolveArenaDaisAnchor`, `finishStageBossDebugScenario`, and the existing
  prereq-clear recording used by the rift gating scenarios.
- `game/server/test/citadel_capstone_e2e.test.js`: new file; copy the
  spawn/activation/defeat flow from `rift_convergence_e2e.test.js` (boss
  lookup by type, `damageEnemy`, objective + currency assertions) and the
  scenario invocation pattern from existing debug-scenario tests.
- Keep quest defs and enemy defs untouched — this sub-ticket only adds
  scenarios + tests. If a value asserted here disagrees with what 01/02
  shipped, the test must match the shipped def (460 HP, 5 adds, 26 purse).

## Verification: code
