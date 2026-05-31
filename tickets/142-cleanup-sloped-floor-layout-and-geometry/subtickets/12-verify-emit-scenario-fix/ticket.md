# Verify emitScenario handler correctly awaits debug scenario promise

Sub-ticket 07 attempted to replace the blind `waitForTimeout(1500)` with a proper await on `__requestDebugScenarioForTest`'s promise, but introduced a multi-arg `page.evaluate` bug (fixed in sub-ticket 09). This sub-ticket verifies the combined state of both fixes is correct: the handler awaits the promise result with bounded timeout, passes arguments via a single object, and degrades gracefully on failure.

## Acceptance Criteria
- `harness/screenshot.mjs` `emitScenario` handler uses `page.evaluate(fn, { name, timeoutMs })` (single serializable arg object, not multiple args).
- The handler awaits the promise from `window.__requestDebugScenarioForTest(name, timeoutMs)` and checks `{ ok: true }` in the result.
- On timeout or rejection, the handler logs a warning (via `console.warn`) but does not throw or crash the capture.
- `game/client/main.js` `__requestDebugScenarioForTest` returns a promise that resolves with `{ ok: true }` on success (verifiable by reading the function body).

## Technical Specs
- **File**: `harness/screenshot.mjs` (~line 632–642) — inspect the `emitScenario` block in `executeRecipe()`
- **File**: `game/client/main.js` — inspect `window.__requestDebugScenarioForTest` definition to confirm it returns a promise

## Verification: code
