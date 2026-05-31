# Make emitScenario await layout rebuild result

The `emitScenario` handler in `screenshot.mjs` only uses `waitForTimeout(1500)` instead of awaiting `__requestDebugScenarioForTest`'s promise or checking `debugScenarioResult.ok`. This can race screenshots on slow machines and produce captures before the layout is rebuilt.

## Acceptance Criteria
- `harness/screenshot.mjs` `emitScenario` handler awaits the promise returned by `window.__requestDebugScenarioForTest(scenarioName)` instead of using a fixed `waitForTimeout(1500)`.
- The handler checks for a successful result (e.g. `window.__debugScenarioResult` with `{ ok: true }`) with a bounded timeout (e.g. 10s) before proceeding to the next step.
- On timeout or failure, the handler logs a warning but does not crash the capture (graceful degradation).

## Technical Specs
- **File**: `harness/screenshot.mjs`
  - In `executeRecipe()`, replace the `emitScenario` block:
    ```js
    // Before:
    await page.evaluate((name) => window.__requestDebugScenarioForTest(name), scenarioName);
    scenarios.add(scenarioName);
    await page.waitForTimeout(1500);
    ```
  - With:
    ```js
    const result = await page.evaluate((name, timeout) => {
      return window.__requestDebugScenarioForTest(name).then(() => ({ ok: true })).catch(e => ({ ok: false, error: e.message }));
    }, scenarioName, step.timeoutMs || 10000);
    scenarios.add(scenarioName);
    if (!result.ok) console.warn(`[emitScenario] ${scenarioName} failed: ${result.error}`);
    await page.waitForTimeout(500); // brief settle after layout rebuild
    ```
  - Verify `window.__requestDebugScenarioForTest` returns a promise (check `game/server/index.js` and client wiring).

## Verification: code
