# Senior Review: 237-booth-mission-launch

## Runtime health

Blocking: the captured run is not valid. `metrics.json` reports `"ok": false` with `failure_kind: "capture_failed"`, and `console.log` ends with `page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5173/`. There are no screenshots or probes in the round output, so the ticket lacks the required proof that the game starts and loads cleanly.

`pageerrors.json` is empty, and the visible `client.log` / `server.log` tails show Vite and the game server reached ready/listening states. There is no `harness_failure` block in `metrics.json`, so this review cannot classify it under the explicit harness-blocker path; by the ticket review rules, `"ok": false` is still an automatic fail.

## Acceptance criteria

### 1. Launch booth does ready-up + triggers startGame for the party

Pass on code inspection. The server-side `boothInteract` handler only accepts booth actions while in the lobby phase, validates the requested booth id against hub anchors, and performs an authoritative proximity check before emitting `boothAction`. The client re-dispatches that action through `BOOTH_ACTION_EVENT`, and the launch booth listener calls `launchBoothReadyUp()`, which emits `playerReady(true)`.

That path reuses the existing server `playerReady` handler, including quest-tier and deck validation, then reaches `checkAllReady()` and the existing `startGame` broadcast when all connected players are ready. This matches the design requirement that players ready up in the lobby and transition together into the dungeon.

### 2. `?booth=launch` hook

Pass on code inspection. The query hook is parsed by `getBoothDebugHook()` and only fires from the `lobbyJoined` handler when the joined state is still `gamePhase === 'lobby'`. It uses the same `launchBoothReadyUp()` function as the physical booth action, so it does not introduce a new server event or bypass the normal ready/start path.

### 3. 2D ready/launch still works

Pass on code inspection. The existing `#ready-btn` listener still toggles `isReady`, emits `playerReady(isReady)`, and syncs the button role. The resume button also continues to emit `playerReady(true)` through its prior path. The new booth helper is additive and does not remove or replace the 2D controls.

### 4. Test

Pass for unit coverage, but runtime verification is blocked. `coverage.log` shows the client suite passed, including `client/test/launchBooth.test.js` with 6 tests and 182 total passing tests across the run. Those tests cover the extracted launch booth helper contract. However, because the final browser capture failed to load the game, the ticket still fails the required live-run verification.

## Design and requirements consistency

The implementation is consistent with the lobby/deploy loop in `game/docs/design.md`: launch remains a lobby ready-up action, and the actual dungeon transition stays behind the party-ready server gate. It does not appear to regress the foundation in `game/docs/requirements.md`; the changed code is limited to client launch-booth wiring and helper tests, and it does not alter rendering, socket transport, player visualization, or movement synchronization.

## Code quality

No obvious dead code or broken import was found in the changed files. The helper module is small and testable, and the new main-client wiring uses existing booth and ready primitives. No browser page errors were captured, but the lack of a successful browser load prevents a full console/runtime quality pass.

## Remaining gaps

1. The game did not produce a clean captured run for this ticket. `metrics.json` is `"ok": false`, `failure_kind` is `"capture_failed"`, `console.log` reports `page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5173/`, and the round contains no screenshots or probes.

VERDICT: FAIL
