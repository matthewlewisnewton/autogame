# 10 — Client browser capture stability (round-3 runtime health)

Round-3 review capture failed before gameplay: `metrics.json` reports `"ok": false` / `failure_kind: "capture_failed"`, and `console.log` records `page.goto: Page crashed` while navigating to the Vite client (`pageerrors.json` is empty). Reproduce the Playwright navigation crash, harden the client startup/render path so the tab survives initial load, and restore a clean harness capture with screenshots and probes.

## Acceptance Criteria

- Running the harness capture recipe against the local client (`node harness/screenshot.mjs <clientUrl> <artifactDir>` with `CAPTURE_PLAN_AGENT=fallback`, or the ticket's round capture step) completes without `page.goto: Page crashed` in `console.log` / `screenshot.log`.
- Capture artifacts report success: `metrics.json` has `"ok": true`, at least one screenshot file is present, and at least one gameplay probe is recorded (`harnessState.sceneInitialized === true`, `hasCanvas === true`, `phase === 'playing'`).
- `pageerrors.json` stays empty (no uncaught module/runtime exceptions on load).
- `initScene()` is safe to call once per session: it does not leak extra WebGL canvases on the document body (gameplay capture probe `canvasCount` is 1 for the main renderer, excluding intentional booth-preview canvases that are not left attached during deploy).
- `cd game && pnpm test:quick` passes, including existing client renderer/passage-gate tests (`game/client/test/passage-gate-meshes.test.js`, `game/client/test/passage-gate-unlock-feedback.test.js`, `game/client/test/hub-lobby-render.test.js`).

## Technical Specs

- **Edit:** `game/client/renderer.js`
  - Add `disposeRenderer()` (or equivalent) that disposes the existing `THREE.WebGLRenderer`, removes its `domElement` from `document.body`, and clears renderer/sceneInitialized state.
  - Call disposal at the top of `initScene()` before creating a new `WebGLRenderer`, so hub → quest transitions and reconnect paths cannot accumulate multiple GPU contexts (sub-ticket 09 captures already showed `canvasCount: 2`).
  - Create the renderer with headless-stable options, e.g. `{ antialias: true, powerPreference: 'low-power', failIfMajorPerformanceCaveat: false }`, and register a `webglcontextlost` handler that prevents default where appropriate and logs a recoverable warning instead of letting the tab die silently.
  - Ensure `rebuildDungeonLayout()` / `syncPassageLockGates()` do not recreate the renderer or append additional canvases.
- **Edit:** `game/client/main.js`
  - Audit `renderHubScene()`, `applyLobbyJoinedData()` (`joinPhase === 'playing'`), and `SERVER_TO_CLIENT.START_GAME` handlers so they never call `rendererInitScene()` when `isSceneInitialized()` is already true (prefer `rebuildDungeonLayout()` for layout swaps).
  - If booth/cosmetic preview opens a separate WebGL canvas (`cosmetic-preview.js`), ensure it is disposed/removed before deploy so the harness probe does not confuse preview canvases with the main game canvas.
- **Reproduce / verify:** use round-3 artifacts as the failure reference (`tickets/wave-gated-doors-blocking-gates-in-passages-that-unlock-when-o0vv.2/round-3/console.log`, `screenshot.log`, `metrics.json`). Sub-ticket 09 capture (`subtickets/09-arena-trials-boss-approach-regression/artifacts/iter-1/metrics.json`) is a passing baseline for the two-player fallback plan.
- **Do not edit:** `harness/` (unless investigation proves the crash is 100% harness-only with zero client involvement — the review gap points at `game/client/main.js` and `game/client/renderer.js`).

## Verification: code
