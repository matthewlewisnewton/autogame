# Drive the full-flow capture launch through the launch-booth ready-up path

The deterministic full-flow capture still readies players by clicking the 2D
`#ready-btn`, which sub-ticket 03 retired. With no button to click, neither
captured player readies up, `startGame` never fires, and the capture times out
in the squad lobby (`page.waitForFunction: Timeout 12000ms exceeded`,
`metrics.json` `ok: false` / `capture_failed`). Re-route the capture's
`readyAll` step through the existing launch-booth ready-up so the run reaches the
playing phase — without re-introducing the retired 2D Deploy button.

## Acceptance Criteria

- The `readyAll` capture step readies every captured player through the
  launch-booth ready-up path (the same `launchBoothReadyUp` →
  `playerReady(true)` path used by the Launch Bay booth and the `?booth=launch`
  hook), not through a `#ready-btn` click.
- A test-only hook on `window` (e.g. `window.__launchReadyUpForTest`) exposes the
  launch-booth ready-up so the capture can invoke it per page; it calls the same
  `launchBoothReadyUp()` function and introduces no new socket event.
- The retired 2D `#ready-btn` is NOT re-added to `game/client/index.html` or
  `game/client/main.js`; the launch booth remains the single launch path.
- The full-flow capture run completes cleanly: `metrics.json` reports
  `ok: true`, the run advances to the playing phase, and `console.log` contains
  the booth ready-up marker (`[launchBooth] ready-up via booth`) with no
  `waitForFunction` timeout.
- The `#lobby-browser` (lobby-finder) menu and the `?booth=` debug hooks remain
  unchanged and functional.
- Tests green (`pnpm test` server + client).

## Technical Specs

- `game/client/main.js`: expose a test-only hook alongside the existing
  `window.__...ForTest` hooks (near line ~2030), e.g.
  `window.__launchReadyUpForTest = () => launchBoothReadyUp();`. This must call
  the existing `launchBoothReadyUp()` (the shared ready-up that emits
  `playerReady(true)` and dispatches `LAUNCH_READY_EVENT`); do not duplicate its
  logic or add a new socket message. The hook is idempotent because
  `launchBoothReadyUp()` already bails when the player is already ready.
- `harness/screenshot.mjs`: in the `readyAll` step (around lines 817–826), for
  each open page, ready up by calling the booth hook via `page.evaluate`, e.g.
  `await page.evaluate(() => window.__launchReadyUpForTest && window.__launchReadyUpForTest())`.
  Remove the obsolete `#ready-btn` locator/click (or keep it only as a harmless
  no-op fallback). Keep the existing settle `waitForTimeout` so all players
  ready before the subsequent `waitForGameplay`/playing-phase wait.
- Do not change `game/client/launchBooth.js`; its `shouldLaunchReadyUp`,
  `isLaunchBoothAction`, `getBoothDebugHook`, and the `?booth=launch` hook stay
  intact.

## Verification: code
