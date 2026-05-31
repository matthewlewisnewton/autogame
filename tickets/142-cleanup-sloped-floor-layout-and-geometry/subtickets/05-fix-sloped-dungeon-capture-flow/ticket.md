# Add emitScenario capture action for dungeon-state debug scenarios

The `sloped-dungeon` debug scenario requires an authenticated player in an active lobby, but the harness only supported `connectPlayer` with `?debugScenario=` on a fresh page. This causes `waitForGame` to time out and capture to fall back to generic smoke. Add an `emitScenario` action that triggers debug scenarios on an already-connected player after gameplay has started.

## Acceptance Criteria
- `harness/screenshot.mjs` includes `'emitScenario'` in the `ACTIONS` allowlist.
- `harness/screenshot.mjs` has an `emitScenario` handler in `executeRecipe()` that calls `window.__requestDebugScenarioForTest(scenarioName)` on the page and waits for layout rebuild.
- `harness/screenshot.mjs` validates `step.scenario` for `emitScenario` steps using the existing `SCENARIO_RE` guard.
- `harness/prompts/capture-plan.md` documents `emitScenario` as an available action with fields: `player`, `scenario`.
- `harness/prompts/capture-plan.md` warns that dungeon-state scenarios require the full auth → lobby → gameplay flow before `emitScenario` (not `connectPlayer` with `scenario`).

## Technical Specs
- **File**: `harness/screenshot.mjs`
  - Add `'emitScenario'` to the `ACTIONS` Set (~line 50).
  - In `executeRecipe()`, add handler after `waitForGame` that evaluates `window.__requestDebugScenarioForTest(step.scenario)` on the page, tracks scenario in `scenarios` Set, and waits 1500ms for layout rebuild.
- **File**: `harness/prompts/capture-plan.md`
  - Add `emitScenario` to the action list with fields: `player`, `scenario`.
  - Add "Important — dungeon-state scenarios" section with correct recipe for `sloped-dungeon`.

## Verification: code
