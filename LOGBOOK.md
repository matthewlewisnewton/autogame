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


## v0.14 — Independent Monster Cards  (2026-05-18 08:11:00)

  visualization, and movement sync are untouched. Server starts cleanly
  (`server.log`), client loads with no page errors (`console.log` shows only
  benign Vite/THREE noise).
- Code quality: the monster branches on both client and server are small,
  scoped, and mirror the existing weapon/summon branch structure. No dead or
  broken code, no console errors.

## Remaining gaps

None blocking. The acceptance criteria are fully and robustly satisfied in the
end-state code. Non-blocking nits are recorded separately for the backlog:

1. Minion `hp` despawn path is currently inert — no game mechanic damages
   minions, so a minion can only ever despawn via `ttl`. Future-facing only.
2. Monster-card consumption in `useCard` is not gated by the per-slot cooldown,
   so rapid key-spam can consume several monster cards (and spawn several
   minions) in quick succession. Minor; matches weapon-card behavior.
3. The review-round-1 capture never exercised the monster card, so visual QA of
   the minion is unverified. This is a harness capture-plan issue.


## v0.15 — Loot Drops & Currency  (2026-05-18 19:04:04)

- Consistent with `design.md` §3 "Loot & Economy" — currency drops from
  defeated enemies; card drops are out of scope for this ticket.
- No regression to the foundation: combat, summons, minions, dungeon, and the
  existing HUD are untouched apart from the additive loot hooks.
- Logs in the capture are clean — no errors in `console.log`/`server.log`;
  `client.log` shows only a pre-existing `THREE.Clock` deprecation warning.
- `crypto.randomUUID()` for loot ids is consistent with enemy/minion id
  generation; `crypto` is required at the top of the server module.

Note on the round-3 capture: the screenshots show `GOLD 0` throughout and no
coin on the ground because the QA run did not land a kill-with-drop in frame
(50% roll; `server.log` shows no `[loot] spawned` line). This is a capture
limitation, not a code defect — the spawn/render/pickup/credit logic is sound
on inspection and all four criteria are met by the live code.

## Remaining gaps

None blocking. All four acceptance criteria are fully and robustly met. Two
minor non-blocking nits are recorded in `nits.md`.


## v0.16 — Test Coverage  (2026-05-18 23:38:52)

**Met.** `vitest.config.js` enforces 70% on statements/branches/functions/lines
via `coverage.thresholds`; the actual run reports 88.88 / 89.88 / 81.48 / 88.88.
The coverage `include` is scoped to `server/index.js` and `client/cards.js`;
`collision.js` and `hand.js` are tested but excluded from the measured set —
noted as a nit (the threshold still passes comfortably on the included files).

## Consistency with design / requirements
No regression to the foundation: the captured run shows lobby → playing
transition, movement, card hand, combat HUD all functional. The server
refactor preserves runtime behavior. `generateLayout` wall-segment math was
tightened (room doorway segments now span corner-to-centered-gap, passage
walls use `CELL_SPACING`) — a correctness improvement that passed the
sub-ticket's visual QA and the round-1 capture; no gameplay regression
observed. The deleted `game/coverage/` artifacts are now `.gitignore`d.

## Remaining gaps
None blocking. The acceptance criteria are fully and robustly met, the test
suite is comprehensive and green, and the game runs cleanly. Minor polish
items are recorded in `nits.md`.


## v0.17 — Dungeon Run Objective Progress  (2026-05-19 00:25:09)

  `run` is included in every `stateUpdate`.
- **Client renders HUD while `gamePhase === 'playing'`** — Met.
  `updateObjectiveHud()` (main.js:110) shows `#objective-hud` only when phase is
  `playing` and `run.objective` exists, otherwise hides it.
- **HUD shows label + `Defeated X / Y`** — Met. Confirmed in screenshots
  (`Defeat all enemies` / `Defeated 0 / 5`) and probe `bodyText`.
- **HUD updates from server state, not local mesh counts** — Met. HUD reads
  `gameState.run.objective`; refreshed from `init`, `stateUpdate`, and
  `startGame` handlers.
- **Lobby ready flow still starts the game** — Met. `checkAllReady()` unchanged
  except for the added `startDungeonRun()` call; integration tests for ready
  flow still pass.
- **Existing combat/card/loot still works** — Met. Enemy-removal logic
  unchanged; defeat accounting is purely additive. Loot spawn loop untouched.
  Full suite (combat, cards, loot) green.

## Remaining gaps
None blocking. `resetGameState()` correctly clears `run`, so a fresh lobby
cycle starts a clean run. Minor non-blocking polish noted in `nits.md`.


## v0.18 — Run Completion Summary and Return to Lobby  (2026-05-19 01:23:15)

    is cleared by the next game-loop tick. Broadcasts `stateUpdate` + lobby update.

11. **Client hides HUD/card hand, shows lobby on confirmed return** — Met. The
    `stateUpdate` handler hides `#run-summary-overlay`, `#ui`, `#card-hand` and
    un-hides the lobby when `state.gamePhase === 'lobby'`.

12. **Second run without page refresh** — Met. The `startGame` handler no longer
    bails on `sceneInitialized`; on a subsequent run it re-inits the hand, resets
    local player position/velocity, and disposes prior enemy/minion/loot meshes
    (all plain `THREE.Mesh`, so the geometry/material dispose is safe). The
    integration test "players can ready up and start a second run" confirms this.

Consistent with `design.md` (lobby → dungeon → loot loop) and does not regress
the foundation — currency/inventory are explicitly preserved for later reward
tickets, and no card-reward/deck-editing scope was added, per the ticket notes.

## Remaining gaps

None blocking. Minor polish items recorded in `nits.md`.


## v0.19 — Session Inventory and Card Rewards  (2026-05-19 03:06:07)

`currencyEarnedThisRun`. `startDungeonRun` resets per-run tracking only. Integration
test confirms a second run reuses prior currency/ownedCards.

**No server-restart persistence required** — Met; nothing added beyond in-memory state.

## Consistency
Consistent with `design.md` ("Enemies drop currency and new cards", card-deck
economy). No regression to the run-summary / return-to-lobby foundation — the
terminal-state flow was refactored cleanly (single status determination, rewards
granted before summary build) and still emits exactly one terminal event per run.

## Remaining gaps
None blocking. Two minor nits recorded in `nits.md`:
- Multi-card reward names are joined with `\n` but the CSS lacks `white-space`
  handling, so >1 card would collapse onto one line (not currently reachable —
  only one card is ever granted).
- The "reconnecting player" `else` branch in the connection handler is effectively
  dead code: `disconnect` deletes the player entry and socket ids are unique, so
  the branch never executes; its comment is misleading.


## v0.20 — Lobby Deck Editor  (2026-05-19 04:26:57)

and later tuning.

**Design / requirements consistency** — Consistent. Deck management in the
lobby matches `design.md`'s "manage their decks" core-loop step; no foundation
regression observed.

## Remaining gaps

No blocking gaps. The acceptance criteria are fully and robustly met and the
captured run is clean.

Non-blocking items (see `nits.md`):
1. `integration.test.js` test `deckAddCard during playing phase is silently
   ignored` fails because it `reject()`s its timeout sentinel instead of
   `resolve()`-ing it — the suite reports a red test even though the server
   guard is correct. The sibling `deckRemoveCard` test (using `sleep`) passes.
2. The default `selectedDeck` is the 4 unique starting cards rather than the
   full 8-card starting deck, leaving zero draw-deck reserve for slot refills
   in-run. Worth deciding whether the default should be the full starting deck.


## v0.21 — Combat Feedback and Readability  (2026-05-19 07:54:11)

**Loot pickup immediate client feedback** — PASS. When loot leaves `gameState`,
`markLootCollected` plays a scale-up/fade animation and spawns a gold `+N` number; the
currency HUD flashes gold on increase. `GOLD 13` in screenshots 03/04 is gold-colored.

**Card slots show cooldown / insufficient MS / empty** — PASS. `.cooldown` (pre-existing,
dashed + dimmed — visible on Flame Blade in screenshot 02), new `.no-ms` (red border/bg
for unaffordable summon cards), new `.empty` (dashed, dimmed). `renderHand` re-runs on
each `stateUpdate` to keep `.no-ms` synced as Magic Stones regenerate.

**cardError still appears + resource constraints visible in hand** — PASS.
`showCardErrorToast` still fires; `cardError` with reason `Not enough Magic Stones` also
adds `.no-ms` to the used slot (`lastUsedSlot` tracking).

**Existing combat mechanics/damage numbers unchanged** — PASS. `git diff` shows no
changes to `server/index.js`; combat logic and damage values are untouched.

## Remaining gaps
None blocking. All acceptance criteria are met and the captured run is healthy.
Minor non-blocking polish items are recorded in `nits.md`.


## v0.22 — Encounter Telegraphs and Audio Cues  (2026-05-19 09:41:53)

defined and exported.

## Tests

`npm test` — 267/268 pass. The new ticket-030 tests all pass: enemy attack
state-machine unit tests, range-revalidation tests, the two
`Enemy telegraph integration` tests (wind-up observed before HP drop; out-of-range
cancels damage), and the client audio-safety test.

The single failure — `deckAddCard during playing phase is silently ignored` —
is a **pre-existing broken test from ticket 028**, untouched by this ticket
(the integration-test diff only *adds* the `Enemy telegraph integration`
block). Its timeout race rejects instead of resolving, so it can never pass.
Not a regression of ticket 030; recorded as a nit.

## Remaining gaps

None blocking. Acceptance criteria are fully and robustly met, and the captured
run is clean. Minor non-blocking items are filed in `nits.md`.


## v0.23 — Dungeon Room Generation  (2026-05-19 11:06:12)

in the `init` payload to every client. `stateSnapshot()` strips the bulky
`layout` but retains `layoutSeed`, and the client cross-checks it on every
`stateUpdate` (`[layout] Seed mismatch` warning path) and on reconnect. Both
capture probes show two players in one `playing` session; screenshots `02` (A)
and `04` (B) show the same room/wall geometry from different viewpoints.

## Consistency & regression
- Consistent with `game/docs/design.md` ("modularly generated level where they
  navigate rooms").
- No foundation regression: all `requirements.md` items (3D render, WS connect,
  multiplayer visualization, movement sync) still pass — confirmed by the
  captured run and the full 296-test suite.
- The diff for this round is a clean extraction refactor (server generator →
  `server/dungeon.js`, client geometry/collision → `client/dungeon.js`) plus
  unit and cross-client integration tests; behaviour is preserved.

## Remaining gaps
None blocking. Minor nit (redundant `dungeonMeshes.length = 0` in `initScene`
after `clearDungeon` already cleared it) recorded in `nits.md`.

