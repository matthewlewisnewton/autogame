# Wire the world-stage transition into the harness fallback capture recipe

The top-level QA capture never exercised the world-stage transition: `harness/steps/screenshot.py`
forces `CAPTURE_PLAN_AGENT=fallback`, so `fallbackRecipe()` in `harness/screenshot.mjs` is always
used, and it only has special-case branches for slope and flare-beacon tickets — for this ticket it
ran the generic lobby/movement/dodge flow. Add a world-stage branch so the capture itself drives the
`sunken-canyon-stage` transition and records before/after screenshots plus state evidence.

## Acceptance Criteria

- `fallbackRecipe()` in `harness/screenshot.mjs` gains a new world-stage detection branch (alongside
  the existing `isSlopeTicket` / `isFlareBeaconTicket` branches) that fires when the ticket text or
  the output directory path indicates this ticket — e.g. matches `world-stage`, `sunken-canyon`,
  `portal-transition`, or `178-qa-world-stage` (case-insensitive) against the ticket text or
  `outDirAbs`.
- When that branch fires, the recipe is the base steps PLUS appended steps that, while still in
  gameplay on the default stage, do all of:
  - take a `screenshot` of the default stage BEFORE the transition (e.g. `05-before-world-stage`),
  - take a `probe` BEFORE the transition whose description records the starting `layout.profile`
    (default/`crowded`), `roomCount`, `startRoom`, and player `x`/`z`,
  - `emitScenario` with `scenario: 'sunken-canyon-stage'` for player `A`,
  - `wait` long enough (≥ ~1500 ms) for the layout swap (it arrives via `questUpdate`),
  - take a `screenshot` of the new stage AFTER the transition (e.g. `06-after-sunken-canyon`),
  - take a `probe` AFTER the transition whose description asserts `layout.profile === 'sunken-canyon'`
    (changed from the before value) and that the player `x`/`z` matches the new `startRoom`.
- The branch sets a distinct `summary` string mentioning the world-stage / sunken-canyon transition.
- The existing `isSlopeTicket` and `isFlareBeaconTicket` branches and the default branch are
  unchanged in behavior; the new branch is mutually exclusive with them (a plain `else if`).
- A capture run for this ticket produces a `metrics.json` whose `scenarios` array contains
  `"sunken-canyon-stage"`, whose `screenshots` include the before-default and after-sunken-canyon
  entries, and whose probes show the `layout.profile` going from the default profile to
  `sunken-canyon` with the player at the new start room — i.e. the round artifacts no longer show
  only the lobby/movement/dodge fallback.
- Existing server + client tests still pass and the game starts and loads cleanly.

## Technical Specs

- `harness/screenshot.mjs`, function `fallbackRecipe()` (currently ~lines 307–380): add an
  `isWorldStageTicket` boolean computed the same way as `isSlopeTicket` (test a regex against both
  the `ticket` text read via `inferTicketFile()` and against `outDirAbs`), then an
  `else if (isWorldStageTicket) { ... }` branch that builds `steps = [...baseSteps, ...]` with the
  appended screenshot/probe/emitScenario/wait/screenshot/probe steps described above and sets a
  matching `summary`.
- Reuse the existing recipe step vocabulary already handled in `executeRecipe`: `screenshot`
  (`name`, `description`), `probe` (`description`), `emitScenario` (`player`, `scenario`), `wait`
  (`player`, `ms`). The `emitScenario` handler (~line 701) already calls
  `window.__requestDebugScenarioForTest(name)`, and `'sunken-canyon-stage'` matches `SCENARIO_RE`.
- The `sunken-canyon-stage` scenario is the existing one in `game/server/index.js` (`DEBUG_SCENARIOS`,
  handled ~line 890); it regenerates the layout, repositions the player to the `role === 'start'`
  room, and emits `questUpdate`. Debug scenarios are already permitted for the harness capture (it
  connects from localhost; round-1 `metrics.json` shows `debugScenarioAllowed: true`), so no server
  change is needed.
- Do NOT modify `harness/steps/screenshot.py` (the forced `CAPTURE_PLAN_AGENT=fallback` is correct —
  the fallback recipe is exactly what must learn this transition). Do NOT touch the existing passed
  sub-tickets' files (`game/client/main.js` layout summary, `game/client/scripts/test-world-stage-transition.mjs`).

## Verification: code
