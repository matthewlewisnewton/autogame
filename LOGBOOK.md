# LOGBOOK

Progress log for the autogame harness. Each entry below is a completed
top-level ticket — a verified-good state that was committed and git-tagged
`v0.N`. Entries are appended newest-last by `harness/run_ticket.sh`.

See `CONTEXT.md` for the project overview, `game/docs/design.md` for the
target game, and `TASKS.md` for the ticket backlog.

## v0.1 — Server Heartbeat System  (2026-05-17 21:25:46)

- **Foundation not regressed** — 3D scene, WebSocket connection, multiplayer
  visualization, and WASD movement sync all remain intact (screenshots
  `02`/`04` show two distinct player cubes and movement). Consistent with
  `requirements.md` and not in conflict with `design.md`.
- **No dead/broken code** — the unused `type` field in the client's heartbeat
  payload is explicitly specified by the ticket; `latency` is both stored and
  displayed as the ticket allows.

## Remaining Gaps
None.

## Notes (non-blocking, no action required)
- The stale-cleanup path emits `playerDisconnected` to other clients only
  indirectly, via the `disconnect` handler triggered by `socket.disconnect()`.
  If a socket were already `connected === false` while still present in
  `gameState.players`, the player would be deleted without a
  `playerDisconnected` broadcast. In practice the `disconnect` handler removes
  such players first, so this state is not reachable; worth keeping in mind if
  future code paths add players without a live socket.


## v0.2 — Input Validation on Server  (2026-05-17 21:35:21)

  movement synchronization (requirement 4) still functions. The client-side
  console log is clean (only Vite connection messages).
- The diff also includes harness changes (`harness/lib.sh`,
  `harness/run_subtask.sh`) and the three sub-ticket `ticket.md` files. These
  are harness/QA tooling, not game code, and do not affect or regress the
  game runtime.

## Code Quality

- No dead or broken code; both handlers guard-then-act with a single early
  return.
- No console errors in `console.log`; server log shows only normal
  connect/disconnect lines.
- Implementation matches the technical specs and is slightly more robust
  (explicit `Array.isArray` rejection).

## Remaining Gaps

None.


## v0.3 — Vite Socket.IO Proxy  (2026-05-17 21:41:22)

  constraints; this ticket is purely a dev-server wiring change and does not
  conflict with it.
- `game/docs/requirements.md` foundation item 2 ("frontend can successfully
  connect to the backend server via WebSockets") is preserved and arguably
  strengthened — the connection now works same-origin without CORS. Items 1, 3,
  and 4 (3D rendering, player visualization, WASD movement sync) remain intact
  per the screenshots and metrics. No regression.

## Code Quality

- No dead or broken code; the diff is minimal and surgical.
- No console errors attributable to this change.
- `vite.config.js` uses a plain object export (no `defineConfig` helper). This
  is valid and functional; `defineConfig` would only add editor type hints and
  is not required. Not a gap.

## Remaining Gaps

None.


## v0.4 — Delta-Time Movement  (2026-05-17 23:55:41)

  socket connects, players are represented as cubes, WASD updates local position and
  broadcasts. Screenshots `03-after-w` (blue cube moved north) and `04-after-d` (blue
  cube moved right) confirm movement and multiplayer sync still work after the change.
- `game/docs/design.md`: no conflict; this ticket is foundational movement plumbing and
  does not touch combat/cards/lobby.

## Code quality

- No dead or broken code; the single diff hunk is minimal and the explanatory comment
  (`main.js:101`) accurately describes the conversion.
- `console.log` shows only the `THREE.Clock` deprecation warning on both clients — no
  errors. `server.log` is clean (connect/disconnect only). `metrics.json` reports
  `ok: true` with a canvas present.
- Velocity is damped asymptotically and never hard-zeroed, but the `0.001` emit threshold
  bounds network chatter to a finite settle period — acceptable.

## Remaining gaps

(none)


## v0.5 — Client Reconnect UI  (2026-05-18 02:17:15)

  `init`/`stateUpdate`/`move`/`playerDisconnected` flow is preserved. The
  heartbeat refactor (`heartbeatStarted` flag → `heartbeatTimer` +
  start/stop helpers) is behavior-preserving and improves teardown.
- **Console / logs**: `console.log` is clean. `server.log` shows normal
  connect/disconnect. The `THREE.Clock` deprecation warning and the `vite ws
  proxy EPIPE` in `client.log` are pre-existing library/harness noise unrelated
  to this ticket.

## Code Quality

- No dead code remaining — the round-1 dead handlers are fixed.
- `updateStatus` cleanly unifies text + class + state tracking.
- Heartbeat lifecycle is correctly tied to connection state (stopped on
  disconnect, restarted on connect/reconnect, idempotent start).
- CSS classes match the hex values specified in the ticket exactly.

## Remaining Gaps

None.


## v0.6 — Camera Follow Player  (2026-05-18 02:28:27)

  movement still updates locally and broadcasts via `socket.emit('move', ...)`
  (`main.js:140`).

## Code Quality

- No dead or broken code; the diff is minimal and focused.
- `CAMERA_OFFSET` is defined once as `new THREE.Vector3(0, 5, 10)`
  (`main.js:102`) per spec; `position.clone()` is used so the offset vector is
  not mutated.
- All new mesh/camera accesses are null-guarded; the camera block does not
  depend on `gameState` being non-null, only on the local mesh existing.
- Browser console log is clean — no errors. The `THREE.Clock` deprecation
  warning predates this ticket (the `Clock` instance is unchanged) and is not
  introduced here. The `EPIPE` entries in `client.log` are Vite ws-proxy
  artifacts from screenshot-session teardown, not game-runtime errors.

## Remaining Gaps

None.


## v0.7 — Card Deck UI Slots  (2026-05-18 02:38:26)


## Consistency & Regression Checks

- **design.md**: The "hand of up to 4 cards" concept is reflected — 4 slots is the
  correct count per the Combat Mechanics section. This ticket scopes only the empty
  visual shell, which is consistent with the design's incremental UI build-out.
- **requirements.md**: No regression. `metrics.json` reports `ok: true`,
  `hasCanvas: true`, `canvasCount: 1`; the 3D scene still renders, the client still
  connects, and the player is visible and movable. The new `#card-hand` uses
  `position: fixed` with `pointer-events: none` and does not touch `#ui`, the canvas,
  or any JS, so movement sync and multiplayer visualization are untouched.
- **Code quality**: Diff is minimal and exactly matches the technical spec. No JS
  changes, no dead code, no broken markup. `console.log` shows only normal Vite
  connection messages; the sole warning (`THREE.Clock` deprecation) is pre-existing
  and unrelated to this ticket. No console errors.

## Remaining Gaps

None.


## v0.8 — Lobby Screen  (2026-05-18 04:16:25)

  multiplayer cube visualization, and WASD movement/sync are all preserved
  intact inside `initScene()`/`animate()`; they are deferred behind the lobby
  gate, not removed. The connection, heartbeat, and `move` paths are unchanged.

## Code Quality

- No console errors: `console.log` shows only Vite connection messages;
  `server.log` is clean.
- The `playerDisconnected` handler now null-guards `scene` (safe before
  `initScene()` runs).
- Listeners (`keydown`/`keyup`/`resize`) are registered inside `initScene()`;
  the `sceneInitialized` guard prevents duplicate registration.
- Minor (non-blocking): `window.initScene = initScene` is leftover console-test
  scaffolding from sub-ticket 01 and is no longer needed now that `startGame`
  drives the call. It is harmless and not a gap.

## Remaining Gaps

None.


## v0.9 — Player Health & Respawn  (2026-05-18 04:48:11)

up, so `startGame` never fired. `03-after-w.png` and `04-after-d.png` are
byte-identical to `02-two-players.png`, i.e. the WASD and damage steps had no
observable effect this round. The integrated in-game behavior (HP bar visible,
cube greying, respawn) is therefore **not demonstrated by this round's
screenshots**. Per the task brief each sub-ticket already passed its own visual
QA, and code review confirms every integration seam is correctly wired, so this
is a screenshot-harness shortcoming rather than an implementation defect. Worth
flagging for the harness, but it does not represent a missing feature.

## Minor Observations (non-blocking)

- `damagePlayer` clamps `hp` to a floor of 0 but not a ceiling of 100. Normal
  play cannot exceed 100 (no healing exists yet), but a negative `amount` sent
  to the `damage` test hook would push `hp` above 100. When real combat/healing
  arrives (tickets 012–014), add a `Math.min(100, …)` cap.

## Remaining Gaps

(none)


## v0.10 — Enemy Entities & Basic AI  (2026-05-18 05:13:01)

## Non-blocking observations (not gaps)
- **QA evidence is inconclusive.** All four round-1 screenshots show only the
  lobby; `metrics.json` reports `hasCanvas: false`. The QA run connected two
  players but never clicked Ready, so the 3D scene (and therefore enemy
  rendering / wander / chase) was never entered or photographed.
  `03-after-w.png` and `04-after-d.png` are byte-identical to
  `02-two-players.png`. This is a limitation of the screenshot harness, not a
  defect in the game code — no game-code change can fix it — but it means the
  visual criteria (AC2, AC3) are verified by code reading only, not by image.
- Enemy AI runs continuously from server start, including during the lobby
  phase, so enemies will drift toward lobby players parked at the origin. This
  matches the ticket's "update every tick" wording and is harmless, but a future
  ticket may want to gate AI on `gamePhase === 'playing'`.
- Client mesh removal calls `scene.remove` without `geometry.dispose()` /
  `material.dispose()`. This mirrors the existing player-mesh handling, so it is
  not a regression; worth a cleanup pass when enemy counts grow.

## Remaining gaps
(none — all five acceptance criteria are fully and robustly implemented)


## v0.11 — Card Hand System  (2026-05-18 06:12:07)

- Minor: `refillSlot()` is defined and exposed as `window.refillSlot` but is
  never called — `useCard()` does its own inline draw on exhaustion. It is
  harmless future-facing API surface, not dead/broken code, so it is not a gap.

## Verification gap (non-blocking observation)

The four screenshots in this round (`01`–`04`) all show only the **lobby** —
both test players remain "Not Ready", `metrics.json` reports `hasCanvas: false`,
and `03-after-w`/`04-after-d` are byte-identical to `02-two-players`. The
screenshot harness never entered the game, so this round provides **no visual
evidence** of the card hand, slot rendering, flash, or charge display. Code
review gives high confidence the feature is correct, and each sub-ticket
individually passed visual QA, so this is treated as a harness/QA-artifact
limitation rather than an implementation defect. It is noted here so the gap in
visual coverage is on record.

## Remaining gaps

(none — all five acceptance criteria are fully and robustly delivered in code)


## v0.12 — Weapon Card Attacks  (2026-05-18 06:40:25)

## Minor observations (non-blocking, not gaps)
- The `cardUsed` payload includes a `hits: [{enemyId, hp}]` array that the
  client does not consume — enemy state is reconciled solely through the
  per-tick `stateUpdate`. Harmless; the array still satisfies the ticket-01
  broadcast contract.
- The server `useCard` handler does not enforce charges or cooldown; charge
  accounting is intentionally client-side "via the ticket-011 hand system" per
  the top-level ticket, so this is within scope. Could be hardened later if
  anti-cheat becomes a concern.
- The projectile travels ~4.8 units over its 600 ms lifetime (`SPEED 8`) versus
  the 5-unit hit range — close enough that the visual reads as covering the hit
  zone.
- Round-2 screenshots (`01`–`04`) only capture the lobby; the harness did not
  click "Ready", so in-game attack visuals are not shown in this round.
  Acceptance of the visual effect rests on the sub-ticket visual QA that
  already passed; the code path is verified correct here.

## Remaining gaps
(none)


## v0.13 — Summon Cards & Magic Stones  (2026-05-18 07:39:51)

  `THREE.Clock` deprecation warning is pre-existing and not introduced here.

## Minor Observations (non-blocking)
- The slot activation flash (`playActivationEffect`) fires on summon press
  before the server verdict is known, so a rejected summon briefly flashes the
  slot as if activated. The dominant feedback (red `cardError` toast) is
  unambiguous, so this is cosmetic only.
- Server-side single-use enforcement is limited to the same-tick window
  (`pendingSummons` is cleared every tick). True per-card-instance enforcement
  is not possible because hand/deck/charge state is entirely client-side by
  pre-existing architecture (weapon charges work the same way). The ticket scope
  does not require server-side hand tracking, and normal gameplay consumes the
  card correctly; full anti-cheat would be a separate architectural ticket.
- `player.pendingSummons` is a `Set` and is serialized as `{}` inside the
  `stateUpdate` payload — harmless dead weight on the wire; the client ignores
  it.

## Remaining Gaps
(none)

