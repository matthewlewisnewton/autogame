# QA playthrough: world-stage portal transition into the sunken-canyon stage

Drive the real game in a headless Playwright browser and confirm the world-stage
transition feature fires: start a run on the default stage, transition to a different
WORLD STAGE via the stage debug scenario, and verify the new stage geometry/layout loads
and the player is correctly placed at the new stage's start room. Capture screenshots and
a JSON state snapshot as evidence. This depends on sub-ticket 01 exposing `layout` in the
harness state.

## Acceptance Criteria

- A Playwright script (run against ISOLATED high ports — server `PORT=32xx`, vite
  `--port 52xx --strictPort` with `HARNESS_GAME_PORT` matching, server started with
  `ALLOW_DEBUG_SCENARIOS=1`) performs the full flow and exits 0 on success, exit 1 on
  failure, printing a clear `PASS:`/`FAIL:` line.
- The flow: `POST /api/register` → inject token into `localStorage('autogame_token')` →
  reload → create lobby → ready → wait for phase `playing` (reusing the pattern in
  `game/client/scripts/*.mjs`).
- BEFORE the transition, the script records the starting stage from
  `window.__AUTOGAME_HARNESS_STATE__().layout` (its `profile`, `roomCount`, `startRoom`)
  and the player position, and logs them.
- The script triggers the transition with
  `window.__requestDebugScenarioForTest('sunken-canyon-stage')` and asserts the returned
  result is `ok: true`.
- AFTER the transition, the script asserts (and logs) all of:
  - `layout.profile === 'sunken-canyon'` (different from the recorded "before" profile),
    confirming the new stage geometry/layout loaded.
  - `layout.startRoom` is non-null and the player's `(x, z)` matches the new
    `startRoom` `(x, z)` within a small tolerance (e.g. ≤ 1 unit), confirming correct
    placement.
  - the Three.js scene/canvas is still active (`sceneInitialized` and `hasCanvas` true).
- Captures at least two screenshots (before-transition default stage, after-transition
  sunken-canyon stage) and writes a JSON state snapshot (the before/after harness states)
  to a `docs/walkthroughs/`-style output dir, and the log output names the written files.
- All processes the script starts (server, vite, browser) are cleaned up on exit,
  including on failure. Existing server + client tests still pass and the game starts
  cleanly. Do NOT commit a permanent script unless it clearly belongs alongside the other
  `game/client/scripts/*.mjs` smoke tests.

## Technical Specs

- Model the script on `game/client/scripts/test-summon-recall.mjs` (register/login,
  `loginWithToken`, create-lobby/ready, `__requestDebugScenarioForTest`,
  `__AUTOGAME_HARNESS_STATE__`, screenshot helper). Use `chromium` from `playwright`.
- Stage transition uses the existing `sunken-canyon-stage` debug scenario in
  `game/server/index.js` (registered in `DEBUG_SCENARIOS`, handled ~line 890), which calls
  `generateLayout(seed, 'sunken-canyon')`, recomputes bounds/colliders, repositions the
  player to the `role === 'start'` room, and emits `questUpdate`.
- Read stage identity/placement from the `layout` field added by sub-ticket 01
  (`profile`, `roomCount`, `startRoom`) plus `player.x/z` from the harness state.
- Use `page.waitForFunction` to wait for the post-transition `layout.profile` to become
  `'sunken-canyon'` before asserting/screenshotting (the swap arrives via `questUpdate`).
- Evidence output dir: `game/docs/walkthroughs/world-stage-transition/` (screenshots +
  `snapshot.json`). Keep the script itself out of a committed location unless it is added
  to `game/client/scripts/` in the smoke-test style.

## Verification: code
