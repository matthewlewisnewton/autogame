# Senior Review — Launch Bay ready-up failure (invalid deck) gives no visible feedback

## Runtime health (gate)
- `metrics.json`: `"ok": true`, `pageerrors: []`, no `harness_failure`, servers started (url `:5177`).
- `console.log`: only benign `401 (Unauthorized)` / `409 (Conflict)` resource responses from the auth/lobby-join flow — no `[fatal]` or `pageerror` lines from game code.
- Capture probes show a healthy run: scene initialized, players=2, phase `playing`, dodge cooldown HUD working.
- **Game runs and loads cleanly.** Gate passes.

Note: the capture used the deterministic fallback smoke plan (`capturePlanSource: "fallback"`, `debugScenario: null`), so the new toast was not exercised *visually* in this run. The behavior is, however, covered directly and robustly by new unit tests (see below), and runtime health is proven, so this is not blocking.

## Acceptance criteria

### AC1 — Invalid-deck ready-up at Launch Bay surfaces clear on-screen feedback
**Met.** `showDeckError` (game/client/main.js:3101) still writes `#deck-error`, but now also checks the `#deck-editor` element: if it is absent or carries the `hidden` class (the exact class toggled at main.js:3389 / set in index.html:163), it raises a transient red toast via `showTransientToast`. `formatDeckErrorToast` maps the server reason `Deck must have at least 4 cards` (progression.js:1769, regex `^Deck must have at least (\d+) cards$`) to the ticket's requested copy: `Deck too small — open the Deck booth (need 4+ cards)`. When the editor is open, no toast fires (the inline message is already visible) — correct de-dup. Covered by `deckError handler — hidden deck editor` test.

### AC2 — No client/server ready desync on rejection
**Met.** `launchBoothReadyUp` (main.js:4283) no longer optimistically sets `isReady = true`. It sets `launchReadyPending = true` and emits `PLAYER_READY`, then waits. The server (deckHandlers.js:246) sets `player.ready = false`, emits `DECK_ERROR`, and `broadcastLobbyUpdate`. The client `DECK_ERROR` handler (lobbyHandlers.js:60) resets both `isReady = false` and `launchReadyPending = false`; the trailing `LOBBY_UPDATE` confirms `ready:false`. On success, the server broadcasts `LOBBY_UPDATE` with `ready:true` *before* `checkAllReady`, so `confirmLaunchReadyUp` promotes `isReady` and fires `launch:ready` only after the authoritative ack. Idempotency holds: a repeat booth touch while pending or already-ready is rejected by `shouldLaunchReadyUp(isReady, launchReadyPending)`. Covered by both new `launchBoothReadyUp — invalid deck rejection path` tests (no optimistic promotion; promotion only after server confirm; single `playerReady` emit).

### Debug scenario `launch-bay-invalid-deck` (review checklist)
**Met.**
- Gated: registered only in `DEBUG_SCENARIO_REGISTRY` (debugScenarios.js:5001) and the `DEBUG_SCENARIOS` allow-set (index.js:561); reachable solely via the `?debugScenario=` path (debug-gate tests pass).
- Normal reachability preserved: it just shrinks `selectedDeck` below `DECK_MIN_SIZE` in the hub lobby — exactly the state a player reaches by removing cards in the Deck booth. The flow that gets a real player there is untouched.
- No invariant bypass: it only seeds lobby state and emits `DECK_UPDATE`/`STATE_UPDATE`; the actual rejection still runs `validateDeck` server-side at ready-up time.

## Consistency / regression
- Consistent with the hub-booth + lobby-ready model in `game/docs/design.md`; no foundation regressions.
- Tests: `client/test/launchBooth.test.js` + `client/test/main.test.js` → 207 passed; `server/test/debug-scenarios.test.js` + tier1 + debug-gate → 78 passed. Registry/allow-set stay consistent.
- Code quality: small, well-commented changes; the new ctx accessor `launchReadyPending` is wired through `socketHandlerCtx.js` cleanly. No dead/broken code.

## Remaining gaps
None blocking.

VERDICT: PASS