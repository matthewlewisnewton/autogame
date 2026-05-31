# Fix emitScenario Playwright multi-arg bug

`page.evaluate` in the `emitScenario` handler passes two separate arguments (`scenarioName`, `timeoutMs`), which Playwright rejects with `"Too many arguments"`. Playwright's `page.evaluate` accepts at most one serializable argument after the function.

## Acceptance Criteria
- `harness/screenshot.mjs` `emitScenario` handler calls `page.evaluate` with a **single** argument object instead of two positional args.
- The evaluate callback destructures the object to recover `name` and `timeoutMs`.
- The handler still awaits the promise from `window.__requestDebugScenarioForTest` and logs a warning on failure (behavior from sub-ticket 07 must be preserved).

## Technical Specs
- **File**: `harness/screenshot.mjs` (~613–617)
  - Replace:
    ```js
    const result = await page.evaluate((name, timeoutMs) => {
      return window.__requestDebugScenarioForTest(name, timeoutMs)
        .then((r) => ({ ok: r.ok === true, ...(r || {}) }))
        .catch((e) => ({ ok: false, error: e.message }));
    }, scenarioName, step.timeoutMs || 10000);
    ```
  - With:
    ```js
    const result = await page.evaluate(({ name, timeoutMs }) => {
      return window.__requestDebugScenarioForTest(name, timeoutMs)
        .then((r) => ({ ok: r.ok === true, ...(r || {}) }))
        .catch((e) => ({ ok: false, error: e.message }));
    }, { name: scenarioName, timeoutMs: step.timeoutMs || 10000 });
    ```

## Verification: code
