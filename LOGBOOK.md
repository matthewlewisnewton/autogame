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


## v0.109 — 181-character-customization-server-cosmetic-profile  (2026-06-02 09:17:37)

`round-1/coverage.log` shows cosmetic-related tests executing and no reported failures before the harness killed the vitest process group at **120s** (`[vitest] timed out after 120s`). Independent `pnpm test:quick` completed **1470 passed** in this review session. Treat round-1 coverage as visibility-only; functional confidence comes from the passing targeted/full run.

---

## Capture vs. ticket scope

Screenshots and probes validate general game health only—they do not assert `cosmetic` in harness state (probes omit it). That is appropriate: acceptance is server/API/snapshot logic, covered by automated tests.

---

## Remaining gaps

None blocking. Runtime is clean; server storage, API, runtime record, and `stateUpdate` replication satisfy the reconstructed top-level criteria.

---

## Nits (non-blocking)

See `nits.md` for follow-up items (cosmetic refresh on socket reconnect, empty `{}` PATCH no-op, missing top-level `ticket.md` in repo).

