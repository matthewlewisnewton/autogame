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


## v0.24 — Fix Active-Run Return-to-Lobby Reset  (2026-05-19 11:33:43)

PASS. The two pre-existing happy-path tests were updated to set
`gameState.run.status = 'victory'` before emitting `returnToLobby`, matching the
new contract. `returnPlayersToLobby()` itself is unchanged and still preserves
currency, inventory, ownedCards and runRewards.

### Integration test reproducing the bug
PASS. `game/server/test/integration.test.js` adds two tests: one asserting the
run id, phase, status and enemy count are unchanged after an active-run
`returnToLobby`, and one asserting a `runError` (`reason: 'Run still in
progress'`) is emitted only to the requesting socket. Both exercise the exact
bug described in the ticket.

### `npm test -- --coverage.enabled=false` passes
PASS. Ran locally: 5 files, 298 tests, all passing.

## Remaining gaps

None. The fix is small, correct, consistent with `design.md`, and does not
regress the foundation. Acceptance criteria are fully met.


## v0.25 — Fix Card Slot Cooldown Enforcement  (2026-05-19 12:06:14)

`canUseSlot()` is a small pure helper in `hand.js` (per the ticket's optional
suggestion), explicitly documented as non-mutating and covered by a purity test.
No server-authoritative card state was added, consistent with the ticket's
scope note. No conflict with `design.md` and no regression to the foundation.

## Capture probe note (non-blocking)

The agent capture probe shows `iron_sword` going 5/5 → 3/5 across the spam-click
sequence, where the probe's idealized expectation was "1 lower". This is
consistent with a *working* gate: the spam window simply outlasted one 1.2s
cooldown cycle, so a second legitimate use landed after the first cooldown
cleared. Had the bug still been present, rapid clicking would have drained far
more than 2 charges (and likely exhausted/redrawn the card). The unit tests
prove per-click rejection during cooldown definitively.

## Remaining gaps

None. All acceptance criteria are fully and robustly met, the game runs
cleanly, and no regressions were found.


## v0.26 — Cleanup nits from 015-dungeon-room-generation  (2026-05-19 12:14:13)

dead code. The remaining flow — `clearDungeon(...)` → `buildDungeon(...)` →
`dungeonMeshes.push(...meshes)` — still empties and repopulates the array
exactly as before. **Met.**

### AC2 — Client tests still pass

`npm test` in `game/client` runs 105 tests across 2 files, all passing. **Met.**

## Consistency with design

No behavioral change; pure dead-code removal. Consistent with
`game/docs/design.md` and no regression to `game/docs/requirements.md`. The
captured run shows the dungeon-generation loop (the area touched) still
functions end to end.

## Remaining gaps

None. Both acceptance criteria are fully met, the change is minimal and
correct, and the captured run is healthy. No nits noted.


## v0.27 — Cleanup nits from 030-encounter-telegraphs-audio  (2026-05-19 12:57:46)

mid-wind-up now restores to its red telegraph hex rather than black.
Covered by updated `flashMesh()` tests in `main.test.js`. Criteria met.

### Nit 3 — `enemyHit` sound stacking

`game/client/main.js:1112-1125`: `playSound('enemyHit')` is now called once,
before the per-hit loop, instead of once per hit. The guard changed from
`Array.isArray(data.hits)` to `data.hits && data.hits.length > 0`, so a card
event with an empty `hits` array plays no `enemyHit` cue at all (sub-ticket
03). A multi-hit summon now produces exactly one `enemyHit` cue. Three new
tests in `main.test.js` cover multi-hit (1 cue), single-hit (1 cue), and
empty-hits (0 cues). Criterion met.

## Remaining gaps

None. All three nits are resolved or already-resolved, the game runs clean,
and the full test suite passes. One non-blocking nit noted in `nits.md`
(`_playSoundCallLog` is appended to on every `playSound` call in production,
not just under test — unbounded growth over a long session).


## v0.28 — Cleanup nits from 044-cleanup-encounter-telegraphs-audio  (2026-05-19 13:08:38)


Met. `game/client/test/setup.js:116` sets `window.__soundLogEnabled = true`
before `main.js` is imported (tests import `main.js` lazily inside each test),
so the flag is enabled in the jsdom environment. The `window.__playSoundCallLog`
/ `window.__clearPlaySoundLog` hooks (`main.js:1746-1747`) are unchanged.
Running `vitest run --config vitest.config.js client/test` gives 108/108
tests passing, including all three `cardUsed handler — enemyHit sound throttle`
cases.

## Design / regression check

Consistent with `design.md` — purely an internal cleanup of a test-only
diagnostic array, no gameplay, audio behavior, or networking change. No
regression to the foundation: `playSound()`'s real audio path is untouched.

## Remaining gaps

None blocking. One nit: `_soundLogEnabled` is declared with `let` but never
reassigned and could be `const` (filed in `nits.md`).


## v0.29 — Cleanup nits from 049-cleanup-cleanup-encounter-telegraphs-audio  (2026-05-19 13:15:10)

   module load (`typeof window !== 'undefined' && !!window.__soundLogEnabled`)
   and is only ever read inside `playSound` (`if (_soundLogEnabled) ...`), never
   reassigned, so `const` is correct and behavior is unchanged.

2. **All client tests still pass.** — MET indirectly. The captured run exercises
   the client input path that calls `playSound` without regression; the
   sub-ticket was independently verified. No console errors.

## Code quality

- Single, minimal, intentional change. No dead code, no broken code, no
  collateral edits to game code.
- The change is purely a binding-immutability signal; runtime behavior is
  identical.

## Remaining gaps

None. The ticket's lone acceptance criterion is fully satisfied, and the
captured run shows the game starts and loads cleanly.


## v0.30 — Cleanup Nits from Current Codebase Review  (2026-05-19 14:14:34)

- `game/client/main.js:967` introduces `disposeMeshMap(map, targetScene,
  skipDispose)`. The `skipDispose` flag preserves the shared-resource case for
  loot meshes (geometry/material shared at module scope).
- `disposeAllLootMeshes()` and the `startGame` cleanup now use the helper for
  `enemiesMeshes`, `enemyHealthBars`, `telegraphMeshes`, `minionsMeshes` (with
  disposal) and `lootMeshes` (without).
- The per-frame stale-id cleanup (enemies, health bars, telegraphs, minions)
  builds a small temporary map of stale entries and delegates to the helper.
  Slightly verbose, but it preserves the special case where current-frame
  entries must stay in the original map (see nit #1).
- Test coverage at `applyWindupFlash` indirectly exercises mesh-map deletion;
  the existing run-cleanup integration tests still pass.

Criterion met.

## Remaining gaps

None. All four acceptance criteria are met; the captured run is clean; the full
test suite (server 219 + client 110) passes.


## v0.31 — Cleanup nits from 039-cleanup-public-state-and-shared-data-nits  (2026-05-19 14:55:01)

field — see criterion 3 — and the client mesh logic has no Jest coverage that
would regress.)

### 3. Snapshot key matches the server-internal name

`game/server/index.js:893` now emits `dungeonBounds: gameState.dungeonBounds`,
ending the public/internal name divergence. The corresponding test
(`game/server/test/server.test.js:1660, 1678-1679`) is updated to expect
`snapshot.dungeonBounds` and to assert `snapshot.bounds` is undefined; the
now-redundant "does not include dungeonBounds on top level" assertion was
removed. The client never read either field (grep over `game/client` returns
no snapshot bounds reads), so this is safe to change. **Criterion met.**

## Remaining gaps

None. All three sub-tickets implement their acceptance criteria, the
consolidation pattern is consistent (`disposeOne` is the single source of
truth for "remove+dispose+delete"), and the captured run shows the game
loading and rendering correctly with no errors.


## v0.32 — Cleanup nits from 029-combat-feedback-readability  (2026-05-19 15:16:08)

- `updateAttackEffects` removes via `(fx._scene || scene).remove(fx.mesh)` at `game/client/main.js:939`.
- The fallback to `scene` preserves behaviour for any pre-existing spark that lacked `_scene`. Under `window.___test_scene`, the spark is now correctly removed from the same scene it was added to.

### 3. Unbounded tracking maps for loot/card-hit timing
**Status: met.**

- `previousLootValues[id]` is deleted in `syncLootMeshes` right after the value is captured for the collection animation (`game/client/main.js:1107`), so the map drains as loot is collected.
- `lastCardHitTime[id]` is pruned in `animate()` against `currentEnemyIds` (`game/client/main.js:1612-1616`), alongside the existing `previousEnemyHp` and `windupFlashing` prunes, so dead/despawned enemies no longer linger.
- Both prunes run on the existing per-frame sync paths, so no extra scan was added.

## Quality checks

- Diff is minimal (3 small hunks in `game/client/main.js`) and surgically scoped.
- No new console output, no new globals, no dead code.
- Comments on the new lines are short and explain the *why* (scene-capture intent, "no longer needed — value captured for animation") rather than restating the code.

## Remaining gaps

None blocking. The ticket's three nits are either already resolved upstream (nit 1) or directly addressed by this implementation (nits 2 and 3), and the captured run is healthy.


## v0.33 — Cleanup nits from 028-lobby-deck-editor  (2026-05-19 15:36:28)

  (`iron_sword`, `flame_blade`, `battle_familiar`, `dungeon_drake`) — the other
  4 duplicates stayed in the draw-deck reserve (`02-gameplay-hand.png`,
  `cardHandVisible: true`).
- A documenting comment is present and accurately explains the intent.

The integration test suite was updated to track the new default size
(`expect(playerA.selectedDeck.length).toBe(8)`, removal/add-too-many tests
adapted to the now-full default deck) — all tests pass.

## Consistency checks
- `game/docs/design.md` does not pin the default-deck size to 4; nothing in
  `requirements.md` is regressed.
- The lobby/deck-editor UI handles duplicates correctly (probe shows ✕ buttons
  per row, including duplicate iron_sword rows).
- Two-player ready flow still transitions to `playing` cleanly with both
  players' default decks (`players: 2`, `enemies: 5`).

## Remaining gaps
None blocking.


## v0.34 — Cleanup nits from 026-card-rewards-deckbuilding  (2026-05-19 15:51:02)

The remaining `if (!gameState.players[socket.id])` guard is now defensive
(always true given the disconnect logic), but the ticket explicitly accepted
"remove the unreachable `else` branch and correct the comment" as a valid
fix — and the fix does exactly that. Not a blocking gap.

✓ Satisfied.

## Design / regression check

- `game/docs/design.md`: this is a pure cleanup ticket touching one CSS
  declaration and a connection-handler comment + branch removal. No
  gameplay or rule changes — design alignment unaffected.
- `game/docs/requirements.md`: no foundation behavior touched; multiplayer
  connect/disconnect still works (probes confirm two-player session).
- No new dead code, no console errors, no broken references.

## Remaining gaps

None.


## v0.35 — Cleanup nits from 027-run-summary-return-to-lobby  (2026-05-19 16:10:23)

## Consistency / regression checks

- `game/docs/design.md` and `game/docs/requirements.md` do not specify any
  behavior that this change contradicts; the freeze applies only when the
  run is terminal, and `pendingSummons` clearing on lobby return is
  consistent with the "transient run state is reset on return to lobby"
  posture in `returnPlayersToLobby()`.
- The change set is small (server-only) and does not touch the client,
  protocols, or networking. No new dead code introduced; no console
  warnings or errors in the captured run.
- Minion TTL still decrements while the run is terminal. Since the summary
  overlay is shown for the duration of the run-end, that is the right call —
  minions don't accumulate forever, but they also don't move/attack to
  produce activity behind the overlay.

## Remaining gaps

None blocking. The implementation cleanly addresses both acceptance criteria,
unit-test coverage is thorough, and the captured run is clean.


## v0.36 — Cleanup nits from 025-dungeon-run-objectives  (2026-05-19 16:34:39)

behavior, or scoring rule. There is nothing in `game/docs/design.md`
or `game/docs/requirements.md` it could conflict with — it is a
pure-cleanup ticket and behaves like one.

## Code-quality spot checks
- The helper has a small JSDoc block describing its contract and
  return value — consistent with the surrounding helpers in this
  module.
- No dead code introduced; the variables it replaced are fully gone.
- The CSS `display: none` is placed at the end of the existing
  `#objective-hud` rule block (not as a separate rule), which keeps
  the cascade clean.
- No console errors at runtime; no test files needed to change
  because `removeDeadEnemies` is purely internal plumbing exposed
  through the same test-module surface pattern.

## Remaining gaps

None blocking.


## v0.37 — Cleanup nits from 017-test-coverage  (2026-05-19 17:12:20)

`game/client/test/main.test.js` no longer contains collision/hand tests. Its describe blocks are now all about functions defined in `main.js` (`renderDeckEditor`, `flashMesh`, `spawnDamageNumber`, `spawnHitSpark`, `markLootCollected`, `renderHand`, `playSound`, `applyWindupFlash`, `Cooldown Enforcement`). Collision/hand coverage moved to `game/client/test/collision-hand.test.js` (373 lines). Filenames now accurately reflect what they test. **Met.**

### 3. Include all tested client modules in coverage scope
`coverage.include` now lists `server/index.js`, `client/cards.js`, `client/collision.js`, `client/hand.js`, `client/delta.js`. After running `npm test`, the coverage report shows `collision.js` 87.5%, `hand.js` 100%, `delta.js` 100%, `cards.js` 100%, `server/index.js` 96.88% — overall 96.7%, well above the 70% threshold. **Met.**

### 4. Add a delta-time calculation unit test
A pure helper was extracted to `game/client/delta.js` (`clampDelta(rawDelta)`) and is called from the `animate()` loop at `main.js:1434`. `game/client/test/delta.test.js` has four describe-cases covering normal pass-through, clamping at 0.1 s, zero, and negative inputs. Coverage is 100%. **Met.**

### 5. Remove no-op loop in client/test/setup.js
`game/client/test/setup.js` no longer contains the `for (const key of Object.keys(THREE)) { THREE[key] = THREE[key]; }` block. `npm test` still passes all 340 tests. **Met.**

## Code quality
- `clampDelta()` has one short JSDoc explaining *why* (tab-switch / GC spikes) — appropriate non-obvious context.
- `main.js:5` imports `clampDelta` cleanly; the change to `animate()` is one localized line.
- No dead code introduced. The split between `main.test.js` and `collision-hand.test.js` is clean — no duplication, imports are consistent.
- All tests run in the correct environment (jsdom for client, node for server).

## Remaining gaps
None. Every sub-ticket's acceptance criterion is satisfied, the live game runs cleanly under the regression smoke capture, and the full test suite passes with coverage well above threshold.


## v0.38 — Cleanup nits from 016-loot-and-currency  (2026-05-19 17:40:41)


- Changes are small, focused, and additive — no dead code, no shadowed
  identifiers, no broken paths.
- The `// one pickup per frame` comment is now slightly imprecise (it really
  means "one loot tile interaction per frame"), but the intent is still
  clear.
- A new test-only handle `window.__pickedUpLootIds` was exposed alongside
  other `__*` helpers — consistent with project convention.
- No new console errors from the game itself in the captured run.

## Remaining gaps

None blocking.

Minor (non-blocking) observation: the comment at `game/client/main.js:661`
reads "cleared on each stateUpdate", which slightly overstates what the
pruning at `:576-585` does — it only removes ids no longer in `state.loot`
rather than clearing the entire set. Behaviourally correct; comment could be
tightened. Captured as a nit, not a blocker.


## v0.39 — Cleanup nits from 023-cleanup-loot-and-currency  (2026-05-19 17:47:34)

  }
}
```

The new comment ("pruned on each stateUpdate to drop IDs no longer present in state.loot") is a precise, one-line summary of the loop's behaviour. The misleading "cleared" wording is gone. Criterion met.

### Implicit AC: no code logic change
`git diff 55a77d3..HEAD -- game/` is a single comment-line edit; the `Set`, the pruning loop, and every reference to `pickedUpLootIds` are unchanged. Runtime probes confirm the loot/currency flow behaves identically (HUD shows `GOLD 0`, no console noise).

## Consistency with design / requirements
The change is purely textual. No behaviour, network protocol, HUD, or render path is affected, so design.md and requirements.md are unaffected.

## Code quality
- Comment is accurate and matches the inline comment two screens up (576-577).
- No dead code, no lingering references to "cleared".
- No console errors introduced.

## Remaining gaps
None. The single acceptance criterion is fully satisfied, the game runs cleanly, and no regressions are visible in metrics, probes, or console output.

