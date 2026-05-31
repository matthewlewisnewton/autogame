1. Round-2 capture failed (`metrics.json` `"ok": false`); zero screenshots — ticket has no runnable proof.
   Files: `harness/screenshot.mjs` (and re-run capture into `tickets/142-cleanup-sloped-floor-layout-and-geometry/round-2/`)
   Fix: Fix items 2–3 below, then re-run harness screenshot capture until `metrics.json` has `"ok": true` and `screenshots[]` includes a ramp/sloped-room frame per ticket AC.

2. `emitScenario` passes two arguments to `page.evaluate`, which Playwright rejects (`Too many arguments`).
   Files: `harness/screenshot.mjs` (~613–617)
   Fix: Use one arg object, e.g. `page.evaluate(({ name, timeoutMs }) => window.__requestDebugScenarioForTest(name, timeoutMs)…, { name: scenarioName, timeoutMs: step.timeoutMs || 10000 })`.

3. Harness ramp screenshot acceptance criterion not satisfied — no sloped-room screenshot in round-2 (or round-1).
   Files: `harness/screenshot.mjs` (`fallbackRecipe` sloped steps), `harness/prompts/capture-plan.md`
   Fix: After fixes above, ensure capture completes fallback/Gemini flow with `emitScenario` `sloped-dungeon` and records screenshot `04-sloped-ramp` (or equivalent) whose description states a sloped room/ramp is visible.

4. Fallback `createLobby` times out when `#lobby-browser` is hidden but squad `#lobby` may already be active.
   Files: `harness/screenshot.mjs` (`createLobby` handler ~547–569)
   Fix: Before filling `#create-lobby-name`, if `#lobby` is already visible treat create as done; otherwise wait for `#lobby-browser` visible (post-login) with a short `waitForFunction`, then create.
