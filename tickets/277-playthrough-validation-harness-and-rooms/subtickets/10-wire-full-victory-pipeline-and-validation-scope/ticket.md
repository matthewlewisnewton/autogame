# Wire full victory pipeline and validation output scope

Round-4 remediation for failed sub-ticket 09. Sub-tickets 01–08 delivered auth/hub/boss-encounter slices and the `validate:rooms` entrypoint, but `--steps full` is still stubbed in HEAD and scope_audit reverts any `validation/rooms/` writes (the root cause of iterations 2–3 in 09). This sub-ticket lands the victory step in the playthrough driver, fixes assertion-only non-zero exit, and permits `validation/**` writes when a sub-ticket's Technical Specs target that directory.

## Acceptance Criteria

- `harness/validate/playthrough.mjs` implements `--steps full` end-to-end: auth → hub/deploy → boss-encounter → `runVictoryStep` (no stub throw for `full`).
- `runVictoryStep` applies `bossLowHpScenario` when preset exports it, calls `defeatBoss`, captures `06-boss-defeated.png` and `07-victory.png`, and returns `probes.afterBoss` / `probes.victory` with `runStatus`, `runObjectiveComplete`, `bossDefeated`, and `lastRunSummaryStatus`.
- `waitForVictoryState` polls harness until `runStatus === 'victory'`, `runObjectiveComplete === true`, `objective.bossDefeated === true`, and `lastRunSummary.status === 'victory'`.
- For `--steps full`, the `finally` block writes merged `probes.json`, non-empty `findings.md` via `renderFindings`, and `run-summary.json` with `steps`, `victory`, `assertions` (`bossSpawned`, `encounterActivated`, `bossDefeated`, `victoryFired`), and `ok`.
- When all four assertion booleans are `true`, `summary.ok === true` and the process exits `0`. When any assertion is `false` (no thrown error), `summary.ok === false` and the process still exits `1` — not `0`.
- `harness/validate/presets/rooms.mjs` exports `bossLowHpScenario: 'training-caverns-boss-low-hp'` (game scenario lands in sub-ticket 11).
- `harness/pipelines/subtask.py` (and `harness/steps/implement.py` if cleaner) adds a `validation/**` safe-path when the sub-ticket `ticket.md` references `validation/` in Technical Specs — same pattern as `allow_harness` for `harness/`.
- Do **not** run `pnpm validate:rooms` or write files under `validation/rooms/` in this sub-ticket.
- `cd game && pnpm test:quick` still passes.

## Technical Specs

- `harness/validate/playthrough.mjs`: remove `full` from `STUB_STEPS`; add `runVictoryStep`, `waitForVictoryState`, `buildVictoryProbe`, assertion block, and `finally` writers for findings/probes/run-summary; exit `1` when `opts.steps === 'full'` and `summary.ok === false` after the try block.
- `harness/validate/presets/rooms.mjs`: add `bossLowHpScenario`.
- `harness/pipelines/subtask.py`: detect `validation/` in ticket text; pass `allow_validation=True` (or equivalent) into `implement()`.
- `harness/steps/implement.py`: when `allow_validation`, append `validation/**` to `extra_safe_paths`.
- Depends on passed sub-tickets **01–03**, **06**, and **08**. No `game/` changes.

## Verification: code
