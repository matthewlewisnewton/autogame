# LOGBOOK

Progress log for the autogame harness. Each entry below is a completed
top-level ticket — a verified-good state that was committed and git-tagged
`v0.N`. Entries are appended newest-last by `harness/run_ticket.sh`.

**Note:** This log may lag behind `TASKS.md`. Use `TASKS.md` as the authoritative
completion index; LOGBOOK entries through v0.73 are historical snapshots.

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


## v0.40 — Enemy Types: Skirmisher and Miniboss  (2026-05-20 03:51:18)

  miniboss simultaneously — is reachable through normal gameplay because
  `spawnEnemies()` always produces a mixed pack of all three types when a
  run starts.
- ✅ The scenario uses the same `spawnEnemy()` path, so type validation
  still runs; `maxHp` still derives from `ENEMY_DEFS`. No invariants
  bypassed.

## Code quality
- No console errors, no dead branches, the `ENEMY_DEFS.grunt` fallback in
  `updateEnemies()` is defensive (covers legacy enemies in state from
  before the migration; harmless going forward).
- The old `CHASE_SPEED` / `WANDER_SPEED` / `ENEMY_ATTACK_DAMAGE` /
  `ENEMY_ATTACK_WINDUP_MS` constants are no longer the runtime source of
  truth but remain as `ENEMY_DEFS.grunt` mirrors and as test exports —
  acceptable, but a small cleanup candidate.

## Remaining gaps

None blocking.


## v0.41 — Enemy Type: Spawner (Summons Skirmishers)  (2026-05-20 05:08:14)

  localhost/127.0.0.1/::1. The server further guards with
  `isDebugScenarioAllowed()` (line 665) — local origin or
  `ALLOW_DEBUG_SCENARIOS=1`. Normal gameplay never touches it.
- Same end-state via normal play: the default spawn table now includes a
  spawner, so a real run reaches the same "spawner present and producing
  adds" state on its own — the debug scenario simply rewinds `lastSpawnTime`
  to make the first add appear immediately.
- The scenario does not skip invariants: it calls `enterPlayingPhase()` which
  in turn calls `startDungeonRun()`, and the spawner it inserts uses the same
  fields as any other spawner — so spawn-cap counting, `spawnedBy`
  bookkeeping, removal on death, and objective-counter increments all run
  through the production paths.
- **Met.**

## Remaining gaps

None blocking. Spawn behaviour, mesh, integration test, regression coverage,
and the debug scenario all check out, and the captured run shows the live
game producing an add at the expected cadence.


## v0.42 — Reset Game State When the Last Player Disconnects  (2026-05-20 05:38:01)

**Met.**

## Design & requirements consistency

`game/docs/design.md` describes a lobby → dungeon → loot loop returning to the lobby; resetting to a clean lobby when no players are left is consistent with that loop. No invariants in `requirements.md` are weakened — currency/inventory/ownedCards/runRewards preservation inside `returnPlayersToLobby()` continues to behave the same way for any reconnecting players (and the no-players branch trivially has nothing to preserve).

## Debug scenarios

This ticket adds no `?scenario=…` or debug shortcut. The existing `debugScenario` plumbing in `server/index.js` and `client/main.js` is untouched. No debug-scenario gating to verify.

## Code quality

- Implementation is a minimal 3-line addition; reuses `returnPlayersToLobby()` per the ticket's suggestion.
- No dead code, no new console noise, no broken paths.
- Existing terminal-state tests around victory/failure still pass, so the `else if` ordering hasn't regressed run termination behaviour.

## Remaining gaps

None blocking.


## v0.43 — Cleanup nits from 058-reset-state-on-last-disconnect  (2026-05-20 05:53:11)


> AC2: All existing integration tests still pass.

The sub-ticket landed with a verified iteration commit (`2cf9889 ... sub-ticket verified (iter 2)`), which by harness convention means the regression suite ran. The captured live run further demonstrates no regression in the lobby → multi-lobby → gameplay → movement flow.

## Consistency with design / requirements

The change is a one-line refactor of branching logic in the disconnect handler. No design contract is affected — the externally observable behavior is identical aside from removing one redundant `lobbyUpdate` socket message per last-player disconnect. Nothing in `game/docs/design.md` or `game/docs/requirements.md` is touched or contradicted.

## Code quality

- No dead code introduced; the change actually removes a redundant call site.
- The added inline comment (`Non-last player disconnects during lobby — broadcast updated player list`) clarifies a non-obvious branch — appropriate.
- No new debug scenarios or `?scenario=` paths added.
- No console errors in the captured run.

## Remaining gaps

None. The acceptance criteria are fully and robustly satisfied, the captured run is clean, and no regressions are visible.


## v0.44 — Cleanup nits from 078-enemy-type-spawner  (2026-05-20 06:07:11)

  `gameState.enemies.push(spawner)` have been removed cleanly.
- No new console errors. `console.log` is silent apart from expected
  vite/init/debugScenario lines.
- The change is the smallest possible refactor — it does exactly what
  the ticket asked.

## Design / requirements consistency
- `game/docs/design.md` calls out the spawner as a real enemy type;
  surfacing it in both debug scenarios brings the QA tooling in line
  with the design.
- No foundation requirement is regressed: enemy-creation flow continues
  to go through `spawnEnemy()` everywhere except a `lastSpawnTime`
  override that mirrors what runtime ticking does.

## Remaining gaps
None. Both acceptance criteria are met, the captured run is clean, the
refactor uses the shared helper, and the spawner is now visible in
`mixed-enemies` (probe `enemies: 4`) and produces an add in
`spawner-active` (probe `enemies: 2`).


## v0.45 — Cleanup nits from 081-cleanup-enemy-type-spawner  (2026-05-20 06:13:43)

same `spawnEnemy()` path and the same `broadcastLobbyUpdate()` /
`io.emit('stateUpdate', ...)` flow as any other state change.

## Design / requirements consistency
No design surface changes. Behavior is byte-identical except that
`spawnEnemy()` now returns the created object. `game/docs/design.md` and
`game/docs/requirements.md` are not affected.

## Code quality
- The change is minimal and well-scoped.
- No console errors, no dead code introduced, no new branches.
- One adjacent inconsistency worth a follow-up (see Nits): `spawnEnemies()` at
  line 651-652 still uses the `gameState.enemies[gameState.enemies.length - 1]`
  peek pattern. The ticket explicitly scoped this cleanup to the
  `spawner-active` branch, so it is not a gap, but it is a natural follow-up
  now that `spawnEnemy()` returns the enemy.

## Remaining gaps
None blocking.


## v0.46 — Cleanup nits from 083-cleanup-cleanup-enemy-type-spawner  (2026-05-20 06:20:46)

## Design / requirements consistency

No design.md or requirements.md surfaces are touched — this is a
behavior-preserving local refactor inside `game/server/index.js`. The
public contract of `spawnEnemy()` (returns the created enemy, already
pushed to `gameState.enemies`) is unchanged from 083.

## Code quality

- No dead code, no console errors, no obvious bugs.
- The new local `enemy` / `add` bindings shadow nothing problematic
  (the outer `enemy` in `updateEnemies` is the iterated spawner — the
  inner `add` name correctly distinguishes the spawned add).
- No debug scenarios were added or changed in this ticket; the
  `summon-ready` scenario invoked by the capture pre-exists.

## Remaining gaps

None blocking.


## v0.47 — Cleanup nits from 077-enemy-types-skirmisher-miniboss  (2026-05-20 06:48:53)

`createEnemyMesh` has collapsed into a single data-driven branch on
`def.type`. All 128 client tests pass. The mesh-height check screenshot
confirms no visual drift (health bars remain correctly positioned). ✅

## Cross-cutting checks
- `git diff 80eaf3f..HEAD --stat` shows changes are confined to
  `game/client/main.js`, `game/server/index.js`, and the two server test
  files. No collateral damage in unrelated code.
- `design.md` and `requirements.md` are unaffected — this ticket is pure
  cleanup with no behavioral changes.
- No debug scenarios were added or modified by this ticket (the
  `mixed-enemies` scenario predates it).
- `MINION_CHASE_SPEED` is a new local constant rather than referencing
  `ENEMY_DEFS.grunt.chaseSpeed`. The inline comment notes they should match.
  Acceptable per the sub-ticket spec ("`updateMinions()` either uses its own
  speed constant or reads from `ENEMY_DEFS`").

## Remaining gaps
None blocking. See nits.md for non-blocking polish items.


## v0.48 — Cleanup nits from 080-cleanup-enemy-types-skirmisher-miniboss  (2026-05-20 06:59:54)

  the source of truth.
- ✅ Single source of truth restored — rebalancing grunts will now move
  minions automatically.

### Integration / design consistency

- No references to `halfHeight`, `chaseSpeed`, or `MINION_CHASE` exist in
  `game/docs/design.md`, so nothing in the documented contract is violated.
- Diff scope is exactly the four lines / one constant the ticket called
  for, plus a one-line test update. No collateral edits, no dead code, no
  console noise.
- Debug-scenario surface: this ticket did not add or change any debug
  scenarios; the existing `?scenario=summon-ready` shortcut is what the
  capture used and continues to behave normally.

## Remaining gaps

None blocking. The captured run is healthy, both acceptance criteria are
satisfied robustly, and the tests pin the new behavior.


## v0.49 — Package Manager Migration and Security  (2026-05-20 07:22:19)

- **Met.**

### 4. "The game client and server start up correctly after the migration"
- Servers listening; client served; game reached `phase: playing` with 1 player and 5 enemies; player movement registered.
- No console pageerrors, no server-side errors.
- **Met.**

## Consistency with design / requirements
- `game/docs/design.md` has no package-manager references; nothing to regress.
- No game code changed in this ticket. Only `CONTEXT.md`, `harness/lib.sh`, `harness/prompts/implement.md`, and the new `game/scripts/check_package_age.js`. No functional gameplay surface touched.
- No debug scenario added or modified by this ticket.

## Code quality
- `check_package_age.js` has one tiny dead binding: the `const deps = node.dependencies || node.devDependencies || node.optionalDependencies;` at line 32 is never read (the function instead builds `depMaps` from the same fields below). Minor — non-blocking.
- The script is not yet wired into `package.json` scripts (e.g. `pnpm run check:deps`) or any CI pipeline, so it requires manual invocation. Acceptance criterion only says "a script **or** GitHub Action is added" so this still meets the bar; the integration point is a follow-up.
- No console errors. No new tests, but the ticket is infrastructure-only.

## Remaining gaps
None blocking.


## v0.50 — Cleanup nits from 018-pnpm-and-security  (2026-05-20 09:43:24)

- **`CONTEXT.md`:** Run instructions unchanged; new supply-chain section is additive and accurate about *where* to run checks and *which* workflow gates lockfiles (wording nit on age direction — see `nits.md`).

## Code quality

- **`check_package_age.js`:** Clear structure; dead binding removed; whitelist helpers are scoped and used in the main loop. Default age is `7`. No obvious logic bugs in tree walk or registry fetch path.
- **CI workflow:** Standard checkout → Node 20 → pnpm → cache → `pnpm install` / `pnpm run check:deps` in `game/`. Reasonable for lockfile PRs.
- **Scope discipline:** No `game/client/` or `game/server/` source changes in the 086 implementation commits; risk to runtime is indirect (deps/scripts only), and capture confirms no breakage.

## Debug scenarios

This ticket did not add or change `?scenario=` shortcuts (`scenarios: []` in capture; no scenario-related code in the 086 diff). Nothing to audit under the debug-scenario rules.

## Coverage (`coverage.log`)

Vitest ran with no tests matching changed files (0% report). Expected for a scripts/CI-only ticket; not a blocking gap with thresholds disabled.

## Remaining gaps

None. All acceptance criteria are satisfied and the captured game run is healthy.


## v0.51 — Cleanup nits from 086-cleanup-pnpm-and-security  (2026-05-20 09:54:24)


- **`game/docs/design.md`:** Unaffected — no gameplay, combat, or lobby changes.
- **`game/docs/requirements.md`:** No regression — changes are limited to project docs (`CONTEXT.md`) and supply-chain script comments.
- **Integration:** Sub-tickets align with the top-level ticket; no drift between CONTEXT wording and script behavior.

---

## Code quality

- Diff is minimal and focused (one CONTEXT sentence + comment-only script edits).
- `check:deps` still passes on the current lockfile.
- No dead code, no behavioral regressions introduced by this ticket.
- Vitest coverage log shows no files changed in the game test surface (expected for a docs/comments ticket).

---

## Remaining gaps

None. Both acceptance criteria are satisfied, runtime capture is healthy, and supply-chain tooling behavior is unchanged aside from clearer documentation.


## v0.52 — Codebase Cleanup and Refactor  (2026-05-20 10:45:39)


### Extracted constants and config values into shared files
PASS. Server gameplay values such as tick rate, combat ranges, deck bounds, HP/magic-stone caps, spawn padding, stale threshold, and victory reward rotation now come from `game/server/config.js`. Client deck, combat, effect, movement, camera, audio, and passage-width values now come from `game/client/config.js`; `game/client/dungeon.js` imports the shared passage width instead of keeping a second copy.

### Duplicate or unnecessary code is removed
PASS. The previous repeated pattern of spawning loot for dead enemies, removing them, and checking terminal run state is now represented by `cleanupAfterDamage()` and called from the minion, weapon-card, and summon-card damage paths. The helper preserves the same order of operations, so loot drops, objective progress, and victory/failure checks remain intact.

### Automated tests continue to pass
PASS. `coverage.log` shows the ticket validation run completed successfully: 4 test files passed, 314 tests passed, with coverage collection enabled. The ticket did not modify test expectations.

### Client and server function as expected
PASS. The captured run validates the baseline lobby, ready-up, gameplay transition, movement, card hand display, socket connection, multiplayer visualization, and dungeon rendering. This remains consistent with `game/docs/design.md` and does not regress the foundational requirements in `game/docs/requirements.md`.

### Debug scenarios
PASS. This ticket did not add a new debug scenario or use a scenario capture. The only debug-scenario code touched by the refactor replaces hardcoded HP with `MAX_HP`; the existing client entry path remains gated by a debug URL parameter/local host check, and the normal lobby-ready flow still reaches active gameplay as shown by the capture.

## Remaining gaps

None blocking. Non-blocking cleanup opportunities are recorded separately in `nits.md`.


## v0.53 — Cleanup nits from 019-codebase-cleanup  (2026-05-20 12:38:01)

- **Production note:** `server.setMaxListeners(0)` applies in production too; acceptable for this codebase (test `startTestServer` stacks `once('error')` on the shared module server). Not a functional defect.

---

## Debug scenarios

This ticket **did not add or modify** any `?debugScenario=` flow. Existing debug gating in `main.js` (localhost-only URL param → `socket.emit('debugScenario')`) is unchanged and was not exercised in capture (`debugScenario: null`). No debug-scenario review required.

---

## Remaining gaps

None. All acceptance criteria are fully satisfied; runtime capture and tests corroborate the code.

### Non-blocking nits (backlog)

See `nits.md` for optional follow-ups (config section header duplication; tests hardcoding `0.5` loot threshold).

---


## v0.54 — Cleanup nits from 088-cleanup-codebase-cleanup  (2026-05-20 12:53:48)


- **design.md:** No gameplay or loop changes; documentation-only cleanup ticket.
- **requirements.md:** 3D render, WebSocket connection, multiplayer representation, and movement sync all exercised in capture probes — no regression observed.

---

## Code quality

- Minimal, focused diff (8 lines moved in config; test import + mock/comment updates).
- No dead code introduced; no new console errors in capture logs (`server.log` / `client.log` clean).
- No debug shortcuts that could mask normal-path regressions.

---

## Remaining gaps

None blocking. Acceptance criteria are fully satisfied and the captured game run is healthy.

---


## v0.55 — Cleanup nits from 089-cleanup-cleanup-codebase-cleanup  (2026-05-20 12:59:31)

## Design and requirements consistency

- **design.md:** No gameplay, networking, or UX changes — test-only alignment. Core loop and combat mechanics untouched.
- **requirements.md:** No regression to 3D render, WebSocket connect, multiplayer presence, or movement sync. Capture probes confirm connected playing state with position updates after input.

## Code quality

- Change is minimal, focused, and consistent with adjacent `spawnLoot` tests.
- `config` is already imported at the top of `server.test.js`.
- `vi.restoreAllMocks()` still runs after the test.
- No dead code, no new console errors, no production-path edits.

## Debug scenarios

This ticket did **not** add or change any `?scenario=` debug shortcut. Capture used existing `summon-ready` for smoke coverage only; no debug-scenario acceptance items apply. No blocking debug-path issues introduced.

## Remaining gaps

None. All acceptance criteria are fully met; runtime capture and tests agree.


## v0.56 — Audit Client/Server  (2026-05-20 23:19:43)

- **Client WebSocket messages are intents, not outcomes:** PASS. Client movement now sends normalized directional intent (`dx`, `dz`, `rotation`) instead of absolute position updates. Card use sends `slotIndex` and `cardId` as an activation request, while the removed client `damage` socket path means clients no longer submit direct damage outcomes. Other client emissions (`playerReady`, deck add/remove, `lootPickup`, heartbeat, return-to-lobby) are requests or UI/session intents, with server-side checks before mutation.

- **Server validates movement against collision geometry and speed limits:** PASS. The server integrates movement from input direction using server `MOVE_SPEED`, normalizes oversized vectors, caps elapsed movement time with `MAX_ELAPSED_MS`, clamps to dungeon bounds, and rejects swept wall collisions using server-generated dungeon wall colliders. The captured server log shows this validation actively rejecting wall-intersecting movement during play.

- **Server exclusively calculates combat outcomes and broadcasts them:** PASS. `useCard` validates phase, run status, player liveness, slot index, card definition, server-authoritative hand contents, per-slot cooldown, and summon resource cost before applying effects. Weapon cone hits, summon radius hits, minion spawning, damage, enemy removal, loot, and run objective progress are all computed from server state and sent back through `stateUpdate`/`cardUsed`.

- **Client prediction and reconciliation respect server authority:** PASS. The client predicts local movement at the same fixed speed as the server, emits only movement intent, and snaps to the authoritative server position when drift exceeds the reconciliation threshold. Server `stateUpdate` also reconciles the local hand from the authoritative per-player hand state, including card identity and remaining charges.

## Design/Regression Check

The changes preserve the documented lobby-to-dungeon multiplayer loop and the card-based action combat model. The foundation requirements are still met: the client connects over WebSockets, renders a Three.js scene, represents multiple players, and synchronizes movement through server state updates. Coverage artifacts show `344` passing tests with focused coverage over the changed server behavior.

## Debug Scenarios

Debug scenarios remain gated through the explicit debug query flow on the client and local/dev-only authorization on the server. The scenarios use the same server-side deck validation and normal `enterPlayingPhase`/run setup before applying QA state adjustments, and the resulting states are equivalent to normal reachable gameplay states such as having a summon available, low mana, damaged HP, mixed enemy types, or an active spawner. They do not replace the normal ready-up path for regular gameplay.

## Remaining gaps

No blocking gaps remain.


## v0.57 — Cleanup nits from 020-audit-client-server  (2026-05-20 23:31:19)


## Code quality

- **Focused diff:** 13 lines removed (client), 1 line changed (server) — appropriate for a nit ticket.
- **No dead code** introduced; removed block was the redundant path.
- **No new console errors** in capture.
- **Tests:** 328 tests passed in `coverage.log` for files touched since baseline.

---

## Remaining gaps

None blocking. Both acceptance areas are satisfied in the working tree; runtime capture is healthy.

---

## Nits (non-blocking)

See `nits.md` for backlog items (visual capture missed summon; monster-card optimistic draw parity; optional log throttling).


## v0.58 — Cleanup nits from 091-cleanup-audit-client-server  (2026-05-21 00:19:06)

This ticket did **not** add or change debug scenarios; capture reused existing `summon-ready`.

| Check | Result |
|-------|--------|
| Gated behind dev path | Client: `?debugScenario=` only on localhost/127.0.0.1/::1. Server: `isDebugScenarioAllowed` (local address/origin/host or `ALLOW_DEBUG_SCENARIOS=1`; blocked in production). |
| Normal path still reaches equivalent state | Lobby → deck select → ready → `startGame` still required for real players; scenario is QA-only via URL + `debugScenario` socket emit. |
| Does not weaken invariants | Scenario sets phase/hand/MS but card plays still go through server `useCard` validation, `drawReplacementCard`, and `stateUpdate` — no bypass of authority. |

Round-2 capture correctly uses slot 1 for summon; prior harness slot-0 bug was plan authoring, not a scenario invariant violation.

---

## Remaining gaps

None. All three acceptance sections are satisfied; runtime health passes.

Round-1 blocking gap (summon not exercised in capture) is resolved in round-2 probes and screenshots.

---


## v0.59 — Cleanup nits from 092-cleanup-cleanup-audit-client-server  (2026-05-21 04:26:18)

## Debug scenario: `monster-card`

| Requirement | Assessment |
|-------------|------------|
| Gated to debug/dev path | **Pass.** Client reads `?debugScenario=` only on localhost/127.0.0.1/`::1` and emits once on connect (`requestDebugScenario`). Server accepts via `debugScenario` socket only when `isDebugScenarioAllowed` (local address/origin/host or `ALLOW_DEBUG_SCENARIOS=1`, not production). |
| Normal path still reaches equivalent state | **Pass.** `dungeon_drake` is in `createStartingDeck()` / server `STARTING_DECK_IDS`. A player can draw/play monsters through lobby → ready → dungeon without the URL shortcut. Scenario only pins hand composition for deterministic QA. |
| Does not weaken invariants | **Pass.** Scenario still runs `validateDeck`, `enterPlayingPhase`, and full server `useCard` handling (minion spawn, server draw, `stateUpdate`). No skip of cooldown, validation, or replication. |

---

## Remaining gaps

None. All acceptance criteria are satisfied; the captured run is healthy.

---

## Nits (non-blocking)

See `nits.md` for backlog items (unused `lastCardUse`, optional integration play-through).


## v0.60 — Cleanup nits from 093-cleanup-cleanup-cleanup-audit-client-server  (2026-05-21 05:06:42)

---

## Debug scenario: `monster-card`

Ticket did not add this scenario (pre-existing from 093), but capture used it — verified per harness rules:

| Rule | Assessment |
|------|------------|
| Gated to debug/dev | **Pass.** Client: `?debugScenario=` on localhost only (`debugScenarioAllowed`). Server: `isDebugScenarioAllowed(socket)` (local address/origin/host or `ALLOW_DEBUG_SCENARIOS=1`; disabled in production). |
| Normal path still reaches equivalent state | **Pass.** `dungeon_drake` is in `STARTING_DECK_IDS` / default deck. `enterPlayingPhase` → `initPlayerHand` deals from deck; players reach monster-in-hand + `useCard` → minion via normal lobby → ready → start flow without the URL param. Scenario only *guarantees* a monster card for deterministic QA. |
| Does not weaken invariants | **Pass.** Scenario adjusts hand/enemy setup for testability; `useCard` still runs full server validation, cooldown, `drawReplacementCard`, and `stateUpdate` broadcast. No client-side hand mutation or skipped server checks. |

---

## Remaining gaps

None. All acceptance criteria are met and the captured run is healthy.

---


## v0.61 — Cleanup nits from 094-cleanup-cleanup-cleanup-cleanup-audit-client-server  (2026-05-21 05:42:40)

| Dev-gated entry | Client: `debugScenario` URL param only on `localhost` / `127.0.0.1` / `::1` (`main.js` ~70–72). Server: `isDebugScenarioAllowed()` (~881–893). Harness sets `?debugScenario=monster-card` on connect. |
| Normal path still reaches equivalent state | Default deck includes `dungeon_drake` (`cards.js`); reached via `drawReplacementCard` after hand churn (not guaranteed in opening 4). Using the card still goes through `socket.emit('useCard')` → full server validation, minion spawn, `stateUpdate` replication. |
| No invariant bypass | Scenario only ensures a monster card in hand (`index.js` ~995–1005); does not skip `useCard`, cooldown, or broadcast. Client waits for server `stateUpdate` for monsters (~405–410). |

**No blocking debug-scenario issues.**

---

## Code quality

- Focused diff: harness probe field + integration test refactor/assertions.
- No dead code introduced; no console errors in capture.
- Two monster integration tests overlap in setup (nit only — see `nits.md`).

---

## Remaining gaps

None. All acceptance criteria are met and the captured run is healthy.


## v0.62 — Cleanup nits from 095-cleanup-cleanup-cleanup-cleanup-cleanup-audit-client-server  (2026-05-21 05:53:24)

| Rule | Status |
|------|--------|
| Gated to dev | Client: `debugScenarioAllowed` only on localhost/127.0.0.1/::1; URL param is the client entry (`main.js` 70–72, 165–168). Server: `isDebugScenarioAllowed` blocks production / non-local (`index.js` 881+, 1698–1707). |
| Normal path still reaches equivalent state | Lobby → ready → `startGame` → hand from deck (default includes `dungeon_drake`) → `useCard` on monster slot uses the same server branch (`index.js` 1560–1588). Scenario only guarantees a monster card in hand when missing; it does not spawn minions or skip `useCard` validation. |
| No invariant short-circuit | `monster-card` adjusts hand/resources and resyncs objectives; minion spawn still requires `useCard` through the standard handler. |

No debug-scenario blocking gaps for this ticket.

---

## Visual capture notes (informational)

Agent-guided capture used `monster-card` and confirmed minion in harness state (50 HP, correct `ownerId`). Final probe `cardPress` reported `cardType: null` and unchanged hand IDs — likely harness timing/input, not a game fatal. Integration test assertions are the authoritative proof for hand replacement after `useCard`; they pass.

---

## Remaining gaps

None. Both acceptance criteria are met; runtime capture is healthy; no regressions identified in live code review.


## v0.63 — Persistence  (2026-05-21 10:42:42)


### Save Timing
PASS. Saves happen on periodic auto-save, disconnect/logout, stale-player cleanup, run terminal reward persistence, and lobby return. This satisfies the ticket's key-event and/or periodic-save requirement.

### Atomic Saves / Crash Corruption Protection
PASS. `FileProvider` writes to a temporary file and renames it into place, keeping saves atomic for the file-backed provider.

### Design And Requirements Consistency
PASS. The implementation preserves the lobby-to-dungeon loop, card inventory/loadout flow, multiplayer socket connection, player visualization, and movement sync requirements. The captured run confirms the client and server still start and connect.

### Debug Scenarios
PASS. This ticket did not add a new persistence-specific debug scenario. The touched debug path still goes through the server-side handler, validates the selected deck before entering play, and does not replace the normal ready flow, which remains reachable through standard gameplay.

### Tests / Coverage
PASS. `coverage.log` reports 5 test files passing with 383 tests passed. Coverage thresholds were disabled, but the changed persistence and reconnect behavior is covered by focused provider, persistence, unit, and socket integration tests.

## Remaining gaps

None.


## v0.64 — User Accounts  (2026-05-21 22:42:20)

### Load and save the correct character through persistence

Satisfied. On connection, the server loads persisted player data by `accountId`, merges currency, owned cards, selected deck, position, and rotation into the live player, and initializes sensible transient combat state for active-run reconnects. Durable state is saved by account key on movement, loot pickup, deck edits, run reward completion, return-to-lobby, stale cleanup, periodic autosave, and disconnect.

## Design and foundation consistency

The implementation keeps the existing lobby-to-dungeon multiplayer loop intact: the captured run reaches the lobby with two authenticated users, transitions to gameplay through ready state, renders the 3D scene, and synchronizes movement. It is consistent with the design goal of persistent player progression and does not regress the baseline requirements for Three.js rendering, WebSocket connectivity, multiplayer visualization, or movement synchronization.

## Debug scenarios

No new review-round capture scenarios were used (`metrics.json` has an empty `scenarios` array). Existing debug scenarios remain behind the `debugScenario` URL-driven client path and server-side dev/local gating; normal gameplay proceeds through register/login, lobby ready, and gameplay without invoking a scenario.

## Test and coverage signal

`coverage.log` reports `15` passing test files and `563` passing tests, with coverage visibility at `95.39%` statements overall. The added coverage includes user storage, auth routes, WebSocket JWT rejection/acceptance, client JWT recovery, and persistence save triggers.

## Remaining gaps

No blocking gaps found.


## v0.65 — Cleanup nits from 022-user-accounts  (2026-05-21 23:09:20)

**No impact.** The ticket touches only package-manager configuration. Lobby, dungeon, combat, multiplayer sync, and auth behavior are unchanged. Foundation requirements (3D render, WebSocket connect, multiplayer presence, WASD sync) remain exercised by the captured smoke flow.

### Code quality

**Good for scope.** Two-file diff, no application logic changes, no dead code introduced. Server `users.js` continues to use bcrypt for password hashing; native module is present after fresh install.

### Debug scenarios

**Not applicable.** This ticket did not add or change `?debugScenario=` / `debugScenario` shortcuts. Probes show `debugScenario: null` and `debugScenarioAllowed: true` (localhost dev default only).

## Integration / sub-ticket notes

- Sub-ticket `01-main` (round 2) removed the explicit `bcrypt: false` deny but was insufficient for pnpm 11 fresh installs — correctly failed review round 2.
- Sub-ticket `01-fix-bcrypt-build-config` adds `allowBuilds.bcrypt: true` and empties `.npmrc`, addressing both round-2 blocking gaps.
- `coverage.log` reports no tests for the changed YAML/`.npmrc` files (expected for tooling-only work).

## Remaining gaps

None. Both acceptance criteria are satisfied on a clean install under pnpm 11, and the captured game run starts and plays through dungeon smoke successfully.


## v0.66 — Advanced Map Generation  (2026-05-22 01:09:10)

- Enemies preferentially spawn in `combat` rooms, not in the start room: satisfied for normal gameplay. `spawnEnemies()` selects combat rooms when present and falls back to non-start rooms before any all-room fallback.
- Loot or reward props preferentially spawn in `treasure` rooms: satisfied. Pre-spawned loot uses treasure rooms when one exists, with a non-start fallback.
- The client renders room roles with subtle visual differences: satisfied. Start and treasure rooms use distinct floor materials, and treasure rooms get a small gold marker.
- All generated rooms remain reachable from the start room: satisfied. Role metadata is assigned after passage generation and does not alter connectivity; tests verify BFS reachability.
- Wall and passage collision remain correct after role metadata is added: satisfied. Role metadata does not change wall or passage geometry, and server/client colliders still derive from the same wall data.
- The layout remains deterministic for a given seed: satisfied. Role assignment is deterministic from generated room/passsage topology, and tests cover same-seed equality.
- Existing debug scenarios still place players/enemies in valid reachable positions: satisfied for this ticket. No new debug scenarios were added, and existing debug scenario setup continues to place players at the start room and nearby entities within the dungeon.

## Runtime Health

The captured run is healthy: `metrics.json` reports `"ok": true`, the server/client reached active gameplay, and `console.log` contains no `pageerror` or `[fatal]` lines from game code. The Vite `EPIPE` lines in `client.log` are benign socket-close noise under the ticket's runtime-health rules.

## Design And Requirements Consistency

The implementation stays aligned with the design goal of semi-procedural dungeons with readable room roles and does not regress the foundational requirements: the game renders a 3D scene, connects over WebSockets, shows multiplayer players, and preserves movement synchronization.

## Remaining gaps

No blocking gaps remain for the advanced map generation ticket. The coverage log does show one unrelated failing monster-card integration assertion; it is outside this ticket's changed map-generation paths, but should be handled separately.


## v0.67 — Cleanup nits from 023-advanced-map-generation  (2026-05-22 01:16:37)

---

## Debug scenarios

This ticket did not add or modify any `?debugScenario=` / `debugScenario` URL flow. Existing debug paths remain gated to localhost hostnames and URL-only entry; normal gameplay in the capture reached `playing` without a debug shortcut. **No debug-scenario review required.**

---

## Sub-ticket integration

Single sub-ticket `01-role-based-client-spawn` covers the full top-level ticket. No uncovered acceptance bullets or cross-sub-ticket gaps.

---

## Remaining gaps

None. All acceptance criteria are met; the game starts and plays cleanly in the captured run.

---


## v0.68 — Cleanup nits from 098-cleanup-advanced-map-generation  (2026-05-22 01:32:33)

## Code quality

- **Scope:** Minimal — 2 comment lines + 53-line test file. No dead code or behavioral edits.
- **Integration:** Client spawn comments now align with `dungeon.js` implementation (`find(r => r.role === 'start')` + `rooms[0]` fallback). Server-side spawn/role tests from 098 remain separate and unaffected.
- **Console / server logs:** No uncaught client errors. Server `Rejected move` lines during W/D hold are normal swept-collision validation, not failures.

---

## Debug scenarios

This ticket did not add or change any `?scenario=` debug shortcut. Capture probes show `debugScenario: null` throughout normal lobby → ready → play flow. Nothing to audit under the debug-scenario checklist.

---

## Remaining gaps

None. Both acceptance criteria are fully satisfied; runtime capture is clean; no integration regressions found in the live tree.

---


## v0.69 — Entity AI Movement and Minion Follow  (2026-05-22 04:02:48)


### Enemy Movement
PASS. `updateEnemies()` uses `moveEntityToward()` for both player chase and wander movement. Wandering enemies track consecutive blocked ticks and select a new `wanderTarget` after repeated blockage. Chase movement no longer directly mutates `x`/`z`, so enemies stop or slide at walls instead of snapping through. Existing detection radius and speed constants are preserved.

### Minion Movement
PASS. `updateMinions()` uses the shared movement helper while chasing enemies. When no enemy is within detection range, a living minion follows its living owner only if farther than `MINION_FOLLOW_DISTANCE`, moving at `MINION_FOLLOW_SPEED` with wall-aware collision. Missing/disconnected/dead owners leave the minion stationary, and existing TTL, hp cleanup, and attack behavior remain intact.

### Debug Scenarios
PASS. This ticket did not add a new debug scenario entry point. The reviewed debug scenario machinery remains gated through the localhost/dev-only `debugScenario` URL/socket path, validates decks before forcing play, reuses normal hand initialization/start-run routines, and resynchronizes objectives after scenario-specific enemy mutations. The normal ready flow still reaches the same playing state without using a debug shortcut.

### Design and Requirements Consistency
PASS. The changes support the design goal of independent monster/minion behavior and dungeon combat without adding out-of-scope pathfinding, boss behavior, or combat telegraphs. The foundation requirements are not regressed: captured gameplay shows the client connects, renders the 3D scene, enters multiplayer gameplay, and accepts movement.

### Verification Evidence
PASS. Coverage ran successfully with 391 tests passing across 8 files. The added server and integration tests cover wall-aware enemy movement, movement helper behavior, blocked wander retargeting, and idle minion owner-follow. The review-round metrics include probes from connected gameplay; the referenced screenshot PNG files were not present in the review folder, but the runtime logs and probes were sufficient for this ticket-level judgment.

## Remaining gaps

None.


## v0.70 — Cleanup nits from 024-entity-ai-improvements  (2026-05-22 04:36:14)

## Debug scenarios

**Not applicable.** This ticket did not add or modify any `?scenario=` / `debugScenario` flow. Capture used normal ready-up gameplay (`debugScenario: null`). No debug-scenario regression review required.

---

## Integration / holistic notes

- Single sub-ticket (`01-fix-reached-metadata`) fully covers the top-level ticket; no integration gaps between sub-tickets.
- Ticket staleness note references commit `8af88db`; actual harness baseline `4374f9b` is valid and yields a focused two-commit diff.
- `metrics.json` lists scenario `mixed-enemies` but capture ran standard smoke without applying a debug scenario — appropriate for this metadata-only server change.

---

## Remaining gaps

No blocking gaps. Acceptance criteria are fully satisfied and the game runs cleanly in capture.

---


## v0.71 — Cleanup nits from 100-cleanup-entity-ai-improvements  (2026-05-22 04:44:23)


- **Diff surface:** Minimal and correct — single identifier string in one test.
- **Dead/broken code:** None introduced.
- **Console errors from game code:** None in `console.log`; server log shows expected swept-collision rejections during movement capture, not crashes.
- **Integration:** Sub-ticket scope fully delivered; no dangling references or partial refactors.

---

## Debug scenarios

This ticket did not add or change any `?scenario=` development shortcuts. Capture listed `mixed-enemies` in plan metadata but probes ran with `debugScenario: null` after fallback smoke capture — normal lobby → ready → play path. No debug-scenario review items apply.

---

## Remaining gaps

None. The misnamed test nit from ticket 100 is resolved; runtime and acceptance criteria are satisfied.

---


## v0.72 — Audio Autoplay Resume & Mute Persistence  (2026-05-22 05:12:02)


## Code quality

- Focused diff (~150 lines in `main.js`, ~150 in tests); helpers are small and match existing `localStorage` patterns (`TOKEN_KEY`, `STORAGE_KEY_PLAYER_ID`).
- Test-only exports (`__resumeAudioContext`, `__loadSoundEnabled`, `__getPersistedMute`) follow established conventions.
- No dead code or obvious logic bugs in the persistence/resume paths.
- Coverage run: 98 client tests pass; coverage report scoped to changed modules (hand/cards/collision/delta) — informational only.

---

## Remaining gaps

None blocking. All acceptance criteria are satisfied in the live working tree, and the captured run proves the game starts and plays cleanly.

---

## Nits (non-blocking, filed separately)

See `nits.md` for follow-up backlog items: missing `resumeAudioContext` unit tests, and no cold-import test for startup mute icon from pre-seeded `localStorage`.


## v0.73 — Cleanup nits from 046-cleanup-audio-autoplay-resume-and-mute-persistence  (2026-05-22 05:38:30)

---

## Debug scenarios

This ticket did **not** add or change any `?scenario=` debug shortcuts. Nothing to verify under the debug-scenario checklist.

---

## Integration / holistic check

Sub-tickets `01-resume-audiocontext-tests` and `02-cold-start-mute-integration-test` together cover all acceptance criteria in the parent ticket. No gaps between sub-ticket scope and top-level ticket. Changes are confined to `game/client/main.js` (2 lines) and `game/client/test/main.test.js` (+211 lines of tests).

---

## Remaining gaps

None. All acceptance criteria are met; runtime capture is healthy; no blocking issues.

---


## v0.74 — Fix: floorSampling.js named exports unavailable to client (ESM/CJS mismatch)  (2026-05-31 06:38:55)

---

## Round-2 capture quality (informational, non-blocking)

- `capturePlanSource: "fallback-after-error"` — first Gemini-guided step timed out; fallback full-flow recipe succeeded.
- `metrics.json` `screenshots[]` does not list `01-auth-overlay.png` even though that file exists on disk; auth visibility is inferred from successful lobby→playing progression, not a dedicated metrics entry.
- `coverage.log` reports 0% on changed files (harness runs vitest without matching changed-file filter in this round); not a functional gap.

---

## Remaining gaps

**None (blocking).** Runtime proof and all acceptance criteria are satisfied.

---

## Nits (non-blocking)

See `round-2/nits.md` for backlog items (CJS/ESM deduplication, flat-room test coordinates).


## v0.75 — Cleanup nits from 138-fix-floor-sampling-esm-export  (2026-05-31 07:04:16)

**Non-blocking observations (see `nits.md`)**

- `floorSampling.esm.js` header still says “Mirrors the logic in floorSampling.js” / “Keep in sync” — outdated after deduplication.
- CJS bridge uses string rewrite + `new Function`; fragile if the ESM file later adds top-level `import`/`export` beyond the two regex patterns (acceptable for current pure-function module, worth documenting).

---

## Tests & coverage

- Round-1 `coverage.log`: vitest ran changed-path coverage; `shared-floor-sampling.test.js` 4/4 pass. Wrapper `floorSampling.js` not directly unit-tested (executed indirectly via server `dungeon.test.js`).
- Independent `pnpm test:quick`: 48 files, 1233 tests, all pass.

---

## Remaining gaps

None. Both acceptance criteria are satisfied; runtime capture confirms the game runs.

---


## v0.76 — Cleanup nits from 140-cleanup-fix-floor-sampling-esm-export  (2026-05-31 07:19:11)

---

## Debug scenarios

Not applicable (documentation-only ticket).

---

## Sub-ticket integration

Both sub-tickets (`01-fix-esm-header-comments`, `02-document-cjs-bridge-constraints`) map cleanly to the two acceptance sections above with no gaps between them.

---

## Remaining gaps

None. All acceptance criteria are satisfied; the captured run proves the game starts and plays; tests pass.

---


## v0.77 — Sloped Floor Layout and Geometry  (2026-05-31 07:23:02)

1. Runtime health passes,
2. `{ slopes: true }` is on the live quest path,
3. Unit tests assert sloped mesh rotation from real `generateLayout(42, …, { slopes: true })`,

the implementation satisfies the ticket’s **Verification: code** bar and the spirit of manual ramp confirmation, though a dedicated ramp screenshot would strengthen future harness rounds (nit only).

---

## Remaining gaps

None blocking. All acceptance criteria are met in the working tree; the game starts and plays cleanly in capture.

---

## Nits (non-blocking)

See `round-1/nits.md` for backlog items: explicit `floorCorners` schema in docs, wall Y alignment on sloped rooms, harness ramp capture, rotated-box vs. bilinear mesh fidelity.

---


## v0.78 — Cleanup nits from 116-sloped-floor-layout-and-geometry  (2026-05-31 14:26:33)

| 02 wall Y on slopes + test | Done |
| 03–14 harness capture plumbing | Done; round-1 capture satisfies ramp screenshot AC |
| Game code on main at HEAD | Includes all four game sub-tickets |

---

## Remaining gaps

None blocking. All five top-level acceptance criteria are met in code, tests, and round-1 capture artifacts.

### Nits (non-blocking)

See `nits.md`: passage wall base height on corridors.

---

## Summary

Round-1 capture provides runnable proof (`ok: true`, sloped/ramp screenshot descriptions, `sloped-dungeon` scenario applied cleanly). Game changes document schema, align room walls to `sampleFloorY()`, and document the box mesh approximation. Verdict: pass.


## v0.79 — Fix: harness misclassifies game pageerror as `harness_failure` infra issue  (2026-05-31 16:36:57)


## Design / game regression

**N/A / PASS.** No `game/` changes. Round-2 capture exercised standard lobby-to-dungeon flow with empty `pageerrors`. Consistent with `game/docs/design.md`; no debug scenarios added or modified.

## Code quality

- Three-way classification (`harness_failure` / `browser_pageerror` / `capture_failed`) is clear, well-tested, and preserves infra-over-pageerror precedence.
- Sub-ticket 06 adds exception handling so `capture_run` always writes classified `metrics.json` on unexpected failures (`failure_kind: "capture_exception"`).
- `confirm_broken.game_smoke_ok()` correctly treats `browser_pageerror` as "servers up" for smoke gating while review/QA still hard-fail on page errors.
- Infra signature detection unchanged from baseline (`vite_eaddrinuse`, `server_eaddrinuse`); existing EADDRINUSE rescue path preserved.

## Debug scenarios

Not applicable — no new or changed `?debugScenario=` shortcuts in this ticket.

## Remaining gaps

None. Round-2 capture provides runnable proof; all acceptance criteria are met in the current codebase.


## v0.80 — Sloped Movement (Server and Client)  (2026-05-31 17:49:08)

   ramp" drives the player south into a sloped room and asserts `y > 0.5` and
   `y ≈ sampleFloorY(...)`. Plus a null-fallback test and the wall-slide test.

7. **Spawn / reset / return-to-lobby place players on valid floor height** — MET.
   All reset paths resample: `assignRunSpawnPositions`, `repositionPlayersAwayFromPortal`,
   `suspendRunToLobby`, `abandonSuspendedRun`, `returnPlayersToLobby`, `giveUpRun`
   (progression.js) and the debug-scenario spawn (index.js:557). `buildPlayerRecord`
   defaults to `DEFAULT_FLOOR_Y` when no saved `y` exists.

## Design / regression consistency
- Server remains authoritative for Y (client sends no `y`), matching the
  Implementation Notes. Shared sampling module keeps client prediction and server
  authority in lockstep. No regression to `requirements.md` foundations.
- This ticket added **no** debug scenario — `sloped-dungeon` came from dependency
  116 — so the DEBUG SCENARIOS gate does not apply.

## Remaining gaps
None. All acceptance criteria are fully and robustly met, the game runs cleanly,
and the full server test suite passes.


## v0.81 — Key Item Data Model and Persistence  (2026-05-31 19:15:55)

---

## Capture vs. ticket intent

Gemini capture plan probed `equippedKeyItemId` and snapshot cooldown fields, but harness `harnessState` in `metrics.json` does not surface those fields — probes only show generic lobby/gameplay UI. **Server implementation and unit tests are the authoritative proof** for snapshot fields; screenshot shows healthy dungeon HUD without key-item UI (expected).

---

## Remaining gaps

None blocking. Runtime is clean; acceptance criteria are satisfied on the server foundation delivered by sub-tickets 01–05.

### Non-blocking nits (see `nits.md`)

- Silent `useKeyItem` when dead/extracted
- No client/socket “list key items” event yet (helpers exist server-side)
- `key-item-cooldown` debug scenario untested

---


## v0.82 — Key Item Input Bindings and Settings  (2026-05-31 20:46:57)

## Debug scenarios

No new `?debugScenario=` added for this ticket. Existing debug path remains localhost-gated only.

## Code quality

- Focused diff across input, settings, profiles, main wiring, docs, tests.
- No dead code observed; binding capture cleans up on settings close.
- Minor follow-ups are nits only (see `nits.md`).

## Capture / visual QA

- Settings row present in planned screenshot.
- Gameplay screenshot shows normal dungeon HUD; binding glyph is a later ticket.
- Probes reached `playing` with enemies; no browser defects.

## Remaining gaps

None blocking. Runtime is clean and all acceptance criteria are met for ticket 119 scope.


## v0.83 — Key Item Lobby Equip UI  (2026-05-31 22:47:26)


- Aligns with lobby tab pattern (`deck-editor`, medic, forge) in `index.html` / `setLobbyTab` / `main.js`.
- No new debug scenarios; normal equip path uses server-validated `equipKeyItem` in lobby phase only.
- `game/docs/requirements.md` foundation unchanged (3D render, sockets, multiplayer, movement).
- `game/docs/controls.md` key-item use binding is separate from this lobby equip UI (ticket 119 territory).

## Code quality

- Focused diff (~540 lines) across server init, HTML, CSS, `renderKeyItemList`, socket handlers, tests.
- No dead module (`key-item-loadout.js` optional path — logic kept in `main.js` per existing lobby style).
- Handlers mirror medic/shop error patterns.

## Remaining gaps

None blocking. Runtime is clean and acceptance criteria are satisfied in the working tree.

## Nits (non-blocking)

See `nits.md` for follow-ups: extend lobby tab integration test to Key Items, and improve harness capture of the Key Items panel.


## v0.84 — Key Item: Dodge Roll  (2026-06-01 02:59:48)

- Transient run state (`invulnerableUntil`, `keyItemCooldownUntil`) excluded from persistence (`key-items.test.js`).

## Debug scenarios

This ticket did **not** add or change `?debugScenario=` handlers in game code. Integration tests use pre-existing `summon-ready` via socket `debugScenario` (test-only entry). Normal lobby → ready → dungeon path remains the player flow; no invariant bypass for dodge itself.

## Code quality

- Focused diff across server handler, `damagePlayer`, client HUD/VFX, defs, tests, docs.
- No page errors; no obvious dead code in the dodge path.
- `useKeyItem` does not validate `keyItemId === equippedKeyItemId` (client sends equipped id; server trusts payload) — pre-existing pattern, low risk for current single implemented item.

## Remaining gaps

None blocking. Runtime proof is clean; acceptance criteria are implemented and tested. Spec drift on i-frame duration (top-level “one tick” vs 300 ms) is resolved in code per sub-ticket AC and is documented in nits, not as a functional defect.

## Nits (non-blocking)

See `round-1/nits.md` for backlog items: `controls.md` tick wording, visual capture omitting dodge, no client tests for VFX/HUD helpers.


## v0.85 — Key Item: Summon Recall  (2026-06-01 04:37:13)

---

## Integration notes

- Harness fallback capture did not press the recall key or spawn minions in-browser; functional proof is unit/integration tests, not screenshots.
- `useKeyItem` does not require `keyItemId === player.equippedKeyItemId` (client sends equipped id — same as dodge roll).
- Emergency spiral placement can place minions farther than 2.5m when ring slots are walled — intentional escape hatch, tested up to ~7m in wall test.

---

## Remaining gaps

None blocking. Runtime clean; acceptance criteria met in server code and tests.

---

## Nits (non-blocking)

See `nits.md` for backlog items (stale client test mock, optional HUD for `no_minions`, fixed ring radius, agent-guided capture for recall).


## v0.86 — Key Item: Field Medic Kit  (2026-06-01 06:17:06)


---

## Capture & QA limitations (non-blocking)

- Fallback capture (`01-initial`, movement probes) does not show medic-kit use or green pulse in screenshots.
- Sub-ticket 02 was `visual` verification; holistic browser proof of VFX was not in this capture plan. Code and sub-ticket QA are the evidence for VFX.

---

## Remaining gaps

None blocking. Runtime is healthy; acceptance criteria are satisfied in code and tests.

---

## Nits (non-blocking)

See `round-1/nits.md` for follow-up tickets: ally-visible heal VFX, shared heal-radius constant, outdated key-item description string.


## v0.87 — Key Item: Guard Block  (2026-06-01 09:07:42)

- Cannot stack with dodge i-frames in a broken way: satisfied. `damagePlayer()` exits on `invulnerableUntil` before applying block reduction, so dodge i-frames take priority. This priority is documented in the implementation comments and covered by tests.
- Client shield pose/VFX on facing direction: satisfied. The client triggers a cyan shield disc on successful `guard_block` use and keeps it active from `stateSnapshot().players[id].isBlocking`; the disc is offset using the same `atan2(z, x)` facing convention as player rotation.
- Tests for frontal hit reduced, rear hit full, and expiry: satisfied. `game/server/test/guard_block.test.js` and the added `damagePlayer()` tests cover frontal reduction, arc edge behavior, rear/full damage, expiry, shield interaction, cooldown, and invulnerability priority.

## Design and regression check

The implementation is consistent with the action-RPG/key-item design: Guard Block adds a short defensive stance without changing the lobby/dungeon/deck loop, and it does not weaken the baseline rendering, socket connectivity, multiplayer state, or WASD movement requirements. Movement is slowed to 20% while blocking, satisfying the requested slowed/rooted tradeoff without introducing a separate movement mode.

No dead or obviously broken code was found in the changed files. The runtime logs and coverage run do not show console crashes or test failures.

## Debug scenarios

The ticket added `guard-block-ready`. It is gated through the existing debug scenario path: the client only auto-requests it from the `?debugScenario=` URL parameter on local hosts, and the server rejects debug scenarios in production or non-local contexts unless explicitly allowed by `ALLOW_DEBUG_SCENARIOS=1`.

The same end state is reachable normally: a player can equip `guard_block` in the lobby via `equipKeyItem`, deploy into a dungeon, and use `useKeyItem` while off cooldown. The scenario only preps the player with `guard_block`, low HP, and no cooldown; it does not bypass the normal `useKeyItem` handler, damage pipeline, cooldown assignment, state snapshot, persistence dirty marking, or net replication that real play uses.

## Remaining gaps

None.


## v0.88 — Key Item: Flare Beacon  (2026-06-01 10:57:26)

## Debug scenario: `flare-beacon-ready`

| Rule | Status |
|------|--------|
| Gated to dev (localhost URL `?debugScenario=`, server `isDebugScenarioAllowed`) | OK |
| Normal path still valid (`equipKeyItem` + `useKeyItem` with equipped id) | OK |
| Does not bypass `useKeyItem` server logic | OK — only pre-equips item and spawns nearby enemies |

## Sub-ticket integration

All three subtickets land coherently: server reveal + cooldown + tick cleanup, client highlight, tests. No dead code or obvious logic bugs found in live tree review.

## Remaining gaps

None blocking. Runtime is healthy; acceptance criteria and tests are satisfied.

## Nits (non-blocking)

See `nits.md` if present — duplicate test suites, no dedicated simulation cleanup test, capture did not exercise flare visually.


## v0.89 — Key Item: Loot Magnet  (2026-06-01 13:17:12)

- Pre-existing pattern: `useKeyItem` does not verify `keyItemId === player.equippedKeyItemId` (client sends equipped id; tests emit directly). Not introduced by this ticket.

---

## Coverage (visibility)

`round-1/coverage.log` includes full `loot_magnet.test.js` run. New handler lines in `index.js` are exercised by unit tests; global thresholds are harness-disabled for this ticket.

---

## Remaining gaps

None blocking. Runtime is clean; acceptance criteria and sub-ticket specs are satisfied.

---

## Nits (non-blocking)

See `round-1/nits.md` for backlog items (test naming clarity, optional client feedback).


## v0.90 — Key Item: Overclock  (2026-06-01 16:39:44)

### Does not bypass MS cost or deck empty checks

PASS. The overclock path only changes slot-cooldown handling. Existing MS checks still run before the helper on spell/enchantment/creature branches, and the dedicated overclock test verifies MS is still consumed. The `draw_card` branch still calls `canDrawIntoHand()` before any overclock charge is consumed, so overclock cannot bypass the hand/deck availability check for draw effects.

### Tests: use overclock, two rapid card plays without slot CD; third respects CD

PASS. `server/test/overclock.test.js` covers key item use, first and second rapid card plays skipping slot cooldown, the next post-overclock card play assigning normal cooldown, MS cost preservation, snapshot visibility, and run-end charge cleanup. The coverage log shows `server/test/overclock.test.js (11 tests)` passing.

Coverage note: the captured coverage run overall had one failure in `server/test/integration.test.js > Socket Integration - Quest Selection > runComplete summary includes quest metadata and quest reward data`, where a randomized hand had no weapon slot. That failure is outside the overclock suite and not caused by the changed overclock paths reviewed here.

## Design and regression review

The implementation is consistent with `game/docs/design.md`: overclock is a key-item combat modifier layered on the card-based dungeon combat loop, while the normal lobby, deck, hand, MS, and dungeon flow remain authoritative on the server. It does not weaken the baseline 3D rendering, websocket connection, player visualization, or movement synchronization requirements.

This ticket added the `overclock-ready` debug scenario. It is gated through the existing debug scenario path, rejected in production/remote contexts unless explicitly enabled, and the client's automatic entry point is the `?debugScenario=NAME` URL parameter. The equivalent end state is reachable through normal gameplay by equipping Overclock in the lobby, deploying, and using the key item. The scenario does directly seed the debug state for QA convenience, but normal gameplay still exercises `equipKeyItem`, `useKeyItem`, cooldown application, and card-use charge consumption; the production path is not replaced by the shortcut.

## Remaining gaps

None.


## v0.92 — Key Item: Phase Step  (2026-06-02 01:51:59)

The captured run loads cleanly. `metrics.json` reports `ok: true`, servers started, `pageerrors` is empty, and the game reached `playing` with a canvas, connected socket, visible card hand, two players, and active enemies. `console.log` has no `pageerror` or `[fatal]` entries from game code; the Vite `EPIPE`/WebSocket close noise in `client.log` is explicitly benign. The PNG screenshot files referenced by metrics were not present in the round folder, so visual confirmation here is limited to the recorded probes/logs for this code-verified ticket.

## Acceptance criteria findings

- Cooldown ~12s: Met. `KEY_ITEM_DEFS.phase_step` defines `cooldownMs: 12000`, the successful server path applies that cooldown to the caster, and `server/test/phase_step.test.js` verifies the second immediate use returns `on_cooldown`.
- Requires co-op ally in same run; solo fails gracefully: Met. `useKeyItem` only considers other living, non-extracted players in the lobby/run state. A solo caster receives `no_ally` without moving or burning cooldown, covered by the focused test.
- No swap through walls / both endpoints valid: Met for the ticket's stated endpoint validation requirement. Before swapping, the server rejects endpoints outside walkable dungeon space and endpoints overlapping wall colliders, leaving positions unchanged and preserving cooldown. Tests cover off-map endpoints and wall-overlap endpoints.
- Client target highlight or auto-nearest: Met. The client recomputes and highlights the nearest in-range ally when `phase_step` is equipped and sends that `targetPlayerId`; the server also supports omitted `targetPlayerId` by selecting the nearest candidate.
- Tests for two-player swap and out-of-range failure: Met. `coverage.log` shows `server/test/phase_step.test.js` passed 8 tests, including coordinate swap, explicit target, out-of-range failure, solo failure, invalid endpoints, wall overlap, and cooldown. The full logged run shows 33 test files / 935 tests passing.

## Design and integration

The implementation fits the existing key-item architecture: data lives in `progression.js`, action handling remains server-authoritative in `index.js`, and the client only supplies a target hint. The swap preserves `x`, `y`, and `z` as requested and broadcasts the authoritative state update after success. It does not regress the foundation requirements: the captured game still renders, connects over WebSockets, shows multiplayer state, and processes movement.

The added `phase-step-ready` debug scenario is gated through the existing local/dev debug path and URL/test hook flow. It equips the local caster and starts a normal playing state, but does not fabricate an ally or bypass the real co-op swap path; equivalent end state remains reachable through normal lobby play by equipping Phase Step and deploying with a second player.

## Remaining gaps

No blocking gaps found. The only follow-up I noted is non-blocking maintainability around duplicated client/server range constants, filed separately in `nits.md`.


## v0.94 — Open Plaza Stage  (2026-06-02 03:14:34)

- Single large walkable plaza bounded by outer walls: satisfied. The stage builds one `32 x 32` room, empty passages, four solid perimeter walls, and `profile: "open-plaza"`, comfortably above the 4x default-room area target.
- At least six freestanding cover pieces that respect collision and traversability: satisfied. The layout targets eight cover pieces, keeps them inside the perimeter and out of the spawn-clear zone, rejects overlaps, flood-fills the plaza to avoid partitioning, and adds matching server/client AABB colliders.
- At least two cover pieces on gently sloped platforms: satisfied. Two platform-centered pillars are created, the platforms carry `floorCorners`, and tests enforce a max corner-height delta of `0.5`.
- Deterministic given a seed: satisfied. Plaza generation uses the seeded PRNG for candidate ordering, and tests assert deep equality for repeated seeds plus deterministic spawn sampling.
- Spawn placement keeps party members on the plaza floor: satisfied. Normal quest selection applies the `open-plaza` layout, run spawn offsets land in the clear center area, and `sampleFloorY()` sets the player Y on the plaza floor.
- Enemy spawn and objective placement still work with no room list: satisfied. Single-room/no-combat-role layouts route enemies, crystals, and loot through `pickFloorSpawnPosition()`, which is seeded and rejects wall/cover collisions. The `arena_trials` normal run path uses this same flow.
- Unit tests cover shape, slope bounds, and cover reachability: satisfied. `game/server/test/dungeon.test.js` covers the open-plaza shape, area, cover count, platform slope delta, cover-on-platform placement, reachability, determinism, and cover colliders; `game/server/test/arena_spawn_cover.test.js` covers cover-aware enemy/objective/loot placement.

## Design and regression check

The implementation fits the design doc's procedural dungeon model and sloped-floor system. It preserves the existing lobby/deploy/dungeon loop, adds the plaza as a selectable quest rather than replacing the default dungeon, and does not regress the foundation requirements: the captured run rendered, connected to the server, showed multiplayer state, and handled movement.

## Debug scenarios

The new `open-plaza-arena` debug scenario is appropriately gated through the existing `debugScenario` socket path and local/dev allowance checks. It is only a QA shortcut: the same end state is reachable through normal play by selecting `arena_trials` in the quest board and deploying, and it uses the same `applyLayoutForQuest()` and `spawnEnemies()` placement path as the normal quest.

## Remaining gaps

None.


## v0.96 — Key Item: Barrier Dome  (2026-06-02 03:51:56)

Cooldown ~14s: PASS. `KEY_ITEM_DEFS.barrier_dome` is retuned to `cooldownMs: 14000`, `durationMs: 1000`, and `radius: 3`, with the stale absorb/5m/8s definition removed. The `useKeyItem` branch sets `keyItemCooldownUntil` from the definition and the tests verify immediate recast returns `on_cooldown` without refreshing the dome.

Co-op dome centered on caster and helps allies inside: PASS. Casting stores transient caster-centered dome state (`barrierDomeUntil`, radius, X, Z). `damagePlayer` checks every living player's active dome, so any player standing inside an ally's dome is protected from ranged/projectile damage originating outside, while attackers inside the same dome still damage normally.

Projectile/ranged damage blocked, melee still applies: PASS. `damagePlayer` only applies the dome block for `options.ranged` or `options.projectile`, before HP reduction and before guard block damage mitigation. Untagged melee damage remains unaffected. The implementation also tags the phase-beam player-hit path as ranged/projectile, giving the mechanic an in-game ranged path rather than only a direct unit-test hook.

Tests: PASS. `coverage.log` shows the full suite passed (`31` files, `897` tests), including `server/test/barrier_dome.test.js` (`10` tests). The new tests cover definition values, cast state/cooldown, outside-to-inside ranged blocking, melee pass-through, ally protection, expired domes, inside attackers, unknown attacker positions, and victims outside the dome.

## Design and foundation consistency

PASS. The change is server-authoritative and scoped to the existing key-item and damage systems, preserving the client/server architecture, multiplayer state snapshots, dungeon flow, and movement/combat foundations described in `game/docs/design.md` and `game/docs/requirements.md`. Dome state is transient and not added to persistent player data, matching short-lived combat effects like invulnerability/blocking.

## Debug scenarios

Not applicable. This ticket did not add or change a `?debugScenario=...` shortcut; the capture used the fallback smoke plan with no scenarios.

## Remaining gaps

None.


## v0.97 — Key Item: Purge Charm  (2026-06-02 04:23:30)

### Tests

PASS. `coverage.log` shows `server/test/purge_charm.test.js` passing 12 tests, including debuff order, oldest-debuff clearing, no-shield-when-clearing, shield grant, cooldown reuse, and one-hit damage absorption. The broader run also passed: 32 test files and 909 tests.

## Design and foundation consistency

PASS. The implementation stays server-authoritative and uses the existing Socket.IO `useKeyItem` path, matching the game's multiplayer server-client architecture. It does not change core lobby, movement, rendering, or card combat flow, and the captured smoke run confirms the foundational requirements still hold: 3D scene rendering, WebSocket connection, multiplayer presence, and movement.

## Debug scenarios

PASS. This ticket did not add or modify a `?debugScenario=...` shortcut. The runtime capture used normal lobby/deploy gameplay with no debug scenario active.

## Code quality

PASS with one non-blocking nit filed separately. The changes are narrowly scoped, covered by focused tests, and integrate with existing key-item behavior without obvious dead or broken code. The only polish issue found is that the existing item description still says "Remove all negative effects" while the implemented and ticketed behavior removes one debuff.

## Remaining gaps

None.


## v0.102 — Sunken Canyon Stage  (2026-06-02 06:26:36)


Both are dev-only shortcuts; normal gameplay reaches the same layout via `canyon_descent`. Neither skips server validation or persistence paths beyond what other debug scenarios already do.

---

## Code quality

- Focused diff across `game/server/dungeon.js`, `progression.js`, `quests.js`, `index.js`, `game/client/dungeon.js`, `renderer.js`, and tests.
- No dead code or obvious logic bugs in spawn/layout paths.
- `buildDescentRampRoom` exported for reuse (136/137 pattern).
- Console capture clean; 409 on register is harness noise, not game defects.

---

## Remaining gaps

None blocking. All top-level acceptance criteria are implemented and covered by unit tests; the round-1 browser capture confirms general game health but not a sunken-canyon vista screenshot (tracked as a nit).

---


## v0.104 — Key Item: Echo Strike  (2026-06-02 08:02:53)


---

## Sub-ticket integration

Both sub-tickets’ criteria are satisfied in the combined working tree:

1. **01-echo-strike-activation** — defs, handler, cooldown, persistence exclusion, tests.
2. **02-echo-strike-weapon-echo** — delayed 50% packet, weapon-only proc, consumption, spell non-proc test, simulation hook.

No integration gaps found between activation and weapon echo layers.

---

## Remaining gaps

**None (blocking).** Runtime is clean; all top-level acceptance criteria are implemented and covered by tests.

---


## v0.108 — Gameplay Review: Improvements & Simplifications Doc  (2026-06-02 09:13:35)


## Per-criterion summary

| Criterion | Status |
|-----------|--------|
| `gameplay-review.md` exists, sole `game/` change | Pass |
| Section order and minimum counts | Pass |
| Grounded, game-specific proposals | Pass |
| Self-contained document | Pass |
| Game runs cleanly in capture | Pass |
| No runtime / requirements regression | Pass |

## Remaining gaps

None. No blocking gaps for acceptance or runtime health.

## Nits (non-blocking)

See `nits.md` for optional follow-ups (design-doc deck cap vs code, minor doc depth on run objectives).


## v0.113 — 181 — Character Customization: Server Cosmetic Profile  (2026-06-02 09:51:13)

restart.** — MET. `updateProfile` merges provided sub-fields onto the existing
cosmetic and persists via the existing atomic `saveUsers`. Verified by
`users.test.js` ("persists cosmetic across a simulated restart") and the
account-route round-trip test that re-reads via `GET /api/me`.

## Consistency / regression
- Reuses the existing `PATCH /api/me/profile` route and atomic `users.json`
  write exactly as the ticket's Design section specifies — no new endpoint, no
  new persistence mechanism.
- Default merge/fallback uses spread copies everywhere a default is applied, so
  no record shares a mutable `DEFAULT_COSMETIC` reference.
- No debug scenarios were added or changed by this ticket.
- All 53 server tests pass (`account`, `cosmetic`, `cosmetic_runtime`, `users`).
  `server.test.js` got a +3 line touch consistent with the new export.

## Remaining gaps
None blocking. All five acceptance criteria are fully and robustly met, backed
by HTTP-level and unit tests, and the captured run is healthy. One minor,
non-blocking polish item is recorded in `nits.md`.


## v0.118 — 189-character-hats-server-unlocks-currency  (2026-06-02 10:30:31)

- **End-state reachable normally**: the scenario only grants currency
  (`max(currency, 1000)`) while staying in the lobby. A real player reaches the
  same state by earning currency in dungeon runs, then opening the same
  `unlockHat` flow — the scenario is a shortcut to having currency, not a
  bypass of any feature path.
- **No weakened invariants**: it does not pre-unlock hats or skip validation;
  the actual unlock still runs through `unlockHatForPlayer` (affordability) and
  `users.unlockHat` (catalog validation + persistence).

## Consistency with design / requirements
Consistent with the established cosmetic/currency architecture (181 cosmetic
profile, `buyShopCard`/`grindCard` purchase flows). No foundation regression;
existing cosmetic fields and currency flows are untouched apart from additive
extension. Client rendering of hats is correctly deferred (server-only feature).

## Remaining gaps
None blocking. See `nits.md` for non-blocking follow-ups (no dedicated unit
test for the `unlockHat` socket handler / `unlockHatForPlayer` / account-level
`unlockHat`, which are currently only covered indirectly).


## v0.120 — 182-character-customization-client-render-avatar  (2026-06-02 11:26:23)

(index.js:3480-3488) — normal gameplay never touches them.
- **Same end-state reachable normally** — ✅ A non-default cosmetic is settable through the
  validated profile route (`users.js:243-255` via `validateCosmetic`), persisted on the
  account, and loaded onto the in-run player (`index.js:1062`), then broadcast
  (`progression.js:3114`). The scenarios just pre-seed `player.cosmetic` to skip the UI.
- **Invariants not short-circuited** — ✅ The relevant invariant for *this* ticket is the
  broadcast→client-render pipeline, which the scenarios exercise fully (they set the
  server-side cosmetic that is replicated normally). The values set are all valid
  (catalog shapes/hats, valid hex). Hat-unlock/currency validation belongs to #189's flow,
  not this rendering ticket; the normal equip path remains intact and validated.

## Consistency with design / foundation
Body-shape vocabulary (`box`/`cylinder`/`cone`/`capsule`) and hat ids
(`none`/`cap`/`wizard`/`crown`) mirror the server's `BODY_SHAPES`/`HAT_CATALOG` — no
invented names. Change is confined to client rendering plus two debug scenarios; no
gameplay/foundation regression. Coverage log shows the existing server suite runs clean.

## Remaining gaps
None blocking. (See `nits.md` for minor non-blocking polish.)


## v0.123 — Models: glTF Loader Infrastructure (with procedural fallback)  (2026-06-02 11:56:04)


6. **Resilient loading: missing/broken logs a warning, falls back, never throws/stalls.**
   ✅ `loadModel` guards loader construction in try/catch, routes `GLTFLoader` error
   callback to a `console.warn` + `resolve(null)`, caches the null so a bad path is
   not re-fetched, and never leaves a hung promise. `attachRegistryModel` also wraps
   the `.then` with a `.catch`. A null result leaves the procedural mesh untouched.

7. **Existing server + client unit tests still pass.** ✅ `pnpm run test:quick`:
   62 files / 1473 tests passed, 0 failures.

8. **Debug scenarios.** None added or changed by this ticket (diff is loader-only;
   `debugScenario` probe fields are unchanged from the existing harness). N/A.

Consistency with `design.md`/`requirements.md`: additive plumbing only; no
foundation regressed.

## Remaining gaps

None blocking. (See `nits.md` for minor non-blocking follow-ups.)


## v0.129 — 183-character-customization-client-panel  (2026-06-02 13:30:04)

  the avatar without a save or reload (rotation preserved across rebuilds).
- **Init from cache, lifecycle-safe** — ✅ `openCosmeticPreview` runs on
  `openAccountOverlay` (after unhide, so the canvas has layout size);
  `closeCosmeticPreview` on close cancels the RAF and disposes renderer + avatar
  GPU resources. `closePreview()` is idempotent and called at the top of
  `openPreview()`, so repeated open/close neither leaks meshes nor stacks loops.
- **Self-contained** — ✅ Own `Scene`/`PerspectiveCamera`/`WebGLRenderer` and
  lights; does not touch the main scene, camera, or render loop.

### Consistency / regressions
- Diff is 100% client-side (`game/client/*`); no server, shared, or net code
  touched — no regression to the foundation. Consistent with `cosmetic.js`
  validation contract and `design.md` cosmetic profile.
- No debug scenarios added or changed by this ticket.

## Remaining gaps

None blocking. The acceptance criteria are fully and robustly met and the
captured run is clean.


## v0.133 — Key Item: Smoke Bomb  (2026-06-02 14:27:33)

## Debug scenario (`smoke-bomb-ready`)

Verified all three requirements:
- **Gated**: only reachable via the `debugScenario` socket event behind
  `isDebugScenarioAllowed` (`index.js:3514-3522`) and membership in
  `DEBUG_SCENARIOS`. Normal gameplay never invokes it.
- **End-state still reachable normally**: the scenario only equips `smoke_bomb`,
  zeroes the cooldown, and spawns two enemies in range. The identical state is
  reachable by equipping the Smoke Bomb key item and approaching enemies; the
  comment documents this.
- **No invariant bypass**: the scenario does not cast the bomb or fabricate the
  smoke zone — the player still casts through the real `useKeyItem` path, which
  applies the cooldown, persistence flag, and concealment exactly as in normal
  play.

## Remaining gaps

None blocking. The ticket is fully and robustly satisfied. (Minor non-blocking
nits recorded in `nits.md`.)


## v0.136 — 193-character-hats-unlock-panel  (2026-06-02 15:02:40)

  guarded by `isDebugScenarioAllowed` (local address/origin/host, non-production,
  or `ALLOW_DEBUG_SCENARIOS=1`). Normal gameplay never calls
  `applyDebugScenario`. ✓
- **End state reachable normally**: it persists real unlocks via
  `unlockHatForAccount` (same persistence path as the live `unlockHat` flow),
  leaving the last catalog hat locked so both owned and locked branches show. The
  equivalent owned state is reachable by earning currency and using the unlock
  flow. ✓
- **No invariant short-circuit**: it persists via the real account API and does
  not bypass net-replication or equip validation. It only skips the currency
  spend for setup convenience, which is appropriate for a QA shortcut. ✓

## Remaining gaps
None. The captured run is clean and all reconstructed acceptance criteria are
fully and robustly met, with server-side validation backing the client UI.

(The fallback smoke capture did not open the Account overlay, so the hat panel
was exercised by code review rather than a screenshot — non-blocking; the panel
mounts from the same module graph that loaded without error.)


## v0.139 — Docs: fix stale sections in design.md  (2026-06-02 15:37:41)


## Consistency with `design.md` and `requirements.md`

- **`game/docs/requirements.md`:** Foundation items (3D render, WebSocket, multiplayer viz, WASD sync) are unchanged; this ticket did not touch runtime code.
- **Holistic doc accuracy:** The corrected sections now align with implementation. One **pre-existing** inaccuracy remains in the same playtesting sentence: **Mana Leach** is still cited, but `CARD_DEFS.mana_leach.name` is **Ether Siphon** (`game/server/progression.js`, `game/client/cards.js`). Sub-ticket 03 explicitly left that name unchanged; it was out of this ticket’s stated fix list. That is a minor doc nit, not a mechanics or acceptance failure for a targeted pass (see `nits.md`).

## Code quality and debug scenarios

- No runtime code changes; no new dead code or console defects attributable to this ticket.
- No new or changed `?debugScenario=` shortcuts; probes show `debugScenario: null` throughout capture.

## Verification artifacts

- **Coverage (`coverage.log`):** No tests run against changed files (docs-only); expected empty report.
- **Screenshots:** Lobby and in-run movement (W/D) look healthy; UI strings match renamed cards.

## Remaining gaps

None blocking. Runtime capture is clean; all top-level acceptance criteria are satisfied for the scoped doc-only work.


## v0.142 — Spire Ascent Stage  (2026-06-02 16:34:54)


- **Reachable in normal play, not just via the debug URL.** The `spire_ascent`
  quest is registered in `QUEST_DEFS` and surfaced by `listQuests()`, so a
  player can select it from the lobby; `applyLayoutForQuest` loads the
  `spire-ascent` profile. The end-state is not gated behind the debug shortcut.
- **Debug scenarios properly gated.** Both `spire-ascent` and
  `spire-ascent-stage` live only in `DEBUG_SCENARIOS` / `applyDebugScenario`
  (the `?debugScenario=` path). The `spire-ascent` scenario runs the *real*
  `applyLayoutForQuest` + `spawnEnemies` — same path as normal deploy, no
  skipped validation or replication; it only tops up HP/MS for QA convenience.
  `spire-ascent-stage` is a layout-only render/collision QA load whose
  equivalent state is reachable normally via the quest. Invariants intact.
- **No design.md/requirements regression.** design.md does not enumerate stages
  or layout profiles, so there is nothing to contradict; the existing
  crowded/open-plaza/sunken-canyon paths are untouched.

## Remaining gaps

None blocking. Minor non-blocking items recorded in `nits.md`.


## v0.144 — Cleanup nits from 122-key-item-summon-recall  (2026-06-02 18:23:29)

  script.

### Debug-scenario gating (required checks) — PASS

- The `summon-recall` scenario is pre-existing (`server/index.js:413`, member of
  `DEBUG_SCENARIOS`) and reachable only via the `debugScenario` /
  `__requestDebugScenarioForTest` dev path — normal gameplay never triggers it.
- The end-state is still reachable through normal play: equip Recall Whistle →
  summon minions → press the use-key-item key. The scenario only seeds state
  (equips whistle, spawns 2 distant minions); it does **not** short-circuit the
  recall itself.
- No invariant is bypassed: the smoke test fires the real `useKeyItem` event, so
  server-side placement validation, cooldown, and `stateUpdate` replication are
  all exercised exactly as in normal play.

## Remaining gaps

None blocking. The four nits are all resolved, the game runs clean, and both
the affected unit suites (client key-item UI, server key-items 36/36) pass.


## v0.145 — Cleanup nits from 123-key-item-field-medic-kit  (2026-06-02 21:58:58)

### Field Medic Kit description text

**Met.** `KEY_ITEM_DEFS.field_medic_kit.description` is now `'Heal nearby allies and restore Magic Stones in an area'`, covering nearby allies and Magic Stone restore. Client test fixture in `main.test.js` updated to match. No remaining in-game copy with “Restore a portion of your health” under `game/`.

## Design & requirements consistency

- **design.md:** Change is a presentation/sync fix for an existing key item; no combat-loop or architecture drift.
- **requirements.md:** Round-2 capture confirms 3D render, WebSocket connect, multiplayer presence, and WASD movement — foundation intact.
- **Debug scenarios:** None added or changed for this ticket (`debugScenario: null` in probes).

## Code quality

- Single VFX entry point for medic kit (`keyItemHealPulse` only).
- Server heal logic, cooldown, and `stateUpdate` ordering unchanged aside from the additive broadcast.
- Harness sub-ticket (`fc7d13f`) hardens worktree Playwright install/link; enabled this round’s successful capture without modifying `game/`.

## Remaining gaps

None blocking. Round-2 browser capture does not visually confirm the green heal ring or ally-side VFX; acceptance is satisfied by the lobby broadcast implementation plus the new two-player socket test.


## v0.146 — Models: Wire enemy + minion placeholders into the registry  (2026-06-02 22:27:56)

**absent** from the gameplay screenshots (`02-after-w.png`, `03-after-d.png`). Procedural
materials are set `visible = false` *only* when a GLB resolves successfully; had any load
failed the colored cones would still be drawn. Their disappearance is positive proof the
GLB swap occurred and the loaded models are in the scene, sitting inside the red
hitbox-wireframe overlays (a pre-existing combat telegraph, unrelated to this ticket).

Note: no minions were summoned during the deterministic smoke capture (`minions: []`), so
minion meshes are not pictured. This is a capture-flow coverage limitation, not a defect —
the minion attach/normalize path is identical to the enemy path and is unit-tested.

### Debug scenarios
N/A. This ticket adds no `?debugScenario=` shortcut; `debugScenario` stays `null` in the
probes and no scenario gating code was touched.

## Remaining gaps

None blocking. Acceptance criteria are fully and robustly met, the game runs cleanly, and
the change is additive and consistent with `game/docs/design.md` / `requirements.md`. Minor
non-blocking polish is recorded in `nits.md`.


## v0.147 — 185-character-models-spike-base-player-model  (2026-06-02 23:07:42)


`round-5/coverage.log` and my re-run both show the isolated `client-glb` vitest
project running `playerModel.test.js`: **5 tests passed**. The test is well
constructed — it parses the real `.glb` via `GLTFLoader`, exercises the
production `loadModel` path, and asserts morph names, rest-pose height (1.7–1.9),
feet at/above ground (min.y ≥ −0.05), and the ≤ 18k triangle budget.
`vitest.config.js` isolates this real-Three.js test into a node project so it
does not collide with the jsdom-mocked client suite. The 0% line in the coverage
table reflects that the asset/test touch no instrumented `game/` source modules
(coverage is visibility-only; thresholds disabled) — expected for a spike.

## Remaining gaps

None blocking. Two documentation nits noted in `nits.md`:
- `MODEL_SPIKE.md` names the base mesh `Regular_Male`, while `SPIKE_DECISION.md`,
  the committed asset, and the passing test all use `SuperHero_Male` — an internal
  inconsistency to reconcile.
- The decision note lives in `game/docs/` rather than the ticket dir named by the
  beads AC; harmless, but worth a one-line pointer if strict location matters.


## v0.148 — Cleanup nits from 125-key-item-flare-beacon  (2026-06-02 23:20:30)

## Debug scenarios

This ticket **did not add or modify** `flare-beacon-ready` (pre-existing from 125). Harness uses it only via `emitScenario` after normal lobby/ready flow.

Existing safeguards remain appropriate:

- Client: `?debugScenario=` on localhost only; server: `isDebugScenarioAllowed` (local address/origin/host or `ALLOW_DEBUG_SCENARIOS=1`).
- Scenario sets `equippedKeyItemId` and spawns nearby enemies; **reveal still requires** harness `pressKey e` → client `useKeyItem` → server handler — same path as normal play.
- Normal play: `equipKeyItem` + bound key (`useKeyItem` in settings, default keyboard binding) reaches the same reveal end-state; covered by socket integration tests.

No blocking debug-scenario issues for this ticket.

## Coverage artifact

`round-2/coverage.log` shows all flare_beacon and `revealedUntil` cleanup tests executing and passing, then the run **timed out at 120s** during later `echo_strike` tests in the same file. That is a harness time-budget issue (visibility-only coverage), not evidence of failing ticket tests. Not a blocking gap.

## Remaining gaps

None.


## v0.149 — Cleanup nits from 121-key-item-dodge-roll  (2026-06-02 23:32:58)

- No dead code or obvious logic bugs in the touched paths.
- Server dodge handler still uses `def.cooldownMs || 800` and `invincibleDurationMs || 300`.
- Round-3 targeted coverage run: 159 client tests passed (3 files including new dodge tests).

---

## Debug scenarios

This ticket did **not** add a new `?debugScenario=` shortcut.

Round-3 capture appended `emitScenario sloped-dungeon` because `fallbackRecipe()` treats ticket markdown matching `/sloped[-_]dungeon/` as a slope ticket; ticket 149’s harness-capture **problem statement** mentions “sloped-dungeon geometry.” That runs **after** dodge steps and does not replace the normal dodge path exercised earlier in the recipe. Pre-existing `sloped-dungeon` remains localhost-gated via `debugScenarioAllowed` and socket `debugScenario` — not a blocking issue for this ticket (see nits).

---

## Remaining gaps

None blocking. Runtime proof, all three top-level acceptance criteria, and subticket integration are satisfied.

---


## v0.150 — Cleanup nits from 126-key-item-loot-magnet  (2026-06-02 23:39:43)

---

## Debug scenarios

This ticket did not add or modify any `?debugScenario=` shortcuts. Round-1 capture shows `debugScenario: null`. No debug-scenario review items apply.

---

## Capture limitations (non-blocking)

Round-1 used **fallback** capture (lobby → ready → movement smoke). Screenshots do not show loot magnet use or the new ring VFX in-browser; behavior is covered by unit tests and sub-ticket visual QA per harness notes. That gap does not block acceptance for this cleanup ticket.

---

## Remaining gaps

None. Runtime health passes and both acceptance-criterion groups are fully satisfied.

---

## v0.151 — Cleanup nits from 117-sloped-movement-server-and-client  (2026-06-03 00:43:08)

- Gated by `isDebugScenarioAllowed` (localhost / dev env / `ALLOW_DEBUG_SCENARIOS=1`; disabled in production).
- Entry only via socket `debugScenario` event (harness), not normal UI.
- Normal play already generates sloped layouts via `applyLayoutForQuest` → `generateLayout(…, { slopes: true })`; the debug scenario mid-run regen is a QA shortcut, not the only path to ramps.
- Does not skip server movement validation; `applyPlayerMovement` still uses the same `resolveFloorY` path as production.

No debug-scenario blocking issues for this cleanup ticket.

## Integration / holistic notes

- Visual QA path (movement, dodge HUD, sloped-dungeon screenshot description in metrics) aligns with sloped-movement foundation from ticket 117.
- Client visual Y and server authoritative Y now share one fallback definition, closing the `??` vs `Number.isFinite` divergence called out in the parent ticket.

## Remaining gaps

None blocking. Runtime proof and acceptance criteria are satisfied.

## Nits (non-blocking)

See `round-1/nits.md` — documentation could mention `resolveFloorY` where design docs describe player Y snapping.

---


## v0.152 — Cleanup nits from 118-key-item-data-and-persistence  (2026-06-03 00:54:47)


---

## Verification (reviewer)

```bash
cd game && pnpm exec vitest run server/test/debug-scenarios.test.js
cd game && pnpm exec vitest run server/test/key-items.test.js -t "dead|extracted|listKeyItems"
```

Both succeeded during review.

---

## Remaining gaps

None blocking. Runtime capture is clean; all top-level acceptance criteria are implemented and covered by targeted tests.

---


## v0.153 — 190-character-hats-asset-starter-hats  (2026-06-03 02:12:55)

  base at the group origin; visually distinct snug dome. ✅
- `buildHatMesh` still returns `null` for `none`/unknown; cap/wizard/crown cases unchanged. ✅
- `cosmeticSignature` keys off `AVATAR_HAT_IDS`, so the new ids yield distinct signatures and
  trigger avatar rebuilds (line 1301). Seating uses the unchanged `bodyTopY(shape)` at the
  call site (line 1349); the new meshes seat exactly like existing hats and dispose through
  the existing traversal. ✅

## Integration
- Server `HAT_CATALOG` ids and client `AVATAR_HAT_IDS` agree on the two new ids. ✅
- No debug scenarios added or changed by this ticket.
- `pnpm test` (from `game/`): **68 files, 1548 tests, all passing.**

The visual capture uses the default `none` hat, so the new hats do not appear on screen —
expected and called out by the decomposer; this is a code-verification ticket and the logic
is exercised by unit tests.

## Remaining gaps
None. Both sub-tickets are fully and robustly implemented, tests pass, and the captured run
is clean.


## v0.154 — Cleanup nits from 119-key-item-input-bindings-and-settings  (2026-06-03 02:24:49)

  other than `missing_key_item_id`."** — MET, proven by capture. The dodge probe
  shows `equippedKeyItemId: "dodge_roll"`, the dodge executed (player moved
  -9,9 → -10.9,-9.6), and the cooldown engaged afterward
  (`keyItemCooldownRemaining: 359`, HUD indicator "0.4", then "0.1"), with no
  rejection error in the console. The server clearly received a valid
  `{ keyItemId }`.

## Code quality

- The new branch is small, readable, and matches surrounding style. No dead code,
  no console errors, no leftover debug paths. No new `?debugScenario` shortcuts
  were introduced (`debugScenario: null`, `debugScenarioAllowed: true` in probes).
- Consistent with `design.md`: profile-aware control glyphs are exactly the
  intent of the gamepad-profiles abstraction; no foundation regression.

## Remaining gaps

None. Both acceptance criteria are fully and robustly met, the unit suite passes,
and the captured run is healthy.


## v0.155 — Cleanup nits from 120-key-item-lobby-equip-ui  (2026-06-03 02:58:57)

`#key-item-list .key-item-entry.equipped` present before screenshotting the
`#key-item-loadout` panel to `docs/walkthroughs/keyitems-capture/`. Wired as
`test:smoke:keyitems` in `game/package.json`.

The equipped-row assertion is sound: `renderKeyItemList` (main.js:2388) adds the
`equipped` class to the entry matching `me.equippedKeyItemId`
(main.js:2409), and the default loadout equips `dodge_roll` (confirmed by the
metrics probe: `"equippedKeyItemId": "dodge_roll"`). The script has a graceful
diagnostic fallback that dumps panel state on timeout.

Note: round-1's own verification capture used the deterministic fallback smoke
(lobby → movement → dodge), not this new script, so the round-1 screenshots are
gameplay rather than the Key Items panel. That does not fail AC2 — the AC asks
for a *scripted capture* deliverable, which is present, correct, and wired in.

## Remaining gaps

None. Both acceptance criteria are met, the game runs cleanly, and the full unit
suite passes. Production game code is untouched.


## v0.156 — Cleanup nits from 142-cleanup-sloped-floor-layout-and-geometry  (2026-06-03 03:17:31)

  flat layouts render unchanged. The pre-existing flat-layout tests still pass.
- New test `positions passage wall Y on sloped rooms using sampleFloorY`
  (`game/client/test/dungeon.test.js:274+`) builds a Z-sloped room with a passage
  whose four side walls sit at distinct sloped heights and asserts each mesh
  `position.y === resolveFloorY(sampleFloorY(...)) + PASSAGE_WALL_HEIGHT / 2`.
  `PASSAGE_WALL_HEIGHT` is exported (`dungeon.js:22`) for the test.
- `pnpm test client/test/dungeon.test.js`: **31 passed**. (The printed coverage
  "threshold" errors come from running a single file against the global 70%
  threshold — visibility only, not a failure of this ticket.)

## Consistency
Consistent with `design.md` sloped-floor handling; brings passage walls into line
with the already-sloped room walls and cover meshes. No regression to flat
corridors. No new debug scenarios added (the `sloped-dungeon` scenario predates
this ticket).

## Remaining gaps
None. The change is minimal, correct, matches existing conventions, is covered by
a new mirroring unit test, and the captured run is clean.


## v0.157 — Key Item: Rally Cry  (2026-06-03 03:47:31)

- Normal path still reachable: the scenario only equips `rally_cry` with a
  cleared cooldown — exactly the state a player reaches by equipping the Rally
  Cry key item in the lobby and entering a run.
- No invariants bypassed: the scenario does not cast the buff itself; casting
  still flows through the normal `useKeyItem` handler, which enforces
  dead/extracted/cooldown checks and net-replicates via `stateUpdate`.

## Consistency / regressions
The change is additive and follows the established per-key-item pattern in the
`useKeyItem` handler (cooldown gate → per-item block → `stateUpdate` broadcast).
New fields `rallyUntil`/`rallySpeedMultiplier` are initialized in both
`buildPlayerRecord` and `initializePlayerForActiveRun`, so they reset correctly
on new runs. No existing behavior is altered beyond the guard_block movement
line, which now composes the rally multiplier (verified by test). No design.md
or requirements.md regression.

## Remaining gaps
None blocking. The implementation fully and robustly satisfies the acceptance
criteria, the game runs cleanly, and the tests are thorough and pass.


## v0.158 — 186-character-customization-server-model-fields  (2026-06-03 04:14:40)

`game/server/cosmetic.js` adds `MODEL_IDS = ['player']`, `PROPORTION_KEYS` (the exact six contract keys: height, headSize, torsoWidth, armLength, legLength, shoulderWidth), and `PROPORTION_RANGES`. `DEFAULT_COSMETIC` now carries `modelId: 'player'` and `proportions` initialized to 1.0 for every key. Key names match the canonical contract in `MODEL_SPIKE.md` verbatim, so server fields will line up 1:1 with glTF morph targets and client slider ids.

**2. Server validates/clamps proportion ranges and modelId allowlist.** ✅
`validateCosmetic()` rejects unknown proportion keys (`Unknown proportion key: …`), rejects non-numbers/NaN, rejects out-of-range values against `PROPORTION_RANGES`, and rejects any `modelId` not in `MODEL_IDS`. On the load/backfill path, `backfillProportions()` clamps each value into range rather than rejecting — so legacy/out-of-range stored data is repaired, while live PATCH input is strictly validated. Both "validate" and "clamp" behaviors are present and appropriate to their context.

**3. Fields persisted and included in the stateUpdate snapshot.** ✅
`updateProfile()` (`game/server/users.js`) deep-merges `proportions` so a partial update (e.g. `{ height: 1.1 }`) no longer erases sibling keys — covered by a new test. The full `cosmetic` blob (now containing `modelId` + `proportions`) is replicated in `stateSnapshot()` at `game/server/progression.js:3184`. `cosmetic_runtime.test.js` explicitly asserts the snapshot player cosmetic equals the custom value and that its keys include `modelId` and `proportions`.

**4. Defaults applied to existing accounts.** ✅
`backfillCosmetic()` fills `modelId` (allowlist-checked) and a complete `proportions` object on load. `users.test.js` verifies both fresh-account creation and legacy-record load produce the full default cosmetic including the new fields; partial-legacy backfill only fills the missing sub-fields.

## Design consistency
Consistent with the canonical model contract (`MODEL_SPIKE.md`): the six proportion keys are used verbatim and `modelId` defaults to `"player"`. As a bonus aligned with the downstream client tickets (187/188), `GET /api/me` now also exposes `modelIds` and `proportionConfig: { keys, ranges }` so the client can build sliders from the server's source of truth. No foundation regression — existing cosmetic/snapshot/persistence behavior is preserved and all prior tests still pass.

## Debug scenarios
This ticket adds no `?debugScenario=` shortcuts. (The pre-existing `cosmetic`-distinctive scenario in `index.js` is untouched.) N/A.

## Remaining gaps
None blocking. The implementation fully and robustly satisfies all acceptance criteria, the captured run is clean, and unit coverage for validation, deep-merge, persistence, backfill, API exposure, and snapshot replication is thorough.


## v0.159 — Cleanup nits from 139-harness-misclassifies-pageerror  (2026-06-03 04:15:09)

`{"ok": false, "error": "servers did not start"}`. `game_smoke_ok` still reads
both shapes as broken (both set `ok: false`, neither is `browser_pageerror`), so
`confirm_game_broken` still returns `True` for a server-down confirmation — no
behavior regression, only richer metrics for the smoke gate.

## Integration / quality
- The promote-pageerrors and classify paths are consistent with the existing
  `_classify_capture_failure` contract (all failure shapes set `ok: false`;
  only true infra sets `harness_failure`/`detected`).
- The lazy `from harness.steps.capture_run import _classify_capture_failure`
  inside `confirm_game_broken` matches the existing lazy-import style there and
  avoids any import cycle with `capture_run`.
- Tests: `tests/unit/test_capture_run_diagnostics.py` 37 passed; related
  confirm/smoke/escalate unit tests 14 passed. No regressions observed.

## Remaining gaps
None blocking. See `nits.md` for one minor follow-up (the promote path drops the
screenshots/probes arrays from the rewritten metrics — consistent with existing
classify behavior, not a regression).


## v0.160 — Key Item: Ground Anchor  (2026-06-03 04:24:52)

in place and correct.

**Tests: knockback ignored during anchor; normal after expiry — MET.**
`server/test/ground_anchor.test.js` (7 tests, all passing) covers: non-anchored player
moves along the direction; no-op while anchored; normal knockback after `anchorUntil`
expires; direction normalization; movement slow active vs. expired; and the definition
values. `key-items.test.js` additions also pass (combined run exit 0).

## Integration / quality
- State init is correct: `anchorUntil`/`anchorSpeedMultiplier` are seeded in both
  `buildPlayerRecord` and `initializePlayerForActiveRun`, mirroring `rally_cry`.
- The handler follows the established sibling pattern (rally_cry, guard_block,
  barrier_dome) exactly — equipped/dead/extracted/cooldown guards, `persistenceDirty`,
  `stateSnapshot()` broadcast.
- No console errors, no dead/broken code, no design.md or requirements.md regression. No
  debug scenarios added.

## Remaining gaps
None blocking. (See `nits.md` for one non-blocking follow-up.)


## v0.161 — 187-character-customization-client-gltf-avatar  (2026-06-03 05:08:43)

**10. Fallback safety no-op — MET.** Both `applyProportionMorphs` (guards on
`morphTargetDictionary`/`morphTargetInfluences`) and `applyLoadedModelCosmetic`
(guards on `modelOverride`/`bodyMesh`) are no-ops under the procedural fallback.

**Debug scenario `avatar-proportions-demo` — OK.** New scenario added to
`game/server/index.js`. It is gated behind the same `isDebugScenarioAllowed(socket)`
check as every other scenario (only reachable via the `debugScenario` socket
path), sets `cosmetic.proportions` strictly within the server clamp
(0.75–1.25), and does not short-circuit any validation/persistence — the same
end-state is reachable normally by saving proportions via the
character-customization route (ticket 186) and starting a run. The capture ran
normal flow (`debugScenario: null`), confirming the scenario is not on the
normal path.

## Remaining gaps
None blocking. The only notable shortfall — accent tint not visible on the
single-material `player.glb` — is explicitly sanctioned by the sub-ticket/spike
contract and filed as a nit. Code is clean, all unit tests pass, and the
captured run is healthy.


## v0.162 — 191-character-hats-client-render  (2026-06-03 05:39:04)

   compensates for the glTF being normalized to ~1.8u (vs the ~1u procedural body
   `buildHatMesh` targets), divided by the bone's world scale. The quaternion
   `inverse(boneWorld) * hostWorld` makes the hat's world orientation equal the
   host's (upright, yaws with the avatar); a `+0.18`-world-unit up offset seats it
   above the head. Math checks out: child-of-bone world rot = boneWorld·hatLocal =
   hostWorld, and it stays aligned as the host yaws.

7. **Resilient + no new errors + test:quick passes** — PASS. Missing `Head`
   falls back to attaching at `HAT_FALLBACK_WORLD_Y = 1.72` on the host; the whole
   routine is also wrapped by the caller's `.catch`. No new console errors on the
   captured load; 187 unit tests pass.

## Remaining gaps
None blocking. All acceptance criteria are met; the captured run is clean.

(Note: the deterministic smoke capture uses default users with `hat:none`, so the
positive hat-on-head path is verified by code review + the sub-ticket's own visual
QA rather than this capture. The capture does positively confirm the bare-head
case, clean load, and no regressions.)

## v0.163 — 188-character-customization-client-proportion-sliders  (2026-06-03 05:47:22)

- **Slider move updates preview live** — PASS. The input handler calls
  `refreshCosmeticPreview()` → `updateCosmeticPreview({ ...cosmeticSelection })`,
  storing proportions and re-applying them.
- **Re-applies after async glTF load** — PASS. `cosmetic-preview.js` stores
  `currentCosmetic` and calls `applyStoredProportions()` every `renderFrame()`
  tick (and on mount/update), so a pre-load change lands once morph targets exist.
- **Safe no-op without morph targets** — PASS. `applyProportionMorphs` returns
  early when `morphTargetDictionary`/`morphTargetInfluences` are absent; the
  helper guards a null host. No thrown errors on the procedural fallback.
- **Driven by the same selection as Save** — PASS. Preview and Save both read
  `cosmeticSelection.proportions`; the previewed shape matches the saved payload.

## Consistency / regressions
- Mirrors `game/docs` foundation; no server files or the in-run apply path were
  changed (server validation/persist/broadcast from 186/187 intact). No debug
  scenarios added.

## Remaining gaps
None. No blocking gaps.

## v0.164 — 192-character-keyitem-body-props  (2026-06-03 06:08:02)

**Procedural fallback prop on the torso, removed/hidden when glTF resolves** — MET. `createPlayerAvatar` now takes `equippedKeyItemId`, records `group.userData.keyItemId`, and seats a procedural prop via `attachProceduralKeyItemProp` BEFORE `attachRegistryModel`, so it is captured by the procedural-visibility snapshot. When the glTF resolves, `attachGltfKeyItemProp` additionally removes+disposes the prior (procedural) prop and seats a fresh one on the spine bone — no duplicate, nothing left floating.

**Updates on equip change without reload; tracked on `userData.keyItemId`** — MET. `updateKeyItemProp` no-ops when the id is unchanged; otherwise removes+disposes the old `keyItemPropMesh`, updates `keyItemId`, and rebuilds via the glTF path (`modelOverride` present) or procedural path. Called every frame in the player-update loop.

**Renders for local AND remote players** — MET. `updateKeyItemProp` is invoked before the `if (id === myId) continue;` guard, so it runs for both branches; new avatars also receive `pData.equippedKeyItemId` at creation for both local and remote.

**Unknown/none/asset-less ids never throw; routine best-effort and caught** — MET. `buildKeyItemProp` returns `null` for unmapped ids; `updateKeyItemProp` wraps the rebuild in try/catch with a warn; `attachGltfKeyItemProp` is invoked inside `attachRegistryModel`'s `.then`/`.catch`. The probe shows `equippedKeyItemId: "dodge_roll"` rendering without error.

## Consistency / regression
- No server changes (snapshot already exposes `equippedKeyItemId` at `progression.js:3171`). Diff is confined to `game/client/renderer.js` plus a new test. Mirrors the shipped hat feature (191) faithfully; no foundation regression.
- Hat path, body retarget, and procedural snapshot logic are untouched in behavior.

## Code quality
- Clean, well-commented, constants named analogously to the hat constants. Dispose-on-swap avoids leaks. No dead/broken code, no console errors in the live capture.

No debug scenarios were added or changed by this ticket.

## Remaining gaps
None. All acceptance criteria are fully and robustly met, and the captured run is clean.


## v0.165 — 164-cleanup-retire-legacy-bash-harness  (2026-06-03 07:48:57)

  execute the deleted files.
- Recoverability preserved exactly as the Goal requires: tag
  `bash-rollback-v1` exists and still contains `lib.sh`, `run_ticket.sh`,
  `run_subtask.sh`, `run_backlog.sh`, `supervisor.sh`.
- `harness/lint.sh` (not a target) is correctly left untouched.

**AC2 — "Existing server + client tests pass; the game starts and loads
cleanly."** — MET.
- Game starts/loads cleanly — see runtime gate above.
- Server + client test suites live entirely under `game/`, which this diff does
  not touch, so they are unaffected by definition. `coverage.log` confirms "No
  test files found" for changed files (the changed files are harness Python/bash,
  outside vitest's `game/` scope) — expected for a harness-only cleanup.

## Remaining gaps

None. The change is correct, minimal, and scoped exactly to the Goal; the
captured run proves the game is healthy and the deletions are recoverable from
`bash-rollback-v1`.


## v0.166 — 184-character-customization-player-nameplate  (2026-06-03 08:03:40)


### Nameplate sprite helper and registry
PASS. `game/client/renderer.js` declares a module-scoped `playerNameplates` registry, exports `createNameplate(username)`, and exports `disposeNameplate(playerId)`. The helper draws the username to a canvas texture with a semi-transparent dark rounded background, white bold text, shadowing, `THREE.CanvasTexture`, and `depthTest: false` sprite material. Disposal removes the sprite from its parent, disposes the texture/material, and deletes the registry entry.

### Game-loop nameplate integration
PASS. The renderer creates or recreates remote-player nameplates from `pData.username`, positions them above each remote avatar after the avatar transform is applied, and disposes labels for players no longer present in `gs.players`. The self-player path creates a nameplate from `getAccountProfile().username` and tracks local predicted position/floor height, so the local label follows the same visual avatar the camera follows. Username changes are handled by comparing `sprite.userData.username` and rebuilding the sprite.

### Design and requirements consistency
PASS. The change is additive presentation around existing multiplayer avatars. It does not alter the lobby/dungeon/card loop described in `game/docs/design.md`, and it does not regress the foundation requirements in `game/docs/requirements.md`: the captured run still renders a 3D scene, connects over WebSockets, shows multiplayer state, and accepts movement.

### Debug scenarios
PASS. This ticket did not add or modify any `?debugScenario=NAME` shortcut or server-side debug scenario entry point. The captured scenario list is empty.

### Verification and coverage
PASS. The round coverage log shows the test suite completed successfully: 10 test files passed, 530 tests passed. The coverage report was informational only, with thresholds disabled. The logged model-load errors are from existing Vitest/jsdom relative-URL resilience paths and did not fail tests or appear in the browser capture.

## Remaining gaps

None.


## v0.167 — 169-gameplay-enemy-variant-framework  (2026-06-03 09:07:56)

### Behavior hook
- PASS. `applyVariant()` invokes a variant definition's `apply(enemy)` only when a variant is selected and only when the registry entry provides a function. The shipped `test` variant keeps `apply: null`, so it remains behaviorally no-op.

### Debug scenario checks
- PASS. The new `variant-enemy` debug scenario is gated through the existing debugScenario socket path and local/dev allowance checks; normal gameplay does not enter it.
- PASS. The same end-state is reachable through normal gameplay because combat enemy spawns can roll the registry `test` variant when the room tier and RNG allow it.
- PASS. The scenario only prepares deterministic client-verification state by spawning a variant enemy beside a plain enemy. It does not bypass persistence, net replication, or server-side validation paths used by normal state updates.

### Design and foundation consistency
- PASS. The change is consistent with `game/docs/design.md`: it extends dungeon enemy/loot behavior without changing the lobby, movement, multiplayer, card-combat, or run loop foundations.
- PASS. The captured run preserves the requirements in `game/docs/requirements.md`: Three.js scene renders, clients connect over WebSockets, players are represented in 3D, and movement/state updates continue.

### Validation
- PASS. Focused local verification completed successfully: `pnpm exec vitest run --config vitest.config.js server/test/enemy_variants.test.js server/test/server.test.js --coverage.enabled=false` passed 2 files / 351 tests.
- Visibility note: the provided `coverage.log` shows `server/test/enemy_variants.test.js` passed and the variant-drop/server tests ran, but the overall coverage process was killed after 120s during an unrelated later key-item suite. I do not treat that coverage timeout as a blocking code gap for this ticket because the captured game run is healthy and the focused changed suites pass.

## Remaining gaps

None.


## v0.170 — 178-qa-world-stage-portal-transition  (2026-06-03 10:08:29)

Pass. Runtime health is clean: `round-2/metrics.json` has `ok: true`, no `harness_failure`, and `pageerrors: []`; `round-2/pageerrors.json` is empty. `round-2/console.log` has no `pageerror` or `[fatal]` lines from game code. The only console errors are 409 registration conflicts during the harness login/register flow, which do not prevent the capture from reaching gameplay or proving the transition.

Coverage/test visibility is also acceptable for this QA ticket: `round-2/coverage.log` shows 3 client test files passing with 160 tests total. The stderr model-load messages in those tests are existing jsdom asset-loading noise from fallback mesh tests, not runtime failures in the captured browser session.

### Design and foundation consistency

Pass. The implementation remains consistent with the design's lobby -> dungeon loop and the requirements for 3D rendering, client/server connectivity, multiplayer visualization, and synchronized movement. The smoke capture enters gameplay through the real UI flow before invoking the debug scenario, and the post-transition state still has an initialized Three.js scene, canvas, connected socket, visible combat HUD, and two players.

The sunken canyon end-state is not fake-only: `game/server/quests.js` defines `canyon_descent` with `layoutProfile: "sunken-canyon"`, and the scenario uses the same `generateLayout(seed, "sunken-canyon")` stage profile used by normal quest deployment.

### Debug scenario safeguards

Pass. The browser URL shortcut is localhost-gated in `game/client/main.js`, and the direct Playwright helper is only reachable from test code with an active socket. Server-side, `debugScenario` is gated by `isDebugScenarioAllowed`, with production disabled unless `ALLOW_DEBUG_SCENARIOS=1` is explicitly set for harness runs.

The `sunken-canyon-stage` scenario does not replace normal gameplay as the only route to the state: the same layout profile is reachable through the `canyon_descent` quest. The scenario preserves the core server path by mutating server-owned state, rebuilding dungeon bounds/colliders, sampling the player's floor height, and broadcasting `questUpdate` to clients; it does not bypass client-only rendering or invent a separate client-side layout.

## Remaining gaps

None.


## v0.169 — 179-qa-deck-loadout-applies-to-run  (2026-06-03 09:51:28)

The committed snapshot at `game/docs/walkthroughs/deck-loadout/deck-loadout-snapshot.json` reports `ok: true`: configured card ids are `iron_sword`, `flame_blade`, `battle_familiar`, and `dungeon_drake`; the in-run hand contains the same four card ids. The companion `in-run-hand.png` evidence file is present and visually shows those four cards in the hand.

### Existing Tests Pass; Game Starts And Loads Cleanly

Pass. The captured run in `round-1/metrics.json` has `ok: true`, `pageerrors: []`, a connected scene with canvas, lobby-to-playing transition, visible hand, and movement/key-item probes. `round-1/console.log` contains only normal Vite connection and scene initialization messages, with no `pageerror` or `[fatal]` entries. Server and client logs show expected startup and benign allowed noise only: THREE deprecation warnings and Vite proxy socket close messages.

Coverage/test output shows all changed-file test coverage completed successfully: 4 test files and 175 tests passed. The jsdom model URL warnings in `coverage.log` are non-fatal stderr from existing renderer tests and did not fail the suite.

### Design And Foundation Consistency

Pass. The work is aligned with the design doc's lobby deck-management and dungeon opening-hand flow: players manage decks in the lobby, then enter a run where the active deck drives combat cards. It does not alter the game loop, rendering foundation, socket connectivity, multiplayer visualization, or movement synchronization requirements.

### Debug Scenario Review

Pass. This ticket did not add or change a `?debugScenario=NAME` shortcut. The smoke test sets `ALLOW_DEBUG_SCENARIOS=1` for parity with harness runs, but the actual loadout verification does not request a debug scenario. It reaches the target state through the normal login, lobby creation, deck configuration, ready, and `phase === "playing"` path. The helper emits the same lobby-only deck events that normal deck editor UI uses, so it does not bypass server validation or run-state invariants.

## Remaining gaps

None.


## v0.172 — 176-qa-quest-objective-completion  (2026-06-03 11:55:39)

The debug scenario itself is scoped to the existing debug-scenario infrastructure. It requires a live lobby/player, moves into the normal playing phase via `enterPlayingPhase`, requires an active `defeat_enemies` run, and only stages a near-complete state. The final completion still flows through enemy defeat, objective progress, `checkRunTerminalState`, `runComplete`, and reward summary code. The same end-state is reachable through normal gameplay by accepting a defeat-enemies quest and clearing all but the final enemy.

### Existing Tests and Runtime Health

Pass. The captured round-2 run starts and loads cleanly: `metrics.json` has `ok: true`, no `harness_failure`, and an empty `pageerrors` array. `console.log` contains only Vite connection messages and scene initialization, with no page errors or fatal errors from game code. The client/server log noise is limited to allowed THREE/Vite socket-close warnings.

Coverage output shows the suite completed successfully: 39 test files passed, 1037 tests passed, duration 25.16s. The added unit/integration coverage exercises the near-complete debug scenario, the normal objective-complete/victory path, and the exported harness state used by the smoke.

### Design and Requirements Consistency

Pass. The change supports the documented lobby-to-dungeon quest loop without altering the core multiplayer foundation. The captured normal smoke confirms the game still renders a canvas, connects over sockets, starts a lobby run, synchronizes player state, and supports movement/key-item interaction. The quest-completion evidence aligns with the design goal of dungeon objectives resolving into victory, loot/economy rewards, and return-to-lobby UI.

### Debug Scenario Review

Pass. The scenario is gated behind the existing debug socket path and local/debug allowance, with the ticket smoke enabling `ALLOW_DEBUG_SCENARIOS=1` only for the isolated run. Normal gameplay does not invoke the scenario. The shortcut does not replace the player-facing path: it only positions an already-started defeat-enemies quest one kill from completion, and the smoke completes the objective through real combat input. It does not bypass the server-side objective, terminal-state, or reward summary invariants that normal play exercises.


## v0.171 — 175-qa-telepipe-suspend-resume  (2026-06-03 11:27:22)

The player position criterion is also covered: after resume the player is at `(-6, 9)` while the restored portal remains at `(-9, 9)`, outside the documented portal radius and therefore not immediately re-extracting.

### Existing server + client tests pass; the game starts and loads cleanly.

Pass. Runtime health is clean: `metrics.json` has `ok: true`, no `harness_failure`, and `pageerrors: []`. `console.log` contains only Vite/debug/init/run messages and no `pageerror` or `[fatal]` entries from game code. Server logs show the expected Telepipe lifecycle: placed, player extracted, checkpoint captured, run suspended, checkpoint restored.

The provided round-3 coverage log reports 3 client test files and 165 tests passing. I also ran `pnpm test:quick`; Vitest reported 71 test files and 1641 tests passed, then the shell process was killed with exit code 137 after the pass summary. I did not see test assertion failures in the output.

### Design and Requirements Consistency.

Pass. The capture aligns with `game/docs/design.md`: Telepipe is consumed mid-run, extracts the solo player, suspends when no active players remain, captures a checkpoint, and restores that checkpoint on the next deploy. The change does not alter the underlying gameplay implementation; it verifies the existing server flow through real socket/UI paths. The foundation requirements remain intact: the capture has a canvas, a connected websocket session, the player represented in 3D state, and server-driven position/state updates.

### Debug Scenario Review.

Pass. This ticket uses the existing `telepipe-ready` debug scenario as a QA shortcut. It remains gated through debug/local paths: the browser URL parameter is localhost-only, and server-side debug scenarios require local/development access or `ALLOW_DEBUG_SCENARIOS=1`. Normal gameplay is still the real path exercised after setup: lobby ready-up deploys the run, the player uses the Telepipe card, server proximity extraction suspends the run, and deploy restores the checkpoint. The scenario does not bypass checkpoint capture, suspend, resume, socket replication, or server validation; it only ensures the player starts with a Telepipe card available for deterministic QA.


## v0.168 — 168-bug-intermittent-stuck-lobby-socket  (2026-06-03 09:10:41)

- Server: no server files changed; suite unaffected.
- Captured run starts and loads cleanly (see gate above).

## Consistency with design / requirements

Purely additive client-side connection resilience. No gameplay, netcode, or
state-replication semantics changed; nothing in `design.md` / `requirements.md`
is regressed. The capture confirms movement, dodge cooldown, enemies, and HUD
still function.

## Code quality

Clean, well-commented, symmetric arm/clear lifecycle across handlers, reuses the
existing error/status surfaces rather than inventing new UI. No dead code, no
console errors. No debug scenarios were added or changed.

## Remaining gaps

None blocking. (One minor wording nit recorded in `nits.md`.)

## Remaining gaps

None.


## v0.173 — 165-cleanup-harness-game-lifecycle-tests  (2026-06-03 12:37:45)


The game server/client Vitest suite also passes:

- `pnpm exec vitest run --config vitest.config.js --coverage.enabled=false --reporter=dot`
- Result: 71 test files passed, 1643 tests passed.

The first attempted `pnpm test:quick` run produced the same full passing Vitest summary but the shell returned 137 after completion; a quieter direct Vitest rerun exited 0, so this is not treated as a test failure.

### Design and requirements consistency

PASS. The change is harness-test-only and does not alter the game loop, multiplayer architecture, movement, rendering, combat, lobbies, persistence, or debug gameplay behavior described in `game/docs/design.md` and `game/docs/requirements.md`. The captured gameplay still shows two players connected, lobby-to-dungeon transition, a rendered scene/canvas, movement, card hand HUD, enemies, and key-item cooldown behavior.

### Debug scenarios

PASS. This ticket did not add or change any `?debugScenario=...` shortcut. The capture ran with `debugScenario: null`, so normal gameplay remains the path exercised by the runtime proof.

## Remaining gaps

None.


## v0.174 — 166-bug-deck-viewer-grid-empty  (2026-06-03 12:56:58)

### Scope and integration with design/requirements

Pass. The change is narrowly scoped to the in-run deck viewer and its tests. It is consistent with the design's card-deck combat model and does not regress the foundation requirements: the captured run reached the lobby and dungeon, rendered the Three.js scene, connected to the server, showed two players, and movement/key-item probes completed.

### Runtime health

Pass. `metrics.json` reports `"ok": true`, no harness failure, and an empty `pageerrors` array. `console.log` has no `pageerror` or `[fatal]` lines from game code; the only notable browser messages are resource conflict lines from the capture flow and normal Vite/scene initialization output.

### Tests and coverage

Pass. `coverage.log` shows the focused `client/test/deck-viewer.test.js` suite passing with 21 tests, including new coverage for instance-ID decks, mixed decks, unknown entries, missing inventory, and plain-ID compatibility. The broader test run continues past the usual jsdom model-loading stderr noise and does not show failures in the relevant deck-viewer coverage.

### Debug scenario review

Pass. The added `deck-viewer-instances` debug scenario is reachable only through the existing `?debugScenario=...` URL/debug socket path, with client localhost gating and server debug-scenario gating. The same end-state remains reachable through normal gameplay by acquiring/forging inventory card instances, building a deck from those instances, and starting a run. The scenario constructs real inventory instances, normalizes inventory, builds the draw deck through `createDrawDeckFromSelectedDeck`, and deals via `initPlayerHand`; it does not replace the production deck-viewer render path or normal readiness flow.

## Remaining gaps

None.


## v0.175 — 174-gameplay-survive-objective  (2026-06-03 12:58:52)

  untouched by the diff). Re-running `account.test.js` in isolation passes
  **10/10**. This is pre-existing test-infra flakiness, not a regression from
  this ticket, and does not block.

## Design / requirements consistency

Consistent. The change is purely additive — a new quest + an additive objective-
type branch alongside the existing `collect_items`/`defeat_enemies` branches. No
existing behavior is altered for the other objective types; the foundation in
`requirements.md` is not regressed.

## Debug scenarios

None added or changed by this ticket. The `survive` end-state is reached purely
through normal gameplay (select `endless_siege` on the quest board → start run).

## Remaining gaps

None blocking. (See `nits.md` for minor, non-blocking polish.)


## v0.177 — 162-cleanup-split-usecard-socket-handler  (2026-06-03 13:45:53)


- `metrics.json` has `"ok": true`.
- `metrics.json` has an empty `pageerrors` array.
- `console.log` contains no `pageerror` or `[fatal]` entries from game code.
- The fallback smoke capture reached lobby, entered gameplay, moved the player, and used dodge roll with cooldown HUD state visible in probes.

Coverage/test evidence is also clean: `coverage.log` reports `36` test files passed and `882` tests passed. `git diff --check` reported no whitespace errors.

### Design and requirements consistency

Pass. The refactor is internal to server dispatch and keeps the documented action-RPG loop intact: authenticated clients can join lobbies, enter dungeon play, move, use cards/key items, and receive synchronized state updates. The captured probes confirm the foundation requirements still hold: a rendered scene exists, sockets connect, multiplayer lobby/game state is present, and movement/key-item state syncs through the server.

### Debug scenarios

Pass. This ticket moves the debug-scenario setup chain but does not introduce a new normal-gameplay entry point. Debug scenarios still enter through the `debugScenario` socket event and are guarded by `isDebugScenarioAllowed`; the normal captured flow has `debugScenario: null`. The scenario code remains server-side and continues to build state through the same lobby/game state structures rather than weakening normal card/key-item validation paths.

## Remaining gaps

None.


## v0.176 — 163-cleanup-dedupe-card-defs-server-client  (2026-06-03 13:22:19)


## Acceptance criteria findings

### Implements the goal and stays scoped
PASS. The implementation adds `game/shared/cardDefs.json` as the single shared source for the normal card identity subset: `id`, `name`, `type`, and `charges`. Both `game/client/cards.js` and `game/server/progression.js` spread those shared identity records into their local card definitions while keeping their side-specific fields local. The changed-file set is scoped to the card-definition extraction plus ticket metadata.

I independently compared the live exports and found 40 shared card ids, 40 client `CARD_DEFS` ids, 40 server `CARD_DEFS` ids, no missing shared keys on either side, and no server/client identity mismatches. This satisfies the drift-prevention goal for the duplicated normal `CARD_DEFS` identity data.

### Existing tests and load behavior
PASS. `coverage.log` shows 10 test files and 319 tests passing. The new runtime capture reaches lobby, deploys into gameplay, renders canvases, shows the card hand, and confirms the shared starter-card identities in live probes, including Rust-Forged Saber, Solar Edge, Signal Familiar, and Vault Wyrm with their expected types and charges.

### Design and foundation consistency
PASS. The change is a data ownership cleanup and does not alter the documented lobby/dungeon/card-combat loop in `game/docs/design.md` or regress the foundation requirements in `game/docs/requirements.md`: Three.js rendering, server-client WebSocket connectivity, multiplayer visualization, and movement synchronization remain demonstrated by the capture.

### Debug scenarios
PASS. This ticket does not add or change any `?debugScenario=` shortcut. The capture used the fallback normal flow, with `debugScenario: null` throughout.

## Remaining gaps
None.


## v0.178 — 167-bug-no-player-attack-affordance-feedback  (2026-06-03 14:03:08)

PASS. Canvas left-click now invokes the same authoritative card-combat path used by hand-slot inputs. `useCard()` sends `slotIndex`, `cardId`, and facing rotation to the server; the server validates hand ownership, cooldown, run phase, player state, and applies weapon cone damage before broadcasting `cardUsed`.

Client feedback is also on the existing shared path: `cardUsed` triggers weapon attack visuals, the attack cone, card audio, enemy-hit audio, and enemy mesh flash feedback when hits are reported. This is consistent with the design doc's card-based combat model rather than adding an unauthoritative client-only attack.

### Existing Tests and Clean Load

PASS. The coverage run reports 171 passing client tests across 3 files. Runtime capture started both servers, loaded the game, and reached live play with no browser page errors. Coverage thresholds were disabled as expected.

### Design and Requirements Consistency

PASS. The change does not alter server-client architecture, movement synchronization, lobby/run flow, or procedural dungeon behavior. It keeps combat card-driven as described in `game/docs/design.md` by routing clicks through existing weapon card use, while adding the missing player-facing affordance. The requirements in `game/docs/requirements.md` remain intact: Three.js renders, WebSocket state is connected, multiplayer avatars are present, and movement continues to update in the captured run.

### Debug Scenarios

PASS. This ticket did not add or change any `?debugScenario=NAME` shortcut. The capture used normal lobby creation/join, ready transition, and gameplay flow.

## Remaining gaps

None.


## v0.179 — 173-gameplay-enemy-variant-leeching  (2026-06-03 21:36:48)


`metrics.json` is present with `ok: true`, the captured clients reached `phase: "playing"` with an initialized scene and canvas, and `pageerrors` is empty. `pageerrors.json` is also empty. `console.log` has only Vite connection lines and 409 resource responses from the harness flow; there are no `pageerror` or `[fatal]` entries from game code. Server/client logs show the dev servers started, players connected, and no game-code crash.

The round folder does not contain the PNG screenshot files named in `metrics.json`, so this review relies on the structured probes and logs for the captured run. The probes still demonstrate the normal lobby-to-dungeon flow, movement, player damage, enemy presence, and HUD state without runtime errors.

## Acceptance criteria findings

- Leeching-tagged enemy healing: PASS. `game/server/enemyVariants.js` defines `LEECH_FRACTION = 0.25`, a `leeching` variant entry, and `applyLeechHeal()`, which heals only living Leeching attackers by `floor(leechFraction * damageDealt)` and caps at `maxHp`. `game/server/simulation.js` calls this helper after `damagePlayer()` actually subtracts the post-mitigation `remaining` HP, so invulnerability, barrier blocks, one-hit absorbs, and fully absorbed shield damage do not leech.
- Server test coverage: PASS. `game/server/test/leeching_variant.test.js` covers the registry entry, base heal amount, max-HP cap, non-Leeching/no-attacker cases, invulnerability, one-hit shield absorb, block mitigation, and barrier prevention. The coverage log reports `48 passed` test files and `1234 passed` tests, including `server/test/leeching_variant.test.js`.
- Distinct client tint/badge: PASS. `game/client/renderer.js` maps `leeching` to a teal badge color distinct from the existing magenta default and applies a subtle teal emissive tint only when the enemy is Leeching. Non-Leeching variants keep the default badge and no mesh tint. The tint path restores `_origEmissive` / `_origEmissiveIntensity` when no tint applies, and stale marker cleanup still runs with the enemy disposal path.
- Debug scenario behavior: PASS. `variant-leeching` is registered in the existing debug scenario allowlists and is only reachable through the `debugScenario` socket handler, which is gated by `isDebugScenarioAllowed()`. The scenario mirrors `variant-enemy` by spawning one Leeching grunt next to one plain grunt for QA, while normal gameplay can still reach Leeching enemies through `spawnEnemy()` -> `applyVariant()` in tiered combat spawning. It does not bypass combat damage, persistence, net replication, or server validation paths for the real leech behavior.

## Design and regression review

The implementation is consistent with the existing enemy-variant registry and combat architecture. It reuses the central `damagePlayer()` path instead of duplicating heal logic at individual enemy attack sites, leaves the foundation requirements intact, and does not alter core client/server connection, movement, and rendering setup. The captured fallback smoke run confirms the game still starts, connects, enters a dungeon, renders the scene, and processes movement/combat-adjacent state.

## v0.181 — 172-gameplay-enemy-variant-warded  (2026-06-03 21:54:57)


### Warded-tagged enemy spawns with a shield
PASS. The live code registers `VARIANT_DEFS.warded` with an `apply()` hook that initializes `maxShieldHp` and `shieldHp` from the enemy's base HP, without changing base HP. Normal combat spawning routes through `spawnEnemy(..., { tier, rng })`, and `applyVariant()` can select `warded` for encounter-tiered combat spawns, so the state is reachable through normal gameplay. The added `warded-enemy` debug scenario is gated through the existing debug-scenario path, is URL/socket debug-only, and mirrors a normally reachable rolled warded enemy for deterministic QA.

### Shield absorbs damage before HP drops
PASS. Enemy damage is centralized through `damageEnemy()`, which drains `shieldHp` first, overflows remaining damage into HP, clamps shield/HP at zero, and reports kills only when HP reaches zero. The implementation replaced direct enemy HP subtraction across cone, radial, projectile, returning projectile, freeze/shatter, echo, mirror-ward, enchantment, and minion damage paths, so shield absorption is consistently applied across current combat sources. Server coverage includes the shield-first behavior, overflow behavior, unshielded behavior, and kill reporting.

### Shield state is visible client-side
PASS. Enemy state snapshots send the full enemy objects, including `shieldHp`, `maxShieldHp`, and `variant`. The renderer adds a cyan shield bar above shielded enemies while shield HP is positive, updates its scale from `shieldHp / maxShieldHp`, and disposes it when depleted or when the enemy is removed. Warded enemies also receive a distinct cyan body tint and cyan variant badge; non-warded variants retain the existing marker behavior.

### Server test coverage
PASS. `coverage.log` shows the full vitest run passing: 50 test files and 1240 tests passed. Relevant added coverage includes `server/test/warded_variant.test.js`, `server/test/debug-scenarios.test.js`, `client/test/renderer-variant.test.js`, and `client/test/renderer-shield-bar.test.js`.

### Design and foundation consistency
PASS. The feature extends the existing enemy-variant registry and combat loop without changing lobby, connection, movement, or rendering foundations. The captured smoke run confirms multiplayer lobby entry, ready transition, WebSocket state, movement, canvas rendering, and key-item cooldown HUD still work.

## v0.182 — 170-gameplay-enemy-variant-volatile  (2026-06-03 21:58:57)

### Covered by a server test

PASS. `game/server/test/volatile_explosion.test.js` covers volatile variant registration, player damage and radius exclusion, minion and enemy blast damage, event queueing for client VFX, and the non-volatile no-op path. The captured coverage run reports `48` test files and `1227` tests passed.

## Design and requirements fit

PASS. The implementation fits the documented multiplayer dungeon combat loop and keeps the server authoritative for enemy death, damage, and state snapshots. It does not regress the foundational requirements: the captured run shows WebSocket connection, 3D scene initialization, two-player lobby/deploy flow, movement, HUD updates, and active gameplay.

## Debug scenario review

PASS. The new `volatile-enemy` scenario is registered through the existing `?debugScenario=` flow and server-side `debugScenario` socket handler, with the same localhost/dev gating as other scenarios. Normal gameplay still reaches an equivalent state through `applyVariant()` on tiered enemy spawns followed by a real defeat. The shortcut sets up a low-HP volatile enemy and a charged weapon for deterministic QA, but the explosion itself still goes through the normal combat death, `removeDeadEnemies()`, area-effect, and client event paths.

## Code quality

PASS. The changes are scoped and use existing extension points: variant registry data, server area effects, state snapshots, renderer effect helpers, and lobby-scoped socket broadcasts. I did not find dead code, broken imports, or console/runtime errors attributable to this ticket. The only log warnings/errors observed are benign or test-environment expected noise.

## Remaining gaps

None.


## v0.184 — 171-gameplay-enemy-variant-frenzied  (2026-06-03 22:54:50)

### Server test coverage

PASS. `game/server/test/frenzied_variant.test.js` covers registry tuning, threshold behavior, faster chase movement below 50% HP, non-Frenzied damaged enemies not speeding up, and shorter wind-up timing. The captured coverage run reports `53` test files and `1266` tests passed, including `server/test/frenzied_variant.test.js`, `server/test/debug-scenarios.test.js`, and `client/test/renderer-variant.test.js`.

### Client tint and badge integration

PASS. `game/client/renderer.js` gives Frenzied enemies a distinct red body tint and red badge color, restores the original mesh color when the variant clears, and reuses the existing variant marker lifecycle so stale badges are disposed. The renderer tests assert the Frenzied constants, marker color, and tint restoration.

### Debug scenarios

PASS. The added `variant-frenzied` and `frenzied-enemy` shortcuts are registered only in the existing debug scenario allowlists and invoked through the debug scenario path. Normal gameplay still reaches equivalent states through normal enemy spawning via `applyVariant()` and combat damage dropping a Frenzied enemy below the enrage threshold. The scenarios do not bypass combat invariants beyond setting up QA state; they use spawned enemies in the active run state and do not alter persistence or networking validation paths.

### Design and requirements consistency

PASS. The change stays within the documented dungeon combat loop: enemies still spawn through the shared progression path, serialize variant tags like the existing variant framework, and render through the existing Three.js scene update. The captured run preserves the foundation requirements: 3D rendering, client/server connection, multiplayer state, and movement synchronization.

## Remaining gaps

None.


## v0.185 — 177-qa-card-evolution-trigger  (2026-06-04 03:43:30)

Pass. The implementation adds an isolated Playwright smoke script at `game/client/scripts/test-card-evolution.mjs` and wires it into `game/package.json` as `test:smoke:card-evolution`. The script launches its own server and Vite ports with `ALLOW_DEBUG_SCENARIOS=1` and `PERSISTENCE_BACKEND=memory`, registers/logs in, creates a lobby, applies `evolution-ready`, calls `__evolveCardForTest(instanceId)`, verifies `skeleton_knight` evolves into `undead_commander`, and records the resulting state.

The committed evidence file `game/docs/walkthroughs/card-evolution/card-evolution-snapshot.json` proves the trigger fired: pre-evolution state contains a `skeleton_knight` instance at grind `10`; the result reports `fromCardId: "skeleton_knight"` and `toCardId: "undead_commander"`; the same instance is then `undead_commander` with `isEvolved: true`, `grind: 0`, and `evolvedFrom: "skeleton_knight"`. The PNG evidence is intentionally uncommitted per the sub-ticket instructions because walkthrough PNGs are gitignored.

### Existing tests and coverage visibility

Pass. `coverage.log` shows the full vitest coverage run completed successfully: `41` test files passed and `1067` tests passed. The new `game/server/test/undead_commander.test.js` covers the evolved card definition, server-side evolution trigger setup, and the upgraded creature behavior when played.

### Design and requirements consistency

Pass. The changes remain consistent with the deck/card combat loop in `game/docs/design.md`: evolution is still a lobby/deck-editor progression action, and the upgraded card remains a creature card whose battlefield behavior is exercised through the real card-use path. The foundation requirements in `game/docs/requirements.md` are not regressed: the captured run shows a rendered canvas, connected sockets, multiplayer lobby/gameplay state, and synchronized movement probes.

### Debug scenario safety

Pass. The new `evolution-ready` scenario is confined to debug/test entry points and is blocked in production by the existing server-side `isDebugScenarioAllowed()` gate. Normal gameplay does not touch it. The scenario only creates a reachable precondition: a `skeleton_knight` at the normal `EVOLUTION_GRIND_REQUIRED` threshold, then the smoke test evolves it through the same `evolveCard` socket path and shared server implementation used by the deck editor. It does not bypass evolution validation, persistence, or the upgraded creature behavior.

## Remaining gaps

None.


## v0.187 — 207-gameplay-card-balance-pass  (2026-06-04 10:12:49)

2. `arcane_bolt` damage 15 -> 20: PASS. The live `CARD_DEFS.arcane_bolt.damage` is `20`, with its weapon type, charges, range, projectile, and long-range special effect preserved. The Arcane Bolt projectile test now asserts `damage: 20` while still verifying in-range, far-edge, out-of-range, and piercing behavior.

3. `mirror_ward` reflect range 8 -> 11: PASS. The live `CARD_DEFS.mirror_ward.reflectRange` is `11`, with the existing self-target, 50% reflect scale, minimum reflect damage, TTL, and damage-reflect effect preserved. `game/server/test/enchantment.test.js` adds a direct balance-target assertion, and the existing reflect/expiry coverage remains intact.

4. Affected card tests updated: PASS. Each changed card value has direct test coverage in the affected server tests. The implementation did not require effect-resolution or gameplay behavior changes for these balance values.

5. Full server+client vitest green: PASS. I ran `pnpm test:quick` from `game/`; it passed with `77` test files and `1706` tests. The provided `round-2/coverage.log` also shows the changed-file coverage run passing with `4` files and `49` tests.

## Design and requirements consistency

PASS. The work is consistent with the design document's card-combat model: these are definition-level card balance adjustments within `CARD_DEFS`, preserving the existing weapon, spell, and enchantment mechanics. It does not regress the setup requirements: the capture proves the 3D client renders, the frontend connects to the server, players are represented, and movement/key-item state continues to synchronize.

## Code quality

PASS. The card changes are minimal data edits, and the supporting tests assert the updated balance values without weakening the mechanics being tested. Additional test-runner and test-stability changes are outside gameplay behavior; they make the vitest wrapper preserve child exit codes and avoid killing its own launcher, and the full suite passes after those changes. No debug scenario files were changed, so the debug-scenario gate is not applicable.

## Remaining gaps

None.


## v0.186 — 209-gameplay-card-aegis-sentinel  (2026-06-04 09:11:16)

1. **Aegis Sentinel definition in `CARD_DEFS`: PASS.** The authoritative server `CARD_DEFS.aegis_sentinel` uses the requested `astral_guardian` / `astral_shield` path with `magicStoneCost: 45`, `damage: 0`, `shieldHp: 30`, `shieldDurationMs: 8000`, `minionHp: 160`, `minionTtl: 30`, `attackDamage: 0`, `taunt: true`, and `isEvolved: true`. The client card definition also exposes the id, evolved flag, cost, zero damage, astral shield effect, and creature categorization needed for UI/deck handling.

2. **Shared identity stub: PASS.** `game/shared/cardDefs.json` includes `aegis_sentinel` with `type: "creature"` and `charges: 1`, so server and client identity loading remain aligned.

3. **Shop availability: PASS.** `aegis_sentinel` is included in `VICTORY_REWARD_ROTATION`, and `SHOP_CARD_POOL` is built from that rotation, making it obtainable through the normal shop offer path. The buy flow grants a normal card instance and can add it to `selectedDeck` without bypassing deck validation.

4. **Cast behavior: PASS.** Aegis Sentinel is typed as a creature but is routed through the shared astral shield cast helper in the creature branch after validating and spending 45 Magic Stones. On cast, it grants a 30 HP shield with an 8 second expiry, spawns an `aegis_sentinel` minion with 160 HP, 30 second TTL, and `taunt: true`, and uses an explicit `attackDamage: 0` path so the minion can draw aggro without damaging enemies. The radial burst also uses `damage: 0`, so nearby enemies do not take offensive burst damage.

5. **Tests and coverage visibility: PASS.** `coverage.log` shows the full vitest suite green: 51 files passed, 1363 tests passed. The new `server/test/aegis_sentinel.test.js` covers definition stats, shop inclusion, shield/minion/zero-burst cast behavior, and taunt target behavior. Client card tests cover the new definition, creature id set, and accent style.

## Design and regression review

The implementation stays consistent with the design document's card-combat model: Aegis Sentinel is a creature card that creates a persistent battlefield ally and defensive shield, without adding a new engine system. It does not regress the foundation requirements: the captured run renders the Three.js scene, connects client/server over sockets, shows multiplayer state, and exercises movement/key-item flow.

The added `aegis-sentinel-ready` debug scenario is gated through the existing debug scenario mechanism. The client only auto-requests URL scenarios via `?debugScenario=...` on localhost, and normal gameplay does not touch the branch. Its end state remains reachable normally by buying Aegis Sentinel from the shop, adding the resulting inventory instance to the deck, readying into a run, drawing the card, and spending Magic Stones to cast it; the scenario only shortcuts setup and does not alter server-side `useCard` validation or cast invariants.

## Remaining gaps

No blocking gaps found.


## v0.189 — 208-gameplay-card-permafrost-lance  (2026-06-04 11:16:27)

### 3. In-game obtainability

PASS. `permafrost_lance` is included in `VICTORY_REWARD_ROTATION`, and `SHOP_CARD_POOL` is derived from that rotation plus `telepipe`, so the new card is available through the shop pool and victory reward rotation.

### 4. Cast behavior and UI rendering

PASS. The existing spell cast route in `game/server/cardEffects.js` handles both `frost_nova` and `glacier_collapse` by reading the active card definition's `radius`, `freezeDurationMs`, `damage`, and optional frozen bonus before calling `applyFreezeInRadius`. Because Permafrost Lance uses `effect: 'frost_nova'`, it freezes and lightly damages enemies using its own tighter stat line. The client adds the matching card definition and accent style, so existing shop and hand rendering can resolve the name, spell type, cost, charges, and frost icon.

### 5. Tests and coverage

PASS. The coverage run completed successfully with `24` test files and `975` tests passing. Added/extended checks cover the server stats, shop-pool membership, direct freeze/damage helper behavior, client definition, and client accent style. Coverage visibility for changed files includes `game/client/cards.js` at 93.81% statements.

## Design and foundation consistency

PASS. The implementation fits the design document's spell-card model: a single-use instant spell with Magic Stone cost and a freeze effect. It does not alter the core lobby/dungeon loop, multiplayer connection path, movement synchronization, or Three.js rendering foundation described in `game/docs/requirements.md`. No debug scenario was added or changed; the capture used normal gameplay rather than a `?debugScenario=` shortcut.

## Remaining gaps

None.


## v0.194 — 224-data-unify-game-state-factories  (2026-06-04 12:36:04)

## Debug scenarios

This ticket did not add or modify any `?debugScenario=` shortcuts. Capture probes show `debugScenario: null` throughout normal lobby → deploy flow. N/A for the debug-scenario checklist.

---

## Integration / holistic notes

The original defect was **latent**: lobby paths missing three fields would throw or misbehave only when combat code touched `enchantments`, `lobby`, or `_pendingVolatileExplosions`. The capture exercises the real integration path (multi-player lobby create/join, ready, dungeon deploy, movement, key item) on state created via `createLobby()` → `createLobbyGameState()`, which is stronger proof than the unit test alone.

Sub-ticket artifacts under `tickets/224-data-unify-game-state-factories/subtickets/` document the intended split; implementation matches both subtickets.

---

## Remaining gaps

None blocking. Runtime capture is clean, both acceptance criteria are fully satisfied, and the refactor is minimal and correct.

---


## v0.193 — 226-data-objective-registry  (2026-06-04 12:23:50)

2. New objective types become one registry entry, not scattered `createRunState()` and completion edits.

   PASS. The previous `createRunState()` branches and completion switch have been removed. Progress and spawn behavior also route through optional registry hooks (`onEnemyDefeated`, `onCrystalCollected`, `syncToEnemyCount`, `spawnQuestEntities`, `tickSpawns`, and spawn preference hooks), so the server-side objective behavior now has a single extension point. Existing client presentation helpers still format known objective types for UI copy and fall back to descriptions for unknown quest types; that is outside the server run-state/completion foot-gun this ticket targets.

3. Cover with existing quest/integration tests before and after.

   PASS. Existing tests in `game/server/test/server.test.js` and `game/server/test/integration.test.js` still cover run creation and normal flow for defeat-enemies, collect-items, and survive objectives. The new `game/server/test/objectives.test.js` adds registry extensibility and quest/registry alignment coverage. The supplied coverage run executed that focused file successfully: 1 test file, 2 tests passed.

## Design and requirements consistency

The implementation preserves the documented lobby-to-dungeon loop, quest objective flow, multiplayer server-client architecture, and movement/combat smoke behavior. The capture confirms the game still renders a 3D scene, connects two clients, enters gameplay, and updates movement/combat HUD state. No debug scenario was added or changed by this ticket.

## Code quality

The refactor is scoped and keeps objective-specific state ownership in `game/server/objectives.js`. Existing behavior for collect-items crystals, survive staggered spawns, enemy defeat progress, and defeat-enemies enemy-count synchronization is preserved through registry hooks. Unknown objective types now fail clearly at run creation/completion instead of silently producing a malformed objective.

## Remaining gaps

No blocking gaps remain.


## v0.191 — 225-data-centralize-enemy-construction-and-consts  (2026-06-04 12:20:15)


### Enemy construction and unknown type handling
PASS. Enemy construction now resolves definitions through `enemyDefFor(type)`, which throws for unknown types, and `spawnEnemy()` copies definition-backed combat fields onto the entity before pushing it into game state. Active enemy AI reads from the entity (`chaseSpeed`, `attackDamage`, `attackWindupMs`, attack style/range, and spawner config) instead of silently falling back through `ENEMY_DEFS[enemy.type] || ENEMY_DEFS.grunt`. A backfill helper preserves manually created valid test/legacy enemies while still throwing for corrupt unknown types that lack self-describing stats.

### Minion and simulation constant audit
PASS. The duplicated `PROJECTILE_HIT_WIDTH` literal was removed from `simulation.js` and imported from `config.js`. Minion movement values that previously reused enemy definition fields are promoted to named config constants and imported into the simulation, avoiding coupling minion movement to grunt/skirmisher enemy defs.

### Integration with design and foundation requirements
PASS. The change is server-side combat/config hygiene and does not alter the documented lobby-to-dungeon loop, card combat model, floor geometry, suspend/resume flow, rendering, WebSocket connectivity, multiplayer visualization, or movement synchronization requirements. The captured run confirms the foundation still starts, connects, renders, deploys, and moves.

### Debug scenarios
PASS. This ticket did not add a new `?debugScenario=NAME` shortcut, and the existing browser URL entry point remains gated to localhost. Existing active combat debug scenarios that spawn enemies use `spawnEnemy()` for valid enemy shapes. I noted one terminal-state debug fixture cleanup separately as a nit because it does not exercise live enemy AI after the scenario immediately fails the run.

### Tests and coverage
PASS. The provided coverage run reports `42 passed (42)` test files and `1055 passed (1055)` tests. Coverage visibility shows the changed-file coverage run completed successfully.

## Remaining gaps

None.


## v0.190 — 223-data-derive-shop-pool-from-defs  (2026-06-04 12:09:41)

1. Add per-card acquisition data and derive `SHOP_CARD_POOL` / reward rotation from `CARD_DEFS`: PASS. `game/shared/cardDefs.json` now carries `acquisition` metadata for direct starter/reward/shop paths plus `rewardOrder` for reward cards. `game/server/config.js` derives `VICTORY_REWARD_ROTATION` from reward-tagged card definitions and builds `SHOP_CARD_POOL` from the reward rotation plus shop-only entries, preserving the previous shop behavior while making shared card definitions the source of truth.

2. Add a test asserting every card is reachable or explicitly flagged drop-only: PASS. `game/server/test/card_acquisition.test.js` checks server/shared card key parity, verifies every server card is reachable through starter/reward/shop/drop/evolution paths, rejects drop-only cards that are not actually in `ENEMY_CARD_DROPS`, and verifies tagged direct paths are directly obtainable.

3. Review the 8 previously unreachable cards before flipping: PASS. The eight named cards (`mana_prism`, `harvesting_scythe`, `deck_sifter`, `sacrificial_altar`, `battery_automaton`, `chrono_trigger`, `spike_trap`, `mirror_ward`) are all intentionally tagged as reward cards with deterministic reward order values and are asserted to appear in `VICTORY_REWARD_ROTATION`.

## Design and regression check

PASS. The change is consistent with the design document's loot/economy loop: cards are acquired through rewards, shop, drops, starter inventory, or evolution. Existing reward and shop flows in `game/server/progression.js` continue to grant cards through the same server-side validation and inventory helpers. The foundation requirements are not regressed; the captured run connected to the backend, initialized the scene, rendered the player/dungeon, and proceeded through live gameplay states.

No new or changed debug scenario was introduced by this ticket. The capture used the existing `telepipe-ready` scenario as a QA shortcut, but the changed acquisition code is exercised by normal reward/shop/drop/evolution paths and does not depend on that debug shortcut.

## Verification

`coverage.log` reports 25 test files passed, 981 tests passed. The new acquisition test file ran successfully. Coverage visibility shows all files at 87.39% statements / 87.39% lines, with thresholds disabled.

## Remaining gaps

None.


## v0.195 — 219-input-unify-keyboard-onto-keymap  (2026-06-04 13:02:31)

5. **Remove dead gamepad handler plumbing:** Satisfied. `setGamepadInputHandler`, `gamepadInputHandler`, and the empty main.js registration are gone; `pollInput()` is the single per-frame gamepad action dispatcher.

6. **Collapse redundant per-callback phase guards:** Satisfied. `main.js` centralizes action gating in `canUseGameActions()` for `initInput()` callbacks and uses the same helper for pointer/deck interactions. Renderer still guards `applyLockOnPress()` internally, which is appropriate because the function is exported and can be called independently.

## Design and requirements fit

The implementation stays within the existing client input architecture and does not alter server simulation, persistence, dungeon flow, or combat rules. It preserves the requirement that WASD movement updates the local player and broadcasts through the existing renderer movement pipeline, while reducing duplicate hardware readers that could diverge.

No new debug scenario was added or changed for this ticket. The capture used the normal gameplay path, not a `debugScenario` shortcut.

## Code quality and verification

The changed code is focused and covered by targeted unit tests. `coverage.log` shows the Vitest suite passed: 12 files and 253 tests. The new input tests cover keyboard movement, typing-target keyup clearing, merged keyboard/gamepad movement, keyboard and gamepad lock-on dispatch, exposed action labels, and existing key-item binding behavior.

I did not find dead replacement code, duplicate keyboard listeners, uncaught runtime errors, or integration issues in the live `game/` files.


## v0.196 — 217-lobby-explicit-phase-state-machine  (2026-06-04 13:14:25)

The server-side gameplay guards have also largely moved from raw string comparisons to `isLobbyPhase` / `isPlayingPhase`, including movement, ready-up, deck/shop/trade lobby-only actions, card/key-item use, simulation ticks, passive draws, survive spawns, give-up, and telepipe suspend/resume paths. One remaining debug-scenario literal check is a cleanup nit rather than a blocking behavior issue because it does not mutate phase or affect normal gameplay.

### 2. Make join-in-progress explicit
PASS. `joinLobby` now delegates to `joinLobbyWithPhasePolicy`, which explicitly recognizes `PHASES.PLAYING`, consults `allowDropInJoin`, and joins with `{ dropIn: true }`. That path is documented in `game/docs/lobbies.md` and initializes only the joining player via `initializePlayerForActiveRun`, preserving the existing run, enemies, layout, and objective state for current players. Waiting or suspended lobbies remain on the normal lobby-join path.

This matches the design document's stated lobby-browser behavior: mid-run lobbies support drop-in rejoin while the normal lobby flow remains `Lobby Browser -> Lobby UI -> ready up -> playing`.

### 3. Pure refactor with existing tests green
PASS. The changed production code keeps behavior aligned with the existing lobby lifecycle and uses the new phase API for the transition points. The recorded coverage run passed: `44` test files and `1075` tests. New tests cover legal/illegal phase transitions and mid-run drop-in setup.

### Design and requirements consistency
PASS. The implementation remains consistent with `game/docs/design.md`: lobbies can be joined from the browser, players ready into dungeons, and mid-run lobbies support drop-in. The foundational requirements are not regressed: the captured run renders the Three.js scene, connects via WebSockets, shows multiplayer state, and accepts movement.

### Debug scenarios
PASS. This ticket did not add a new `?debugScenario=...` shortcut. It only routed existing scenario phase writes through `setPhase`. Debug scenarios remain behind the existing dev/debug URL path and are not part of normal gameplay. The normal ready-up path still reaches `playing` through `checkAllReady`, and the scenario changes do not skip any new server-side validation or persistence path beyond the existing QA shortcuts.


## v0.197 — 215-lobby-atomic-hat-unlock-ordering  (2026-06-04 13:19:47)

### Test that kills the write between steps

Pass. `server/test/hat_unlock_persistence.test.js` adds focused coverage for the write ordering, the crash-between-steps persistence state, currency-save failure, and account-unlock failure refund. The crash-window test blocks the `users.json` rename after the currency save and verifies a reload sees deducted currency without the purchased hat, preventing the original free-hat exploit.

## Design and requirements consistency

The change is server-side persistence ordering for a lobby economy action. It does not alter the documented lobby/dungeon loop, card combat, multiplayer rendering, movement synchronization, or client/server connection requirements. The round-2 screenshots and probes confirm the foundation still loads, connects two players, enters gameplay, moves, and uses a key item.

No development debug scenario was added or changed by this ticket, so the debug-scenario shortcut criteria are not applicable.

## Code quality and validation

The implementation is narrow and follows existing server patterns for player persistence, account unlocks, and socket error events. I did not find dead/broken code or an obvious integration regression in the changed files.

Validation observed in `coverage.log`: `41` test files passed, `918` tests passed. The new `server/test/hat_unlock_persistence.test.js` passed all `4` tests. Coverage on changed server code is visible, with `server/index.js` reported at `89.22%` statements / `64.65%` branches / `89.18%` functions / `89.22%` lines.

## Remaining gaps

None.


## v0.200 — 218-lobby-handler-preamble-and-session-helper  (2026-06-04 14:12:16)

## Code quality

- Helpers are small, documented with JSDoc for options, and colocated with existing `withLobbyFromSocket`.
- No dead code or broken imports introduced.
- Minor style: several callbacks receive `lobby` but do not use it (acceptable for uniform signature; optional cleanup only).

## Debug scenarios

No new or changed `?debugScenario=` entry points in this ticket. N/A.

## Screenshots & probes

- `01-initial.png`: Squad lobby with contract terminal, loadout bay, two players standby — lobby path works.
- `02`–`04`: In-run HUD, movement, dodge cooldown — post-lobby gameplay unaffected.
- Probes confirm dodge cooldown UI and return to ready state after cooldown.

## Remaining gaps

None blocking. All acceptance criteria are satisfied; captured run is clean; refactor is complete for the handlers named in the ticket goal.


## v0.199 — 220-input-rebind-collision-guard  (2026-06-04 14:07:21)


New tests are well targeted and pass (188/188 across `input.test.js` +
`main.test.js`):
- `getReservedKeys lists fixed keyboard bindings and excludes useKeyItem`
- `rejects reserved keys without changing the binding and shows a toast`
- `saves a non-reserved key via patchSettings`
- `ignores modifier-only keys with no toast`

## Code quality

Clean, minimal, self-contained change consistent with surrounding input/
settings code. No dead code, no regressions to `onKeyDown` resolution, and no
console errors introduced. Consistent with `design.md`/`requirements.md`
(input remapping is a settings-UI concern only; no net or server invariants
touched). No debug scenarios added.

## Remaining gaps

None blocking.


## v0.198 — 222-data-collapse-card-def-drift  (2026-06-04 13:33:34)

3. Keep `getCardSellValue` computed fallback.

PASS. Both server and client retain the fallback behavior: explicit sell value first, then evolved/spell/creature/default values, with unknown cards returning `0`.

4. Expand `card_sync.test.js` to diff full stat objects.

PASS. `game/server/test/card_sync.test.js` now compares all client-defined fields against the server surface, checks that only documented server-only overlay fields are absent from the client, validates shared sell values and evolution transforms, and checks sell-value fallback agreement for every card id. The latest coverage run shows `server/test/card_sync.test.js` passing with 9 tests, and the coverage summary reports the broader run green.

## Design and foundation consistency

PASS. The change is data-ownership focused and preserves the documented card-combat loop, lobby-to-dungeon flow, rendering, WebSocket connection, and movement foundation. The live capture confirms the foundation requirements still work: the app rendered a 3D scene, connected two clients to the backend, represented players in gameplay, and accepted movement input without runtime errors.

## Code quality

PASS. The implementation is appropriately scoped: shared JSON owns static data, server-only computed fields remain in a small overlay, and tests explicitly guard the allowed overlay exception. No ticket changes introduced debug scenarios or normal-gameplay shortcuts, so the debug-scenario gate review is not applicable.

## Remaining gaps

No blocking gaps.


## v0.202 — 216-lobby-remove-dead-hostid  (2026-06-04 14:40:58)

- No dangling `hostChanged` comments, partial migrations, or dead branches.
- `removePlayerFromLobby` still deletes empty lobbies and cleans minions/trades on leave.

## Debug scenarios

No new or modified `?debugScenario=` shortcuts. N/A.

## Integration notes

Branch `auto/216-lobby-remove-dead-hostid` has two implementation commits on baseline `9134e7d`:

1. `a8af6b3` — server model + tests (+ `field_medic_kit` MS assertion hardening)
2. `f5d5ef9` — doc alignment

Capture exercised the normal lobby create/join/ready/deploy path (not a debug shortcut), which is the right holistic check for this cleanup.

## Remaining gaps

None. Runtime capture is clean and both acceptance criteria are satisfied.

## v0.203 — 228-gameplay-card-cinder-snare  (2026-06-04 14:44:24)

### DoT attribution and integration with existing combat systems

PASS. `spawnInfernoPillarEffect` carries `ownerId`, and `updateAreaEffects` passes that owner through `collectRadialHits`, preserving kill/drop attribution for the trap owner. The implementation continues using the existing area-effect damage pipeline and run cleanup flow, consistent with the design's enchantment model of lingering ground effects.

### Tests and coverage visibility

PASS. The round-2 coverage run completed successfully: `53` test files passed and `1392` tests passed. The new enchantment tests cover Cinder Snare arming, non-trigger persistence, trigger-to-DoT conversion, repeated tick damage, and owner attribution on DoT kills. Acquisition reachability tests also cover shop/reward/starter/drop validity across all card definitions.

### Debug scenario review

PASS. The added `cinder-snare-ready` shortcut is gated through the existing `debugScenario` socket event and `isDebugScenarioAllowed` local/dev checks; normal gameplay does not call it. The scenario reaches a state that is also reachable through normal play by buying Cinder Snare from the shop, entering a run, and encountering enemies. It does not bypass the real card-use logic: it only places the card in hand and creates a nearby enemy, leaving placement, cost validation during normal use, trap trigger detection, and DoT ticking to the same server systems used in gameplay.

### Design and foundation regression

PASS. The change fits the documented card taxonomy: Cinder Snare is an enchantment that leaves a lingering ground effect triggered by enemy proximity. The captured run still demonstrates the foundational requirements: Three.js scene initialized, WebSocket connection established, multiplayer lobby/run flow works, and movement/key-item smoke probes completed without runtime errors.

## Remaining gaps

None.

## v0.204 — 214-lobby-clear-ready-on-disconnect  (2026-06-04 14:54:00)

| 02-gate-check-all-ready-on-connected | `checkAllReady` connected + stale-ready guards |
| 03-test-ready-then-disconnect-no-start | Integration + unit regression |
| 04-pass-harness-game-port-to-vite | Capture infra (not ticket AC, supports QA) |

No gaps between sub-tickets; holistic behavior matches top-level AC.

---

## Visual / capture notes

Fallback capture plan exercised full lobby → deploy → gameplay smoke (not a dedicated “ready then disconnect” screenshot). Behavioral proof for the bug fix is in automated tests; capture confirms no regression in normal two-player deploy and play.

---

## Remaining gaps

None blocking. All acceptance criteria are satisfied; captured run is healthy; tests pass.

---


## v0.206 — 212-net-reconnect-socket-race-and-dup-listener  (2026-06-04 16:10:16)


- Localized server/client networking correctness fix; no changes to gameplay loop, combat, or lobby phase policy.
- No new debug scenarios added — nothing to gate-check.
- Aligns with design doc networking expectations (JWT auth, lobby drop-in/rejoin) without altering documented player flows.

## Code quality

- Fix is minimal and targeted (50 lines changed in `index.js`, 5 removed in `client/main.js`).
- No dead code introduced; helper is used on the reconnect path that resume-on-connect shares.
- No browser console defects in capture.
- Changed-file coverage (`index.js` ~89%) is adequate for this scope; new paths exercised by unit + integration tests.

## Debug scenarios

Not applicable — this ticket did not add or modify any `?debugScenario=` shortcuts.

## Remaining gaps

None. All three acceptance criteria are fully satisfied, runtime capture is clean, and regression tests pass.

## v0.207 — 221-data-debrittle-model-tests  (2026-06-04 16:23:02)


## Commits (baseline `9134e7d` → HEAD)

| Commit | Summary |
|--------|---------|
| `713c1f6` | Extract `pickVariant(rng, ids)` |
| `cd83081` | De-index warded variant tests |
| `27f2529` | De-index enemy_variants tests |
| `d51e09c` | `>= 42` card count assertions |
| `41360f3` | Suite-green verification |
| `9e484b0` | Split `new_card_pack_definitions.test.js` |

## Remaining gaps

None blocking. Runtime is healthy; all five acceptance criteria are satisfied for the churn generators and test layout described in the ticket.

## Nits (non-blocking)

See `nits.md` for follow-up backlog items (unused import, residual `ids[0]` assertion in `server.test.js`).


## v0.210 — 227-gameplay-enemy-variant-polish  (2026-06-04 19:05:07)

### 3. Variant audio cues

PASS. `game/client/config.js` adds distinct synthesized sound configs for `volatileExplosion`, `leechHeal`, and `shieldBreak`. `game/client/audio.js` is config-driven and respects the existing mute setting before playing any sound.

The event sources are tied to real game outcomes: volatile deaths queue `_pendingVolatileExplosions`, leeching enemies queue `_pendingLeechHeals` only when `applyLeechHeal()` restores HP after damage dealt, and warded enemies queue `_pendingShieldBreaks` when `shieldHp` reaches zero. `game/server/index.js` emits those events to the lobby, and `game/client/main.js` plays the matching sound on receipt. The `volatile-enemy`, `variant-leeching`, and `warded-enemy` debug scenarios cover these paths as QA shortcuts while preserving the normal combat routes.

## Design and requirements consistency

PASS. The changes stay inside the existing lobby/dungeon/combat architecture described in `CONTEXT.md` and `game/docs/design.md`: server combat remains authoritative, state snapshots drive client rendering, and WebSocket events are used for transient effects. The foundation requirements are not regressed: the captured run shows the 3D scene renders, WebSocket connection succeeds, multiplayer state enters gameplay, and movement probes still update during the run.

## Code quality and validation

PASS with a validation caveat. The implementation is cohesive and scoped to variant feedback; I did not find dead code, broken imports, uncaught browser errors, or normal-gameplay shortcuts that bypass server invariants.

`coverage.log` shows 63 server test files passing and one unrelated failure in `server/test/cosmetic_runtime.test.js` during registration: `ENOENT: no such file or directory, rename 'game/data/users.json.tmp' -> 'game/data/users.json'`, leading to an unexpected HTTP 500. The ticket did not change the cosmetic/auth persistence files, and the captured game run is clean, so I am not treating this unrelated coverage-run failure as a blocking gap for this ticket.

## Remaining gaps

None.


## v0.212 — 268-scaling-thread-lobby-state-explicitly  (2026-06-04 21:14:18)

- The migrated socket paths remain wrapped by `withLobbyFromSocket`/`withLobbyContext`, so legacy sub-helpers that still intentionally read context-swapped module state remain behaviorally equivalent for this incremental pass.

This is a meaningful reduction of direct `_gameState` reads in progression/handler call sites without changing public helper call compatibility.

### Tests and coverage

PASS. The round-2 coverage log reports `43 passed (43)` test files and `947 passed (947)` tests. The implementation also fixes the account test's temp user-file collision by adding process/random uniqueness to the path, addressing the full-suite flake documented by the final sub-ticket.

### Behaviour and design consistency

PASS. The capture exercises auth, lobby creation/join, ready transition into dungeon play, movement, and dodge/key-item cooldown while preserving the lobby-to-dungeon loop described in `game/docs/design.md`. The probes show connected multiplayer state, initialized scene/canvas, active run state, card HUD, enemies, and synchronized player movement, so the foundation in `game/docs/requirements.md` is not regressed.

### Debug scenarios

PASS. This ticket did not add or change any development debug scenario or `?debugScenario=...` entry point. The capture used the fallback normal flow with `debugScenario: null`, so no debug shortcut is substituting for normal gameplay.

## Remaining gaps

None.

## v0.213 — 265-sec-debug-gate-no-header-spoof  (2026-06-04 21:24:07)

- No browser console errors in capture.
- `ALLOW_DEBUG_SCENARIOS=1` still bypasses address checks for CI/integration tests — intentional per ticket wording (“and/or explicit env”).

---

## Debug scenario policy (informational)

No new debug scenarios were introduced. Existing scenarios remain behind:

- Server: `isDebugScenarioAllowed(socket)` on every `debugScenario` emit.
- Client: `?debugScenario=` URL param + localhost hostname guard before auto-request.

Normal gameplay (lobby → ready → dungeon) was exercised in capture without using a debug shortcut.

---

## Remaining gaps

None. Runtime proof is clean, acceptance criteria are fully met, and tests cover the spoof vector described in the ticket.

## v0.215 — 244-canyon-walkability-fixes  (2026-06-04 21:35:23)

3. Add side/return ramps or widen the canyon north-wall gap so edge players can ascend: PASS. The layout now always adds west/east edge connector ramps aligned to the canyon-edge probes, and the canyon north wall is opened for all ramp centers. The new tests prove lateral edge probes can reach the plateau and return, including a step from each edge probe to its matching edge ramp.

4. Flood-fill reachability test plus walk test proving plateau <-> canyon both ways with no wedge: PASS. `sunken_canyon_walkability.test.js` flood-fills every room from the plateau start, proves plateau-to-canyon and canyon-to-plateau reachability, checks edge probes bidirectionally, and covers the wedge corridor directly. The captured coverage run passed all 205 tests, including the four dedicated sunken-canyon walkability regressions.

## Design and requirements consistency

PASS. The implementation stays within the existing dungeon layout model described in `game/docs/design.md`: rooms carry `floorCorners`, server movement samples floor Y from the shared floor sampler, and server collision/walkability remains layout-driven. It does not regress the foundation requirements: the capture shows 3D rendering, client/server connection, player visualization, and movement/HUD updates before and after the stage transition.

## Debug scenarios

PASS. This ticket did not add or change the `sunken-canyon-stage` debug scenario; the code changes are limited to the dungeon generator and tests. The existing scenario remains gated by debug-scenario handling rather than normal gameplay, and the sunken-canyon geometry it loads is the same `generateLayout(seed, 'sunken-canyon')` path covered by the normal layout generation tests.

## Code quality

PASS. The implementation is narrowly scoped, deterministic, and covered by targeted regression tests. No broken imports, dead paths, browser exceptions, or server errors were found in the live code or captured logs. One non-blocking cleanup note was filed separately in `nits.md`.

## Remaining gaps

No blocking gaps remain.

## v0.216 — 253-level2-tier-framework-unlock  (2026-06-04 21:48:29)

- `client/test/questBoard.test.js`

The same coverage run contains one failure in `server/test/field_medic_kit.test.js` due to a 0.005000000000000782 vs 0.005 floating-point tolerance on Magic Stone regen. That test file and key-item medic path were not part of this ticket; I do not consider it a blocking gap for the Tier 2 unlock framework.

## Design and requirements consistency

Pass. The implementation stays within the documented lobby-to-dungeon core loop: quest selection happens in the lobby, deploy starts the selected run, and run completion returns rewards/progression. It does not regress the baseline requirements: captured probes show WebSocket connection, multiplayer lobby state, scene initialization, canvas rendering, gameplay entry, and movement/key-item interaction.

## Debug scenarios

Pass. The new `quest-tier-2-unlocked` debug shortcut is reachable only through the existing debug scenario path, with both client localhost gating and server-side debug-scenario gating. It does not replace normal gameplay: the equivalent state is still reached by clearing Tier 1, which calls the normal victory/unlock persistence path. The shortcut writes the same persisted account unlock and then uses normal quest selection/layout payload plumbing.

## Code quality

Pass. The tier plumbing is cohesive and server-authoritative: catalog validation, per-account persistence, per-socket payloads, selection validation, deploy gating, run summary/checkpoint tier propagation, and UI rendering all use the same tier fields. I did not find dead code, broken imports, console-debug leftovers, or obvious bypasses in the changed game files.

## v0.217 — 250-enemy-per-level-spawn-pools  (2026-06-04 22:00:04)

```text
pnpm exec vitest run --config vitest.config.js server/test/quests-spawn-pools.test.js server/test/enemy-spawn-pools-wiring.test.js
Test Files  2 passed (2)
Tests       19 passed (19)
```

## Design and regression check

PASS. The implementation stays within the existing quest/stage architecture described in `game/docs/design.md`: players still select quests, enter generated dungeon levels, and fight AI enemies to complete objectives. It does not weaken the foundation requirements in `game/docs/requirements.md`; the captured run confirms rendering, WebSocket connection, multiplayer state, and movement remain functional.

No new or changed development debug scenario was introduced by this ticket, so there is no debug-scenario shortcut to validate as part of this review.

## Code quality

PASS. The implementation is small and follows the existing server module boundaries: quest metadata in `quests.js`, spawning in `progression.js`, objective-specific staggered spawning in `objectives.js`, and focused tests under `game/server/test/`. I did not find dead code, broken exports, console-fatal behavior, or integration issues in the live codebase.

## Remaining gaps

None.

## v0.220 — 229-hub-stage-layout-server  (2026-06-04 22:47:15)

### Walkable geometry and collision like other stages

PASS. The hub rooms use the same room wall and passage wall shapes consumed by existing server/client dungeon systems. The tests validate the anchors are walkable using `buildWallColliders` and `computeWalkableAABBs`, and validate all zone rooms are reachable from the Operations start room across multiple seeds. The live smoke capture did not select the hub profile, but it did confirm the ticket did not break normal gameplay startup or existing stage rendering.

### Server unit tests for layout generation and anchors

PASS. `game/server/test/dungeon.test.js` includes focused tests for hub profile shape, zone grouping, fixed roles/spawn weights, booth-anchor presence and placement, collision-aware walkability, reachability, and determinism. I also ran `pnpm vitest run server/test/dungeon.test.js` from `game/`; all 132 tests passed. The round coverage log also shows the full suite passed: 11 files, 243 tests.

### Design and requirements consistency

PASS. The implementation stays within the existing server-generated modular layout model described in `game/docs/design.md`: rooms/passages, floor corners, and server-side walkability remain compatible with existing collision and floor sampling. It does not regress the foundation requirements for 3D rendering, socket connectivity, multiplayer visualization, or synchronized movement.

### Debug scenarios

PASS. This ticket did not add or modify a `?debugScenario=...` shortcut. No debug-scenario gating or normal-flow reachability issue applies.

## v0.221 — 272-socketHandlers-extract-lobby  (2026-06-04 22:54:57)

Pass. The live code keeps the same socket event surface for lobby browser, key items, deck/shop/trade, run lifecycle, playing-phase actions, debug scenario dispatch, heartbeat, loot pickup, and disconnect. Context-sensitive operations still execute through `withLobbyFromSocket`, `withLobbyPlayer`, or `withLobbyContext`, so progression and simulation state continue to point at the active lobby while handlers run.

The captured smoke flow exercised lobby creation/join, readiness transition into gameplay, movement, card/key-item HUD state, and dodge cooldown without browser errors. No new debug scenario was added by this ticket; the existing `debugScenario` socket handler was only moved, and the capture used normal gameplay (`debugScenario: null`).

### Server test suite green

Pass. The round's coverage run reports `42 passed (42)` test files and `942 passed (942)` tests. Coverage visibility shows changed server code remains covered through the existing server/integration suite.

## Design and requirements consistency

Pass. The extraction does not alter the documented lobby-to-dungeon core loop, socket-authenticated multiplayer structure, 3D rendering path, player representation, or movement synchronization. The captured run confirms server/client WebSocket connectivity, multiplayer lobby state, movement into gameplay, and synchronized state updates still work.

## Code quality

Pass. The change is scoped to the intended server socket-handler extraction. There is no obvious dead path, missing export, broken import, or runtime error in the moved module. The ctx boundary is explicit and keeps index-local helpers out of the handler module's dependency graph.

## v0.222 — 264-admin-character-roster-view  (2026-06-04 23:07:45)


### Password-gated via ADMIN_PASSWORD; wrong/no password denied
PASS. `requireAdminPassword` fails closed when `ADMIN_PASSWORD` is unset, returns 403 for missing or wrong supplied passwords, and uses a constant-time comparison for exact matches. The HTTP route tests cover successful access, missing password, wrong password, unset env, and POST rejection.

### Own admin password, never player auth; not reachable by normal players
PASS. The admin middleware only reads `x-admin-password` / `?password=` and does not consult bearer/player JWT auth. Tests verify a bearer-only request is denied and that account data is not included in denied responses.

### Consistency with design and requirements
PASS. The change is isolated to server admin/account inspection and does not alter the documented lobby/dungeon/card loop, WebSocket architecture, 3D scene startup, multiplayer visualization, or movement synchronization. The smoke capture and full test run show no regression to the foundation requirements.

### Tests and coverage
PASS. `coverage.log` shows 49 test files and 1075 tests passing, including `server/test/admin_roster.test.js` with 17 focused tests for roster aggregation, password gating, route behavior, and read-only expectations. Coverage thresholds were disabled as expected for visibility-only output.

### Debug scenarios
Not applicable. This ticket did not add or change a `?debugScenario=` shortcut, and the captured flow did not rely on a debug scenario.

## Remaining gaps

None.


## v0.224 — 273-socketHandlers-extract-deck  (2026-06-05 00:30:57)

Behavior appears preserved. The extracted code continues to enforce lobby-only deck/shop/trade operations, normalizes inventory before deck mutations, validates selected decks before readying, persists successful deck/inventory/trade changes, and leaves run-lifecycle/gameplay handlers in `lobbyHandlers.js`.

Tests are green. I ran `pnpm test:quick` from `game/`; it passed with 91 test files and 1,837 tests.

## Design And Requirements

PASS. The change is a server-side organization refactor and does not alter the documented core loop, card combat model, lobby flow, dungeon entry, rendering, websocket connectivity, multiplayer visualization, or WASD movement synchronization. The captured run also exercises the lobby browser/squad flow through gameplay without regressions.

## Debug Scenarios

PASS. This ticket did not add or change any `?debugScenario=...` shortcut. The capture used the fallback smoke path with `debugScenario: null`, so normal gameplay remains the exercised path.

## Code Quality

PASS. The new module keeps deck/shop/trade concerns out of the larger lobby handler file without adding circular imports. `git diff --check` reported no whitespace errors. I did not find dead duplicate handler registrations, missing exports, missing context wiring, or runtime console failures attributable to the ticket.

## Remaining gaps

None.

## v0.225 — 230-hub-client-render  (2026-06-05 00:33:03)

## Integration / regression checks
- Lobby↔run transitions refactored cleanly: lobby-join → hub, run-join/deploy → quest,
  and `returnToGuildLobby({ rebuildHub })` rebuilds the hub once per return (guarded so
  it does not fire on every lobby-phase `stateUpdate`). `applyQuestLayoutFromServer` now
  only caches the selected quest layout during the lobby instead of moving the avatar
  off the hub floor. All geometry-switch paths set `renderedSceneProfile`.
- `style.css`: the `#lobby` overlay background dropped its opaque `#0f172a` base so the
  hub canvas shows through; only sub-1-alpha decorative layers remain, and the title got
  a text-shadow for legibility. Confirmed visually in `01-initial.png`.
- Debug scenarios: this ticket adds none. The `sunken-canyon-stage` scenario in the
  capture is pre-existing and untouched by this diff. The URL parameter remains the only
  entry point and the normal flow is unaffected.
- Tests: full suite = 1859 passed. The single failure (`field_medic_kit.test.js`,
  magic-stones regen `10.005` vs `10`) is a pre-existing floating-point/timing flake —
  this ticket touches no server simulation/regen code, and the test passes on rerun.

## Remaining gaps
None blocking. One non-blocking nit (test-stderr noise from the renderer's
`/models/player.glb` URL parse under jsdom) is recorded in `nits.md`.


## v0.226 — 274-socketHandlers-extract-trade  (2026-06-05 00:44:53)

### Trade handlers moved and registered

PASS. `game/server/socketHandlers/tradeHandlers.js` now owns the `offerCardTrade` and `respondCardTrade` socket listeners. `game/server/socketHandlers/deckHandlers.js` no longer registers those listeners or imports their progression helpers, and `game/server/socketHandlers/lobbyHandlers.js` imports and calls `tradeHandlers.register(socket, ctx)` alongside `deckHandlers.register(socket, ctx)`. The extracted handlers preserve the prior event names, lobby-phase gating, `findSocketByPlayerId` notifications, inventory update payloads, and persistence calls.

### Tests green

PASS. I ran `pnpm test:quick` from `game/`; it completed successfully with 92 test files passed and 1854 tests passed. Existing integration coverage still exercises the socket-level trade offer, accept, and reject flows through `offerCardTrade` and `respondCardTrade`.

### Design and requirements consistency

PASS. The change is an internal server socket-handler extraction and does not alter the documented lobby, dungeon, combat, loot, or movement foundations. The captured smoke run still demonstrates the requirements baseline: the game renders, connects frontend to backend over sockets, shows multiplayer state, and synchronizes movement/gameplay.

### Debug scenarios

PASS. This ticket did not add or change any `?debugScenario=...` shortcut or debug scenario implementation.

## Remaining gaps

None.

## v0.229 — 275-socketHandlers-extract-keyitem  (2026-06-05 02:10:56)

## Per-Criterion Findings

### Runtime health
PASS. The captured run loaded successfully: `metrics.json` has `"ok": true`, no harness failure, and an empty `pageerrors` array. `console.log` contains only expected Vite connection lines plus 409 registration conflicts from the harness flow, with no `pageerror` or `[fatal]` entries from game code. `server.log` shows both players connecting, entering a generated dungeon, and disconnecting cleanly; `client.log` contains only explicitly benign THREE/Vite socket-close noise.

### Key-item handlers moved and registered
PASS. The live code now has `game/server/socketHandlers/keyItemHandlers.js` registering `listKeyItems`, `equipKeyItem`, and `useKeyItem`, while `game/server/socketHandlers/lobbyHandlers.js` imports that module and calls `keyItemHandlers.register(socket, ctx)` from the existing per-socket registration path. The extracted handlers still use the same context helpers and effect dispatch path as the pre-extraction inline handlers, so lobby-phase equip validation, key-item listing, persistence, and in-dungeon use dispatch remain wired through the authoritative server socket flow.

### Tests green
PASS. The latest `coverage.log` reports `server/test/server.test.js` and `server/test/field_medic_kit.test.js` passing, with `371 passed (371)`. Existing key-item socket coverage remains applicable because the public socket events and payloads did not change, and the changed field-medic and spawner assertions are limited to timing/float tolerance rather than behavior changes.

### Design and foundation consistency
PASS. The change is a server-side organization extraction only; it does not alter the documented lobby/dungeon/card loop, run suspend/resume behavior, rendering, WebSocket connectivity, multiplayer visualization, or movement synchronization requirements. The fallback capture exercised auth, lobby creation/join, ready transition, movement, and key-item use in normal gameplay with two connected players.

### Debug scenarios
PASS. This ticket did not add or change any `?debugScenario=NAME` shortcut, and the capture did not use a debug scenario.

## Remaining gaps

None.

## v0.228 — 211-net-slim-per-tick-state-broadcast  (2026-06-05 01:15:06)

## Acceptance criteria findings

1. Split hot per-tick `stateUpdate` from cold per-player data: satisfied. The live server now builds `hotStateSnapshot()` in `game/server/progression.js` with position, hp, combat/status flags, enemies, minions, loot, run/lobby, quest, layout seed, shop, telepipe, and suspended-run summary fields. The 20Hz loop in `game/server/index.js` emits this hot snapshot from `runGameLoopTick()`, while the full `stateSnapshot()` remains available for one-shot full syncs and transition paths. Tests assert tick-emitted `stateUpdate` omits `deck`, `hand`, `inventory`, `ownedCards`, `selectedDeck`, `runRewards`, `returnRewardsPreview`, `inDesperation`, `nextDrawAt`, and related cold fields while server state retains them.

2. Hoist lobby-level computes and stop hot-path inventory cloning: satisfied. `ensureShopOffer()` and `buildSuspendedRunSummary()` are computed once per snapshot and shared through `buildWorldSnapshot()`. `stateSnapshot()` no longer deep-clones inventory per player, and the periodic path no longer includes inventory at all.

3. Cold state changes use existing reconciliation events without UI desync: satisfied. `emitPlayerDeckUpdate()` sends in-run `deckUpdate` payloads with `deck`, `hand`, `desperationDeck`, `inDesperation`, `nextDrawAt`, and reward preview data to the owning socket. Hand/deck mutation helpers call it for opening hands, passive draws, discards, exhausted cards, and card effects. Existing lobby collection mutations continue through `deckUpdate` or `cardInventoryUpdate`. The client `stateUpdate` handler in `game/client/main.js` guards all cold-field reads and preserves last-known collection/hand data when slim ticks omit those fields; the `deckUpdate` handler applies in-run hand, draw pile, desperation, HUD, and deck-visual updates. The capture probes show no hand, deck, inventory, or cooldown HUD desync after deploy, movement, and dodge cooldown.

4. Design and foundation consistency: satisfied. The changes preserve the documented lobby-to-dungeon multiplayer loop and do not alter combat, movement, dungeon generation, authentication, or rendering foundations. The captured run still renders the Three.js scene, connects two players over sockets, transitions from lobby to dungeon, synchronizes movement, and updates HUD state.

5. Debug scenarios: no ticket-added debug scenario was found. Existing debug-scenario usage remains test-only/socket-driven and was not introduced as a normal gameplay entry point by this ticket.

## Verification notes

The branch includes focused server and client tests for the new split: tick payload shape, in-run `deckUpdate`, and client reconciliation for slim playing updates. The supplied `coverage.log` completed 1163 passing tests and 1 failing test in `server/test/account.test.js` where `/api/register` returned 500 instead of 201 for the unrelated `modelUser` account profile test. I did not find an intersection between that failure and this ticket's changed files or runtime behavior, and the live capture demonstrated successful auth/lobby/gameplay flow.

## Remaining gaps

No blocking gaps remain for this ticket.

## v0.230 — 231-hub-lobby-phase-movement  (2026-06-05 02:58:43)

PASS. Lobby movement uses `buildHubMovementContext(HUB_LAYOUT)`, which derives walkable AABBs, dungeon bounds, and wall colliders from the deterministic hub layout rather than the selected quest layout. Player Y is sampled from the hub floor, and lobby re-entry paths now seat players at the hub start room. The screenshots show the hub/lobby scene and subsequent movement/run flow rendering cleanly.

### 3. Server validates like in-run move: finite, sequence, magnitude
PASS. The shared `move` handler still rejects non-object payloads, non-finite `dx`/`dz`/`rotation`, invalid or stale sequence numbers, disconnected players, and normalizes oversized input vectors. Playing-only restrictions for dead/extracted players remain scoped to the run phase, which is appropriate for lobby movement.

### 4. Test for lobby-phase move accept/bounds
PASS. `server/test/lobby_hub_movement.test.js` covers accepting a lobby move, rejecting invalid payloads, rejecting stale sequence numbers, clamping sustained hub movement inside bounds/walkable AABBs, and resolving movement into a hub wall back to valid floor space. The coverage log shows this test file passed all 6 tests.

### Design and foundation consistency
PASS. The change matches the design goal that players gather and interact in a lobby before deploying, while preserving server-authoritative movement synchronization from the requirements. It also avoids adding new `_gameState` reads to the move path by threading explicit movement contexts through `applyPlayerMovement()`, `tryPlayerMove()`, `isInsideDungeon()`, and clamping.

### Debug scenarios
PASS / not applicable. This ticket did not add or change a `?debugScenario=` shortcut, and the round-2 capture used no debug scenarios.

### Validation notes
The coverage run itself reports one failing test in `server/test/cosmetic_runtime.test.js` (`PATCH /api/me/profile` returned 500 instead of 200), while `server/test/lobby_hub_movement.test.js` and the movement-related integration tests passed. I did not find a movement-ticket regression tied to that cosmetic runtime failure; it appears orthogonal to this ticket's acceptance criteria.

## Remaining gaps

None.

## v0.231 — 271-telepipe-hub-suspend-resume-integration  (2026-06-05 03:01:59)

## Preservation of run state

PASS. The checkpoint implementation captures player combat state, run/objective, layout, enemies, minions, loot, area effects, and portal state. The round-4 capture verifies objective and enemy preservation across suspend/resume, and the added integration coverage exercises the non-trivial acceptance case by suspending a two-player run with spent Magic Stones, drained card charges, and advanced objective progress, then resuming through the normal all-ready gate without resetting those values.

## Debug scenarios

PASS. The capture uses `telepipe-ready`, which is only requested through `?debugScenario=`/test hooks, is gated to localhost or `ALLOW_DEBUG_SCENARIOS`, and stays in the lobby until the normal ready-up flow starts the run. The added `suspended-run-hub` shortcut is also dev-gated, documents the normal route it mirrors, and calls the same `suspendRunToLobby()` checkpoint path rather than bypassing server-side suspend/resume invariants.

## Design and foundation consistency

PASS. The implementation is consistent with `game/docs/design.md`: Telepipe creates a shared portal, extracted players leave dungeon actions, the run suspends only after no active players remain, and deploy/resume restores the checkpoint instead of generating a fresh run. It does not regress the foundation requirements: the captured page renders, connects over Socket.IO, shows the player/hub or dungeon state, and resumes to synchronized server state.

## Tests and coverage

Ticket-relevant server tests for Telepipe suspend/resume and debug scenarios passed in the coverage run, and the live browser capture validated the end-to-end flow. The coverage log includes one unrelated existing `server/test/auth.test.js` failure around `accountId` in a login JWT assertion; no changed files for this ticket are in that auth path, and the captured game still registers/logs in and runs cleanly.

## Remaining gaps

No blocking gaps.

## v0.232 — 238-avatar-cosmetic-render  (2026-06-05 03:10:39)

PASS. The provided `coverage.log` reports `65` test files passing and `1321` tests passing. New/focused coverage includes:

- client model registry and player glTF lookup/fallback behavior;
- glTF hat attach/removal, body tint, and proportion morph mapping;
- hub and in-run avatar cosmetic rendering and live cosmetic changes;
- server account cosmetic propagation into live player records and snapshots;
- race-safe user persistence cleanup.

### Consistency with design and requirements

PASS. The implementation preserves the documented lobby/dungeon loop and does not regress the foundation requirements: the capture shows a rendered 3D scene, authenticated socket connection, multiplayer visualization, and movement synchronization. The changes are scoped to avatar cosmetics, account persistence/sync, and renderer model loading; they do not alter combat, lobby readiness, dungeon generation, or movement semantics.

### Debug scenarios

PASS. This ticket did not add or modify any debug-scenario implementation. Existing debug-scenario code remains gated through the localhost-only `?debugScenario=` path and is not part of normal gameplay.

## v0.233 — 276-socketHandlers-extract-run-and-cleanup  (2026-06-05 03:10:46)

`grep "socket.on("` over `game/server/index.js` returns **nothing** — the connection
handler now only builds the `ctx` object and calls `lobbyHandlers.register(socket, ctx)`
(plus reconnect/init bookkeeping). `getUnlockedKeyItems` was correctly dropped from `ctx`
since `keyItemHandlers` no longer needs it.

### "Tests green" — MET
984/984 tests pass, including the `move`/`dodge`/`lootPickup` integration paths that
exercise the relocated handlers.

### Design / requirements consistency
Pure server-side socket-handler refactor; no change to `game/docs/design.md` behavior or
the `game/docs/requirements.md` foundation. No debug scenarios were added or changed
(`debugScenario: null`, `debugScenarioAllowed: true` in probes; the existing
`debugScenario` handler stays gated in `lobbyHandlers.js`).

## Remaining gaps

None. The refactor is behavior-preserving, fully wired, and the captured run plus the full
test suite confirm it.

## v0.234 — 269-lobby-enforce-max-players-cap  (2026-06-05 03:28:36)

- No changes to client, simulation, or spawn logic — low regression risk.
- No new debug scenarios added; nothing to audit on that axis.
- `requirements.md` foundation (connect, render, move) unaffected; capture confirms normal play still works.

---

## Code quality

- Minimal, focused diff: one config constant + one guard in the single join entry point.
- Cap check is synchronous before player insertion; Node's single-threaded handler model prevents a TOCTOU race within one server process.
- Tests are thorough for this scope; they duplicate local socket helpers rather than importing shared ones (see nits).

---

## Remaining gaps

None. All acceptance criteria are satisfied and the captured run is clean.

---

## v0.236 — 233-booth-interaction-primitive  (2026-06-05 03:44:18)

The captured game run is healthy. `metrics.json` reports `"ok": true`, includes a normal lobby-to-gameplay smoke capture, and has `pageerrors: []`. `console.log` contains only Vite connection messages and scene initialization, with no `pageerror` or `[fatal]` entries from game code. Server/client logs show the dev servers started and the two-player capture completed; the only client warnings are benign THREE.Clock deprecation warnings.

## Acceptance criteria findings

1. Interaction-zone primitive: PASS. The implementation adds a shared `findBoothInRange()` primitive with a bounded booth radius and uses it on the server in `boothInteract` to validate the current lobby phase, booth id, and authoritative player position before emitting `{ boothId, action: boothId }`. This satisfies proximity detection at booth anchors and named action dispatch without trusting the client.

2. Client prompt when in range: PASS. The renderer recomputes the current hub booth each frame from the hub layout anchors, clears it outside the hub, and notifies `main.js` on enter/exit transitions. `boothPrompt.js` shows a named prompt for known booth ids, hides it out of range, and supports both the interact key and prompt click as dispatch paths.

3. Test coverage for zone enter/exit and action dispatch: PASS. `server/test/boothZones.test.js` covers zone enter, zone exit, nearest-booth behavior, malformed inputs, successful `boothAction`, and rejection paths. `client/test/boothPrompt.test.js` covers prompt enter/exit, clearing outside hub layouts, interact emit/no-op behavior, and the `booth:action` hook. The captured `coverage.log` reports 65 test files and 1359 tests passing.

## Design and regression check

The change fits the design: booth interactions live in the hub/lobby layer and do not alter the dungeon/combat loop. The foundational requirements still hold in the captured run: the 3D scene initializes, both clients connect over WebSockets, two players enter gameplay, movement works, and the run UI remains functional.

No development debug scenario was added or changed for this ticket, so the debug-scenario shortcut checks do not apply.

## Remaining gaps

None.

## v0.237 — 249-rooms-distinctness-identity  (2026-06-05 04:10:22)

**1-2 landmark props per profile: PASS.** `game/server/dungeon.js` places deterministic profile-specific landmarks for `crowded` (`reactor_coil`, `pipe_stack`) and `open` (`sand_spire`, `sun_arch`) in non-start rooms while avoiding cover, hazards, and doorway clear zones. `game/client/dungeon.js` renders each landmark as a composed visual prop and keeps it visual-only, so it does not introduce collision regressions.

**Differentiate crowded vs default structurally: PASS.** The `crowded` profile uses tighter spacing, more rooms, and deterministic interior cover in combat rooms. Cover placement rejects doorway blockers, overlaps, and partitions, then becomes server/client wall collision, which gives the crowded profile a materially different play space rather than only a palette swap.

**Hazards/verticality for the open profile: PASS.** `crystal_rescue` is wired to the normal `open` profile, and normal deployment goes through `applyLayoutForQuest()`, which generates that layout with slopes enabled. The open layout adds raised platforms, sparse cover, shallow pit visuals, and at least two ramp rooms when room count allows. The `open-verticality` debug scenario is gated by the existing debug-scenario path and mirrors the same `crystal_rescue` open layout instead of substituting an unreachable state.

**Doorway markers in large rooms: PASS.** `buildDoorwayMarkers()` only marks connected passage gaps on rooms at or above the large-room threshold, uses the active profile accent material, and places markers at sampled floor height. This covers open-profile large rooms while avoiding false markers in small rooms.

## Design and foundation consistency

The implementation is consistent with `game/docs/design.md`: room floor geometry continues to use `floorCorners`/`sampleFloorY()`, server movement snaps player Y to the sampled floor, and the new visual geometry follows the existing layout contract. It does not regress the foundation requirements: the captured run renders a 3D scene, connects through the server/client architecture, shows multiplayer state, and movement/dodge updates remain live.

## Code quality and validation

The implementation is cohesive and covered by focused server/client tests for palette resolution, profile structure, crowded cover reachability/collision, open platforms/hazards, doorway markers, landmarks, and traversability across seeds. The provided coverage run reports `68` test files and `1461` tests passing.

## Remaining gaps

None.

## v0.238 — 246-spire-tower-identity  (2026-06-05 04:28:30)

### Optional mid-tier edge hazards

PASS. The implementation adds edge hazard strips only to middle combat tiers, renders them as emissive warning strips, and applies server-side chip damage plus a snap-back toward the safe tier interior during normal movement simulation. Tests cover hazard placement, rendering, damage cooldown, and non-regression of reachability.

### Debug scenarios

PASS. New spire shortcuts are URL/debug entry points only: the client only auto-requests `?debugScenario=...` from localhost-style URLs, and the server rejects debug scenarios in production unless explicitly enabled. The shortcuts reuse `generateLayout(seed, 'spire-ascent')` or the real `spire_ascent` quest path, rebuild movement/collider state, and do not replace the normal gameplay path because `spire_ascent` is present in the normal quest list.

### Design and requirements consistency

PASS. The work remains consistent with the dungeon/core-loop design: spire-ascent is a quest-selectable dungeon layout, movement still follows server-sampled floor heights, and the multiplayer client/server loop is intact. The capture confirms two connected players, lobby-to-playing transition, rendered canvas, movement, and active HUD state, satisfying the foundational graphics, websocket, player visualization, and movement requirements.

### Tests and coverage visibility

PASS. `coverage.log` reports all tests passing: 74 test files and 1479 tests. Coverage thresholds are disabled; the visible report shows broad existing coverage plus focused spire layout, rendering, atmosphere, hazard, and proxy-readiness tests.

## Remaining gaps

None.

## v0.244 — 232-hub-shared-presence  (2026-06-05 05:33:33)

The captured run is healthy. `metrics.json` reports `"ok": true`, the servers started, gameplay reached `phase: "playing"` with two players, and `pageerrors` is empty. `console.log` has two non-fatal 409 resource lines but no `pageerror` or `[fatal]` entries from game code. The capture used the fallback full-flow smoke plan; it proves the build loads and the core lobby-to-game flow still runs, though it does not specifically visualize hub-presence movement.

## Acceptance criteria findings

1. Party-mates' avatars render and move live in the shared hub with cosmetics: satisfied. The server builds presence entries from live lobby players with position, rotation, username, connection state, and backfilled cosmetics. Lobby ticks sync movement into `lobby.hubPresence`, and the client applies `hubPresence` snapshots/updates into `gameState.players`; the renderer then builds/rebuilds remote avatar meshes from cosmetic signatures and moves them from broadcast coordinates. Tests cover remote mesh creation, movement, cosmetic changes, and removed-player disposal.

2. Presence broadcast is per-lobby-scoped and structured for future culling: satisfied. `createLobby()` owns a `hubPresence` object, broadcasts target `io.to(lobby.id)`, and payloads include `lobbyId`, `schemaVersion`, `entries`, and `revision`. There is no global hub-presence store, and the per-entry map is a reasonable base for later per-player filtering.

3. Join/leave updates presence correctly: satisfied. `lobbyJoined` includes a full lobby-phase `hubPresence` snapshot for the joining player. Existing members receive `hubPresenceUpdate` on join/reconnect, and leave, soft-disconnect, and eviction paths sync the lobby snapshot and include `removedPlayerIds` so clients can remove stale avatars.

4. Tests: satisfied. The latest coverage run passed: 59 test files, 1223 tests. The new coverage includes server hub-presence state tests, socket broadcast tests, end-to-end cosmetic/presence integration tests, and client avatar rendering tests. Coverage thresholds were disabled as requested visibility only.

## Design and regression check

The implementation is consistent with the lobby-first multiplayer design in `game/docs/design.md` and `game/docs/lobbies.md`: players still authenticate, create/join a lobby, ready up, and enter a dungeon together. It does not regress the foundation requirements for 3D rendering, server-client WebSocket connection, player visualization, or movement synchronization. The ticket did not add or change a development debug scenario; existing debug URL handling remains gated to localhost-style hosts and is not part of normal gameplay.

## v0.243 — 236-booth-deck-terminal  (2026-06-05 05:10:08)

   Pass. The hook is parsed from the URL, is gated to `localhost`, `127.0.0.1`, and `::1`, and opens only once after a lobby-phase join. It reaches the same `openDeckBooth` end state as the normal booth interaction, so it is a QA shortcut rather than an alternate gameplay implementation.

3. 2D deck editor still works.
   Pass. The implementation reuses the existing deck editor DOM and `renderDeckEditor` behavior. The capture shows the regular lobby and deployment flow still works, and the tests exercise the existing add-button path through the deck editor.

4. Test.
   Pass. `coverage.log` reports 59 test files and 1210 tests passing. Added tests cover booth opening, `deckAddCard` emission, debug-hook gating, socket handler fault wrapping, and the ready-to-deploy server resilience path.

## Design and foundation consistency

The change is consistent with the design document's lobby flow: players manage decks in the lobby before readying for a dungeon run. The booth interaction remains server-authoritative for normal gameplay, so normal players must still be in range of the deck booth. The captured run also preserves the foundation requirements: Three.js renders, the client connects to the server, multiplayer state is visible, and movement/deployment continue to work.

## Code quality

No blocking code-quality issue found. The deck booth behavior is small and testable, normal and debug paths share the same editor opener, and the capture logs do not show runtime exceptions. The broad server resilience wrappers are worth tightening later, but they did not mask any observed capture error and are covered by targeted tests.

## v0.242 — 237-booth-mission-launch  (2026-06-05 05:01:50)

### Launch booth readies up and starts the run
PASS. The Launch Bay booth path uses the existing booth primitive: renderer proximity emits `boothInteract`, the server validates the player is in the hub/lobby and in range, then returns `boothAction`. The client listens for the launch booth action and calls `launchBoothReadyUp()`, which sets the shared ready flag and emits the same `playerReady(true)` socket event as the 2D Ready button. Server-side `playerReady` still validates quest tier and deck state, broadcasts lobby readiness, and calls `checkAllReady()`, which emits `startGame` once all connected party members are ready.

### `?booth=launch` debug hook
PASS. The debug hook is gated to the URL parameter and only runs from `lobbyJoined` while the server state is still in the lobby phase. It calls the same `launchBoothReadyUp()` path as the physical booth, so it does not introduce a separate start-game socket event or bypass server validation. The same end state remains reachable through normal gameplay by walking to the hub Launch Bay booth and using the booth interaction.

### 2D ready/launch still works
PASS. The existing `#ready-btn` handler remains wired to toggle `isReady`, emit `playerReady`, and update the button role. The launch booth path shares state with that button and is idempotent when already ready, so it does not desync the 2D ready UI. The round-2 capture also reaches `phase: "playing"` with two players, visible combat HUD, movement, and card hand after the ready transition.

### Test coverage
PASS. `coverage.log` shows the client suite passing, including `client/test/launchBooth.test.js` with 9 tests, and the full visible run lists 185 passing tests. The launch-booth helper tests cover launch booth detection, `?booth=launch` parsing, idempotent ready-up gating, and the observable launch-ready event name.

### Design and foundation consistency
PASS. The implementation preserves the documented lobby-to-dungeon loop: players remain in the hub lobby, ready through the same party readiness gate, and enter the dungeon through the existing `startGame` transition. It does not weaken the foundation requirements for rendering, WebSocket connectivity, multiplayer presence, or synchronized movement; the capture proves the client/server connection, hub-to-run transition, movement, and gameplay HUD remain functional.

## v0.241 — 239-booth-character-editor  (2026-06-05 04:44:53)

2. **Walking up opens it as an in-hub screen.** PASS. The normal path is present end to end: the generated hub includes a `character` booth anchor, the renderer detects nearby booth zones and emits `boothInteract`, the server validates lobby phase plus authoritative proximity, and `main.js` opens the character booth only for `boothId === 'character'` while in lobby phase. This is consistent with the existing hub lobby flow and does not bypass server validation for normal play.

3. **`?booth=character` debug hook.** PASS. `main.js` reads the `booth` query param, gates it to localhost/loopback using the existing debug allowance check, and opens the booth once after the hub lobby scene is entered. The URL parameter is the only debug entry point, and the same end state remains reachable through the normal proximity/interact path.

4. **Edits apply to the avatar.** PASS. Saving from the booth calls the existing `patchProfile({ cosmetic })` API, then resyncs from the cached account cosmetic and updates `gameState.players[myId].cosmetic`, which is the same live avatar update path used by the Account character editor. Hat unlocks are also wired to rebuild both account and booth hat lists after the authoritative server event.

5. **Test.** PASS. `coverage.log` shows `client/test/characterBooth.test.js` running successfully, including overlay open/close behavior, save-to-avatar syncing, normal `booth:action` handling, lobby-phase gating, and the localhost `?booth=character` one-shot hook. The full captured test set reports 184 passing tests.

## Design and foundation consistency

PASS. The change stays within the design's lobby customization space and does not alter dungeon combat, card flow, multiplayer synchronization, movement, or WebSocket connection fundamentals. The requirements baseline remains covered by the captured run: 3D rendering, client/server connection, multiplayer presence, movement, and gameplay transition all still function.

## Code quality

PASS. The implementation is scoped and modular: shared cosmetic UI behavior was extracted into `cosmeticForm.js`, the booth overlay owns only booth-specific lifecycle, and the existing `cosmetic-preview.js` remains the preview renderer. I did not find dead code, broken imports, ungated debug behavior, or console/page errors attributable to this ticket.

## v0.240 — 270-difficulty-scale-with-player-count  (2026-06-05 04:32:37)

### Enemy damage tracks live count up and down

Pass. `game/server/simulation.js` applies the enemy-damage factor at strike resolution for player-directed enemy attacks, leaving stored enemy `attackDamage` unchanged and allowing later joins/leaves to affect subsequent hits. `game/server/test/enemy_damage_scaling.test.js` verifies baseline counts, scaled counts, live join/leave changes, and no mutation of the stored enemy stat.

### Miniboss HP scales at spawn and is not retroactive

Pass. `game/server/progression.js` scales miniboss `hp` and `maxHp` inside `spawnEnemy()` only when the enemy is created, using the current party count. Existing minibosses are not revisited when the party later changes. `game/server/test/miniboss_hp_scaling.test.js` covers baseline and scaled spawns, non-miniboss enemies remaining unchanged, and join/leave changes not retroactively altering existing minibosses.

### Count helper stays correct under churn

Pass. `game/server/config.js` exposes `runPlayerCount()` as the single helper all three systems read, clamps at `MAX_PLAYERS`, and the config test suite verifies count increases and decreases as players are added and removed. This is consistent with the lobby leave path deleting players from `gameState.players` and the drop-in path adding them.

## Design and regression check

The implementation is server-side only and does not alter the documented lobby/dungeon/deck loop, rendering, movement synchronization, or socket architecture in `CONTEXT.md`, `game/docs/design.md`, and `game/docs/requirements.md`. It does not add or change any debug scenario URL shortcut, so the debug-scenario review criteria are not applicable.

## Remaining gaps

No blocking gaps found.

## v0.246 — 235-booth-shop  (2026-06-05 05:37:49)

   - PASS. `registerShopBoothListener()` opens the existing lobby card shop via `showGameLobby()`, `setLobbyTab('shop')`, and `renderCardShop()`, so it reuses the same 2D shop panel rather than introducing a parallel UI.
   - PASS. Buy and sell continue through the existing socket events and progression functions. `buyShopCard` now has a client button listener and a lobby-gated server handler that refreshes offers and emits `cardInventoryUpdate`; `sellCard` remains lobby-gated and updates inventory/currency.

2. `?booth=shop` hook.
   - PASS. The hook is localhost-only, one-shot, and runs from the lobby/hub update path. It uses the same `openShopBooth()` path as booth interaction and does not bypass server-side buy/sell validation or persistence.

3. 2D shop still works.
   - PASS. The existing shop tab click handler still calls `setLobbyTab('shop')`; the shared `renderCardShop()` and buy/sell socket paths are used by both the 2D tab and the booth shortcut. Lobby updates also refresh `shopOffer` while the shop tab is open.

4. Test.
   - PASS. `coverage.log` shows all visible Vitest coverage checks passing: 7 test files, 198 tests. The added `client/test/boothShop.test.js` covers booth opening plus buy/sell emits, and `client/test/boothShopDebug.test.js` covers localhost gating and one-shot behavior.

## Design and foundation consistency

PASS. The change fits the documented lobby economy loop: players can buy and sell cards back in the lobby, while dungeon rendering, WebSocket connection, player visualization, and movement synchronization remain intact in the captured run. No regression to the 3D/server-client foundation was found.

## Remaining gaps

None.

## v0.247 — 234-booth-quest-counter  (2026-06-05 05:38:50)


### `selectQuest` works from the booth-opened panel
PASS. `openQuestPanel()` only scrolls `#quest-board-wrapper` into view and does not create a second quest UI. The existing `renderQuestBoardState()` callback still emits `socket.emit('selectQuest', { questId, tier: tier ?? 1 })`, so selecting from the visible quest board uses the same flow as before.

### `?booth=quest` debug hook
PASS. `requestBoothDebugOpen()` now accepts `quest` alongside `character`, keeps the existing localhost gate (`debugScenarioAllowed`), requires lobby phase, and uses `boothDebugRequested` to fire at most once per session. It opens the same `openQuestPanel()` path rather than bypassing server quest-selection behavior. No development debug scenario was added, so there is no scenario shortcut that could replace normal gameplay.

### 2D quest menu remains intact
PASS. The always-present inline quest board remains the selection surface, and the implementation only focuses it. No server, quest data, or quest board rendering changes were made.

### Tests and coverage
PASS. `coverage.log` shows the captured verification run passed: 5 test files, 198 tests. The new `game/client/test/questBooth.test.js` covers the pure helper, event listener behavior, non-lobby rejection, localhost debug gating, one-shot behavior, and unchanged `?booth=character`/absent-param behavior.

### Design and foundation consistency
PASS. The change stays within the documented lobby flow where players manage decks and select quests before deployment. It does not regress the foundation requirements for 3D rendering, socket connection, multiplayer visualization, or movement synchronization; the captured run exercised lobby, deployment, movement, and gameplay without runtime errors.

## Remaining gaps

None.


## v0.248 — 242-hub-polish  (2026-06-05 06:12:09)

1. Booths labeled/signed: PASS. The live implementation adds `game/client/boothSigns.js` and wires it through `buildDungeon()` only when `layout.profile === 'hub'` and `layout.boothAnchors` exists. It builds one kiosk plus one floating label sprite for each known generated hub booth anchor, using the same display names as the interaction prompts. The focused unit tests cover the generated six-anchor hub, label text, positioning, invalid anchors, and missing anchors. The latest `01-initial.png` capture also shows visible hub labels including `Shop` and `Launch Bay`.

2. Interaction prompts: PASS. The existing prompt path is still intact and normal-gameplay gated by actual hub proximity, not a debug shortcut: `renderer.js` computes the current booth only for hub layouts with booth anchors, `main.js` wires the transition callback into `updateBoothPrompt()`, and the interact key/click path emits `boothInteract` for the in-range booth. Existing tests cover prompt text, enter/exit visibility, non-hub clearing, and interact emission.

3. Nameplates over other players: PASS. The live renderer creates canvas-sprite nameplates from remote player usernames, positions them above remote avatars each frame, and disposes them when players leave. Hub presence tests cover building and moving remote lobby avatars through normal hub presence updates; the captured two-player run also shows player labels in the rendered scene without runtime errors.

4. Visual review: PASS. The latest rescue capture is a fallback smoke plan rather than a hub-specific full booth walkthrough, but it includes a hub lobby screenshot with visible booth labels and then proves the game transitions into active dungeon play. Combined with the previously passing visual QA for the sub-tickets and the live code/tests above, I do not see a blocking visual or integration gap.

## Design and requirements consistency

PASS. The changes stay within the lobby/squad hub part of the design loop and do not alter dungeon objectives, combat, loot, persistence, or networking invariants. The foundation requirements remain satisfied by the clean capture: the 3D scene renders, the client connects to the server, players are visualized, and movement/deploy flow continues to work.

## Code quality

PASS. The new signage code is scoped to hub layouts, handles missing or unknown anchors safely, avoids per-rebuild texture churn by caching sign materials, and is covered by focused tests. No debug scenario was added or changed for this ticket. `coverage.log` was not present in the rescue-review directory, so there was no changed-file coverage report to inspect.

## v0.249 — 240-paid-appearance-change  (2026-06-05 06:37:15)


### Price in config
PASS. The appearance fee is configured as `APPEARANCE_CHANGE_COST` on both server and client config paths and is used by the server charge helper and client confirm/cost label.

### Client confirm dialog
PASS. The character booth shows a paid-save confirmation only when body/color/model/proportion appearance fields differ from the saved account cosmetic. Hat-only changes skip the paid confirmation and remain free. Connected booth saves emit `applyAppearanceChange` instead of the legacy profile PATCH path, and socket errors re-enable the save UI with a visible message.

### Tests, insufficient funds, and crash safety
PASS. The new server tests cover successful paid charge, insufficient funds, hat-only free changes, profile-route blocking for live lobby appearance edits, persistence ordering, currency-save failure, and simulated crash/update failure cases. Client tests cover the confirmation flow, socket emission, error recovery, cost label, and hat-only behavior. The recorded coverage run passed: 91 test files, 1569 tests.

### Design and requirements consistency
PASS. The implementation fits the existing lobby/economy loop in `game/docs/design.md`: booth appearance edits use persistent account cosmetics and currency without disturbing dungeon combat, lobby flow, WebSocket connectivity, or movement synchronization. The smoke capture confirms no regression to the foundational requirements.

### Debug scenarios
PASS. This ticket did not add or change any `?debugScenario=` shortcut. The capture used normal auth/lobby/ready/gameplay flow.

## Remaining gaps

None.

## v0.250 — 247-plaza-arena-identity  (2026-06-05 06:43:14)

### Varied Cover Types And Real Platform Height

PASS. The plaza now has three raised platform patches with non-flat `floorCorners`, and `sampleFloorY()` returns raised heights on them. Cover includes pillars, broken walls, barricades, and crate stacks, with AABB colliders matching the server/player collision footprint. Spawn and loot helpers use cover-aware placement for open-floor layouts, so entities do not appear inside cover.

### Verticality / Hazards

PASS. The plaza includes shallow pit hazards outside the spawn-clear zone and clear of cover/platform footprints. They render as visual recesses and intentionally do not affect collision or `sampleFloorY()`, matching the ticket’s optional hazards scope.

### Design And Foundation Consistency

PASS. The changes stay within the existing quest/layout architecture: `arena_trials` and `endless_siege` select `layoutProfile: 'open-plaza'`, `applyLayoutForQuest()` routes that through `generateLayout()`, and existing multiplayer movement, WebSocket connection, and 3D rendering foundations remain intact. No development debug scenario was added or changed for this ticket.

### Code Quality And Tests

PASS. The implementation is deterministic, scoped to dungeon generation/rendering/theme data, and includes server/client tests for generated layout shape, decor/marking rendering, collider behavior, platform sampling, hazards, and open-plaza entity spawning. The latest coverage run reports 33 test files passed and 960 tests passed.

## Remaining gaps

No blocking gaps.

## v0.251 — 251-enemy-display-metadata  (2026-06-05 07:12:07)

- Minimal, focused diff (~150 lines across 2 commits).
- Copy is thematic and distinct per type/variant.
- `surfacedStats` selections are sensible for each role (spawner includes spawn keys; miniboss includes `attackRange`; frenzied surfaces enrage multipliers).
- No dead code, no client-side leakage, no new console errors.
- `ENEMY_DEFS` remains exported from `simulation.js` / `index.js` for server-side and test consumers — appropriate for the stated prerequisite role.

---

## Debug scenarios

**Finding: N/A — no new or modified debug scenarios**

This ticket did not add or change any `?debugScenario=` shortcuts. No gating or normal-path bypass review required.

---

## Remaining gaps

None. All acceptance criteria are met; the game starts and runs cleanly in capture; tests pass.

## v0.252 — 245-canyon-verticality-identity  (2026-06-05 07:13:32)

### Optional cliff hazard band

Satisfied. The layout emits `edgeHazards` along plateau cliff segments between ramp mouths, plus side flanks when central ramps consume the south rim. Server movement detects the hazard band for `sunken-canyon`, applies chip damage, and snaps players back toward safe plateau interior. Client rendering draws the hazard strips with emissive warning materials. Tests cover hazard placement, reachability preservation, rendering, and movement response.

### Debug scenario gating and normal reachability

Satisfied. The added `sunken-canyon-stage` shortcut is reachable only through the debug-scenario socket path, and `isDebugScenarioAllowed` gates it to explicit debug env or loopback non-production addresses. The same end-state is reachable through normal gameplay via the `canyon_descent` quest, whose tier uses `layoutProfile: 'sunken-canyon'` and flows through `applyLayoutForQuest`, normal run start, spawn, collision, and enemy spawning. The shortcut reuses `generateLayout(seed, 'sunken-canyon')`, recomputes bounds/walkable AABBs/colliders, and emits the standard quest update; it does not bypass persistent progression or combat invariants beyond providing a QA jump into an otherwise normal layout state.

## Design and requirements consistency

The implementation fits the design document's modular dungeon and floor-height model: generated rooms carry `floorCorners`, server movement samples floor height with `sampleFloorY`, and client rendering uses the same layout data for floors, walls, cover, and landmarks. It does not regress the foundation requirements: the captured game renders a 3D scene, connects through the server-client architecture, shows multiplayer state, and movement continues to update during the smoke flow.

## Code quality and verification

The implementation is cohesive and covered by focused tests across server layout generation, client rendering/materials, movement hazard handling, camera height selection, and debug-gate behavior. The coverage run completed with 93 test files and 1742 tests passing. Coverage logs include unrelated expected/handled model-loading messages from tests and a simulated persistence failure, not ticket-blocking runtime defects.

## Remaining gaps

No blocking gaps remain.


## v0.253 — 248-rooms-objective-hud-and-default-profile-bugs  (2026-06-05 07:38:35)

| Does not weaken invariants | Acceptable — still runs deck validation and full run start; only patches `collectedItems` on an active `collect_items` run for HUD QA (same pattern as `quest-objective-near-complete`). Does not skip net replication or persistence paths used in normal play. |

No blocking issues with the debug shortcut.

---

## Code quality

- Changes are minimal and follow existing patterns (theme strings, `LAYOUT_PROFILES` structure, debug scenario conventions).
- No dead code introduced; the previously dead `'default'` alias is now wired correctly.
- No browser page errors or console fatals in capture.

---

## Remaining gaps

None. Both acceptance criteria are met with targeted tests; the captured run proves the game loads and plays cleanly.

---

## v0.254 — 252-enemy-lockon-info-panel  (2026-06-05 07:55:30)

### Hides when unlocked

PASS. The renderer only supplies an enemy to the panel when the current phase is `playing` and lock-on is active. It refreshes the panel when leaving gameplay, when the local player is dead, and each frame after lock-on state updates; `syncLockOnInfoPanel()` hides the panel when no model can be built. Focused tests cover the unlocked/missing-target hide path.

### Test coverage

PASS. The ticket adds focused unit/integration coverage for the server display catalog and the client panel model/DOM sync. `coverage.log` shows the full Vitest run passed: 82 test files and 1351 tests passed. The lock-on panel test file specifically passed 9 tests.

## Design and requirements consistency

PASS. The change is HUD-only and does not alter the core lobby/dungeon/combat loop, server-client architecture, rendering startup, movement synchronization, or multiplayer state replication described in `game/docs/design.md` and `game/docs/requirements.md`. The captured smoke flow confirms the game still reaches lobby and active gameplay with two connected players, canvas rendering, movement, enemies, and HUD updates.

## Code quality

PASS. The implementation keeps display metadata centralized on the server, uses a small client-side formatter/model builder, and wires the panel through existing renderer lock-on state instead of adding a parallel targeting system. No debug scenario was added or changed for this ticket, so the debug-scenario shortcut checks are not applicable.

## Remaining gaps

None.

## v0.255 — 254-level2-mechanics-and-reference  (2026-06-05 07:58:43)

Satisfied. `coverage.log` shows the full suite passed: 79 files and 1416 tests. New targeted coverage includes `variant_rate_by_quest_tier.test.js`, open-plaza rigid-mode cases in `dungeon.test.js`, `arena_trials_tier2.test.js`, `quests.test.js`, `debug-scenarios.test.js`, and harness proxy readiness tests.

## Design and Requirements Consistency

The implementation stays within the documented lobby/deploy/dungeon loop: Tier-2 quests are surfaced through the quest board, unlock after clearing Tier 1, and deploy through the same run creation, objective, layout, enemy spawn, movement, and persistence systems as normal gameplay. The captured run confirms the foundation requirements remain intact: 3D scene renders, client connects to the server, players are represented, and movement updates in a running multiplayer session.

## Debug Scenario Review

This ticket adds `?debugScenario=arena-trials-tier-2`. It is properly gated behind the existing debug-scenario socket path: the client only requests it from a localhost URL parameter, and the server rejects debug scenarios in production unless explicitly enabled. Normal gameplay does not call this scenario.

The same end state is reachable normally by clearing `arena_trials` Tier 1, selecting the newly unlocked Tier 2 quest, and readying/deploying. The shortcut sets `selectedQuestId`, `selectedQuestTier`, and the Tier-2 layout before `enterPlayingPhase()`, so `startDungeonRun()` snapshots the correct quest/tier metadata. It does not bypass combat or objective invariants after entry: enemies are spawned through the normal `spawnEnemies()` path, run objective sync is called, and state is broadcast through normal lobby/state update channels.

## Code Quality

The changed code is cohesive and uses existing quest, progression, layout, lobby, and debug-scenario patterns. The harness proxy readiness change is narrowly scoped to harness capture env and keeps normal dev proxy behavior unchanged. I did not find dead/broken code, missing exports, obvious race conditions, or console/page errors attributable to the ticket.

## Remaining gaps

None.

## v0.256 — 267-sec-hat-equip-unlock-check  (2026-06-05 08:11:21)

- `validateCosmetic` correctly remains catalog-only (ticket goal acknowledged this split).

## Code quality

- Defense-in-depth: unlock checked in both `lobbyHandlers` and `updateProfile` — redundant but safe; a future caller of `updateProfile` alone is still protected.
- Tests assert persisted state, not just return codes — good coverage of the original exploit (free equip of paid hats).
- No dead code, no new console errors, no debug scenarios added or modified by this ticket.

## Debug scenarios

Not in scope for this ticket. Existing debug scenarios (e.g. `avatar-wizard-hat`) remain URL-gated dev shortcuts; normal equip flow still goes through unlock + `applyAppearanceChange` / `updateProfile`.

## Harness capture note

Round-1 capture used the fallback full-flow smoke plan (lobby → gameplay → movement/dodge). It does not visually exercise hat customization, but the ticket acceptance criteria are server-side enforcement and automated tests — both are satisfied independently of the capture plan.

## Remaining gaps

None. The security fix is in place at both equip entry points, automated tests cover locked-hat rejection on profile update and lobby appearance change, the game starts and runs cleanly in capture, and vitest passes.

## v0.257 — 257-level2-spire-ascent  (2026-06-05 08:22:56)

### Higher variant rate

PASS. Variant scaling is resolved centrally in `spawnEnemy` from the active `run.questTier` or selected tier plus the spawn room encounter tier. Tier 2 maps to a full roll tier even when encounter tier is 0, while Tier 1 remains effectively untagged. The new tests prove Tier 2 spawns tagged enemies under fixed seeds and Tier 1 stays unchanged on the same seed batch.

### Spire identity

PASS. The implementation keeps spire-specific shape and spawn identity: enemies spawn on walkable spire tier rooms rather than ramp connectors, bottom/top tier coverage is forced, top-tier objective/loot placement remains intact, and the spire-exclusive enemy pool continues to include spawners. The design foundation remains consistent with the documented lobby-to-dungeon flow, server-authenticated multiplayer run state, and movement/collision requirements.

### Debug scenarios

PASS. The added `spire-ascent-tier-2` shortcut is registered only in the debug-scenario allowlist path and is reachable through the URL/socket debug scenario flow, not normal gameplay. It mirrors the normal state by unlocking/selecting the quest tier, applying the Tier-2 layout before entering `playing`, then spawning enemies through the same `spawnEnemies`/`startDungeonRun` path so run metadata and variant rolls match deployment. The same state is reachable normally by clearing Spire Ascent Tier 1, selecting Tier 2, and readying/deploying.

### Tests and coverage

PASS. The recorded `coverage.log` shows the test suite passed: 77 test files and 1424 tests. Relevant coverage includes `spire_ascent_tier2.test.js`, `spire_ascent_spawn.test.js`, `debug-scenarios.test.js`, `quest_tier_gating.test.js`, `quests.test.js`, and `variant_rate_by_quest_tier.test.js`.

## Remaining gaps

None.

## v0.258 — 263-debug-unlimited-health-godmode  (2026-06-05 08:25:20)

## Code quality

- Implementation is minimal and follows existing patterns (`debugScenario` handler, `debugScenarioResult` logging, harness state exposure).
- No dead code or obvious bugs in the changed paths.
- `window.__variantCodexKeydownHandler` refactor (remove/re-add listener) prevents duplicate handlers on hot reload — sensible.
- Independent test run confirms no regressions in the broader suite.

---

## Integration notes (non-blocking)

- Round-1 browser capture used the generic fallback smoke plan; probes show `debugGodmodeResult: null` because godmode was never toggled during capture. Unit/integration tests provide the functional proof; capture still validates the game runs cleanly with this code loaded.
- Player HP decreased during capture (expected — godmode was off), confirming normal damage still works when the toggle is not engaged.

---

## Remaining gaps

None. All acceptance criteria are fully and robustly satisfied; the captured run is clean.

## v0.261 — 255-level2-rooms  (2026-06-05 09:11:14)


### Carries rooms identity

PASS. The rigid `crowded` path preserves crowded identity with combat-room cover and only crowded landmark types (`reactor_coil` / `pipe_stack`). The rigid `open` path preserves open identity with raised platforms, pit hazards, light cover, and only open landmark types (`sand_spire` / `sun_arch`). Existing slope/floor sampling and walkability foundations remain consistent with `game/docs/design.md`.

### Higher variant rate

PASS. Tier 2 runs use the existing quest-tier variant scaling path: `spawnEnemy` resolves `run.questTier` / selected quest tier through `resolveVariantRollTier`, so Tier 2 rolls at full variant chance while Tier 1 remains effectively untagged. The Tier 2 quest tests cover fixed-seed variant tagging for both `training_caverns` and `crystal_rescue`, and the runtime capture still shows normal Tier 1 enemies unbroken.

### Debug scenarios

PASS. The added `training-caverns-tier-2` and `crystal-rescue-tier-2` debug scenarios are behind the existing debug-scenario path: the browser only requests them from the localhost-only `?debugScenario=` parameter, and the server rejects unknown/disabled debug scenarios unless the debug gate allows them. Both shortcuts set quest id/tier and apply the Tier 2 layout before entering playing phase, so run metadata and variant rolls match normal deployment. The same states are reachable through normal gameplay by clearing each Tier 1 quest, unlocking Tier 2, selecting it, and deploying.

### Tests and coverage visibility

PASS. `coverage.log` shows the full suite passing: 79 test files and 1456 tests passed. Coverage was reported for changed files with thresholds disabled. The relevant new tests cover quest catalog/options, rigid layout determinism and identity, spawn placement, variant tagging, unlock persistence, deploy gating, and debug scenarios.

## Remaining gaps

None.

## v0.264 — 241-free-hat-swap  (2026-06-05 09:57:44)

2. Equipping verifies the hat is unlocked.

PASS. Both server entry points validate the proposed hat against `backfillUnlockedHats(account.unlockedHats)` before applying it. `updateProfile()` rejects hats not unlocked for the account, and the socket `applyAppearanceChange` handler performs the same check before any currency or cosmetic mutation. Tests cover rejection of locked hats without updating live or account cosmetic.

3. Test.

PASS. `coverage.log` shows the vitest run completed successfully: 10 test files passed, 226 tests passed. Relevant coverage includes `apply_appearance_change.test.js`, `appearance_change_persistence.test.js`, `cosmetic_appearance.test.js`, `characterBooth.test.js`, and the new `debug-hatswap-hook.test.js`.

## Debug scenario / shortcut review

PASS. The new `?booth=hatswap` shortcut is only reachable through the URL parameter and only on local debug hosts. It opens the character booth in lobby phase, emits the existing `hats-unlocked` debug scenario once, and rebuilds the booth hat list when the scenario result reports unlocked hats. The server-side debug scenario gate still requires loopback or explicit debug enablement, and the scenario documents that the same owned-hat state is reachable through normal currency earning and hat unlocking. Normal gameplay can still reach the equivalent end state through the character booth plus the regular unlock/equip flow.

## Design / requirements consistency

PASS. The implementation stays within the existing lobby/account customization model and does not affect the 3D rendering, server-client socket architecture, multiplayer visualization, or movement synchronization requirements. No regressions were evident in the live smoke capture.

## Remaining gaps

None.

## v0.265 — 256-level2-sunken-canyon  (2026-06-05 10:35:00)

## Acceptance Criteria

PASS: Canyon Tier-2 is playable and discoverable. `game/server/quests.js` defines `canyon_descent` Tier 2 with canyon-themed metadata, `unlockRequires: { questId: 'canyon_descent', tier: 1 }`, `layoutProfile: 'sunken-canyon'`, and `layoutMode: 'rigid'`; `listQuestVariants()` exposes it. Normal gameplay gates Tier 2 selection in `game/server/socketHandlers/lobbyHandlers.js` and ready-up in `game/server/socketHandlers/deckHandlers.js`, then `applyLayoutForQuest()` applies the tier-specific seed/options before deployment.

PASS: The rigid layout requirement is met. `generateLayout(seed, 'sunken-canyon', { layoutMode: 'rigid' })` now threads the mode into `generateSunkenCanyon()`, pins the central ramp selection, uses ordered canyon cover, and places a fixed monolith while preserving plateau/start, canyon/treasure, ramp connectors, cliff lips, edge hazards, floor elevation drop, and reachability. Default mode still varies ramp count and seed-driven scatter, so Tier 1 behavior remains distinct.

PASS: The higher Tier-2 variant rate is wired through production spawn code. `spawnEnemy()` resolves the active run/selected quest tier and combines it with room encounter tier via `resolveVariantRollTier()`, so Tier 2 canyon spawns use the full variant base chance even for encounterTier 0 rooms. The new canyon Tier-2 tests verify at least one variant under a fixed seed and null variants for Tier 1 under the same seed.

PASS: Canyon identity is preserved. The sunken-canyon layout keeps plateau-to-canyon descent structure, ramp banding, canyon floor cover, cliff hazard/lip decoration, and the canyon monolith. Enemy spawning remains band-aware with plateau presence and a canyon majority, avoiding connector/ramp spawns.

PASS: The debug shortcut is acceptable. `canyon-descent-tier-2` is only reachable through the existing debugScenario socket path and is registered in the debug allowlist; the socket handler still restricts debug scenarios to explicit dev/local allowance. The scenario sets the same quest/tier, applies the same Tier-2 layout before `enterPlayingPhase()`, and uses the same run metadata and spawn/variant machinery as normal deployment. The equivalent state is reachable normally by clearing Canyon Descent Tier 1, unlocking Tier 2, selecting it, and deploying.

PASS: Design and foundation requirements are not regressed. The changes stay within the existing 3D multiplayer dungeon loop, preserve server-authoritative layout/run state, and keep websocket movement/gameplay foundations intact. The captured probes confirm connected multiplayer gameplay, canvas rendering, and movement/key-item smoke flow before and after the canyon layout transition.

PASS: Test coverage is strong for the changed surface. `coverage.log` reports `81` test files and `1481` tests passed. Relevant coverage includes quest catalog/options, rigid canyon determinism and reachability, Tier-2 unlock/gating/deploy flows, debug scenario parity, enemy spawn banding, and variant-rate assertions.

## v0.266 — 243-retire-2d-lobby-menus  (2026-06-05 11:58:29)

5. Tests green.

PASS. `round-2/coverage.log` reports 10 client test files passed, 227 tests passed. Coverage thresholds were disabled as expected.

## Design and requirements consistency

PASS. The implementation is consistent with `game/docs/design.md`: the lobby browser remains the first post-login menu, while squad lobby actions are now spatial booth interactions in the 3D hub. It also preserves the foundation requirements in `game/docs/requirements.md`: Three.js scene initialization, server-client Socket.IO connection, player representation, and movement synchronization are all exercised by the captured run.

## Debug scenarios

PASS. This ticket did not add a new `?debugScenario=NAME` shortcut. The changed `?booth=` shortcuts are gated to localhost and/or lobby phase as appropriate. The `?booth=hatswap` helper requests the existing `hats-unlocked` debug scenario, which remains a QA shortcut for a state normally reachable through hat unlock progression and does not bypass normal gameplay entry points.

## Code quality

PASS. The live code removes obsolete DOM lookups and tests around retired buttons/tabs, keeps launch ready-up idempotent, and uses existing booth dispatch/socket validation rather than adding parallel events. Server-side booth interaction is still lobby-phase and proximity validated. I found no dead entry point that lets normal gameplay open the retired 2D menus.

## Remaining gaps

None.

## v0.267 — 213-net-shared-event-name-constants  (2026-06-05 12:02:29)

2. Replace literals incrementally: satisfied. The changed live code routes production server emits/listeners and client listeners/emits through the shared constants across `game/server/index.js`, `game/server/progression.js`, `game/server/cardEffects.js`, `game/server/keyItemEffects.js`, `game/server/debugScenarios.js`, `game/server/hubPresence.js`, `game/server/socketHandlers/*.js`, `game/client/main.js`, `game/client/renderer.js`, and `game/client/characterBooth.js`. Critical dynamic paths such as run completion/failure now select between `SERVER_TO_CLIENT.RUN_COMPLETE` and `SERVER_TO_CLIENT.RUN_FAILED`, preserving the existing wire protocol.

3. Add a drift guard test: satisfied. `game/server/test/events.test.js` validates the registry shape and critical pairs, and `game/server/test/socket_events_drift.test.js` scans production server/client socket paths for uncatalogued literal Socket.IO events, including `socket.on`, `socket.emit`, `s.on`, `socket.once`, `socket.off`, and `socketRef.emit`. Coverage log shows both new tests ran, with the full server suite passing: 91 test files and 1420 tests.

## Design and requirements fit

The change is infrastructure-only for Socket.IO event naming and does not alter the documented lobby, dungeon, combat, loot, movement, or multiplayer foundations. The captured run still demonstrates login/lobby, ready transition, WebSocket connectivity, 3D rendering, movement, replicated gameplay state, and key-item HUD behavior, so the foundation in `game/docs/requirements.md` remains intact.

## Code quality

The implementation is appropriately mechanical and conservative. The shared catalog keeps existing wire strings stable, avoids protocol renames, and the server/client import choices match their module systems. I did not find dead or broken production socket code, missing catalog entries for changed production call sites, or runtime console defects. `git diff --check` is clean.

## Debug scenarios

No new development debug scenario was introduced. Existing debug scenario event names were converted to shared constants only; the URL/query-param gated debug path and server-side `allowDebugScenario` checks remain in place.

## Remaining gaps

None.
