# Review: Key Item Phase Step

## Runtime health

Fail. The captured run is not valid proof that the game starts and loads cleanly: `metrics.json` reports `"ok": false` with `"failure_kind": "capture_failed"`. There is no `console.log` in `round-2`, and `screenshot.log` shows the browser capture failed before launch with `Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'playwright' imported from harness/screenshot.mjs`.

The server and client logs do show Vite ready on `5173` and the game server listening on `3000`, and `metrics.json` does not report browser `pageerrors`. However, because the browser capture never completed, the ticket fails the required runtime-health gate.

## Acceptance criteria

### Cooldown ~12s

Met in code. `KEY_ITEM_DEFS.phase_step` uses `cooldownMs: 12000`, and the Phase Step test suite verifies the definition and the `on_cooldown` response on immediate reuse.

### Requires co-op ally in same run; solo fails gracefully

Met for the normal server path. The `useKeyItem` handler only considers other living, non-extracted players in the active lobby state, returns `no_ally` for solo use, and does not burn cooldown on that soft failure. The dedicated integration test covers solo failure.

The new `phase-step-ready` debug scenario is a separate blocking issue: it fabricates an ally directly in `state.players`, so the QA shortcut can exercise Phase Step without a real second connected player.

### No swap through walls / endpoints valid

Met for the ticket's stated endpoint-validation requirement. The server checks both the caster and ally endpoint positions with `isInsideDungeon()` before swapping `x`, `y`, and `z`; invalid endpoints fail with `invalid_position` before cooldown is touched.

### Client target highlight or auto-nearest

Met in code, but not visually proven in this capture because the browser run failed. The renderer recomputes the nearest living, non-extracted ally within 6m each frame, shows a cyan ring on that ally while `phase_step` is equipped, and exposes the selected id to `main.js`. The key-item input path emits `{ keyItemId: 'phase_step', targetPlayerId }` for Phase Step while preserving the existing payload shape for other key items. The server still auto-selects nearest when no target is supplied.

### Tests: two players swap coords; out of range fails

Met. `game/server/test/phase_step.test.js` covers the definition, nearest auto-target swap, explicit target swap, out-of-range failure without cooldown, solo failure without cooldown, and cooldown enforcement. The provided coverage log reports `33 passed` test files and `933 passed` tests, including all six Phase Step tests.

## Design and foundation consistency

The implementation stays consistent with the socket-driven multiplayer architecture in `CONTEXT.md` and the dungeon/run loop in `game/docs/design.md`. It does not introduce an obvious regression to the foundation requirements for 3D rendering, client-server connection, multiplayer visualization, or movement synchronization. The failed capture prevents confirming those foundations in the live browser for this round.

## Debug scenarios

Blocking gap. This ticket adds `phase-step-ready`, and while it is debug-gated, the scenario creates a synthetic ally object directly in `state.players` after entering the run. A real player can reach an equivalent end state through normal gameplay by joining a lobby with another player, readying up, equipping Phase Step, and standing within 6m, but this shortcut does not exercise the real second player's auth/socket/lobby membership path. That weakens the co-op invariant this ticket depends on and can let future QA pass against a fake ally while real two-player flow regresses.

## Remaining gaps

1. Captured browser proof is missing because `metrics.json` has `"ok": false` / `"failure_kind": "capture_failed"` and `screenshot.log` shows Playwright missing before browser launch.
2. `phase-step-ready` fabricates the required co-op ally directly in server state instead of using a real second connected lobby player or leaving that requirement to normal gameplay.

VERDICT: FAIL
