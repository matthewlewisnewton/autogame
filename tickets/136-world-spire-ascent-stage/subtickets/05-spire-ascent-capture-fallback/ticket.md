# Add spire-ascent scenarios to harness capture plan and fallback recipe

Round-1 capture used the generic fallback plan (`capturePlanSource: "fallback"`)
and never loaded the spire-ascent layout (`training_caverns` only). Register the
existing `spire-ascent` / `spire-ascent-stage` debug scenarios in the planner
prompt and extend the ticket-aware fallback recipe (same pattern as the
`sloped-dungeon` branch for ticket 142) so a successful re-capture exercises the
tower stage.

## Acceptance Criteria

- `harness/prompts/capture-plan.md` lists `spire-ascent-stage` and `spire-ascent`
  under "Available development scenarios" with descriptions aligned to
  `DEBUG_SCENARIOS` in `game/server/index.js`.
- `fallbackRecipe()` in `harness/screenshot.mjs` detects spire-ascent tickets
  (ticket text or output path matching `spire|spire-ascent|136`) and appends after
  the base lobby/gameplay steps:
  - `emitScenario` with `scenario: "spire-ascent"` on player A
  - bounded `wait`
  - `screenshot` whose `description` mentions spire ascent, tower tiers, or ramps
- When the spire fallback branch runs, `metrics.json` `scenarios[]` includes
  `"spire-ascent"` (via the existing `emitScenario` handler).
- The existing `sloped-dungeon` / slope-ticket branch in `fallbackRecipe()` is
  unchanged; non-spire, non-slope tickets keep the generic fallback only.
- No files under `game/` are modified.

## Technical Specs

- **`harness/prompts/capture-plan.md`**: add scenario bullets, e.g.
  - `spire-ascent-stage`: load the spire-ascent tower layout for render/collision QA.
  - `spire-ascent`: select the spire quest, deploy layout, spawn enemies (full dev shortcut).
  Mirror the "Important — dungeon-state scenarios" note: use full auth → lobby →
  `waitForGame` → `emitScenario`, not `connectPlayer` with a scenario query param.
- **`harness/screenshot.mjs`**: in `fallbackRecipe()`, add `isSpireTicket` detection
  (`/spire|spire[-_]ascent/i.test(ticket)` or `/136|spire/.test(outDirAbs)`)
  parallel to `isSlopeTicket`. When true, append steps after `baseSteps`:
  ```js
  { action: 'emitScenario', player: 'A', scenario: 'spire-ascent' },
  { action: 'wait', player: 'A', ms: 1500 },
  { action: 'screenshot', player: 'A', name: '04-spire-ascent',
    description: 'Spire Ascent tower with stacked tiers and ramp passages after emitScenario spire-ascent.' },
  ```
  Update the returned `summary` string for spire tickets accordingly.

## Verification: code
