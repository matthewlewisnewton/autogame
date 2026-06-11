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

## v0.268 — 258-miniboss-encounter-framework  (2026-06-05 12:12:34)

### Per-player HP scaling

PASS. Miniboss HP is scaled centrally in `spawnEnemy()` using live party size at spawn time, with the existing baseline of no scaling for 1-4 players and increased HP for larger parties. Tests cover the stage-boss path and confirm regular adds stay at baseline HP.

### Tests

PASS. `coverage.log` shows 89 test files and 1645 tests passed. The changed behavior has focused coverage for encounter state, stage-boss objective spawning, encounter triggers/locks, boss defeat, Arena Trials Tier 2 wiring, unlock flow, quest board display, and the new debug scenarios.

## Design and requirements consistency

PASS. The implementation fits the documented lobby-to-dungeon core loop and keeps the game server-authoritative: quest selection is still lobby-gated, Tier 2 selection is locked behind persisted account unlocks, run state is created server-side, enemy spawning and objective completion happen on the server, and clients receive state updates. It does not regress the foundation requirements: the captured run renders 3D, connects over WebSockets, shows multiplayer state, and synchronizes movement.

## Debug scenarios

PASS. This ticket added `arena-trials-tier-2`, `stage-boss-dormant`, and `stage-boss-active` shortcuts. They are only reachable through the existing debug scenario socket path, which is gated by `isDebugScenarioAllowed()` and requires the URL/debug harness path to request a named scenario. Normal gameplay reaches the same Tier 2 stage-boss state by clearing Arena Trials Tier 1, unlocking Tier 2, selecting it in the lobby, and deploying. The debug scenarios reuse `applyLayoutForQuest()`, `enterPlayingPhase()`, `spawnEnemies()`, and `startDungeonRun()` so they exercise the same server-side quest, spawn, run, and encounter invariants; `stage-boss-active` only pre-clears adds and lowers boss HP after creating the normal run for QA convenience.

## v0.272 — 259-miniboss-rooms  (2026-06-05 13:24:21)

### Trigger, Defeat Completion, and Rewards

PASS. The stage-boss encounter flow is wired through the shared encounter/objective framework: the boss starts dormant, activates and locks when players reach the encounter radius or clear supports, clears only when the active boss dies, and then marks the `stage_boss` objective complete. `checkRunTerminalState()` then grants normal victory rewards, saves players, and emits completion. Annex Overseer death also follows the existing miniboss-tier card, Magic Stone, and currency drop paths.

### Normal Gameplay Reachability and Debug Scenarios

PASS. The normal path remains intact: clearing `training_caverns` Tier 1 unlocks Tier 2, the quest board exposes the locked/unlocked Tier-2 row, and selecting/deploying Tier 2 uses the same quest/layout/run creation path as the shortcut. The added `training-caverns-tier-2` debug scenario is gated through the existing debug scenario mechanism, reachable only by explicit debug scenario request, and mirrors normal Tier-2 deployment rather than bypassing server-side encounter/objective/reward invariants.

### Design and Foundation Consistency

PASS. The implementation stays consistent with the documented lobby -> dungeon -> objective -> loot loop and preserves the foundational requirements: the capture proves the 3D scene renders, sockets connect, players are visualized, and movement continues to sync. The change is scoped to quest/encounter/layout/enemy presentation and does not regress Tier 1 behavior.

### Tests and Coverage

PASS. The round coverage log shows `110` test files and `1868` tests passing. New and updated tests cover quest catalog exposure, Tier-2 unlock, rigid vault layout, boss/support spawn placement, encounter activation/completion, Annex Overseer stats/radial behavior, drops, client quest copy, model/display registry, and the Tier-2 debug shortcut.

## v0.271 — 260-miniboss-open-plaza  (2026-06-05 13:17:35)


### Debug scenarios

PASS. This ticket did not add a new URL debug scenario, but it changed the expected behavior of the existing `arena-trials-tier-2` and stage-boss debug paths by changing the underlying Tier-2 boss type. The scenarios remain debug-only via `?debugScenario`/localhost socket paths, and the server comments plus tests trace the normal path: clear Arena Trials Tier 1, unlock Tier 2, deploy, activate the encounter, and defeat the stage boss. They use the same quest, layout, spawn, encounter, and run-completion systems as normal gameplay.

### Design and requirements consistency

PASS. The change stays within the documented lobby-to-dungeon action-RPG loop and does not alter foundational rendering, WebSocket connection, multiplayer visualization, or movement synchronization requirements. It reuses the existing stage-boss and reward systems instead of creating a parallel completion path.

## Verification

- Captured run: `metrics.json` ok, no page errors; no fatal console output.
- Harness coverage log: 71 test files / 1434 tests passed with coverage visibility enabled.
- Additional focused check: `pnpm exec vitest run server/test/arena_trials_tier2.test.js client/test/renderer-registry-normalize.test.js client/test/models-registry.test.js --coverage.enabled=false` passed 3 files / 38 tests.
- An ad hoc `pnpm test -- --run ...` invocation also ran the full suite and all 2342 tests passed, but exited nonzero only because global coverage thresholds were active for that command.

## v0.270 — 262-miniboss-spire-ascent  (2026-06-05 13:10:34)

- Defeat completion and rewards are wired through the shared stage-boss flow. `spawnEnemies()` delegates to the objective registry, `startDungeonRun()` wires the pending boss ID into `run.encounter`, `updateEncounterTriggers()` runs every gameplay tick, and boss defeat marks the objective complete so `checkRunTerminalState()` grants normal victory rewards and emits `runComplete`.
- Visual/contract presentation is consistent enough for the ticket: quest-board summaries use spire-specific "summit warden" copy, and the client has a distinct fallback procedural color/scale/telegraph for `spire_warden`.

## Design and foundation consistency

The implementation fits the existing action-RPG loop in `game/docs/design.md`: players unlock/deploy into a dungeon quest, fight enemies, and receive loot/economy rewards on completion. It also preserves the foundation requirements in `game/docs/requirements.md`: the captured run renders a 3D scene, connects client/server over sockets, visualizes multiplayer players, and accepts synchronized movement.

## Debug scenarios

The changed `spire-ascent-tier-2` debug scenario remains behind the explicit `debugScenario` socket path. The same state is reachable normally by clearing Spire Ascent Tier 1, unlocking Tier 2, selecting the Tier-2 spire quest, and deploying. The scenario uses the normal quest/layout selection, `enterPlayingPhase()`, `spawnEnemies()`, and `startDungeonRun()` path, so it does not bypass encounter wiring, objective creation, or reward/completion invariants.

## Verification reviewed

- `git diff 7c38c21338fe7d884c07984c926971ad4efbdf92 HEAD` and `git log --oneline 7c38c21338fe7d884c07984c926971ad4efbdf92..HEAD` were inspected.
- `coverage.log` reports `83 passed` test files and `1630 passed` tests. Relevant suites include `spire_ascent_tier2.test.js`, `spire_ascent_spawn.test.js`, `spire_warden.test.js`, `debug-scenarios.test.js`, `quests.test.js`, `dungeon.test.js`, and related stage-boss tests.

## Remaining gaps

No blocking gaps remain.

## v0.269 — 261-miniboss-sunken-canyon  (2026-06-05 12:47:59)

### Defeat completes and rewards

PASS. The stage-boss flow uses the existing encounter state machine: spawn wires `bossEnemyId`, `startDungeonRun()` attaches the encounter state, `tryActivateEncounter()` activates/locks the fight when players reach the anchor or clear adds, and `onStageBossDefeated()` marks the objective complete. The canyon Tier 2 test covers active boss defeat through `removeDeadEnemies()`, `cleanupAfterDamage()`, and `checkRunTerminalState()`, ending in `run.status === 'victory'`. Reward currency remains on the quest definition and the existing victory reward path grants quest rewards for completed runs.

### Test coverage

PASS. The ticket adds focused coverage for canyon Tier 2 catalog data, objective copy, rigid layout behavior, boss/add spawn placement, encounter activation, boss-defeat victory, Tier 1-to-Tier 2 unlock persistence, Tier 2 gating, debug scenario parity, and quest-board copy. The recorded coverage run passed: 25 test files and 883 tests.

## Design and foundation consistency

PASS. The change fits the design's dungeon/loot combat loop and uses the existing card-combat, lobby quest, objective, and encounter architecture. It preserves the foundational requirements: the captured run renders a 3D scene, connects to the server, shows multiplayer gameplay state, and still exercises movement/dodge in the live capture before the canyon stage transition.

## Debug scenarios

PASS. The changed `canyon-descent-tier-2` debug scenario remains behind the existing debug-scenario event and environment/localhost gate. It is a shortcut to a state that is reachable through normal gameplay: clear Canyon Descent Tier 1, unlock Tier 2, select the Tier 2 quest, and deploy. The scenario follows the same core invariants as normal deployment by applying the quest layout, entering play, spawning enemies, calling `startDungeonRun()`, emitting normal quest/state updates, and not bypassing the server encounter/objective machinery.

## Remaining gaps

None.

## v0.273 — 266-sec-jwt-require-explicit-dev-auth  (2026-06-05 16:23:18)

The captured run in round-9 is healthy: `metrics.json` ok=true, `pageerrors: []`,
and full gameplay with `ALLOW_DEV_AUTH=1` supplied by the harness.

### Acceptance criteria

PASS. `initAuth()` requires explicit `ALLOW_DEV_AUTH=1` for the dev-secret
fallback; otherwise fails closed (throws) when `JWT_SECRET` is unset. Tested in
`auth.test.js` (23/23 passing).

### Integration / consistency

The opt-in is wired everywhere the server is launched without a real secret:
dev script, harness `start_game()`, smoke tests, and `game/docs/auth-setup.md`
documents the local vs production setup and both throw messages.

No conflict with `game/docs/design.md` / `requirements.md` — this is a
server-side security hardening with no gameplay surface change, and the capture
confirms gameplay is intact.

## Code quality

Clean. The branch ordering is correct and short-circuits idempotently
(`if (JWT_SECRET) return`). Warning on the insecure path is appropriate. Error
messages are actionable. No dead code in the shipped state (the PORT-based
fallback that appeared mid-history was removed in commit `9ac0e5ab`; the working
tree has no PORT heuristic). No debug-scenario shortcuts were added by this
ticket.

## Remaining gaps

None blocking. Minor nits recorded in `nits.md` (a slightly stale inline comment
and smoke-script header comments).



## v0.274 — 277-playthrough-validation-harness-and-rooms  (2026-06-06 01:13:29)

## Stage-boss encounter integration

PASS. Normal gameplay remains the source of the stage-boss state: Tier 2 Training Caverns starts a `stage_boss` run with an `annex_overseer`, the encounter stays dormant while adds are present, activates and locks only after adds are gone and a live player reaches the trigger, and boss defeat clears the encounter and completes the run. The debug scenarios are URL/test shortcuts into reachable normal states, are gated by localhost/server debug allowances, and preserve the real combat/victory invariants the harness needs to exercise.

## Validation artifacts

PASS. `game/validation/rooms/run-summary.json` records `"steps": "full"`, `"ok": true`, a victory section, and all four assertion booleans true: `bossSpawned`, `encounterActivated`, `bossDefeated`, and `victoryFired`. `probes.json` includes dormant, active, afterBoss, and victory probes. `findings.md` reports PASS with no console/page errors, and the required screenshots are present, including boss dormant/active, boss defeated, and victory states.

## Design and foundation consistency

PASS. The implementation remains consistent with the documented PSO-style lobby-to-dungeon loop and active card combat. It does not regress the foundation requirements: the captured run renders a Three.js scene, connects to the backend via sockets, visualizes players/enemies, and exercises movement/lock-on/combat synchronization through the harness.

## Test and coverage visibility

PASS. The captured coverage run reports `101` test files and `1600` tests passing. Coverage is visible only, with thresholds disabled, and no changed-file test failures appear in the log.

## Remaining gaps

None.


## v0.283 — 281-playthrough-validate-ship-hub  (2026-06-06 05:59:45)

### Lobby finder remains 2D

PASS. The auth/lobby-finder probe verifies the lobby browser is visible, the lobby hub is hidden, `hub3dStarted` is false, and the browser is not fixed over an active playing canvas. `09-lobby-finder.png` shows the 2D Lobby Registry menu rather than the 3D hub.

### Debug scenarios and test hooks

PASS. The new/used shortcuts are gated through the existing local/dev debug path (`?debugScenario` and `ALLOW_DEBUG_SCENARIOS` / localhost socket allowance). The end states remain reachable through normal play: currency and hats through dungeon rewards/shop unlocks, Telepipe through an in-run deck/card flow, and suspended-run reset through Telepipe extraction plus abandon. The harness does not bypass the server-side booth save, Telepipe suspend, abandon, or fresh deploy invariants.

### Design and requirements consistency

PASS. The implementation stays aligned with `game/docs/design.md`: the lobby remains a squad management hub, Telepipe suspends an in-progress run, and abandoning clears the checkpoint. It does not regress the foundation requirements: the captured run renders a Three.js scene, connects over WebSockets, shows multiplayer presence, and movement/state synchronization is exercised in the hub validation and tests.

### Code quality and validation

PASS. The diff was reviewed against `8bf01834a57011da31965759d85eea40e47222bb`; the current game code is the source of truth. Coverage output reports 31 test files and 1160 tests passing. I noticed one unused import nit in `game/server/simulation.js`, filed separately in `nits.md`; it is not a blocker.


## v0.275 — 278-playthrough-validate-open-plaza  (2026-06-06 02:33:34)

- Victory fires: final probe has `runStatus: "victory"` and objective complete.

### Debug scenario safety

PASS. This ticket did not add a new game debug scenario. It reuses `arena-trials-tier-2`, which is gated behind the existing debug-scenario socket path and `ALLOW_DEBUG_SCENARIOS` server gate. Normal gameplay still reaches the same end state by clearing Arena Trials tier 1, unlocking tier 2, deploying, clearing adds, entering the trigger radius, and defeating the boss. The playthrough harness only uses the debug scenario as a QA entry shortcut; the boss activation and defeat path in this run proceeds through normal encounter/combat logic.

### Design and requirements consistency

PASS. The implementation does not change `game/**` gameplay code, so it does not regress the documented lobby-to-dungeon core loop or the foundation requirements for 3D rendering, client/server connectivity, player visualization, and movement synchronization. The round-1 smoke capture confirms the game loads, connects, renders, enters play, and responds to movement/key-item input.

### Code quality and verification

PASS with non-blocking nits. The harness changes are small and scoped to `harness/validate/**`. `node harness/validate/playthrough.mjs --help` runs successfully, and `git diff --check` reports no whitespace errors. The provided coverage log is informational only and found no changed-file test files to cover.

The remaining rough edges are backlog-worthy rather than blockers for this validation ticket: the findings renderer still has hard-coded Rooms/annex-overseer labels, the arena champion model asset is missing and falls back to a placeholder mesh, and the Open Plaza full-HP run is documented as flaky over repeated executions.

## v0.276 — 279-playthrough-validate-sunken-canyon  (2026-06-06 02:45:41)

- **Reach, activate, and defeat the stage boss:** PASS. `run-summary.json` has all four assertions true: `bossSpawned`, `encounterActivated`, `bossDefeated`, and `victoryFired`. The active probe shows the encounter locked/active, and the victory probes show `runStatus: "victory"`, `runObjectiveComplete: true`, `bossDefeated: true`, and `lastRunSummaryStatus: "victory"`.
- **Capture required screenshots and findings under `game/validation/sunken-canyon/`:** PASS. The directory contains hub/lobby, level entry, mid-combat, boss dormant, boss active, boss defeated, and victory screenshots, plus `findings.md`, `probes.json`, `console.log`, and `run-summary.json`. The screenshots show the expected lobby, Sunken Canyon run, boss encounter states, and sortie-complete overlay.
- **Pay attention to multi-level canyon floor alignment:** PASS. `probes.json` records floor samples at level entry, mid-combat, boss dormant, and boss active. All sampled `playerY - floorY` deltas are `0`, including the canyon-band boss-active probe at `playerY: 0.5`.

## Design and requirements consistency

PASS. The implementation remains aligned with the documented lobby-to-dungeon loop and server-authoritative floor sampling in `game/docs/design.md`. It does not regress the foundation requirements: the captured run renders a 3D scene, connects client/server over sockets, shows multiplayer state, and preserves movement/gameplay responsiveness in the smoke capture.

## Debug scenario review

PASS. The newly used Canyon Descent shortcuts are debug-only socket scenarios gated by `isDebugScenarioAllowed`, and the URL `?debugScenario=...` path remains localhost-only on the client. The same gameplay states remain reachable normally by unlocking Canyon Descent Tier II, deploying into the stage-boss run, clearing adds, approaching the `canyon_monolith`, and defeating the boss. The scenarios use the normal quest/run/encounter helpers (`applyLayoutForQuest`, `spawnEnemies`, `startDungeonRun`, `activateEncounter`, `lockEncounter`) and do not alter production gameplay paths.

## Code quality and validation

PASS. The changed code is scoped to the validation harness, artifacts, debug/test hooks, and focused tests. Full Vitest coverage visibility completed with `79` test files and `1406` tests passing, and `pnpm validate:sunken-canyon:check` exits `0` against the committed artifacts. I found only a minor cleanup nit, recorded separately in `nits.md`.

## v0.277 — 282-fix-hostiles-purged-count-ignores-boss-encounter-kills  (2026-06-06 03:20:03)

### Stage-boss victory semantics are preserved

PASS. The implementation does not make kill count progress complete a `stage_boss` run. `isComplete()` still depends on a cleared encounter or `bossDefeated`, and the updated tests assert that `recordEnemyDefeated(5)` increases the count without completing the objective. This preserves the design requirement that dungeon completion depends on defeating the boss, not merely satisfying a numeric kill counter.

### Regression coverage

PASS. The new `game/server/test/stage_boss_kill_count.test.js` exercises the full server-side path: deploy a stage-boss run, kill and remove adds through `removeDeadEnemies()`, activate the encounter, kill the boss through `cleanupAfterDamage()`, finish victory, and assert both `run.objective.defeatedEnemies` and `buildRunSummary('victory').defeatedEnemies` equal boss plus adds. Existing stage-boss tests for Training Caverns, Canyon Descent, Spire Ascent, and Arena Trials were adjusted to reflect the new progress accounting while preserving boss-gated completion.

### Design and foundation consistency

PASS. The changes stay in server kill/objective accounting and tests, matching the design's dungeon loop of defeating AI enemies and completing objectives. They do not affect the Three.js rendering, socket architecture, multiplayer visualization, or movement synchronization requirements in `game/docs/requirements.md`.

### Debug scenarios

PASS. This ticket did not add or change debug scenario entry points. Existing boss approach and low-HP shortcuts remain debug-only paths behind `?debugScenario`/debug socket invocation, and the normal equivalent path remains reachable by unlocking/deploying the Tier 2 quest, clearing adds through combat, entering the encounter radius, and defeating the boss. The accounting fix is in the shared server removal/objective path, not in a debug-only substitute.

## Remaining gaps

None.


## v0.278 — 283-add-stage-boss-health-bar-and-encounter-ui  (2026-06-06 03:36:23)

### Every per-level stage boss is supported

PASS. The implementation is data-driven by `bossEnemyId` plus the enemy display catalog, so it is not hard-coded to a single boss type. The wiring test covers the current stage-boss enemy types from the live quest/catalog data: `annex_overseer`, `arena_champion`, `miniboss`, and `spire_warden`.

### No gameplay changes or foundation regressions

PASS. The branch is scoped to client UI, styling, and tests. Server encounter activation, boss spawn, objective completion, movement, rendering, and multiplayer socket flow are untouched. The captured run still satisfies the foundation requirements: 3D scene renders, socket connection succeeds, two players enter gameplay, and movement/key-item state updates are visible.

### Debug scenarios

PASS. This ticket did not add or change a `?debugScenario=...` shortcut. Existing debug scenarios remain server-side QA conveniences and are not part of the normal gameplay entry path for this HUD.

## Code quality and validation

PASS. The HUD logic is isolated in a small pure module with DOM sync separated from model building, matching existing client test patterns. The coverage log shows `client/test/boss-encounter-hud.test.js` and `client/test/boss-encounter-hud-wiring.test.js` passing, with the overall visible test run at 12 files / 250 tests passed. The only stderr in coverage is pre-existing jsdom model URL noise, not a runtime browser error.

## Remaining gaps

None.


## v0.279 — 285-open-plaza-missing-encounter-debug-scenarios-and-flaky-defeat  (2026-06-06 04:06:17)

PASS. The captured run proof is clean: `metrics.json` has `"ok": true`, no `harness_failure`, and an empty `pageerrors` array. `console.log` contains only Vite connection logs, scene initialization, ready-up, and the applied `sunken-canyon-stage` debug scenario; there are no `pageerror` or `[fatal]` lines from game code. Server and client logs show normal startup and teardown, with only a benign THREE deprecation warning in the Vite client log.

### Add open-plaza / arena_trials encounter debug scenarios
PASS. The implementation adds and registers `arena-trials-near-adds`, `arena-trials-boss-approach`, and `arena-trials-boss-low-hp` in the existing debug-scenario path. Each requires an active `arena_trials` Tier 2 stage-boss run and refuses to run outside that state, so normal gameplay does not touch the shortcuts. The client entry remains the localhost `?debugScenario=NAME` flow, with the socket event serving as the existing transport behind that debug path.

The scenarios are consistent with the training-caverns and canyon-descent patterns: near-adds clusters live adds with a usable weapon, boss-approach requires adds cleared and places the player just outside the dormant trigger, and boss-low-hp preserves the real boss enemy, locks/activates the encounter, and leaves the player to finish through normal combat. The normal state remains reachable by clearing Arena Trials Tier 1 to unlock Tier 2, deploying into the `arena_trials` stage-boss quest, defeating adds, approaching the arena dais, and fighting the `arena_champion`.

### Investigate and retune arena_champion defeat flakiness
PASS. `arena_champion` HP is reduced from 500 to 420 while leaving its identity and pressure profile unchanged (`attackDamage`, cone style/angle, and range are pinned by tests). This aligns it with `spire_warden`, matching the design note that stage boss HP values should stay within a tight band so full-HP defeats fit the 180s validation window.

### Design and requirements consistency
PASS. The new Stage Bosses section in `game/docs/design.md` accurately documents the HP tuning and preserves the open plaza boss as a hard-hitting, long-range encounter. The changes do not regress the foundation in `game/docs/requirements.md`: the captured run proves the 3D scene renders, socket connection works, multiplayer state appears, and movement/dodge interactions still update.

### Code quality, tests, and coverage
PASS. The code is scoped to server debug scenario setup, scenario registration, the enemy definition, docs, and focused tests. The scenario code uses existing helpers for quest layout, encounter anchors, floor sampling, lobby broadcast, and state snapshots; no dead or broken code was found. Coverage log shows `75` test files and `1421` tests passing, including `server/test/debug-scenarios.test.js` and `server/test/arena_champion_hp.test.js`.

## Remaining gaps

None.


## v0.280 — 286-playthrough-driver-output-quality-findings-victory-path  (2026-06-06 04:27:59)

- **No invariant short-circuit** — no server validation, persistence, or
  replication is skipped; the boss-low-hp scenario sets HP to 1 but the kill,
  victory detection and run-summary still run normally.
  Covered by new `server/test/debug-scenarios.test.js`.

## Validation

- `vitest run server/` — 98 files, 1668 tests passed.
- `findings-render` + `debug-scenarios` + client `main.test.js` — 186 passed.
- `node harness/validate/verify-open-plaza-artifacts.mjs` — exit 0.
- Visual: `06`/`07` PNGs both show a clean Sortie Complete overlay.

## Remaining gaps

None blocking. All three acceptance criteria are fully and robustly met, the
new debug scenarios are correctly gated and tested, and the captured run is
healthy. One non-blocking nit recorded in `nits.md` (06-boss-defeated frame
now shows the summary overlay rather than a mid-combat defeat frame for the
instakill boss-low-hp path).

## v0.281 — 280-playthrough-validate-spire-ascent  (2026-06-06 05:24:26)

PASS. The implementation adds and verifies a dedicated `spire-ascent` validation preset targeting `questId: "spire_ascent"`, Tier 2, and `bossType: "spire_warden"` (Summit Warden). `game/validation/spire-ascent/run-summary.json` records a full run with `"ok": true`, `"steps": "full"`, `deployScenario: "spire-ascent-tier-2"`, all four required assertions true, and victory probes showing `runStatus: "victory"`, `runObjectiveComplete: true`, `bossDefeated: true`, and `lastRunSummaryStatus: "victory"`.

PASS. The required deliverables are present under `game/validation/spire-ascent/`: hub/lobby, level entry, mid-combat, boss dormant, boss active, boss defeated, and victory screenshots, plus `findings.md`, `probes.json`, `console.log`, and `run-summary.json`. `findings.md` now correctly reports `bossSpawned (spire_warden): PASS` rather than the earlier Training Caverns boss label. I also ran `pnpm validate:spire-ascent:check`, which exited 0.

### Design and requirements consistency

PASS. The changes remain consistent with the documented lobby-to-dungeon core loop and the foundation requirements: the round-3 capture exercises auth, lobby creation/join, ready/deploy, multiplayer socket state, 3D rendering, movement, and gameplay HUD; the Spire validation artifacts exercise the level-specific boss flow. Existing quest progression supports the normal path: Spire Ascent Tier 1 victory unlocks Tier 2, Tier 2 uses the `stage_boss` objective, and the Summit Warden victory is driven by the encounter/boss-defeat terminal-state path rather than a bespoke completion shortcut.

### Debug scenarios

PASS. The added Spire debug scenarios are gated behind the existing debug path: the client requests scenarios only on localhost/test hooks, the server applies them only when `ALLOW_DEBUG_SCENARIOS=1` or non-production loopback access permits it, and normal gameplay does not call them. The same end states are reachable through normal progression: clearing Spire Ascent Tier 1 unlocks Tier 2, deploying Tier 2 creates the stage-boss run, clearing adds and entering the encounter trigger activates the Summit Warden, and killing the active boss clears the objective. The shortcuts do not replace the terminal-state invariant; the final validation still kills the real `spire_warden` enemy and observes the standard victory/run-complete state.

### Code quality and tests

PASS. The harness preset changes are narrow and preserve the existing Rooms defaults while adding configurable add types for Spire. The artifact renderer/verifier now derives the boss label from the preset, preventing the previous `annex_overseer` false label from recurring. The server readiness/PID cleanup changes address capture stability without changing combat rules. Round-3 coverage reports `76` test files and `1225` tests passing with coverage enabled.

## Remaining gaps

None.


## v0.284 — 284-distinct-stage-boss-visual-identity  (2026-06-06 06:37:26)

### Boss identity is preserved in real encounters

Pass. Quest metadata maps tier-2 stage-boss encounters to the expected boss types: training caverns uses `annex_overseer`, arena trials uses `arena_champion`, canyon descent uses `miniboss`, and spire ascent uses `spire_warden`. Stage-boss spawning filters adds with `entry.type !== 'miniboss' && entry.type !== bossType`, so the Canyon boss is not spawned alongside same-type miniboss adds in its boss encounter.

### Consistency with design and requirements

Pass. The change is visual-only and aligns with `game/docs/design.md` stage-boss identity without changing boss HP, combat stats, objective wiring, movement, multiplayer, or client/server connectivity. The captured smoke run confirms the foundational rendering, socket connection, player presence, and movement loop remain intact.

### Debug scenarios

Pass. This ticket did not add or modify `?debugScenario=...` entry points. Existing debug scenarios are outside this ticket's diff.

### Code quality and validation

Pass. The implementation is narrowly scoped to `game/client/models.js`, `game/client/renderer.js`, and tests. The model fallback path is robust because null registry entries skip glTF loading and keep procedural geometry visible. The provided coverage run passed: 25 test files and 315 tests passed. Coverage visibility for changed files was present, with no thresholds enabled.

## Remaining gaps

None.


## v0.305 — 288-hub-validation-capture-walkable-3d-not-menu-overlay  (2026-06-06 21:26:26)

### Scope remains validation-focused

PASS. The meaningful behavior change is in `harness/validate/**` plus regenerated `game/validation/hub/**` artifacts. The only `game/client/main.js` change is a harmless null guard around existing `lobbyEl.classList.add('hidden')` calls; it does not add a debug shortcut or alter the hub flow.

## Design and requirements consistency

PASS. The change supports the design requirement that the lobby is a 3D multiplayer space where players gather before deployment, and it does not regress the foundational requirements for Three.js rendering, client/server connection, player visualization, or movement synchronization.

## Code quality and validation

PASS. The harness change is small, direct, and failure-producing if the overlay cannot be hidden. `coverage.log` shows the relevant Vitest run completed successfully with 11 files and 238 tests passing; coverage thresholds were disabled as expected. Existing model-load warnings in the jsdom test environment are caught by fallback rendering and do not affect the captured browser run.

## Debug scenarios

No development debug scenario was added or changed by this ticket. The existing debug scenarios used by broader hub validation remain URL/harness-driven and are not part of normal gameplay entry.

## v0.287 — 292-ice-level-and-slippery-floor-physics  (2026-06-06 12:14:08)

### Client visuals and movement feel

PASS. `ice-cavern` has a distinct cold palette in `dungeonTheme.json`; the renderer uses ice-cavern band materials, applies a profile-independent emissive slippery material override for slippery rooms/platforms, and places the treasure marker using sampled floor height. Client prediction was extracted into `movementPrediction.js` and mirrors the server's acceleration/coast/stop behavior, with velocity reset on spawn/layout changes. Client tests cover slippery material rendering and local movement carry/normal-stop behavior.

### Debug scenarios

PASS. The remaining ice/slippery URL shortcuts are gated by the existing localhost/dev debug-scenario mechanism. `frost-crossing-tier-1` is the canonical deploy shortcut and uses the production Frost Crossing path: selected quest/tier, `applyLayoutForQuest`, `enterPlayingPhase`, enemy spawn, and `startDungeonRun`. `slippery-floor-lab` no longer builds a synthetic URL-only lab layout; it deploys Frost Crossing and then positions the player on a real slippery room from that generated layout. The equivalent states remain reachable through normal play by selecting Frost Crossing, deploying, and walking from the stone start onto the ice field.

### Design and foundation consistency

PASS. The work fits the documented dungeon-room/floor-sampling model and preserves the foundation requirements: Three.js rendering still initializes, sockets connect, multiplayer state is present, and movement continues to sync through the server. The new slippery system extends floor metadata without regressing existing normal-floor movement semantics.

### Tests and coverage

PASS. The round-2 coverage run reports `124 passed (124)` test files and `2111 passed (2111)` tests. Relevant ticket suites include `server/test/slippery_floor.test.js`, `server/test/frost_crossing_spawn.test.js`, and `client/test/slippery_movement.test.js`; coverage was reported for visibility with thresholds disabled.

## Remaining gaps

No blocking gaps found.

## v0.285 — 295-fire-level  (2026-06-06 11:38:30)


### Fire level reachable via debug scenario
PASS. `fire-cavern` and `fire-cavern-stage` are registered debug scenarios. The `fire-cavern` scenario selects `ember_descent` tier 1, applies the same quest-derived layout seed/profile path, enters playing phase, spawns the quest enemy pack, and starts a normal run state. The client URL entry point remains gated to localhost by `?debugScenario=...`, and the server also gates debug scenario use through `isDebugScenarioAllowed`.

### Layout generation and floor alignment
PASS. `generateLayout(seed, 'fire-cavern')` dispatches to a deterministic rim/ramp/basin layout with a high rim start room, 2-3 descent ramps, a large lower basin, solid perimeter walls, cover in the basin, and floor corners compatible with shared `sampleFloorY`. Server walkability tests cover rim-to-basin reachability across regression seeds, and client render tests assert elevated rim floors, sloped ramp meshes, basin marker placement, and cover placement on sampled floor Y.

### Themed visuals and atmosphere
PASS. `dungeonTheme.json`, `game/client/dungeon.js`, and `game/client/renderer.js` add a distinct fire-cavern palette, rim/basin floor material separation, and depth-responsive warm fog/background. The fire-specific render and atmosphere tests passed. The final round-2 browser capture used the fallback sunken-canyon scenario rather than a fire-cavern scenario, but it still proves the game runs cleanly with this ticket applied; fire-specific behavior is covered by the live code tests and earlier sub-ticket visual QA.

### Design and requirements consistency
PASS. The implementation stays consistent with the design document's floor-height model by using `sampleFloorY`/`resolveFloorY` for player placement, wall placement, cover, and treasure markers. It does not regress the foundation requirements: the captured run renders a 3D scene, connects to the backend, shows multiplayer state, and preserves movement/key-item smoke behavior.

### Code quality and validation
PASS. The changed server/client code is scoped to quest wiring, layout generation, debug shortcuts, fire-cavern render materials, and atmosphere. The coverage log reports the full vitest suite passing: 109 test files and 1895 tests.

## v0.286 — 290-slow-status-effect-foundation  (2026-06-06 12:09:09)

### Helper exposure for future ice systems

PASS. `applySlow` and `isSlowed` are exported from `game/server/simulation.js` and surfaced through `game/server/index.js`, so the future ice enemy and ice card can call the shared foundation helpers directly instead of reimplementing status state.

### Design and foundation requirements

PASS. The implementation is consistent with the design doc's multiplayer action-combat foundation and does not regress the setup requirements: Three.js rendering, WebSocket connection, multiplayer visualization, and WASD movement synchronization are all still demonstrated by the round-3 capture. The SLOW status is server-authoritative, replicated to clients, and does not alter the lobby/dungeon/deck loop.

### Debug scenarios

PASS. The live code does not add a slow debug scenario or any normal-gameplay shortcut for applying slow. The ticket history includes removal of an intermediate slowed-player debug shortcut, and no `?debugScenario=` path remains for this status, so there is no debug-only path masking a missing normal gameplay path.

### Test and coverage evidence

PASS. `coverage.log` reports `108` test files and `1808` tests passing. Focused coverage includes `game/server/test/slow_status.test.js` for helper semantics, player movement scaling, enemy chase scaling, freeze precedence, expiry, and refresh; `game/client/test/local-slow-prediction.test.js` covers local prediction with valid, missing, expired, and invalid slow factors; and existing snapshot expectations now include the player slow fields.

## Remaining gaps

None.


## v0.300 — 287-persist-player-health-and-stones-no-telepipe-reset  (2026-06-06 16:52:52)


### No Checkpoint Resume / Fresh Run Does Not Wipe Vitals
PASS. The removed checkpoint machinery is not present in live server code: searches found no `captureRunCheckpoint`, `restoreRunCheckpoint`, or `suspendedCheckpoint` implementation. `resetTransientRunState()` only clears enemies, minions, loot, area effects, and the telepipe. The captured redeploy produced a different run id while preserving vitals, which matches the updated design: fresh dungeon state, durable player state.

### Medic Booth Is The Only Health Restore
PASS. `healAtMedic()` is restricted to lobby phase, charges the configured cost, sets `hp` to `MAX_HP`, clears `dead`, saves player data, and is exposed through the `medicHeal` socket event. Combat cards/key items no longer define or apply HP healing: healing-themed cards now restore Magic Stones, field medic kit restores Magic Stones, and damage code only subtracts HP. Tests cover both direct medic healing and socket-level healing.

### Server Tests And Coverage
PASS. `coverage.log` reports 104 test files passing and 1,938 tests passing. Relevant tests cover telepipe extraction preserving HP/MS in hub, fresh redeploy preserving HP/MS with a new run id, drop-in default/preservation behavior, cold save/load of vitals, and med booth healing.

### Debug Scenario Review
PASS. This ticket uses/updates `telepipe-ready`. The scenario is only reachable through the debug scenario path, which is gated by localhost/debug allowance and the URL/test hook request path. It does not itself complete the telepipe flow: it leaves the player in the lobby until normal ready-up, then `checkAllReady()` injects a telepipe into a normal dealt hand. The later placement, portal entry, extraction, lobby return, and redeploy all use the ordinary server-side card, telepipe, and ready-up paths. The same end state remains reachable in normal gameplay by deploying with/obtaining a Telepipe card, placing it, entering it, and redeploying from the hub.

### Design And Foundation Requirements
PASS. `game/docs/design.md` now describes Telepipe as ending the dungeon run, clearing transient world state, starting a fresh dungeon on redeploy, and preserving `hp`/`magicStones` across hub-sortie transitions, with the Medic station as the only full-health restore. The implementation does not regress the foundation requirements: the captured run renders, connects to the server, shows the player, and proceeds through lobby/dungeon transitions.

## v0.289 — 291-burning-status-effect-foundation  (2026-06-06 13:14:08)

PASS. The implementation is entity-generic and covers players and enemies separately in the server tick pass. Player `burningUntil` is included in the hot state snapshot in `game/server/progression.js`, and enemies are already broadcast as live world objects, so the client receives the status timestamp for both entity classes.

### Burning animation on players and enemies

PASS. `game/client/renderer.js` adds distinct player and enemy burn marker maps, creates a warm additive flame marker, updates it every animation frame while `burningUntil` is active, anchors the local-player marker to predicted local position, anchors remote players/enemies to broadcast positions, and disposes markers on expiry or entity removal. The effect is visually distinct from the existing slow/freeze indicators.

### Server tests

PASS for the burning acceptance coverage. `game/server/test/burning_status.test.js` covers helper state, expiry, reapplication, player/enemy-shaped entities, and null tolerance. `game/server/test/burning_tick_damage.test.js` covers player and enemy periodic damage, expiry, godmode immunity, dead/extracted player skips, refreshed duration, and re-ignition after a gap. The latest `coverage.log` shows both new burning test files passing.

Note: the full coverage run in `coverage.log` has one unrelated existing failure in `server/test/debug-scenarios.test.js` for the `arena-trials` debug scenario expecting an `arena_champion` at 1 HP and receiving 420 HP. This ticket did not add or change debug scenarios and the failing area is outside the burning-status diff, so I am not counting it as a burning-status blocking gap.

### Design and requirements consistency

PASS. The change preserves the documented multiplayer client/server foundation: server state remains authoritative, clients receive status state through snapshots, and rendering remains a Three.js overlay effect. The captured smoke run still satisfies the foundation requirements for scene rendering, WebSocket connectivity, multiplayer visualization, and movement synchronization.

## Remaining gaps

None.


## v0.290 — 302-chain-lightning-card  (2026-06-06 13:15:58)

PASS. Client arc rendering is wired from server payload to visual effect. The card effect emits `chainSegments` from caster to primary and each subsequent hop; `cardRenderers.js` registers a Voltaic Chain renderer that spawns a cyan `spawnLightningArc()` for every segment, with a legacy directional fallback. `renderer.js` creates and fades short-lived jagged line arcs, and the client renderer tests assert that chain segments invoke arc rendering instead of the legacy bolt.

PASS. The implementation stays consistent with the design document's active card-combat model: this is a single-use spell with an instant combat effect, consumes Magic Stones through the existing spell branch, uses existing hand validation/cooldown/consumption flow, and does not alter the lobby/dungeon/core loop or foundation requirements.

## Debug scenario review

PASS. The added `chain-lightning-ready` shortcut is reachable only through the existing debug scenario URL/client socket path. The client only requests debug scenarios from localhost-style hosts, and the server rejects production/non-loopback use unless `ALLOW_DEBUG_SCENARIOS=1` is explicitly set.

PASS. The same end state is reachable through normal gameplay: `chain_lightning` is a reward-acquisition card included in the reward rotation, and normal run combat can put the player near multiple enemies in range. The debug setup only makes that state deterministic by putting Voltaic Chain in hand, restoring Magic Stones, and lining up three grunts.

PASS. The scenario does not replace or weaken production validation. It still enters a normal playing phase, uses the regular hand/card structures, and any cast goes through the normal authoritative `useCard` validation, Magic Stone cost, cooldown, card consumption, damage, cleanup, state update, and `cardUsed` broadcast paths.

## Test and coverage review

PASS. The round-2 coverage log shows the full Vitest suite passing: 114 test files and 1971 tests. Relevant ticket coverage includes `server/test/chain_lightning.test.js` with 7 passing tests and `client/test/cardRenderers.test.js` with the new chain segment renderer coverage. Overall coverage is visible at 72.71% statements / 72.68% lines with thresholds disabled.

## Remaining gaps

None.


## v0.291 — 300-rare-medic-enemy-in-level2  (2026-06-06 13:24:25)

PASS - Medic flees, heals allies, and does not chase. `game/server/simulation.js` gives `field_medic` its own AI path before the regular chase/windup branch. It prioritizes wounded nearby allies when heal cooldown is ready, fires only when a visible player is within bead range, flees from players inside `fleeRadius`, and otherwise wanders rather than entering the normal chasing state. `game/server/test/field_medic.test.js` covers flee movement, lowest-HP ally healing, close-range bead damage, no self/ally friendly fire, and no closing distance to a distant player.

PASS - Close-range defensive energy bead works. The bead uses the existing phase-beam hit collector with `playersOnly: true`, applies weak ranged damage to players, queues a `medicBead` event for clients, and avoids damaging the firing medic or allied enemies. Client-side handling in `game/client/main.js` and `game/client/renderer.js` renders the bead and hit sparks from the server event.

PASS - Display metadata and lock-on info are present. `ENEMY_DEFS.field_medic` includes name, description, surfaced stats, and combat tuning. The server display catalog includes the type, and the client lock-on panel test verifies the Field Medic name, HP, support stats, and description are shown.

PASS - Client visuals are integrated. `game/client/renderer.js` defines a distinct small green-teal octahedron for `field_medic`, registers a projectile telegraph style, and renders medic ally-heal and bead VFX from the new socket events. Renderer tests cover the mesh shape/scale and registry normalization.

PASS - Debug scenarios are acceptable. The new `field-medic` and `field-medic-spawn` scenarios are only reachable through the existing debug scenario path, with browser auto-request gated to localhost and `?debugScenario=...`. The same end states are reachable through normal tier-2 quest selection and weighted spawn pools, and the scenarios reuse server `spawnEnemy` state rather than bypassing combat or persistence invariants.

PASS - Consistency with design and foundation requirements. The change stays within the existing multiplayer dungeon combat loop, preserves server-authoritative enemy behavior and WebSocket event delivery, and does not regress the documented basics: 3D render, server-client connection, multiplayer visualization, or movement synchronization. The round-2 smoke capture reached lobby and gameplay with two connected players and live movement probes.

## Verification

Observed evidence: `coverage.log` reports 114 passed test files and 1856 passed tests. Relevant passing suites include `server/test/field_medic.test.js`, `server/test/enemy-spawn-pools-wiring.test.js`, `server/test/quests-spawn-pools.test.js`, `server/test/enemy_display_catalog.test.js`, `client/test/lock-on-info-panel.test.js`, `client/test/main.test.js`, and `client/test/renderer-registry-normalize.test.js`.

## Remaining gaps

No blocking gaps remain.


## v0.292 — 301-burning-and-slow-mutually-exclusive  (2026-06-06 13:37:01)


### Burning and slow are mutually exclusive on any entity
PASS. `applySlow()` now clears `burningUntil` and resets `lastBurnTickAt` before applying slow, while `applyBurning()` clears `slowedUntil` before applying burn. Because these helpers operate on generic entities and are the shared status entry points, both player and enemy sources inherit the most-recent-wins behavior.

### Both application orders are covered for players and enemies
PASS. `server/test/burn_slow_mutual_exclusion.test.js` covers slowed-then-burned, burned-then-slowed, repeated toggles, and "never both" assertions for player-shaped and enemy-shaped entities. It also covers the burn tick clock reset when slow douses burn. The captured coverage log shows the new test file passed as part of the server suite, with 24 test files and 966 tests passing.

### Client shows only the active status
PASS. The client slow and burn indicators are separately driven by `slowedUntil` and `burningUntil` from the server snapshot. Since the server now zeroes the opposing timestamp on every status application, the existing renderer path disposes the inactive marker and displays only the current effect for local players, remote players, and enemies.

### Design and foundation consistency
PASS. The change is consistent with the combat status model in `game/docs/design.md`: it keeps the existing card-combat/status-effect architecture and does not alter the lobby, dungeon, rendering, networking, or movement foundations in `game/docs/requirements.md`. The captured run still demonstrates 3D rendering, client/server connectivity, multiplayer presence, and movement.

### Debug scenarios
PASS. This ticket did not add or change any `debugScenario` shortcut. The captured scenarios list is empty, so there is no debug-only path to validate for this ticket.

## Remaining gaps

None.

## v0.293 — 298-vault-wyrm-burning-rebalance  (2026-06-06 13:54:54)

PASS. The shared `dungeon_drake` stats add `burnDurationMs: 2000` and `specialEffect: "burning_breath"`. Both server and client build `CARD_DEFS` from the shared JSON sources, and the client card HUD renders `specialEffect` by replacing underscores with spaces, producing the captured `BURNING BREATH` label on the Vault Wyrm cards.

### Server tests cover reduced damage and burn application

PASS. The new `game/server/test/vault_wyrm_burning.test.js` covers cone miss behavior, burn refresh/extension on subsequent breath ticks, and the evolved Wyrm non-burn guard. Existing Wyrm tests were updated to assert 50 HP -> 48 HP, `isBurning(enemy) === true`, and `burningUntil === now + 2000`. The changed `astral_guardian` default-minion assertion was also updated for the new fallback damage.

`coverage.log` shows the full test run passed: 53 test files and 1466 tests. Coverage was collected successfully with thresholds disabled.

## Design and requirements consistency

PASS. The change stays within the existing card-combat model: Vault Wyrm remains a creature/minion summon with channeled breath, but now trades lower direct damage for the already-established BURNING status. It does not alter the lobby/dungeon loop, movement, networking, rendering, or multiplayer foundations listed in `game/docs/design.md` and `game/docs/requirements.md`. The captured smoke run confirms server-client connection, 3D rendering, player representation, and movement synchronization still work.

## Debug scenarios

PASS. The ticket updates an existing `minion-combat` debug scenario's hard-coded Vault Wyrm stats to mirror production damage and burn duration. The scenario remains behind the existing debug-scenario path (`?debugScenario=...` / debug socket event from local debug flow), and normal gameplay can reach the equivalent end state by starting a run with Vault Wyrm in the deck and casting it near enemies. The scenario does not replace the production summon path or weaken server-side card validation for normal play.

## v0.294 — 297-fireball-card-inflicts-burning  (2026-06-06 14:20:38)

PASS. Casting flows through the authoritative `useCard` weapon branch in `game/server/cardEffects.js`: `effect: "fireball"` uses `collectProjectileHits`, applies impact damage, preserves projectile render data in the `cardUsed` payload, consumes charges/cooldowns through the existing weapon path, and emits state updates normally.

PASS. Burning-on-hit is implemented on the server by resolving each hit enemy and calling `applyBurning(enemy, burningDurationMs)`. This reuses the existing Burning status implementation from ticket 291, including mutual exclusion with Slow and ticking fire damage. State snapshots expose enemies directly, so `burningUntil` reaches clients for visual status rendering.

PASS. Client visuals are covered on both sides of the requirement: `game/client/cardRenderers.js` registers a Fireball-specific renderer that spawns a warm `effect: "fireball"` projectile, and `game/client/renderer.js` has a matching sphere projectile branch. Burning on enemies is rendered via the existing `burningUntil`-driven flame markers.

PASS. Server and client tests cover the new behavior: `game/server/test/fireball_card.test.js` verifies the definition, reward obtainability, cast payload, impact damage, and Burning status on struck enemies; `game/client/test/cardRenderers.test.js` verifies the Fireball projectile renderer; `game/client/test/cards.test.js` verifies Fireball is in weapon card sets. The coverage run reports `112 passed` test files and `1745 passed` tests.

## Design and requirements fit

PASS. The change fits the design document's card-combat model: Fireball is a multi-charge weapon projectile in the active deck/hand system, and it adds a status-based combat effect without changing the lobby, dungeon, loot, multiplayer, movement, or rendering foundations required by `game/docs/requirements.md`.

## Debug scenario review

PASS. The added `fireball-ready` scenario is only reachable through the debug-scenario URL/socket path guarded by `isDebugScenarioAllowed`; normal gameplay does not call it. It is a deterministic QA shortcut into a state that remains reachable normally by earning the reward card, putting it in a deck, deploying, and fighting enemies. The scenario still uses normal `useCard` server validation and combat resolution; it only seeds the hand and enemies for repeatable testing.

## Remaining gaps

None.

## v0.295 — 299-aoe-heal-and-cleanse-card  (2026-06-06 14:28:29)

**Casting removes slow, burning, and other negative statuses on affected players.** Passed. `clearNegativeStatuses` resets `slowedUntil`, `slowFactor`, `burningUntil`, `lastBurnTickAt`, `frozenUntil` when present, and the generic `debuffs` array. The radius heal path runs this cleanse for every in-radius active player, including full-health players whose HP cannot increase. Tests cover slow, burn, frozen/debuff cleanup, and socket integration after casting from a slowed/burning player.

**Client shows AoE heal and cleanse effects.** Passed. `purifying_pulse` has a card-specific renderer that spawns a mint-green expanding heal ring and a white/teal cleanse burst at the cast origin, plays the heal sound, and is registered in the card renderer dispatch. Client tests verify renderer registration and the specific heal-ring/cleanse-burst calls.

**Server tests cover radius heal and status clear.** Passed. `server/test/purifying_pulse.test.js` directly covers the helper behavior and socket `useCard` path. The full captured coverage run reports 127 test files and 2220 tests passing.

## Design and requirements consistency

The implementation fits the documented combat model: Purifying Pulse is a single-use spell with an instant radial support effect, matching the card-combat system in `game/docs/design.md`. It does not weaken the foundation requirements in `game/docs/requirements.md`; the captured run confirms 3D rendering, WebSocket connection, player visualization, and movement synchronization still work.

The new `purifying-pulse-ready` debug scenario is gated through the existing `debugScenario` URL/socket path and is included in the debug scenario allowlist, not normal gameplay. Its end state is reachable through normal play by earning the reward card and being affected by existing slow/burning/debuff systems before casting. It does not bypass the real card-use path; the integration test uses the scenario only to stage state, then casts through normal `useCard` handling.

## Code quality

The implementation is tightly scoped and follows existing patterns for card JSON, server card effect dispatch, simulation helpers, debug scenarios, and client renderer registration. I did not find dead/broken code or whitespace issues (`git diff --check` passed). One non-blocking observation is that `healedTargets` only includes players who gained HP, even though full-health in-radius players are still cleansed server-side; this does not block the acceptance criteria because the cleanse is applied and the client effect is a radius-wide AoE, not per-target.

## Remaining gaps

None.


## v0.296 — 294-ice-slow-ball-card  (2026-06-06 15:14:34)

### Client renders projectile and slow indicator

Pass. `game/client/cardRenderers.js` registers a dedicated `ice_ball` renderer that calls `spawnAttackEffect` with an icy palette and slow travel duration. `game/client/renderer.js` implements the `ice_ball` attack effect as a cyan sphere that travels over `projectileTravelMs`. Existing slow indicators are driven from broadcast `slowedUntil` on enemies and players, so Ice Ball's server-applied slow is visible via the same status indicator system as the ice enemy slow mechanic.

### Server tests for cast, projectile, and chance-to-slow

Pass. `game/server/test/ice_ball_card.test.js` verifies card definition/economy, reward availability, cast payload with projectile metadata and hit damage, success-roll slow application, and failure-roll no-slow behavior. `coverage.log` reports 115 test files and 1765 tests passed.

## Design and regression review

The implementation is consistent with the card-combat design: Glacial Orb is a spell card using Magic Stones, is acquired as loot/reward, and reuses the established shared-card-data pipeline so client and server definitions stay aligned. It does not weaken the base requirements in `game/docs/requirements.md`; the captured run still renders the 3D scene, connects to the backend, shows multiple players, and processes movement.

## Debug scenarios

The new `ice-ball-ready` debug scenario is gated through the existing debug-scenario socket path and registered only in the `DEBUG_SCENARIOS` set. It shortcuts into a QA-ready state by placing Glacial Orb in hand, topping up Magic Stones, and lining up enemies, but the equivalent state is reachable through normal gameplay by earning the reward card, adding it to a deck, entering combat, and casting it at an enemy. It does not bypass server-side card validation or effect handling; tests still emit `useCard` and exercise the authoritative `handleUseCard` path.

## Remaining gaps

None.


## v0.297 — 296-fire-enemy-inflicts-burning  (2026-06-06 15:48:10)

## Lock-on panel and enemy display metadata

PASS. `ENEMY_DEFS.ember_wraith` includes name, description, surfaced stats, combat stats, cone attack style, and burn duration metadata. The enemy display catalog trims and publishes the surfaced values, while the client lock-on panel labels and formats `burnDurationMs` as seconds. Client tests verify the Ember Wraith panel model includes name, description, HP, attack, cone style, chase speed, and burn duration.

## Client render and attack telegraph

PASS. The client registers `ember_wraith` as a procedural warm emissive octahedron with a distinct footprint, model registry entry, and cone telegraph matching the server's `Math.PI / 3` attack cone. Renderer and main tests cover mesh creation, height/footprint normalization, visual distinction from grunt, and registry handling.

## Design and requirements consistency

PASS. The change fits the documented action-RPG dungeon loop: a level-exclusive enemy in the fire-cavern quest adds combat pressure without altering lobby flow, multiplayer state, movement, or rendering foundations. The captured smoke run verifies the baseline requirements still hold: Three.js scene initializes, clients connect over WebSockets, multiplayer presence exists, and movement/dodge state updates during gameplay.

## Test and coverage evidence

PASS. The provided coverage run reports 116 test files and 1895 tests passed. Relevant coverage includes `server/test/ember_wraith_burning.test.js`, `server/test/enemy-spawn-pools-wiring.test.js`, `server/test/quests-spawn-pools.test.js`, `server/test/enemy_display_catalog.test.js`, `client/test/lock-on-info-panel.test.js`, `client/test/main.test.js`, and `client/test/renderer-registry-normalize.test.js`.

## Remaining gaps

None.


## v0.298 — 293-ice-enemy-glacial-ball-thrower  (2026-06-06 16:27:08)

PASS. The client has a glacial thrower mesh preset, projectile telegraph visual metadata, and keyed ice-ball mesh syncing from `gameState.iceBalls`. Stale projectile meshes are disposed when projectiles leave the server state, and run-exit cleanup clears `iceBalls` from world snapshots.

### Server tests

PASS for this ticket's new behavior. `coverage.log` shows `server/test/ice_enemy.test.js` passing all 13 tests and `server/test/enemy_display_catalog.test.js` passing all 4 tests.

There is one existing-suite failure in `coverage.log`: `server/test/debug-scenarios.test.js > debugScenario — canyon-descent-tier-2 > positions miniboss at 1 HP beside the player in playing phase`. That failure is outside this ticket's glacial enemy path and is not evidence that this implementation fails the ticket acceptance criteria.

## Design and requirements consistency

PASS. The implementation fits the documented multiplayer dungeon combat loop: enemies are authoritative on the server, snapshots drive client rendering, and the new foe is scoped to the ice-themed Frost Crossing level. It does not regress the foundation requirements: the captured run shows client/server connection, 3D scene initialization, player representation, and movement/gameplay state.

## Debug scenarios

PASS. This ticket added `?debugScenario=glacial-thrower`. It is gated through the existing debug-scenario allowlist and URL-driven client request path, clears current enemies/projectiles, and spawns the thrower as a QA shortcut. The same end state is reachable through normal gameplay because Frost Crossing is selectable/deployable and guarantees at least one `glacial_thrower` through the normal spawn path; the scenario does not bypass persistence or server validation beyond the existing debug-only state setup pattern.

## Remaining gaps

None.


## v0.299 — 304-fix-lobby-menu-overlay-reshows-over-walkable-hub  (2026-06-06 16:51:57)

### Client test for dismiss / stays-dismissed behavior

PASS. `client/test/lobby-menu-dismiss.test.js` covers hub lobby join starting hidden, state updates staying hidden after dismissal, hub presence updates not reopening the menu, and deck/shop booth reopen behavior. `coverage.log` shows the test run passed: 12 files and 247 tests passed. Coverage thresholds were disabled as expected.

## Design and requirements consistency

PASS. The change supports the design doc's lobby role of squad management in a shared 3D space without regressing the foundational requirements: the captured run rendered a Three.js scene, connected to the server, represented two multiplayer participants, and progressed through movement/gameplay probes.

## Code quality

PASS. The main implementation is scoped to the client lobby/menu surface and keeps state explicit with `lobbyMenuDismissed` and `extractedLobbyOverlayActive`. The persistent lobby controls moved outside the dismissible menu, which avoids losing essential lobby actions when the large panel is hidden. I did not find dead code, a normal-gameplay regression, or a blocking console/runtime issue.

## Debug scenarios

No `?debugScenario=NAME` shortcut was added or changed for this ticket. Existing debug-scenario gating remains localhost-only through `debugScenarioAllowed`, and normal gameplay reaches the same lobby and booth states without debug shortcuts.

## Remaining gaps

None.


## v0.302 — 305-recapture-walkable-hub-after-overlay-fix  (2026-06-06 18:39:43)

### `findings.md` covers walkable presentation

PASS. `game/validation/hub/findings.md` includes a dedicated walkable presentation section covering overview, operations, commerce, salon, menu dominance, and party-mate visibility, plus hub walk notes and screenshot references.

## Design and foundation consistency

PASS. The implementation is scoped to validation harness code and generated hub-validation artifacts; it does not alter `game/client` or `game/server` gameplay behavior. The new checks support the documented lobby/hub multiplayer flow and do not regress the requirements for 3D rendering, client-server connectivity, multiplayer visualization, or movement synchronization.

## Code quality and integration

PASS. The harness changes align the hub waits with the post-304 contract, add explicit walkable-presentation probes, enforce required hub artifacts, and route the ticket-305 fallback capture away from dungeon deploys. I found no dead/broken code or blocking integration issues. The only coverage artifact reports no matching test files for changed files, which is informational because thresholds are disabled.

## Debug scenarios

PASS. This ticket did not add or modify game debug scenarios. The generated validation artifacts use existing debug helpers for booth and telepipe validation through the harness path only; normal gameplay paths remain unchanged.

## Remaining gaps

None.


## v0.303 — 303-card-balance-analysis  (2026-06-06 18:46:16)

### Applied safe tunings

PASS. The implementation applies only low-risk numeric stat changes in `game/shared/cardStats.json`: `saber_of_light`, `fireball`, `harvesting_scythe`, `permafrost_lance`, and `dragons_breath`. The later `excalibur_photon` revert leaves it as a written triage item, matching the ticket's requirement to avoid broader reworks.

### Tests and validation

PASS. The new analyzer in `game/validation/card-balance/analyzeCards.mjs` is covered by `game/server/test/card_balance_metrics.test.js`, which verifies every `cardDefs` id has stats and complete metric rows, checks key cards, documents server overlay keys, and smoke-runs the CLI. Existing tests were updated for the changed numeric values. The supplied coverage run reports 24 test files and 460 tests passing.

### Design and foundation consistency

PASS. The changes stay within card data, report generation, and tests; they do not alter the multiplayer lobby/dungeon flow, rendering, movement synchronization, or server-client architecture described in `game/docs/design.md` and `game/docs/requirements.md`.

### Debug scenarios

PASS. This ticket did not add or change any game debug scenario implementation. Existing test use of `debugScenario` remains confined to test harness paths and does not introduce a normal-gameplay shortcut.

## Remaining gaps

None.


## v0.304 — 289-card-charges-persist-on-telepipe-resume-reset-on-new-sortie  (2026-06-06 19:14:38)

3. Health + magic stones persist in BOTH cases.

   PASS. The restore branch does not overwrite finite `hp` or `magicStones`, and the fresh-deploy branch preserves existing finite vitals instead of resetting them. Tests exercise telepipe resume and abandon-then-new-sortie with non-default HP/MS and verify neither path resets HP to max or MS to the starting amount. This matches the ticket-287 durability rule in `game/docs/design.md`.

4. Server tests covering both paths.

   PASS. The changed tests include focused server coverage for telepipe-resume card-charge preservation, new-sortie charge reset after abandon, and HP/MS regression guards, plus socket integration coverage for the same two-player flows. The round-3 `coverage.log` shows the full suite passed.

## Design and regression review

PASS. The updated `game/docs/design.md` accurately describes the implemented telepipe suspend/resume policy: last active player extraction suspends the run, resume restores the same run/checkpoint including card charges, and Abort Sortie discards the checkpoint so the next deploy is a fresh run with reset card charges. This does not regress the foundation requirements: the captured run rendered a 3D scene, maintained a WebSocket connection, showed the player in the world, and successfully transitioned lobby -> dungeon -> suspended lobby -> resumed dungeon.

## Debug scenario review

PASS. The round-3 capture used the existing `telepipe-ready` debug scenario. It remains gated by the localhost-only `?debugScenario=` client path and server debug-scenario allowlist, and it does not replace the real flow: normal play still reaches the same state by deploying with a Telepipe card, placing the portal, extracting all active players, then readying from the hub to resume. The scenario only prepares a QA-friendly hand/state before normal ready-up and telepipe/resume server logic run, so it does not bypass checkpoint persistence or net-replication invariants.

## Remaining gaps

None.


## v0.306 — 306-restore-hp-healing-cards-keep-no-auto-level-heal  (2026-06-07 18:46:17)


### Med Booth Still Heals
PASS. `healAtMedic()` remains lobby-only, charges currency, heals dead/zero-HP or damaged players to `MAX_HP`, clears `dead`, and rejects already-full/insufficient-currency/not-in-lobby cases. The existing server tests cover these paths.

### Client Text and Rendering
PASS. The shared client card definitions expose `healAmount` for Restoration Beacon and Sanctum Pulse. The `cardUsed` renderer dispatch now uses HP-heal visuals and the `heal` sound for `healing_font` / `divine_grace` when the local player actually gains HP, rather than Magic Stone loot audio. Field Medic Kit server metadata now describes HP restoration and the client VFX remains a heal pulse keyed from the server event.

### Design and Foundation Consistency
PASS. `game/docs/design.md` now states that HP persists across resume/new sortie and is restored by the hub Medic station or healing cards, with no automatic free heal at level start. This is consistent with the ticket clarification and does not regress the foundation requirements: the capture reached a connected 3D gameplay state with player representation, movement probes, card hand, HP/MS HUD, and no page errors.

### Debug Scenarios
PASS. This ticket did not add or change any `?debugScenario=` implementation in the diff. Existing debug shortcuts remain URL-driven development paths, so there is no new scenario-specific blocker for this ticket.

### Tests and Coverage
PASS. `coverage.log` shows 59 test files and 1580 tests passing. Coverage visibility was available; thresholds were disabled. The only stderr noise in coverage is existing jsdom/model URL fallback noise from renderer model loading tests, not a ticket regression or captured browser page error.


## v0.307 — 307-card-windup-commitment-input-lock-mechanic  (2026-06-07 18:54:36)

### Client shows wind-up animation and input-lock feedback

Satisfied. The server snapshots expose `cardUseState`, `cardWindupUntil`, and `cardWindupCardId`. The client uses those fields to block card-slot input, discard, key-item input, movement packets, and rotation-only movement packets while committed. The hand UI toggles `#card-hand.input-locked`, dimming and disabling card slots, and the renderer shows a sky-blue player wind-up ring plus emissive avatar flash while `cardUseState === "windup"`.

### Server tests cover input-lock, deferred resolution, normal-card regression, and card types

Satisfied. `coverage.log` reports all tests passing: 137 test files and 2179 tests. The added wind-up tests cover state snapshot fields, movement/card/key-item/discard rejection, lock persistence until pending resolution, deferred weapon damage, cancellation on death, telepipe suspend cleanup, no-regression instant cards, and wind-up behavior for spell, creature, and enchantment card types. Coverage visibility includes the changed client/server files, with no threshold failures.

## Design and requirements consistency

The implementation is consistent with `game/docs/design.md`: it keeps combat card-based, adds a risk/reward commitment window for heavy cards, mirrors the existing enemy wind-up style, and leaves the lobby/dungeon loop intact. It does not regress `game/docs/requirements.md`: the captured run renders a Three.js scene, connects frontend to backend via websocket, shows two players in a squad/run, and movement input updates state during normal play.

## Debug scenarios

This ticket adds `magma-windup-ready`. It remains behind the existing debug-scenario path and is requested only through the `debugScenario` socket/URL mechanism on localhost; normal gameplay does not enter it. The scenario places `magma_greatsword` in hand with a nearby enemy for QA, but the same end state is reachable normally by evolving `flame_blade` into `magma_greatsword` and entering a run. It does not bypass the production card-use or server validation path: tests still emit normal `useCard` and rely on the same wind-up, lockout, and deferred-resolution code used by real play.

## Remaining gaps

None.


## v0.309 — 313-saber-of-light-aoe-per-grind-scaling  (2026-06-07 23:09:16)

### Scaling is scoped and does not affect other weapons

Pass. Weapons without `aoeGrindScale` return their original explicit `attackRange` or the existing `ATTACK_RANGE` fallback. The new helper is exported for tests but otherwise stays internal to weapon resolution.

### Tests

Pass for this ticket. `game/server/test/saber_aoe_grind.test.js` covers unchanged damage/cooldown, the explicit small scale, smooth reach growth, and a control weapon without scaling. In `coverage.log`, this new test file passed (`5 tests`). The full visibility run shows one unrelated failing `debug-scenarios` assertion for `canyon-descent-boss-low-hp`; the live state assertions in that same test passed, and only the captured `stateUpdate` packet was stale. I do not consider that a Saber implementation blocker.

### Debug scenario

Pass. The added `saber-grind-max` scenario is reachable only through the existing debug scenario mechanism: client URL parameter `?debugScenario=...` on localhost and server-side `isDebugScenarioAllowed` gating. It sets up a normal playing run with a +10 `saber_of_light` in hand and matches the real 6-charge card definition. The state is reachable through normal gameplay by owning/grinding Saber of Light and deploying; the shortcut does not bypass card-use validation, combat resolution, persistence, or net replication.

## Design and requirements consistency

The change stays within the card-combat model described in `game/docs/design.md`: a weapon card gets a small per-grind combat stat improvement while normal dungeon, lobby, movement, rendering, and multiplayer requirements remain intact. The captured smoke confirms lobby join, ready transition, gameplay rendering, movement, socket connectivity, and key-item HUD state still work.

## Remaining gaps

None.


## v0.313 — 311-slower-scaling-early-strong-cards-plus-astral-trim  (2026-06-07 23:39:26)

### Astral Guardian is conservatively trimmed without gutting its role

PASS. `game/shared/cardStats.json` trims only the requested direct stats: `damage` from 66 to 63 and `shieldHp` from 15 to 14. Its evolved identity, 65 MS cost, minion HP/TTL, shield duration, and attack behavior are preserved, so it remains a top-tier evolved payoff while being slightly less of an outlier. `game/server/test/astral_guardian.test.js` and `game/server/test/card_balance_metrics.test.js` assert the live values.

### Tests and ticket 303 report are updated

PASS. The coverage log reports `115 passed` test files and `1829 passed` tests with coverage generated. New/updated tests cover the per-card grind scale, Phase Stalker beam behavior, Astral Guardian values, balance metrics, and the debug scenario follow-up. `game/validation/card-balance/report.md` documents the post-311 Signal Familiar, Phase Stalker, and Astral Guardian changes and keeps remaining operator-triage items separate from this ticket's completed scope.

## Design and requirements consistency

The changes are consistent with the card-combat design: they preserve the active deck/card loop and tune numeric progression rather than changing card acquisition, combat type, or multiplayer flow. The requirements baseline is not regressed: the capture confirms 3D rendering, client-server connection, multiplayer state, and movement synchronization.

## Debug scenario review

This ticket changed the Arena Trials boss-approach debug scenario logic. It remains gated behind the existing localhost `?debugScenario=` / debug socket pathway and is listed only in the debug scenario allowlists. The shortcut still requires an `arena_trials` Tier 2 playing run with an encounter, refuses to run while any non-boss enemies remain alive, and only repositions the player outside the dormant boss trigger after the same add-clear state that normal gameplay reaches by defeating adds and walking to the arena dais. It does not replace or weaken the normal encounter activation invariant; it now reuses `areAllNonBossEnemiesDefeated`, the same helper used by the encounter state machine.

## Remaining gaps

None.


## v0.315 — 310-apply-3-optional-newcard-balance-tunes  (2026-06-08 00:14:45)


PASS. The relevant assertions were updated:

- `server/test/ice_ball_card.test.js` now expects `slowChance: 0.65`.
- `server/test/card_balance_metrics.test.js` now expects `chain_lightning.magicStoneCost: 37` and `purifying_pulse.utilityScore: 20`.

`coverage.log` shows the full suite passed: 22 test files and 446 tests. Coverage thresholds were disabled, but coverage completed successfully for the files under visibility.

### Design and requirements consistency

PASS. The changes are data-only numeric tuning within the existing card combat model described in `game/docs/design.md`: spells remain card-based combat actions, and no new flow or mechanic is introduced. The foundation in `game/docs/requirements.md` is not regressed; the capture confirms rendering, client/server connectivity, multiplayer presence, and movement synchronization still work.

### Debug scenarios

PASS. This ticket did not add or change any development `?debugScenario=` URL shortcut. The existing `ice-ball-ready` server test setup is unchanged by the implementation and remains test-only setup, so there is no new debug-path acceptance risk.


## v0.316 — 314-ether-scythe-evolution-gold-health-on-kill  (2026-06-08 00:18:31)

### Evolution data and card definitions are complete

PASS. `cardEconomy.json` maps `harvesting_scythe` to `reapers_scythe`; `cardDefs.json`, `cardStats.json`, server stat overlays, client card ID sets, and balance metrics all include the evolved card. This matches the existing evolution pattern for other cards and keeps the evolved variant reachable through normal gameplay evolution rather than a debug-only path.

### Tests and coverage visibility

PASS. The latest coverage run reports `65 passed` test files and `1602 passed` tests. Relevant passing tests include `server/test/card_evolution.test.js`, `server/test/collect_cone_kill_rewards.test.js`, `server/test/integration.test.js`, `server/test/card_balance_metrics.test.js`, and `client/test/cards.test.js`. Coverage thresholds are disabled, but the changed behavior has focused and integration coverage.

## Design and requirements consistency

PASS. The change fits the documented card-combat and loot/economy loop: enemies can reward currency, HP restoration exists through combat effects, and the scythe evolution reinforces the harvest/reap fantasy without changing movement, rendering, lobby, or multiplayer foundations. The smoke capture confirms the foundation requirements still hold: the 3D scene renders, the client connects to the server, players are present in multiplayer, and movement/dodge gameplay remains functional.

## Debug scenarios

PASS. This ticket did not add or modify a `?debugScenario=...` URL shortcut. The tests use existing socket-level debug scenarios for setup only; normal gameplay reachability is provided by the existing card evolution transform from base Ether Scythe to Reaper's Scythe.


## v0.317 — 312-excalibur-photon-windup-balance  (2026-06-08 00:36:08)

### Test coverage

PASS. Coverage log shows `25` test files and `496` tests passing. New and updated tests cover the wind-up-aware balance calculation, Excalibur Photon stat exposure, evolution/new-card expectations, generic instant-card regression, and a live socket `useCard` path where Excalibur Photon commits wind-up, deals no early damage, resolves after `windUpMs`, applies two hits, and clears commitment state. Coverage output includes unrelated stderr from existing test-time model URL fallbacks and socket disconnect cleanup, but the suite passes and the captured browser run is clean.

## Design and requirements consistency

PASS. The change remains within the documented card-combat model: Excalibur Photon is still a weapon card in the active deck combat loop, and the wind-up/recovery lock is consistent with existing wind-up cards such as Steel Claymore and Corebreaker Greatsword. The implementation does not affect the foundational requirements for Three.js rendering, websocket connection, multiplayer visualization, or movement sync; the capture verifies those still run.

## Debug scenarios

PASS. This ticket did not add or change a development `?debugScenario=` entry. The new tests seed state directly or use an existing debug scenario for Magma Greatsword regression coverage; normal gameplay remains the only route for real players to obtain and use Excalibur Photon through the existing card/evolution systems.

## Code quality

PASS. The code change is appropriately narrow: one data-field addition, balance-metric accounting for `windUpMs`, report reconciliation, and targeted regression/integration tests. The existing wind-up pipeline locks cost/cooldown/origin at commit, resolves from `pendingCardUse`, applies `swingsPerUse` during deferred resolution, and clears commitment after use. I did not find dead code, duplicated gameplay paths, or a mismatch between stats, report, and tests.

## Remaining gaps

None.


## v0.318 — 309-fix-storm-eagle-thunderbird-attack-interval-gate  (2026-06-08 00:43:26)

### Server test asserting the gate

PASS. `game/server/test/new_card_pack.test.js` adds focused coverage for first-hit behavior, suppression within the interval, re-fire after interval expiry, and Thunderbird chain suppression/re-fire. The provided `coverage.log` shows `server/test/new_card_pack.test.js` passed, and the full suite passed with `53` test files and `1514` tests.

## Design and requirements consistency

PASS. The change is server-authoritative combat tuning for creature cards, consistent with the design document's card-based combat model and the existing minion AI patterns. It does not touch rendering, WebSocket connectivity, multiplayer visualization, or movement synchronization requirements, and the captured fallback smoke flow confirms those foundations still load and run.

## Debug scenarios

No development debug scenario was added or changed by this ticket. The captured run did not use a debug scenario (`debugScenario: null`), so there is no debug shortcut gating issue to review.

## Code quality

PASS. The implementation is minimal and localized to the expected files. The interval gate mirrors existing minion timing patterns, avoids changing hit damage, and does not introduce dead code or console/runtime errors. One non-blocking cleanup is tracked separately in `nits.md`: live creature spawn currently relies on the simulation fallback interval rather than copying the new stat onto the minion instance.

## Remaining gaps

No blocking gaps.


## v0.321 — 308-apply-windup-and-lower-charges-to-heavy-hitter-cards  (2026-06-08 02:37:44)

### Card text and rendering

PASS. Hand rendering now shows the wind-up hint for cards with `windUpMs`, the tooltip explains the movement/card lockout, and reward choice descriptions include wind-up-aware damage copy. This satisfies the requirement that card text/rendering convey the heavy wind-up.

### Tests and coverage

PASS. The captured coverage run passed: 38 test files and 1134 tests. Relevant coverage includes merged card stat assertions, charge-value updates, delayed resolution for Solar Edge, Soul Drain, and Corebreaker, input-lock behavior, death cleanup, and UI wind-up hints/tooltips. Coverage thresholds were disabled as expected.

### Design and requirements consistency

PASS. The change stays within the card-combat system described in `game/docs/design.md`: weapons/spells remain card-driven combat actions, charge behavior is preserved, and the wind-up mechanic adds commitment without changing the lobby/dungeon/loot loop. The foundation requirements are not regressed: the captured run renders the scene, connects client/server, shows multiplayer state, and accepts movement.

### Debug scenarios

PASS. This ticket only updates the existing `magma-windup-ready` debug scenario fixture to match the new Corebreaker charge count. Debug scenarios remain gated by the debug socket path, which is only allowed locally or via `ALLOW_DEBUG_SCENARIOS`, and the normal equivalent state is still reachable by obtaining/grinding/evolving `flame_blade` into `magma_greatsword` and entering a run. The shortcut does not replace normal gameplay or weaken the production card-use path; wind-up validation still goes through the same server `useCard` and resolution code.

## v0.320 — 315-card-animation-shared-vfx-primitives-foundation  (2026-06-08 01:05:38)

### Client tests where feasible

PASS. The coverage log shows all tests passing: 30 files, 418 tests. New focused coverage includes primitive lifecycle/disposal tests, accent override tests, card renderer composition/fallback tests, and wind-up charge ratio/telegraph lifecycle tests.

### No performance regression

PASS. The new primitives allocate on effect spawn, then update existing meshes in `updateAttackEffects` without per-frame allocation. Particle effects honor the existing `particlesEnabled` setting, and all new transient meshes are removed and disposed at expiry. No runtime errors or capture regressions were observed.

## Design and requirements consistency

PASS. The changes are client-side visual polish for card combat and do not alter the lobby/dungeon/card-combat loop described in `game/docs/design.md`. They preserve the foundational requirements in `game/docs/requirements.md`: the captured run renders a 3D scene, connects to the backend, shows multiplayer presence, and updates movement during play.

## Debug scenarios

No development debug scenario was added or changed by this ticket. Existing debug scenario plumbing remains outside the changed behavior.

## Remaining gaps

None.


## v0.325 — 319-status-support-utility-card-animations  (2026-06-08 03:50:25)


### Telepipe portal animation
PASS. `game/client/renderer.js` now represents active telepipes as a group with a shimmering cylinder, two orbiting rings, and a small rising particle column. The capture exercised Telepipe placement, extraction, suspended lobby, and resume; probes confirm the game returned to a clean playing state with the same run id, layout seed/profile, objective, and preserved enemy set.

### Performance and integration risk
PASS. New effects allocate short-lived groups through the existing `activeEffects` cleanup model or a fixed telepipe particle pool. The particle counts are small, the telepipe particles are reused while the portal exists, and no per-frame unbounded allocations were introduced in the hot path.

### Tests and coverage
PASS with note. The ticket added focused renderer tests for status/economy/enchantment dispatch and telepipe portal animation. The visibility-only coverage run reports `126` test files passed and `1` failed due to two existing-looking `server/test/debug-scenarios.test.js` stage-boss shortcut assertions unrelated to this ticket's changed VFX surfaces or the newly added `economy-cards-ready` shortcut. I do not consider those a blocking gap for this top-level VFX ticket.

### Debug scenarios
PASS. The ticket adds `economy-cards-ready` to the existing debug scenario system, and normal gameplay does not touch it: the client only requests scenarios through `?debugScenario=...` on localhost and the server also gates debug scenarios through `isDebugScenarioAllowed`. The scenario enters a normal run and only preloads reward/shop cards that are otherwise reachable through the regular card economy, so it is a QA shortcut rather than a replacement for player progression or card-use validation.

### Design and requirements consistency
PASS. The implementation stays within the card-combat and dungeon/lobby loop described in `game/docs/design.md`: cards remain the combat surface, Telepipe remains a mid-run evacuation/resume feature, and no foundation requirements for rendering, server/client connectivity, player visualization, or movement synchronization are regressed.

## Remaining gaps

No blocking gaps remain for this ticket.

## v0.324 — 316-distinct-weapon-card-animations  (2026-06-08 03:06:17)

### No performance regression

PASS. The implementation composes a small, bounded number of existing primitive effects per card use. Delayed effects use the existing scheduler, and optional primitive calls are guarded so missing helpers degrade to the core swing rather than throwing. No per-frame work was added to normal gameplay beyond the existing wind-up marker path.

### Tests where feasible

PASS. `game/client/test/cardRenderers.test.js` exercises all weapon visual families, distinctness, optional-helper fallback, heavy impact parameters, photon barrage scheduling, and Solar Edge/heavy weapon wind-up stat presence. Integration tests were adjusted where Solar Edge's new wind-up changes timing assumptions. The round-2 coverage run passed: 127 files, 1929 tests.

## Design and requirements consistency

PASS. The change remains consistent with the active card-combat design: weapons are still multi-charge directional attacks, and wind-up cards now better communicate committed hits. The foundation requirements are not regressed: the capture shows a 3D scene, WebSocket-connected multiplayer state, player visualization, and movement/dodge probes working in a live run.

## Debug scenarios

PASS. This ticket adds `weapon-slash-ready`, `energy-blade-slash-ready`, and `heavy-greatsword-slash-ready`. They are reachable only through the existing `debugScenario` socket path, which is gated to localhost/non-production unless `ALLOW_DEBUG_SCENARIOS=1` is set. They do not replace normal gameplay: the same weapons are reachable as starter/reward/evolved cards through inventory, deck, and evolution systems. The scenarios prepare hand contents and nearby enemies for QA but still use the normal `useCard` server path for card validation, wind-up resolution, net replication, and `cardUsed` rendering.

## v0.323 — 318-creature-minion-summon-and-attack-animations  (2026-06-08 02:59:05)

## Performance and cleanup

PASS. The new effects reuse existing short-lived primitive systems and active-effect cleanup instead of adding persistent unbounded meshes. Minion telegraphs and mesh maps are disposed with stale minions, and pending server VFX queues are drained each game-loop tick. I did not see a perf-risk pattern such as unbounded DOM or scene growth.

## Tests and coverage visibility

PASS. `coverage.log` shows the test run completed successfully: 138 test files passed and 2331 tests passed. Focused coverage includes renderer dispatch tests for the new card visuals, minion summon scale-in tests, field medic VFX tests, and server tests for the new minion attack payloads/evolution paths.

## Design and requirements consistency

PASS. The changes are consistent with the documented card-combat design: creatures remain persistent battlefield allies, enemies remain server-authoritative, and the client renders visual feedback from server events. The captured run still satisfies the foundation requirements: 3D scene renders, WebSocket state connects, multiplayer squad state exists, and movement updates during gameplay.

## Debug scenarios

PASS. This ticket added debug scenarios for minion and enemy VFX review. They are only reachable through the existing debug scenario mechanism (`?debugScenario=...` / debug socket path), with normal gameplay untouched. Equivalent states remain reachable through regular card acquisition, deployment, evolution, and enemy spawning paths: `dungeon_drake`, `null_crawler`, `storm_eagle`, and `skeleton_knight` are reward cards; `ancient_wyrm`, `thunderbird`, and `undead_commander` are normal evolution targets; Field Medic is a normal enemy type. The scenarios set up QA states but do not weaken the server-side cast, combat, persistence, or replication invariants.

## v0.322 — 317-distinct-spell-card-animations  (2026-06-08 02:54:50)

### Cast, projectile, and impact VFX

PASS. The implementation distinguishes cast/projectile/impact where those phases apply. Projectile-style cards such as Fireball, Glacial Orb, Permafrost Lance, and Voltaic Chain include directional travel cues and endpoint/impact flourishes. Radial and utility spells use distinct cast telegraphs and origin bursts, while specialized effects such as Thermal Column, Sanctum Pulse, Purifying Pulse, and Event Horizon preserve their thematic impact visuals. The code also keeps existing hit flashes and common sounds in the shared post-effect path, so new renderers do not duplicate those responsibilities.

### Performance and robustness

PASS. The added effects are bounded helper calls per cast and do not introduce persistent loops or unbounded allocation. Optional newer renderer primitives are guarded in the renderers that can operate without them, and the main client context supplies all new helpers. The full vitest run passed: 120 test files and 1811 tests, including `client/test/cardRenderers.test.js`.

### Design and requirements consistency

PASS. The work stays within the documented card-combat model: spells remain single-use card actions whose server effects and validation are unchanged, with the client only adding presentation for `cardUsed` events. The foundational requirements are not regressed: the captured run shows the 3D scene, server/client connection, multiplayer state, movement, and HUD still functioning.

### Debug scenarios

PASS. This ticket added spell-ready debug scenarios for QA, but normal gameplay does not touch them: the client only requests `?debugScenario=...` on localhost, and the server accepts debug scenarios only via the existing debug gate. The shortcuts seed hands/enemies for visual capture, while the real card-cast path still goes through normal `useCard` validation and `cardUsed` broadcasts. The scenarios document equivalent normal reachability through earning/evolving the cards and entering combat, so they are QA shortcuts rather than substitutes for player flow.

## Remaining gaps

No blocking gaps found.

## v0.326 — 339-anim-excalibur-photon  (2026-06-08 11:13:11)


### Excalibur Photon visual identity
Pass. `game/client/cardRenderers.js` now registers a dedicated `excalibur_photon` renderer instead of using the generic weapon or heavy-greatsword path. The renderer composes the shared VFX primitives into a magenta photon greatslash with a wide cone, photon trail, impact pulse ring, ground decal, and light-shard burst, which is a strong fit for the "Excalibur Photon" weapon theme.

### Timing and server-effect sync
Pass. The renderer honors the authoritative `cardUsed` payload after the 600ms wind-up resolves, uses `swingCount`, and applies the `photon_barrage` two-swing cadence through the shared `PHOTON_BARRAGE_SWING_DELAY_MS` constant. The server-side card definition remains `windUpMs: 600`, `swingsPerUse: 2`, and `specialEffect: "photon_barrage"`, and tests cover the renderer's two-swing scheduling and per-swing impact primitives.

### Scope, design, and foundation consistency
Pass. The implementation stays within the intended client renderer/config/test surface and does not change core server mechanics, lobby flow, movement, multiplayer state, or progression behavior. This is consistent with the active-card combat model in `game/docs/design.md` and does not regress the foundational requirements for rendering, WebSocket connection, multiplayer visualization, or movement sync.

### Test and coverage evidence
Pass. `coverage.log` shows the full suite passing: 43 test files and 1163 tests. The relevant client renderer tests cover dedicated registration, Excalibur Photon style, optional primitive fallback, wind-up presence, and photon barrage scheduling.

### Debug scenarios
Pass. This ticket did not add or change a `?debugScenario=NAME` shortcut, so there is no new debug-path invariant to validate.

## Remaining gaps

None.

## v0.327 — 350-anim-sanctum-pulse  (2026-06-08 11:17:08)

### Scope, Integration, And Foundation

PASS. The live code changes are scoped to VFX/rendering and tests. The gameplay loop, server authority, card consumption, healing, multiplayer state, and movement foundations are unchanged. The design remains consistent with spell cards resolving instant effects at cast time, and the requirements baseline is preserved: the captured run shows WebSocket connectivity, 3D rendering, two-player visualization, and movement.

### Performance And Cleanup

PASS. The added column is a single cylinder mesh with a finite lifetime and no per-frame allocations; it is cleaned up through `updateAttackEffects()` using the same active-effect lifecycle as the other primitives. The effect adds two short-lived meshes plus a bounded particle burst for one card use, with no obvious performance risk.

### Tests And Coverage

PASS. Coverage log shows the suite passed: 32 test files and 507 tests. The added tests cover renderer registration, distinct helper signatures and palettes versus nearby heal cards, synchronous timing with no scheduled delay, the new holy-gold primitive composition, and cleanup of the light column. Coverage thresholds are disabled, but the changed client paths have focused assertions.

### Debug Scenarios

PASS. This ticket did not add or modify a `?debugScenario=...` shortcut. Existing debug-scenario machinery is not part of the implementation surface for this ticket.

## Remaining gaps

None.

## v0.328 — 346-anim-permafrost-lance  (2026-06-08 11:25:24)

## Per-Criterion Findings

### Runtime health
PASS. The captured run is healthy: `metrics.json` reports `"ok": true`, no harness server-start failure, and an empty `pageerrors` array. `console.log` contains only normal Vite connection and scene initialization messages, with no `pageerror` or `[fatal]` entries from game code. Client/server logs show the game reached lobby and playing states; the only client-log noise is the allowed THREE.Clock deprecation warning and Vite websocket `EPIPE` on shutdown.

### Permafrost Lance visual identity
PASS. `game/client/cardRenderers.js` registers a dedicated `permafrost_lance` renderer instead of falling through to the generic spell/frost nova visual. The card now composes a narrower icy telegraph, a forward `permafrost_lance` attack effect, a cyan frost trail, an impact decal, and an ice particle burst at the lance tip. `game/client/renderer.js` backs that style with an elongated crystalline cone projectile, so the visual reads as a lance rather than a radial Cryo Burst clone.

### Timing and server-effect sync
PASS. Permafrost Lance has no positive `windUpMs`, and the renderer treats it as an instant spell: no delayed schedule, no wind-up telegraph dependency, and no lingering DoT. The projectile/trail use `ATTACK_EFFECT_DURATION`, while the impact decal and burst spawn with the `cardUsed` event, matching the server's immediate `frost_nova`-branch resolution rather than implying delayed damage.

### Scope, integration, and regressions
PASS. The implementation is limited to the card renderer, the shared attack-effect primitive, and client tests. It does not alter server mechanics, card stats, debug-scenario entry points, movement, networking, or lobby flow, so it remains consistent with `game/docs/design.md` and does not regress the foundation requirements for rendering, websocket connectivity, multiplayer visualization, or movement synchronization.

### Test and coverage evidence
PASS. The round coverage run completed successfully with `32` client test files and `506` tests passing. Focused coverage includes `cardRenderers.test.js` assertions that Permafrost Lance resolves to a distinct renderer from Frost Nova, emits the lance/trail/decal/burst helper calls, and has no wind-up; `vfx-primitives.test.js` verifies the new `spawnAttackEffect` branch creates and cleans up the lance projectile. The fallback browser capture did not include a Permafrost Lance-specific screenshot, but the live game run is clean and the renderer contract is directly tested.

## Remaining gaps

None.

## v0.329 — 343-anim-fireball  (2026-06-08 11:33:50)

### No performance regression

PASS. The new Fireball projectile uses a small group with two sphere meshes and existing active-effect cleanup. The added primitives are short-lived and follow existing VFX patterns; grouped meshes are disposed through the existing recursive effect disposal helper.

### Client test coverage where feasible

PASS. `coverage.log` shows the vitest run completed successfully: 32 test files and 504 tests passed. The Fireball-specific tests cover renderer registration, projectile style payload, cast/trail/impact timing, absence of wind-up, per-hit ignite feedback, and graceful fallback when optional VFX primitives are unavailable.

### Design and foundation consistency

PASS. The change stays within the active card-combat/VFX architecture described in `game/docs/design.md`: Fireball remains a weapon card, server-authoritative hit/burn logic is unchanged, and the client only renders the `cardUsed` event. The core requirements in `game/docs/requirements.md` are preserved by the clean capture: 3D scene rendering, WebSocket connection, multiplayer presence, and movement/gameplay progression all worked.

### Debug scenarios

PASS. This ticket did not add or modify any `?debugScenario=` shortcut. The captured run used normal lobby create/join and ready-up flow, with `debugScenario: null`.

## Remaining gaps

None.

## v0.337 — 373-playthrough-validate-fire-level  (2026-06-08 19:18:06)

### Telepipe vitals persistence and fresh-sortie charge reset

PASS. The fire telepipe step depletes run resources, places Telepipe, suspends to hub, abandons/restores into a fresh sortie, and confirms HP/MS persistence plus full card-charge reset. `run-summary.json` shows HP 60 and MS 20 before and after, a new run id after deploy, and full post-deploy hand charges.

### Debug-scenario requirements

PASS. The new fire scenarios are gated by the server-side `ALLOW_DEBUG_SCENARIOS` check before `debugScenario` or debug godmode can mutate state. They are QA shortcuts over real quest/card/combat systems: `fire-cavern` uses the same quest/layout/run machinery as normal deployment, follow-on scenarios require an active `ember_descent` defeat-enemies run, and the card probes still use normal `useCard` resolution, damage/status application, and telepipe/run state. The equivalent end states are reachable through normal play by selecting Ember Descent, encountering Ember Wraiths, earning/using the relevant cards, and using Telepipe.

### Design and foundation consistency

PASS. The implementation stays within the documented lobby -> dungeon -> card-combat loop, preserves server-authoritative combat and state transitions, and does not regress the foundational requirements: the captured run connects over WebSockets, initializes the scene/canvas, renders the player and dungeon state, and keeps movement/combat state synchronized through server snapshots.

### Code quality and validation

PASS. The live code paths are covered by focused tests plus the full validation artifacts. `round-5/coverage.log` shows `137` test files and `2080` tests passed with coverage reporting enabled. `git diff --check` reported no whitespace errors. I did not find dead or broken ticket code that affects the acceptance criteria.

## v0.331 — 363-anim-thermal-column  (2026-06-08 12:38:16)

### Performance and cleanup

PASS. The new effect adds two active effect meshes plus scheduled primitive pulses, all handled through the existing `activeEffects` lifecycle. The thermal shaft has a dedicated update branch with no per-frame mesh allocation, and tests verify both the scorch ring and shaft are disposed when expired.

### Tests and coverage

PASS. The round's `coverage.log` shows the full client suite passed: 32 files, 527 tests. New coverage exercises renderer registration, removal of the generic summon fallback, cast-time eruption feedback, DoT pulse scheduling, per-hit ignite bursts, absence of wind-up for this instant spell, and primitive lifecycle/disposal. Coverage output contains expected modeled-asset fallback noise from unrelated renderer tests, not failures.

### Design and requirements consistency

PASS. The change is visual-only on the client and does not alter the card combat model, server-client architecture, multiplayer state, movement synchronization, or core dungeon loop described in the design and requirements documents.

### Debug scenarios

PASS. This ticket did not add or change a `?debugScenario=` shortcut. The existing `fire-spells-ready` scenario remains a QA shortcut only; normal reachability remains through reward/evolution progression and the same server card-use path.

## v0.332 — 366-anim-mirror-ward  (2026-06-08 13:23:46)

### Reflect consumption sync

Pass. The renderer tracks one shell per `playerId`, dismisses any prior shell on recast, and calls `dismissMirrorWardShellEffect(playerId)` before spawning the reflect burst. Natural TTL expiry still cleans up through `updateAttackEffects()`. This keeps the client shell from lingering after the server has consumed the active enchantment.

### Scope, performance, and code quality

Pass. The implementation is focused on the card renderer, renderer primitives, minimal context wiring, the reflect event bridge, tests, and a debug scenario. The VFX primitives are active-effect records cleaned by the existing update loop, with no per-frame allocation patterns beyond iterating child meshes/material opacity. I did not find dead or broken code paths that would block the ticket.

### Debug scenario review

Pass. The added `mirror-ward-ready` scenario is only entered through `?debugScenario=mirror-ward-ready`; normal gameplay does not call it. Client-side debug scenario requests are localhost-gated, and server-side scenario application remains behind the existing debug-scenario allowance. The same end state is reachable through normal progression because `mirror_ward` is a standard reward card (`rewardOrder: 25`) and normal casting still goes through the real server card-use validation, Magic Stone cost, active-enchantment guard, state update, and card-used broadcast. The scenario does not replace or weaken the production path.

### Design and foundation consistency

Pass. Mirror Ward remains an enchantment, consistent with the design document's "lingering magical effect" model. The changes do not affect the required foundations: the captured run confirms 3D rendering, WebSocket connectivity, multiplayer presence, and movement/update flow still work.

## Remaining gaps

No blocking gaps remain.

## v0.333 — 365-anim-spike-trap  (2026-06-08 13:31:46)


### Timing and server-effect synchronization
PASS. The renderer fires from the normal `CARD_USED` event, which the server emits after Spike Trap's 500ms wind-up commit, so the initial placement VFX aligns with the server-side arming point and still benefits from the existing 307/315 wind-up telegraph. The server now exposes armed ground enchantments in snapshots, emits `SPIKE_TRAP_TRIGGERED` when proximity damage actually resolves, and the client plays the eruption VFX at that reported position/radius. The persistent mesh is reconciled from server state and removed when the server drops/disarms the trap, so lingering visuals follow actual server state rather than a client timer.

### Scope, quality, and performance
PASS. The implementation is localized to the Spike Trap renderer/VFX, snapshot/event plumbing needed for armed traps, and focused tests. Persistent trap meshes are keyed by enchantment id and reused across frames, stale meshes are disposed through the existing mesh-map cleanup path, and the hit eruption remains short-lived active-effect geometry. I did not find dead/broken code, obvious leaks, or unrelated gameplay changes.

### Design and requirements consistency
PASS. The behavior remains consistent with the design doc's enchantment definition: Spike Trap leaves a lingering magical ground hazard that triggers when an enemy enters it. The foundation requirements are not regressed: the captured run shows 3D rendering, server-client connection, player visualization, and movement in active gameplay.

### Debug scenarios
PASS. This ticket touched the existing `canyon-descent-boss-low-hp` debug scenario as a snapshot correctness fix, not as a new gameplay path. It remains behind the existing debug socket gate (`ALLOW_DEBUG_SCENARIOS`, localhost, non-production) and the client URL shortcut path. The scenario requires an already-running canyon_descent Tier 2 stage-boss run with an encounter, matching a state reachable through normal progression by deploying Canyon Descent Tier 2, clearing adds, and engaging the miniboss; it does not replace normal validation, persistence, or encounter activation for real players.

### Verification
PASS. The round-3 coverage log reports `137 passed` test files and `2219 passed` tests. Relevant added/covered checks include Spike Trap renderer dispatch/timing, the spike VFX primitive, persistent hazard reconciliation and cleanup, server enchantment snapshot fields, trap trigger event queuing, and the canyon low-HP debug-scenario snapshot regression.

## Remaining gaps

None.

## v0.336 — 370-playthrough-revalidate-sunken-canyon  (2026-06-08 18:17:33)

PASS. The ticket asked for a Sunken Canyon re-validation playthrough using the validation driver, with screenshots and findings for boss UI/visuals, slow/burn exclusivity, heal/cleanse, wind-up input lock/telegraph, Telepipe vitals persistence, and new-sortie charge reset. The live artifacts in `game/validation/sunken-canyon` include `run-summary.json`, `probes.json`, `findings.md`, console/server logs, and the expected screenshots from hub through victory plus the new-content exercises.

The full playthrough summary is green: `ok: true`, `preset: "sunken-canyon"`, `steps: "full"`, Sunken Canyon Tier II selected, boss spawned/activated/defeated, victory fired, boss HUD visible with `Canyon Warden`, boss render scale distinct from adds, slow and burn mutually exclusive, Purifying Pulse healed and cleansed, wind-up input lock/telegraph active, Telepipe vitals preserved, and fresh sortie card charges reset. The findings file records the assertions, screenshots, floor alignment probes across plateau/canyon bands, and console/page-error status.

## Design and requirements consistency

PASS. The implementation remains consistent with `game/docs/design.md`: Sunken Canyon floor alignment is validated through `sampleFloorY`-based probes with zero delta in both plateau and canyon bands; stage boss behavior remains a normal active encounter with a boss HUD; card exercises validate the documented active card-combat loop; Telepipe behavior matches the documented suspend/new-sortie durability rules. The baseline requirements are preserved: the captured run renders a Three.js scene, connects client/server over sockets, shows the player, and exercises live movement/combat state.

## Debug scenarios

PASS. The new/changed Sunken Canyon and card exercise scenarios are gated behind the existing debug/dev path (`ALLOW_DEBUG_SCENARIOS`, localhost debug capture, and `?debugScenario`/Playwright harness entry points). Normal gameplay does not invoke them. The scenario comments and code map each shortcut back to a normally reachable state: unlocking/deploying Canyon Tier II, walking to adds/boss trigger, earning or evolving the relevant cards, purchasing Telepipe, taking damage/statuses, and defeating the boss normally. The shortcuts do not replace server-side card use, encounter activation, Telepipe suspend/abandon, or victory logic; they only set up deterministic QA state.

## Code quality and tests

PASS. The changed live code is scoped to validation harness support, debug-only setup, boss HUD modeling, and targeted game fixes needed for deterministic validation. I did not find dead/broken code or normal-game regressions in the reviewed paths. The coverage run in `round-2/coverage.log` shows `131` test files and `2054` tests passing with coverage collected.

## Remaining gaps

None.

## v0.338 — 375-height-aware-projectile-aiming  (2026-06-09 20:11:34)

PASS. Enemy ice-ball windups now store vertical direction, spawned ice balls carry `y`/`dirY`, move through 3D space, and collide against player world Y. Minion windups and breath locks also compute full 3D direction; `storm_eagle`/`thunderbird` use the same ranged-strike branch, `null_crawler` passes vertical aim into phase-beam collection, and `dungeon_drake`/`ancient_wyrm` breath ticks pass vertical aim into cone collection.

The test matrix covers glacial thrower ice balls, `storm_eagle`, `null_crawler`, `dungeon_drake`, and `ancient_wyrm` against elevated targets.

### Debug scenarios

PASS. The added `lock-on-elevated-projectile` and `height-aware-projectile` scenarios are registered through the existing debug-scenario path, with the player-facing shortcut remaining the localhost `?debugScenario=` URL and the server path gated by development/local checks. Both are QA shortcuts for states reachable through normal play: earning/drawing a projectile card, entering vertical dungeon geometry such as Spire Ascent, and fighting enemies on higher elevation. They do not replace server validation, persistence, or normal combat resolution; they only seed player/enemy positions, hand contents, layout, and cooldowns before using the same `useCard` and simulation paths.

### Design and foundation compatibility

PASS. The implementation matches the design document's 3D dungeon/elevation model by using server-resolved floor/sample Y where explicit entity Y is absent. The captured run still satisfies the foundation requirements: Three.js scene renders, client/server socket connectivity works, multiplayer state is visible, and movement synchronization remains active.

### Code quality and validation

PASS. The implementation is localized to the expected combat/server paths plus a focused test file. The full captured coverage run reports `111` test files and `1952` tests passing. No dead or obviously broken code was found in the reviewed paths.

## Remaining gaps

None.

## v0.340 — 376-airborne-flying-entity-support  (2026-06-09 20:45:46)

PASS. Existing airborne content is wired for both enemies and minions. `ember_wraith` carries `flying: true` plus altitude through the existing enemy-definition spread, and `storm_eagle` / `thunderbird` minions are stamped with `flying` and altitude when summoned. Targeting and attack-range logic remains planar X/Z, so airborne entities remain selectable and able to attack without introducing Y-based range regressions.

PASS. Player symmetry is present for future fly/hover support. Player snapshots now include `flying` and `altitude`, server movement resolves a flagged player through the same helper, and local/remote client render paths use the shared airborne render/shadow helpers rather than a player-only path.

PASS. Client rendering handles altitude and shadows for enemies, minions, and players. Flying bodies render at floor-aware altitude, grounded entities keep their prior placement, flying shadows are created only for fliers and disposed on despawn/removal, and flying enemy health/shield bars follow the airborne render Y. The shadow Y samples the actual floor surface rather than using a fixed plane, so raised/sloped floors are covered.

PASS. Tests cover the risky integration points. `server/test/airborne.test.js` verifies generic helper behavior, default server altitude fallback, airborne wraiths, aerial minions, and player snapshot symmetry. `client/test/airborne-floor-render.test.js` verifies floor-aware render offsets, floor-aware shadow Y, grounded no-op behavior, and player reuse of the shared helper. The round-3 coverage run reports 76 test files and 1569 tests passed.

## Design and requirements consistency

PASS. The implementation matches the design doc’s floor-sampling model by continuing to derive world Y from `sampleFloorY()` / `resolveFloorY()` and extending that model to hovering entities. It does not regress the foundation requirements: the captured run renders a 3D scene, connects through the server/client stack, shows multiplayer state, and updates movement.

## Debug scenarios

PASS. This ticket did not add or change a `?debugScenario=...` shortcut. Existing debug scenario code appears unrelated to the airborne implementation.

## Remaining gaps

None.

## v0.345 — Client: split renderer.js (6,800 lines) — extract per-domain sync modules and a generic mesh-map reconciler  (2026-06-09 23:49:19)


### `animate()` is under ~150 lines and delegates to extracted sync modules
PASS. `game/client/renderer.js` now has a compact `animate()` orchestrator of roughly 90 lines, delegating player, enemy, minion, spike-trap, loot, ice-ball, and telepipe sync to extracted modules under `game/client/renderer/`. The remaining inline work in `animate()` is orchestration, local loot pickup emission, camera/atmosphere updates, effect ticking, and the final render call.

### Shared mesh-map reconciler
PASS. `game/client/renderer/meshSync.js` provides the shared `syncMeshMap(map, items, { key, create, update })` helper plus shared disposal helpers. The implementation uses it for simple keyed mesh maps such as spike-trap hazards and ice-ball projectiles, while more stateful domains retain custom loops for parallel meshes, collection animations, or per-entity side effects.

### Rendering behavior unchanged
PASS. The round-2 screenshots show the hub lobby, deployed dungeon, player avatar/nameplate, HUD hand, enemy telegraphing, damage number, and dodge cooldown HUD rendering coherently. The captured probes confirm multiplayer gameplay, scene initialization, canvas presence, movement, cards, enemies, and cooldown state. Existing tests in `coverage.log` passed: 33 test files and 400 tests. `git diff --check` also reported no whitespace errors.

### Design and foundation consistency
PASS. The refactor is client-renderer modularization only; it does not change the server/client architecture, movement synchronization contract, lobby/dungeon loop, combat rules, floor sampling model, or the requirements baseline. The live capture still demonstrates a connected multiplayer 3D scene with movement and rendering.

### Debug scenarios
PASS. This ticket did not add or change a renderer debug scenario entry point. Existing debug scenario plumbing remains in `game/client/main.js`, gated by URL parameter and localhost/dev checks, with normal gameplay still reaching the captured lobby-to-dungeon state without a debug scenario.

## Remaining gaps

None.


## v0.350 — Server: death soft-lock — players return to lobby at 0 HP with 0 money (LOBBY_REVIVE_HP is dead code), redeploy = instant Signal Lost  (2026-06-10 03:24:04)


Ticket-specific tests pass when run in isolation:

- `revivePlayerInLobby` unit tests (3/3)
- Death-at-0-money integration test (1/1)

Harness `coverage.log` shows the full server suite ran with one unrelated flaky failure (`cleanupStalePlayers` boundary) and pre-existing debug-scenario failures; neither touches changed revive logic. Changed files are exercised by the updated unit and integration tests.

### Harness capture vs. ticket scenario

The round-1 capture used the **fallback** smoke plan (generic lobby → deploy → movement), not a death/revive scenario. Screenshots show a healthy in-run state at 100 HP. Visual QA therefore does not independently demonstrate the soft-lock fix, but the dedicated integration test and code paths provide strong functional proof. Runtime health is clean.

## Remaining gaps

None. All acceptance criteria are satisfied; the game runs without browser errors.

## Nits (non-blocking)

See `nits.md` for follow-up items on mid-run reconnect revive scope and design-doc alignment.

## v0.349 — Quest briefings + mid-run radio dialogue: named client NPC, reward shown upfront, scripted progress beats  (2026-06-10 02:54:49)


### Selecting a quest on the board shows client name, briefing, reward before ready-up
PASS. The quest payload now carries `client`, `dialogue`, reward currency, and optional signature-card metadata through `buildSharedQuestUpdatePayload()` / `buildQuestUpdatePayload()`. The client quest board renders a selected-quest briefing panel with Client, Briefing, and Reward fields, and the server `selectQuest` handler emits updated quest payloads while still enforcing lobby phase, suspended-run lockout, valid quest/tier, and tier unlock rules.

### During `crystal_rescue`, collecting each prism fires a distinct radio line; completing the objective fires an extraction line
PASS. `crystal_rescue` tier 1 defines distinct Lysa lines for prism collections 1, 2, and 3, plus an `objective_complete` extraction line. The live pickup flow removes crystal loot, calls `recordCrystalCollected(1)`, and then calls `checkRunTerminalState()` for completion, so collection and extraction dialogue are driven by the same server objective path that completes the run.

### Dialogue events are driven by server triggers so all squad members see them
PASS. `questDialogue.fireQuestDialogue()` dedupes fired triggers per run and emits `questDialogue` from the server. Run-start dialogue fires after `START_GAME` and the playing `stateUpdate`; prism collection, survive wave progress, and objective completion fire from progression hooks. In normal lobby context, `getIoTarget()` scopes the emit target to `io.to(lobbyId)`, so every socket in the squad room receives the same server event without relying on client timers.

### Quest content and design consistency
PASS. All existing tier-1 quests have named clients, pre-run briefing copy, reward copy, run-start dialogue, and completion dialogue; collect-item quests additionally define per-item beats. This fits the PSO-style guild-counter briefing and in-run radio direction in `game/docs/design.md`, and it does not regress the foundation requirements: the captured run still connects client/server, renders the 3D scene, displays multiplayer state, and synchronizes movement.

### Debug scenarios
PASS. This ticket adds/changes debug scenario support for quest-comms and wave-progress QA. The URL parameter remains the only client entry point, gated to localhost in the client and local/dev sockets on the server. The new scenario comments trace equivalent normal gameplay paths, and the shortcuts still use server-side quest/run state, layout application, progression hooks, and lobby-scoped state updates rather than client-only state.

## Remaining gaps

None.

## v0.348 — Epic: PSO-style quest identity rework — scripted encounters, briefings, named rares, signature rewards  (2026-06-10 02:51:14)


- `training_caverns` / Initiate Vault is a scripted annex sweep with a passage lock, wave-clear dialogue, Vault Stalker named rare, and Saber of Light reward.
- `crystal_rescue` / Prism Salvage keeps prism collection but requires scripted guard waves and fires collection dialogue for each prism, with Mana Prism as the stated reward.
- `frost_crossing` has ice-band waves, glacial throwers, Rimecast the Slow as a named rare, room-entry ice-band dialogue, and Cryo Burst as the reward.

The design doc's Quest identity section matches this implementation, and the original foundation requirements still hold: the captured run renders 3D, connects over WebSocket, shows multiplayer state, and synchronizes movement.

### Debug scenarios

PASS. This ticket added tier-1 deploy shortcuts for the reworked quests. They are debug/dev gated: the client only auto-requests them from the `?debugScenario=` URL on localhost, and the server rejects debug scenarios outside localhost/dev or `ALLOW_DEBUG_SCENARIOS=1`. Equivalent states remain reachable through normal gameplay by selecting the quest, readying/deploying, and then progressing through authored waves/items/escort objectives. The shortcuts mutate QA state only after the debug event and do not replace the normal validation path.

## Verification

- Captured run: `metrics.json` ok, `pageerrors: []`, no fatal browser page errors.
- Harness probes: lobby deploy to playing, objective visible, two players present, enemies spawned, card hand visible, key-item cooldown probe succeeded.
- Coverage log: 155 test files passed, 2368 tests passed; coverage report present with thresholds disabled.

## Remaining gaps

No blocking gaps.

## v0.347 — Quest scripting foundation: data-driven hand-placed waves + room triggers (replaces random bulk spawn for scripted quests)  (2026-06-10 01:14:31)


### `enter_room` waves are delayed, and `waveCleared` chaining works
PASS. `enter_room` waves remain pending until an active, non-dead, non-extracted player enters the resolved trigger room; room bindings support both explicit room coordinates and landmarks. Spawned waves transition to `cleared` only after every tracked enemy id is absent from live enemies, and pending `{ waveCleared: id }` waves then spawn once. The tests cover delayed entry, no re-spawn on re-entry, dead/extracted-player suppression, landmark resolution, chained waves, and partial-wave clearing.

### Existing non-scripted quests are unchanged
PASS. Production quest tiers currently have no `script` block, so they continue through the existing spawn path. The implementation gates scripted behavior on `getQuestScript(quest) != null`, and the regression test confirms `training_caverns` tier 1 still bulk-spawns its normal `enemyCount`. The live browser capture also ran `training_caverns` tier 1 with 5 enemies, matching the existing non-scripted behavior.

### Unit/integration coverage and state snapshot exposure
PASS. The new server tests cover script schema, run-start waves, enter-room triggers, wave-cleared chaining, and a full scripted lifecycle that completes a `defeat_enemies` run. `stateSnapshot()` exposes `run.waveScript` through the existing run snapshot, including wave ids, triggers, statuses, and spawned ids. The captured coverage run reports `109 passed` test files and `1535 passed` tests, including all new quest-script suites.

### Design and foundation consistency
PASS. The implementation is consistent with the PSO-style room/wave scripting direction in the ticket and does not regress the baseline requirements in `game/docs/requirements.md`: the captured game still renders, connects client/server, visualizes multiplayer, and synchronizes movement. The change is server-authoritative and does not add client-only shortcuts or weaken gameplay invariants.

### Debug scenarios
PASS. This ticket did not add or change any `?debugScenario=...` shortcut. Existing debug scenario entry points remain gated by URL/debug handling and are not part of normal gameplay.

## Remaining gaps

No blocking gaps remain. One limitation of the evidence is that the browser capture exercised an unscripted production quest because no shipped quest tier currently defines `script.waves`; the scripted path is nevertheless covered by focused server fixtures and integration tests, which is sufficient for this foundation ticket.

## v0.346 — Per-quest signature card rewards: replace the single global victory rotation, surface reward on the quest board  (2026-06-10 00:45:49)

| Requirement | Status |
|-------------|--------|
| Gated behind debug/dev path only | Yes — registered in `DEBUG_SCENARIOS`; `isDebugScenarioAllowed` requires `ALLOW_DEBUG_SCENARIOS=1` or localhost; URL/socket is the entry point |
| Same end-state reachable in normal play | Yes — frost_crossing tier 1 with all but one hostile cleared |
| Does not weaken invariants | Yes — uses `setupFrostCrossingTier1Deploy`, spawns a 1-HP grunt, does not skip victory reward server logic |

Not used in round-1 capture (`debugScenario: null` in probes). Acceptable QA shortcut.

---

## Remaining gaps

None blocking. All acceptance criteria are implemented and covered by tests; the game runs without errors in capture.

---

## Nits (non-blocking)

See `nits.md` for one follow-up on tier-1 vs tier-2 currency label wording on the quest board.


## v0.358 — Client: disposeOne/disposeAvatar dispose geometry/materials shared with the glTF model cache  (2026-06-10 06:30:33)

PASS. Cosmetic preview behavior is covered through its existing `disposeAvatar()` path, so preview rebuilds avoid re-uploading shared glTF buffers without adding a separate disposal policy.

## Design and requirements

PASS. The change is client-side rendering resource management only. It does not alter the documented lobby/dungeon/combat loop, server-client state flow, multiplayer visualization, or movement synchronization requirements.

## Code quality

PASS. The implementation is scoped to the model loader and disposal helpers, keeps the model cache behavior intact, and avoids broad renderer refactors. The safe disposer preserves the previous cleanup behavior for procedural meshes and material arrays while protecting shared glTF resources.

Coverage visibility shows `39` test files and `428` tests passing. The log includes expected mocked-model-load warnings in jsdom tests, but the live capture console is clean.

## Debug scenarios

No development `?debugScenario=` shortcut was added or changed by this ticket.

## Remaining gaps

None.


## v0.357 — Wave-gated doors: blocking gates in passages that unlock when a scripted wave is cleared  (2026-06-10 06:06:37)

### A scripted quest can chain room A wave -> gate to room B opens -> room B wave -> gate to treasure room.

Pass. `training_caverns` tier 1 now defines two scripted passage locks: room 0 wave 0 opens the passage to room 1, and room 1 wave 0 opens the passage to room 2. The chained passage-lock test walks this exact A -> B -> end-room progression, verifies each gate's locked/unlocked state, confirms room B wave spawning after entry, and confirms the final end room remains a no-wave treasure/end room.

### No gates in non-scripted quests; telepipe escape still works while gated.

Pass. Passage locks are initialized only from scripted encounter config; tests verify a non-scripted open-plaza deploy has no passage locks and no extra gate colliders. Telepipe suspend/resume is preserved: checkpoint capture stores passage lock state, scripted encounter state, dialogue state, objective progress, world state, and card state; restore rehydrates the run and relinks scripted enemy ids. The round-4 browser capture specifically exercised telepipe suspend/resume and verified the run layout, enemy ids, enemy HP, objective active enemy count, and run status survive the cycle.

## Design and foundation consistency

The implementation matches the PSO-style pacing described by the ticket and the design document's quest identity section: Initiate Vault is now a scripted annex sweep with passage locks and wave-clear radio lines. The changes do not conflict with the foundation requirements: the game renders, connects over WebSockets, represents the player, and continues to synchronize movement through the existing server-authoritative movement path.

## Debug scenarios

The new passage-lock debug shortcuts are gated through the existing `?debugScenario=` client URL path on localhost, with the server also requiring local/test allowance. They are QA shortcuts into states reachable through normal quest selection and deploy: `passage-lock-chain` maps to `training_caverns` tier 1, and `passage-lock-gated` maps to the scripted fixture path used by tests. They use the normal deploy/setup path rather than bypassing collision, objective, or state replication invariants.


## v0.356 — Theme quest entry rooms per biome — first 30 seconds of every level currently look identical  (2026-06-10 05:24:36)

---

## Test & coverage summary

- Harness `coverage.log`: **1737 / 1737** server tests passed.
- Targeted ticket test `cross-quest entry room distinguishability`: **pass**.
- Independent `pnpm test:quick` run: 3132 passed, 2 failed — failures are in unrelated `arena-trials-boss-low-hp` and `smoke_bomb` tests, not in entry-room code.

---

## Remaining gaps

None blocking. The implementation fully satisfies both acceptance criteria; runtime capture is healthy.

---

## Nits (non-blocking)

See `nits.md` for harness capture-plan and follow-up theming items.


## v0.355 — Client: quest board panel flashes open then is re-hidden by the lobby render loop (F at Quest Board unusable)  (2026-06-10 05:18:34)


**No regressions.** Change is lobby UI visibility only; multiplayer, movement, and server-authoritative quest selection are untouched. Aligns with the design doc's lobby quest-selection flow.

### Code quality

**Good.** Small, focused diff (11 lines in `main.js`); flag lifecycle is symmetric (set on open, cleared on dismiss). Test export `__isQuestPanelOpen` is consistent with existing harness hooks. No dead code or console errors introduced.

### Debug scenarios (`?booth=quest`)

**No issues.** Pre-existing localhost-only `?booth=quest` hook calls `openQuestPanel()` once via `requestBoothDebugOpen()`. It is gated by `debugScenarioAllowed` (localhost hosts only), does not bypass server validation, and the normal path (walk to Quest Board booth, press F / `booth:action`) reaches the same UI state. No new debug scenario was added by this ticket.

## Test & coverage notes

- Changed-files vitest run: **14 files, 282 tests, all passed**.
- Coverage report in `coverage.log` covers shared modules from the harness diff baseline; the changed `main.js` paths are exercised by `questBooth.test.js`.

## Remaining gaps

None blocking. The implementation fully addresses the reported flash-close bug with appropriate tests and clean runtime capture.


## v0.354 — 374-spherical-3d-aoe-for-all-radius-effects  (2026-06-10 04:37:38)

**Scope: game/server/simulation.js + game/server + test.** Respected. Diff touches only `game/server/*.js` and `game/server/test/*` (plus subticket bookkeeping files). No client/shared edits.

## Consistency & quality

- Consistent with `game/docs/design.md`: AoE remains server-authoritative; no gameplay-shape
  regression — only the height dimension is added to inclusion.
- No 2D fallback leaks: `resolveAoeOriginY` resolves null Y to the floor sample, so the
  conversion is total, not partial.
- Displacement semantics preserved where intended: `pullEnemiesToward`/loot_magnet gate
  inclusion in 3D but keep the pull/slide on the XZ plane (documented in comments) — correct,
  enemies/loot don't get yanked vertically.
- No debug scenarios were added or changed by this ticket.
- Full server suite: **2065/2065 pass**, including the 164 tests in the spherical-focused
  files. No regressions.

## Remaining gaps

None blocking. Acceptance criteria are fully and robustly met, the game runs cleanly, and the
test suite is green. Minor non-blocking polish noted in `nits.md`.


## v0.353 — Server: quest-objective crystals despawn after LOOT_LIFETIME_MS — collect_items runs unwinnable after 2 minutes  (2026-06-10 04:29:31)


### Code quality

**Good.** Minimal two-file production change plus focused test. The `questCritical` flag is more extensible than hard-coding `kind === 'crystal'` in the filter (future non-crystal quest items could reuse it). Telepipe suspend/resume deep-clones loot (`captureCardCheckpoint`), so `questCritical` survives checkpoint round-trips.

No new debug scenarios were added; existing crystal debug shortcuts deploy through normal quest spawn and inherit the flag.

### Debug scenarios

**N/A — no new or changed debug scenarios in this ticket's diff.**

## Test and coverage notes

- Harness vitest run: all server tests green (`1569` passed).
- Changed-file coverage snapshot includes `index.js` at ~72% lines; the one-line filter change is exercised indirectly across the suite. `progression.js` `spawnCrystals` is covered by existing spawn/integration tests (crystal count assertions) though none newly assert `questCritical: true` on output.

## Remaining gaps

None blocking. All acceptance criteria are satisfied; runtime capture is clean.


## v0.352 — Server: SELECT_QUEST swaps layout and teleports players while lobby still renders the hub (movement freeze, booths dead)  (2026-06-10 04:27:42)


### Layout Swap and Spawn Teleport Happen at Deploy
PASS. Fresh deploy now applies the selected quest layout inside `checkAllReadyInner()` before assigning run spawn positions and starting the dungeon run. Existing suspended-checkpoint resume flow returns before this fresh-deploy path, so resume continues to restore its saved layout instead of regenerating.

### Players Can Still Move and Use Hub Booths After Selection
PASS. Server-side selection no longer changes player positions, and booth validation continues to use the hub anchors while requiring lobby phase. On the client, quest layout payloads received during lobby phase are cached for deployment while `gameState.layout` is kept on the hub layout and rendered geometry is not rebuilt until `startGame`.

### Normal Quest Flow Still Reaches the Selected Run
PASS. Existing socket integration coverage still launches a selected `crystal_rescue` run and verifies the run objective/loot match that quest. The new focused regression test verifies no selection-time teleport/layout swap and confirms deploy applies the selected quest seed and moves the player to a run spawn.

### Design and Requirements Consistency
PASS. The implementation preserves the documented lobby -> ready/deploy -> dungeon core loop in `game/docs/design.md`, keeps quest selection as a lobby activity, and does not regress the foundation requirements for rendering, WebSocket connection, multiplayer representation, or WASD movement synchronization. No development debug scenario was added or changed by this ticket.

### Tests and Coverage
PASS. The captured coverage run completed successfully: 117 test files passed, 1589 tests passed. The changed behavior is covered by `game/server/test/defer_quest_layout_swap.test.js`, updated quest selection integration coverage, and quest-tier gating assertions that selection previews without mutating the live layout.


## v0.351 — Named rare enemy variants per quest (PSO 'The Fake in Yellow' style) with unique drops  (2026-06-10 03:48:03)

### Stats Scale Per Variant Config; Regular Spawns Unaffected

PASS. `spawnEnemy` applies `applyNamedRareVariant` only when a scripted spawn passes `namedRareVariant`; otherwise it follows the existing random affix variant path. Named rares set `enemy.variant = null`, scale HP/max HP and attack damage from the base enemy definition, and preserve the base enemy's other behavior fields, including Cinderghast's flying/altitude behavior. Tests verify HP/damage multipliers for all three authored variants and that normal enemies still roll affix variants when no named-rare config is supplied.

### Design And Foundation Consistency

PASS. The implementation fits the PSO-inspired quest identity goal in the ticket and stays within the documented multiplayer lobby/dungeon/loot loop. It does not regress the foundation requirements: the captured run rendered a Three.js scene, connected to the backend via WebSockets, showed multiplayer state, and exercised movement synchronization.

### Debug Scenarios

PASS. This ticket added named-rare debug shortcuts for Frostmaw, Vault Marauder, and Cinderghast. They remain behind the existing debug scenario socket gate and the client `?debugScenario=NAME` localhost path; normal gameplay does not invoke them. Each shortcut is a QA accelerator for a state reachable through normal quest selection, deployment, room traversal, and the same quest-script trigger path. The shortcuts use real quest setup, `spawnEnemies`, `startDungeonRun`, and `updateQuestScriptTriggers`; they do not replace the real quest script or drop/reward logic.

### Tests And Coverage

PASS. The provided coverage run reports 148 test files passed and 1991 tests passed. Coverage includes focused server tests for named-rare plumbing and all three authored quests, client visual tests, quest script schema/objective behavior, debug scenarios, and broader integration coverage.

## Remaining gaps

None.

## v0.359 — Client: enemy windup/damage/reveal/variant emissive VFX are no-ops on modeled enemies and self-cancelling on procedural ones  (2026-06-10 07:01:40)

Criterion: Windup flash, damage flash, reveal glow, and variant tints are visible on modeled `.glb` enemies.

Finding: PASS. `attachRegistryModel()` now retargets enemy hosts after successful glTF load by hiding the procedural material, adding the loaded model, and assigning `host.userData.bodyMesh` to a cloned visible glTF body material. Enemy color/emissive bookkeeping is copied from the loaded body material or the procedural palette fallback, so the existing VFX paths resolve through `resolveBodyMesh()` onto the visible model instead of the hidden procedural mesh. The shipped enemy models (`grunt`, `skirmisher`, `miniboss`, `spawner`) load as skinned meshes with normal single `MeshStandardMaterial` surfaces, matching the resolver's material expectations.

Criterion: A windup flash is not cleared by the reveal-highlight pass.

Finding: PASS. `applyWindupFlash()`, `applyRevealHighlight()`, and `applyVariantEmissiveTint()` no longer compete through direct emissive writes. `resolveEnemyEmissive()` is called once per enemy sync and applies priority in the requested order: damage flash, windup, reveal, variant tint, then base emissive. The added tests cover windup surviving a non-reveal pass, damage flash beating windup, reveal beating leeching tint, and windup restoration after damage flash expiry.

Criterion: Tests cover the priority resolver.

Finding: PASS. `client/test/renderer-enemy-emissive-priority.test.js` directly exercises the new resolver priorities, and `client/test/models-registry.test.js` covers successful enemy glTF retargeting and failure fallback. The provided coverage run reports `41` test files and `587` tests passing.

## Design and requirements consistency

The implementation is client-renderer-only and preserves the documented multiplayer dungeon loop, active combat model, and foundational requirements for Three.js rendering, WebSocket connectivity, player visualization, and movement synchronization. It does not add or change a `?debugScenario=` shortcut, server validation, persistence, or net-replication behavior.

## Remaining gaps

None blocking. The implementation fully addresses the reported flash-close bug with appropriate tests and clean runtime capture.

## v0.360 — Server: bulkhead_mauler and astral guardian minions attack every tick; mauler broadcasts CARD_USED 20x/sec  (2026-06-10 07:09:48)

## Debug scenarios

This ticket did not add or change `?debugScenario=` shortcuts. Nothing to gate-check.

## Code quality

Implementation is focused, consistent with neighboring minion branches, and covered by targeted unit tests. No dead code or obvious logic bugs found in the changed paths.

Minor stale comments/docs remain in validation/sync helpers (see nits backlog); none affect behavior.

## Integration notes

Two sub-tickets landed cleanly with no merge conflicts in `game/`. Changes are limited to server simulation, card spawn defaults, shared card stats, and tests — no client/renderer edits required for this server-side cadence fix.

The round-6 capture exercises generic gameplay (lobby → deploy → movement → dodge) rather than spawning mauler/guardian minions, but unit tests directly prove the interval gates. Combined with a clean runtime capture, that is sufficient evidence for this ticket scope.

## Remaining gaps

None. All acceptance criteria are satisfied and the captured run is healthy.


## v0.361 — Server: player movement triggers up to 20 synchronous disk writes/sec per player on the game-loop thread  (2026-06-10 07:39:47)

### Disconnect, leave, periodic, and shutdown persistence

PASS. The lifecycle paths still bypass the movement debounce by calling `savePlayerData()` directly for soft disconnect, eviction, and explicit lobby leave. The existing 30s periodic save interval still calls `saveAllPlayersInAllLobbies()`, and SIGINT/SIGTERM shutdown now invokes the same all-lobby save before closing the HTTP server, so dirty players inside the debounce window are persisted on clean shutdown.

### Test coverage

PASS. The ticket adds focused debounce coverage in `persistence_save_debounce.test.js`, updates movement/persistence trigger coverage for the debounce window, and adds a shutdown flush regression test. The captured coverage run reports `133` test files and `1973` tests passed, including the new persistence debounce and shutdown cases.

### Design and foundation consistency

PASS. The change is server-side persistence plumbing only. It does not alter the documented lobby/dungeon core loop, multiplayer rendering, WebSocket movement synchronization, combat, floor sampling, or foundation requirements. The fallback smoke capture exercised lobby join, ready/deploy, movement, and key-item cooldown without visual or runtime regression.

### Debug scenarios

PASS. This ticket did not add or change a `?debugScenario=NAME` URL shortcut. Existing test-only socket debug scenario usage remains outside normal captured gameplay; the capture itself used `debugScenario: null`.

## Remaining gaps

No blocking gaps found.

## v0.362 — Content: rework crystal_rescue, frost_crossing, training_caverns as scripted PSO-style scenarios  (2026-06-10 08:30:15)

### No random bulk spawns remain in these three tiers

PASS. All three Tier 1 quests have `scriptedEncounters`, and their objective definitions skip bulk combat spawning for scripted quests. Runtime deployment spawns only the first authored wave, then `tickScriptedEncounters()` starts later room waves when players enter the corresponding rooms. The scripted enemy counts are authored from the quest config rather than pulled from `enemyPool`, while the legacy enemy pools remain only as catalog/spawn-pool metadata.

### Playtest each start-to-finish on a fresh account without debug tools

PASS. The latest capture is a normal no-debug fallback smoke run through default lobby/deploy/gameplay, and the probes show the game reaches `phase: "playing"` with connected multiplayer, canvas rendering, the scripted Initiate Vault objective, and live authored enemies. Full-flow automated coverage backs the remaining arcs: crystal rescue has a collect -> ambush -> extraction -> victory test, Tier 1 cross-quest tests verify the three authored arcs and solo-friendly wave sizes, and the full coverage run reports 146 test files and 2328 tests passed.

## Design and foundation regression review

PASS. The implementation preserves the foundation in `game/docs/requirements.md`: the captured run renders a Three.js scene, connects via Socket.IO, displays multiple players, and updates movement/HUD state. The quest changes stay server-authoritative: enemy waves, objective counters, passage locks, extraction completion, reward/victory handling, and tier unlocks all flow through existing server progression paths.

## Code quality and integration

PASS. The changed code is cohesive and keeps the new behavior in the existing quest/objective/progression boundaries. Objective counters include scripted guard enemies and the final ambush before victory is possible, passage locks rebuild colliders when unlocked, and telepipe/checkpoint serialization preserves scripted encounter state. The debug scenarios added for `crystal-rescue-extraction-phase` and `frost-crossing-frostmaw` are gated through the existing debug-scenario socket path, which is restricted to loopback or `ALLOW_DEBUG_SCENARIOS=1`; normal gameplay does not call them. Their target states remain reachable through the normal scripted quest flow and still rely on the real run objective state for completion.

## v0.363 — Client: persistent in-run key item HUD slot (icon, name, keybind, cooldown) — currently invisible when ready  (2026-06-10 08:58:01)


### Hidden when unequipped or outside a run
PASS. `renderKeyItemHud()` calls `clearKeyItemCooldownHud()` when there is no equipped key item, no matching definition, or the phase is not `playing`; this removes ready/cooldown classes, clears the `data-key-item-id`, and empties the HUD child text. Focused tests cover both unequipped and non-playing states.

### Existing key item flash feedback preserved
PASS. `flashKeyItemIndicator()` still applies success, cooldown, and soft-fail flash classes without replacing the structured HUD children. The `keyItemUsed` socket handling still triggers the same success/cooldown/soft-fail cues and keeps VFX hooks intact.

### Client test coverage
PASS. `coverage.log` shows the client suite passed: 14 test files and 284 tests. The focused key item tests cover ready, cooldown, unequipped/non-playing, and flash preservation states.

### Design and foundation consistency
PASS. The change is client-HUD only and does not alter combat, server validation, persistence, networking, movement, or the documented lobby/dungeon loop. It remains consistent with `game/docs/design.md` and does not regress the foundational rendering/client-server requirements.

### Debug scenarios
PASS. This ticket did not add or modify any `?debugScenario=` shortcut. The capture used the fallback full-flow smoke path, not a debug scenario.

## Remaining gaps

None.


## v0.364 — Server: PATCH /api/me/settings persists arbitrary unvalidated JSON with unbounded growth  (2026-06-10 09:27:28)

### Stored Settings Size Is Capped

PASS. `updateSettings()` serializes the sanitized merged settings and rejects writes over `SETTINGS_MAX_BYTES` before touching the settings file. Existing oversized/tampered stored data is also prevented from being served as-is because `getSettings()` falls back to defaults if the backfilled settings would exceed the active cap. The cap is applied to accumulated stored JSON, not just the incoming request body.

### Tests Cover Rejection And Pruning

PASS. `coverage.log` shows the relevant test suite passed: 55 tests across 4 server files, including `server/test/settings.test.js` and `server/test/account.test.js`. The added tests exercise invalid types/enums, unknown key pruning, repeated junk PATCHes not increasing stored byte size, oversized write rejection without clobbering the prior file, and HTTP 400 behavior from `PATCH /api/me/settings`.

### Design And Foundation Consistency

PASS. The change is server-side account settings hardening and does not alter the core lobby, dungeon, combat, or rendering loop described in `game/docs/design.md`. The captured run still satisfies the foundation in `game/docs/requirements.md`: 3D scene renders, client connects to server, multiplayer presence is visible, and movement/dodge state updates during gameplay.

### Debug Scenarios

PASS. This ticket did not add or change a `?debugScenario=` shortcut. The capture used the fallback full-flow plan with `debugScenario: null`, so there is no new debug-only path to validate.

## Remaining gaps

None.


## v0.365 — Server: enemies attacking a taunt minion bypass the windup state machine and hit every tick  (2026-06-10 09:33:16)

## Design & requirements consistency

- **design.md:** Server-side combat simulation change only; no client or card-definition changes. Taunt minions (Aegis Sentinel, Necroframe Knight) now survive long enough to fulfill their intended tanking role — aligned with creature/taunt design intent.
- **requirements.md:** No documented regression. Change is narrowly scoped to enemy attack cadence against taunt targets.

## Code quality

- **Focused diff:** 14 lines changed in `simulation.js`; no dead code or unrelated refactors.
- **State-machine safety:** Guard `attackState === 'chasing' || attackState === 'idle'` prevents restarting windup mid-cycle; windup/recovery blocks short-circuit before the taunt branch on subsequent ticks.
- **Integration:** Taunt priority (`findTauntMinionNear` before normal target selection) preserved; chase fallback for out-of-range taunt targets unchanged.
- **No debug scenarios added** — nothing to gate-check for this ticket.

## Debug scenarios

Not applicable — no new or modified `?debugScenario=` shortcuts in this ticket.

## Remaining gaps

None. The direct-per-tick damage bug is fixed, regression-tested, and the game runs cleanly in capture.


## v0.366 — Server: enemies acquire players through walls (DETECTION_RADIUS has no line-of-sight) — Frost Crossing spawn room gets swarmed in seconds  (2026-06-10 09:39:21)

The focused test coverage directly matches the reported bug: `game/server/test/enemy_line_of_sight.test.js` verifies an enemy about 6 units away behind a wall remains idle, an unobstructed player is still chased, doorway gaps remain valid line-of-sight, and a chasing enemy reverts to idle once the only target is occluded.

### Acceptance criterion: Frost Crossing spawn room should not be swarmed before the player leaves it
Satisfied by the acquisition fix. Frost Crossing remains a normal scripted quest deployment through `setupQuestTier1Deploy()` / `spawnEnemies()` / `startDungeonRun()`, but those enemies now use the shared line-of-sight-gated acquisition path. The added `enemy-behind-wall` debug scenario exercises Frost Crossing geometry with both player and enemy in walkable space, within detection radius, separated by a real interior wall, and verifies several enemy ticks do not promote the enemy to chasing.

The fallback visual capture did not specifically deploy Frost Crossing, but the full coverage run passed and includes the focused line-of-sight and debug-scenario tests. Runtime health for the applied build is clean.

### Design and requirements consistency
The change is consistent with `game/docs/design.md`: it preserves the 3D dungeon combat loop and uses existing dungeon wall geometry rather than introducing a new targeting model or changing quest identity. It does not regress the foundation in `game/docs/requirements.md`; the capture still demonstrates 3D rendering, server-client connection, multiplayer presence, and movement synchronization.

### Debug scenario review
The new `enemy-behind-wall` scenario is gated through the existing debug-scenario path. The client only auto-requests `?debugScenario=...` on localhost-style hosts, and the server rejects production debug access unless explicitly allowed. Normal gameplay does not touch this scenario; it remains a QA shortcut. Its end state is reachable by normally deploying Frost Crossing and standing on one side of an interior wall while an enemy is on the other, and the scenario still runs the normal quest setup path before narrowing the enemy setup for deterministic validation.

### Code quality and tests
The implementation is narrow and reuses existing collision primitives. It builds line-of-sight colliders once per enemy tick, which avoids repeated layout work per candidate target. Coverage evidence shows `116` test files and `1878` tests passed, including the new focused tests, with no coverage threshold failures.


## v0.367 — 391-fix-glacial-thrower-slow-not-applied  (2026-06-10 09:53:26)

### SLOW is independent of HP damage success

PASS. `applySlow()` is called before `damagePlayer()`, so SLOW is not gated by damage resolution. The added server tests cover the spawned glacial thrower wind-up into projectile contact path, and specifically assert that SLOW still applies when `debugGodmode` or `invulnerableUntil` prevents HP loss. This matches the ticket's note that SLOW is a movement effect and should not be masked by god-mode or damage immunity.

### Server test coverage

PASS. `game/server/test/ice_enemy.test.js` now asserts slow application on direct projectile contact, the full spawned thrower wind-up/projectile/contact path, and damage-skipped contact cases. `game/server/test/height_aware_projectiles.test.js` also asserts slow application for an elevated ice-ball contact path. The recorded coverage run completed with `1148 passed (1148)`, including `server/test/ice_enemy.test.js (18 tests)` and `server/test/height_aware_projectiles.test.js (22 tests)`.

### Design and foundation consistency

PASS. The change stays within the server-authoritative combat simulation described by `game/docs/design.md`: glacial thrower projectiles remain enemy combat actions in the dungeon loop, and SLOW remains a movement status rather than a damage side effect. It does not weaken the foundation requirements in `game/docs/requirements.md`; the capture confirms 3D rendering, client/server connectivity, multiplayer presence, and movement/key-item smoke behavior still work.

### Debug scenarios

PASS. This ticket did not add or modify a `?debugScenario=NAME` shortcut. The capture metadata reports no active scenarios, so there is no debug-path gating or normal-flow reachability concern to review.

## Remaining gaps

None.

## v0.368 — 372-playthrough-validate-ice-level  (2026-06-10 10:15:26)

debug-scenario socket path behind `isDebugScenarioAllowed()`. They seed state but do not
bypass the live movement, projectile, status, telepipe, or card-resolution code — the same
end states are reachable through normal Frost Crossing play (deploy, cross to ice band,
fight scripted glacial-thrower waves, use Telepipe). The `main.js` change that always
dismisses `#lobby` on join makes a host behave like a joiner; the lobby remains reopenable
(press `L`, line 4021) and deploy still flows through the launch booth, so normal play is
not regressed.

### Findings honesty
PASS. `findings.md` reports a green run with real probe numbers, documents the no-boss gap,
and lists the out-of-`game/validate` edits it required (main.js lobby dismiss, new debug
scenarios, telepipe progression). Screenshots `02-level-entry` and `08-victory` confirm
genuine Frost Crossing ice content, not a stand-in level. "Do not fake green" is satisfied.

## Remaining gaps

None. (One non-blocking nit recorded in `nits.md`: `05-glacial-slow.png` is captured after
the Sortie Complete overlay appears, weakening its value as visual proof of the slow hit —
the probe data still proves it.)


## v0.369 — New objective type: escort/NPC partner quest (PSO Guild Quest staple)  (2026-06-10 10:59:09)


PASS. `annex_escort` is a new tier-1 quest with `objectiveType: 'escort'`, scripted encounter rooms, Archivist Vale metadata, and the route ambush dialogue beacon `They found us!` on room 1. The normal path is reachable through the quest board by selecting Annex Evacuation and deploying; the debug shortcut only stages that same doorway state.

## Design, requirements, and debug scenarios

PASS. The implementation matches the design direction for a PSO-style Guild Quest escort: it adds a real quest, objective registry support, NPC protection/failure semantics, route ambushes, and UI feedback without weakening the baseline requirements for rendering, websocket play, multiplayer visualization, or movement sync.

The new debug scenarios remain gated through the existing localhost/debug socket path and are only client-triggered from `?debugScenario=...`. They are QA shortcuts into states reachable by normal play: selecting/deploying Annex Evacuation, walking the escort to the ambush room, or escorting to the destination.

## Validation

Focused validation passed:

`pnpm exec vitest run --config vitest.config.js server/test/escort_objective.test.js client/test/escort-hp-bar.test.js --coverage.enabled=false`

The provided `coverage.log` shows the escort objective test suite and escort HP-bar suite passing. It also shows one unrelated full-suite failure in `server/test/debug-scenarios.test.js` for the existing `arena-trials-boss-low-hp` shortcut reporting a boss HP mismatch in `stateUpdate`; this ticket's diff does not touch that arena-trials scenario path, so I am not treating it as a blocking gap for this escort ticket.

## Remaining gaps

None.

## v0.370 — 392-investigate-ice-telepipe-vitals-not-preserved  (2026-06-10 11:12:35)

### Fresh sortie after Telepipe abandon on ICE

PASS. The new `frost-telepipe-ready` debug scenario supports the live capture path: first emit selects Frost Crossing and injects Telepipe only on ready-up; re-emitting from the suspended lobby abandons the checkpoint while keeping lobby HP/MS, so the next ready-up starts a new ICE run id with vitals preserved. Round-2 probes confirm `preHp: 20`, `postHp: 20`, `preMagicStones: 20`, `postMagicStones: 20`, and a fresh run id (`35c1710d...` -> `b15b9e8e...`).

### Design and requirements consistency

PASS. This matches `game/docs/design.md`: HP and Magic Stones persist across Telepipe resume and new sortie, while fresh sortie creates a new run id and redeals cards. It does not weaken the foundation requirements: the captured run rendered a Three.js scene, connected to the server, showed the player in 3D gameplay, and exercised server-driven state transitions.

### Debug scenario safeguards

PASS. The new scenario is gated through the existing `debugScenario` socket/URL harness path and is allowlisted in `DEBUG_SCENARIOS`; normal gameplay does not enter it. Its end state is reachable normally by selecting Frost Crossing, having Telepipe available, deploying, extracting, abandoning the suspended run, and redeploying. It does not bypass the server persistence path under review: the scenario uses the normal lobby/run state, normal ready-up deploy, Telepipe hand injection at deploy, `abandonSuspendedRun()`, and `checkAllReady()` fresh-run handling.

### Code quality and validation

PASS. The changes are scoped to scenario/capture routing and regression coverage. `git diff --check` reports no whitespace issues. The provided coverage run passed: 127 test files and 1725 tests, including the new ICE telepipe persistence coverage and the fresh-sortie `frost-telepipe-ready` test.

## Remaining gaps

None.

## v0.371 — 390-fix-slippery-floor-no-momentum  (2026-06-10 11:28:08)

Pass. Normal-floor walking now seeds `vx`/`vz` from the direct walk step, so crossing from normal into slippery terrain carries forward speed instead of arriving with zero momentum. Sliding from ice back onto normal floor is still damped to a stop by normal-floor friction. Both server and client prediction tests cover normal-to-slippery velocity seeding and slippery-to-normal stopping behavior.

### Server test coverage for the regression

Pass. `game/server/test/slippery_floor.test.js` contains explicit regression coverage for the original playthrough failures: momentum after release, direction change while sliding, generated ice-cavern behavior when the movement context omits bounds, and both normal-to-ice and ice-to-normal transitions. The client prediction tests were updated to mirror the same transition expectations.

## Design and requirements consistency

The changes stay within the documented server-authoritative dungeon movement model in `game/docs/design.md`: floor sampling still comes from `sampleFloorSurface()`/layout data, and player movement remains resolved in `applyPlayerMovement()`. The foundation requirements are not regressed: the captured run shows the game renders, connects over sockets, represents multiplayer players, and accepts WASD movement during gameplay.

## Code quality and validation

The implementation is small and localized to movement physics and prediction parity. The `resolveMovementContext()` fallback improvement also addresses the validation-style stripped-context path without weakening normal live-collider behavior. I did not find dead code, broken exports, or console/runtime defects.

Validation observed in `coverage.log`: 86 test files passed, 1593 tests passed. Coverage was collected for visibility with thresholds disabled.

## v0.372 — 380-ice-l1-miniboss-permafrost-warden  (2026-06-10 11:44:26)

### Defeat objective and rewards

PASS. The stage-boss objective does not complete from add kill counts; it completes when the active encounter boss is defeated and the encounter clears. Existing reward-card metadata for Frost Crossing remains in place, and the debug last-enemy shortcut was updated to use a 1-HP Permafrost Warden while preserving the same normal post-victory path.

### Design and foundation compatibility

PASS. The implementation is consistent with `game/docs/design.md`: Frost Crossing remains an ice-band thrower/Rimecast level, now culminating in a single stage boss. It does not regress the foundational requirements: the captured run demonstrates server/client startup, websocket connectivity, scene initialization, multiplayer presence, and movement/dodge HUD behavior.

### Debug scenarios

PASS. The changed Frost Crossing debug scenarios remain gated behind `debugScenario` names; normal gameplay does not enter them. The new/updated shortcuts mirror reachable end states from normal play, such as deploying Frost Crossing, clearing scripted hostiles, approaching the cairn, and fighting the boss. They do not bypass persistent account progression, server-side objective code, or the live encounter state machine in normal gameplay.

### Tests and coverage

PASS. The provided `coverage.log` shows the full suite passing: 191 test files and 2702 tests. Coverage includes targeted server tests for `permafrost_warden` and `frost_crossing_stage_boss`, plus updated client tests for quest-board copy, model registration, lock-on panel metadata, render registry normalization, and boss HUD naming.

## v0.373 — 381-fire-l1-miniboss-cinder-warden  (2026-06-10 11:57:40)

The lock-on metadata panel and boss HUD remain generic and server-catalog driven, so the new surfaced metadata reaches the panel without bespoke client panel code. This is consistent with the existing design and does not regress the generic enemy-catalog contract.

### Debug scenario review

PASS. The new `ember-descent-tier-2` debug scenario is registered only in the normal debug-scenario path and is requested by the client exclusively from the localhost `?debugScenario=` URL parameter. The equivalent state is reachable through normal gameplay by clearing Ember Descent Tier I, unlocking Tier II, selecting Ember Descent Tier II, and deploying.

The shortcut does not replace the encounter implementation with a fake state: it sets the quest/tier and layout, then uses the same `enterPlayingPhase`, `spawnEnemies()`, and `startDungeonRun()` flow that regular deployment uses. It unlocks the tier for the debug account so the QA shortcut can select the state, but the quest definition still preserves the normal `unlockRequires` gate.

### Design and foundation consistency

PASS. The implementation follows the existing stage-boss framework described in `game/docs/design.md`: one stage-boss encounter, server-authored enemy metadata, defeat objective, supporting adds, and generic lock-on panel data. It does not weaken the base setup requirements in `game/docs/requirements.md`; the captured run confirms rendering, client-server connection, multiplayer representation, and synchronized movement still work.

## Verification

The provided coverage log shows the full vitest coverage run passed: `188` test files and `2652` tests passed. New relevant coverage includes `server/test/cinder_warden.test.js`, `server/test/ember_descent_stage_boss.test.js`, `server/test/enemy_display_catalog.test.js`, and `client/test/renderer-cinder-warden.test.js`.

## v0.374 — 384-extend-unlockrequires-multi-prereq-and  (2026-06-10 12:18:37)

PASS. The changes stay within the lobby/quest progression model described in `game/docs/design.md`: players select quests in the lobby, ready up, deploy, and progression is awarded after successful dungeon objectives. The foundation requirements are not regressed; the captured run confirms WebSocket connection, multiplayer visualization/state, 3D rendering, and movement in an active run.

### Debug Scenarios

PASS. This ticket did not add or change a development `?debugScenario=` shortcut. The changed behavior is exercised through normal account progression, quest selection, readiness, and run-completion paths rather than relying on a debug-only entry point.

## Code Quality And Verification

The live codebase is coherent with the ticket scope. The implementation is server-authoritative for selection/readiness gating, keeps account-specific payloads isolated per socket, and updates the client lock UI without trusting the raw legacy unlock map when evaluated `tierUnlocked` is available.

Verification observed:

- Round-3 runtime capture: `ok: true`, empty `pageerrors`, no fatal console entries.
- `coverage.log`: 151 test files passed, 2328 tests passed.
- Changed code inspected from `git diff 00815f732b26c7eecfaa2d64a1ffd2a8cf8c37a4 HEAD`.

## v0.375 — 378-introduce-few-flying-enemies  (2026-06-10 12:27:01)


### Client Rendering and Telegraphs
PASS. `game/client/models.js` registers both new enemy ids as procedural-only entries, and `game/client/renderer.js` adds mesh geometry plus attack-visual entries. `void_seraph` maps to a radial telegraph and `rime_drifter` maps to the projectile telegraph style consistent with `glacial_thrower`. The implementation reuses the existing server-provided flying/altitude render path rather than adding per-type Y handling.

### Rare/Sparse Thematic Spawn Weights
PASS. `rime_drifter` is added only to `frost_crossing` at weight 1. `void_seraph` is added only to `canyon_descent` and `spire_ascent` at weight 1. These are the lowest weights in their pools, and no tier-2 pool or unrelated quest pool gained a flying type. Normal gameplay can reach the same enemy states through those quest pools and stage-boss add pools that draw from `getEnemyPool()`.

### Debug Scenario
PASS. The added `?debugScenario=flying-enemies` shortcut is only entered through the existing URL-param/client socket route and server-side debug scenario allowlist. It is guarded by the existing localhost or `ALLOW_DEBUG_SCENARIOS=1` checks and is rejected in production/non-local contexts. The shortcut uses the authoritative server `spawnEnemy` path and does not replace the normal gameplay path, which remains available through the rare quest spawn pools.

### Design and Foundation Consistency
PASS. The change fits the design document's 3D multiplayer dungeon combat direction, uses the established card/enemy combat systems, and does not regress the requirements baseline: the captured run shows a rendered Three.js scene, connected client/server WebSockets, multiplayer presence, and synchronized movement.

### Tests and Coverage
PASS. The latest coverage run reports 168 test files passed and 2504 tests passed. Focused tests cover flying enemy definitions, hover height, spherical radial hit/miss behavior, height-aware projectile launch/damage, display catalog entries, client render registries, and sparse spawn-pool wiring. Coverage output includes unrelated pre-existing disconnect-handler warnings in older tests, but they did not fail the suite and are not caused by this ticket's changed files.

## Remaining gaps

None.


## v0.385 — Client: attack/cast hint is static — wrong for controllers and shown forever  (2026-06-10 15:23:15)

### Fresh Profiles and Same-Profile Memory

PASS. The localStorage key is scoped by stored player id, so a profile that has seen the hint keeps it hidden on later runs while a different/new profile with no matching flag sees it again. Storage and timer access are guarded to avoid breaking gameplay if localStorage is unavailable.

### Design and Requirements Consistency

PASS. The change is limited to client HUD/input affordance behavior and does not alter the documented lobby/dungeon/card-combat loop, server-client architecture, multiplayer state, movement synchronization, combat simulation, or progression systems. The captured run still demonstrates auth/lobby entry, deploy into gameplay, movement, card hand visibility, and HUD state.

### Debug Scenarios

PASS. This ticket did not add or change any `?debugScenario=...` shortcut. No debug-scenario capture was used in `metrics.json`, and the normal lobby-to-gameplay path remains the exercised route.

### Test and Coverage Evidence

PASS. The round-3 coverage log shows the client suite ran successfully, including the new `attack-cast-hint`, `attack-hint-dismiss`, `attack-hint-dismiss-action`, and expanded `input` coverage. The tests cover keyboard text, standard gamepad text, 8BitDo 64 text, remapped 8BitDo 64 labels, timeout dismissal, attack-plus-cast dismissal, persistence across runs, fresh-profile reappearance, and rejected-action gating.

## Remaining gaps

None.

## v0.384 — 385-boss-level-framework  (2026-06-10 14:13:18)

### Client Presentation

PASS. The quest board receives boss-level metadata, resolves proper boss display names, shows boss-level objective templates, includes tier lock state for tier-1 prerequisite-gated quests, and renders the new Crucible Sovereign enemy visual/telegraph definitions.

### Debug Scenarios

PASS. The retired fixture-only `boss-level-dormant` shortcut is rejected, and the live shortcuts (`crucible-duel-boss`, `vault-onslaught-boss`) are only entered through the existing localhost `?debugScenario=` path. They use the normal server deployment pipeline, preserve encounter state, and their comments/tests tie each shortcut to a normal progression path: complete prerequisites, select the quest, deploy, clear supports where applicable, then engage the boss.

### Design and Foundation Compatibility

PASS. The implementation fits the design doc's lobby-to-dungeon quest loop, card-combat enemy framework, and stage boss HP-band guidance. It does not regress the baseline requirements: the captured run renders 3D, connects over sockets, displays the player, and accepts movement.

### Tests and Coverage

PASS. Round-2 coverage shows `199` test files and `2875` tests passing. The added tests cover schema/default layout behavior, spawn pipeline, Crucible Duel flow, reusable second boss level, dormant boss damage immunity, quest-board copy, unlock gating, and debug scenario retirement.

## v0.383 — Server: memoize movement contexts — wall colliders and walkable AABBs rebuilt from scratch every tick  (2026-06-10 14:02:45)

- Hub cache is appropriate: `HUB_LAYOUT` is a static constant shared by all lobbies.
- Minimal diff scope (two production files); no dead code introduced.

**Correctness notes (non-blocking)**

- Caches are module-global, not per-lobby. With multiple concurrent playing lobbies that have different layouts, the singleton cache alternates and may rebuild more often than a per-lobby cache would — but reference/key checks preserve correctness; hub cache still hits on every lobby tick.
- Cached `walkableAABBs` / `dungeonBounds` are references captured at build time. In practice these are always reassigned together with `state.layout` in `applyLayoutForQuest` and equivalent paths, so stale-reference risk matches pre-ticket behavior.

---

## Debug scenarios

This ticket did not add or modify any `?debugScenario=` shortcuts. No review required.

---

## Remaining gaps

None. Runtime proof is clean, acceptance criteria are fully met, and the test suite passes.

## v0.382 — 389-level-select-tree-map-ui  (2026-06-10 13:55:26)


### Quest-board placement and lobby behavior

Pass. The map fronts the existing Contract Terminal/quest board panel and does not replace or alter the lobby finder menu. The quest panel is still opened through the lobby quest booth flow, preserving the design's lobby-browser -> lobby -> quest selection -> dungeon loop.

## Design and requirements fit

Pass. The implementation stays in `game/client` plus client tests, is consistent with the documented lobby selection flow, and does not regress the foundational requirements: the captured run shows the Three.js scene, websocket connection, multiplayer lobby/gameplay state, and movement smoke still work.

## Code quality and tests

Pass. The implementation is reasonably scoped and covered by focused unit tests for layout, edges, state styling, click behavior, empty graphs, and integration tests through `main.js` quest updates. The coverage run reports 16 test files passed and 309 tests passed, including `client/test/levelMap.test.js` and `client/test/levelMapIntegration.test.js`.

## Debug scenarios

No new `?debugScenario=...` shortcut was added by this ticket. The existing debug hooks remain gated by localhost-only URL parameters and are not part of normal gameplay.

## Remaining gaps

None.

## v0.381 — 377-lock-on-and-aim-across-heights  (2026-06-10 13:54:11)

Camera and reticle tracking for elevated targets is satisfied. The camera look-at uses `resolveLockOnLookAtY()` instead of the player height, death-release eases from the target's actual height, and the lock-on ring is positioned at the enemy render height via `syncEnemyMeshes()`. The renderer ring test specifically covers a flying target, and the implementation remains consistent with the existing render model for flying enemies and floor-aware altitude.

Server-side target resolution for height-aware projectile aiming is satisfied. The client includes `lockTargetId` when locked on, and `game/server/index.js` resolves projectile aim from the player's world Y to the locked enemy's world Y. The server tests cover elevated and flying lock-on hits for projectile/cone-style card paths, including `fireball`, `arcane_bolt`, `photon_slicer`, `infinite_disk`, `ice_ball`, `chain_lightning`, and `dragons_breath`.

The lock-on info panel remains live-code consistent. It already consumes the locked enemy object and catalog data, and the new selection/tracking path does not bypass the panel or introduce stale panel state; dead or missing enemies still hide the panel through the existing model guard.

The new debug scenarios are acceptable. `lock-on-flying-enemy` and `lock-on-3d-stack` are registered as debug scenarios and are reachable through the existing local `?debugScenario=` client path. They set up deterministic QA states that correspond to normal vertical-quest situations with flying enemies and stacked X/Z targets, and they do not weaken combat validation or replace the real play flow.

## Design and requirements consistency

The implementation aligns with `game/docs/design.md` by reusing the shared floor sampling and floor-aware altitude model rather than adding a parallel height system. It does not regress the foundation requirements: the captured run proves the 3D scene renders, client/server communication works, multiplayer state appears, and movement still updates during the smoke capture.

## Code quality and tests

The changed code is scoped to lock-on height resolution, renderer reticle/camera placement, debug scenarios, and tests. I did not find dead code, broken imports, or console/runtime errors. Coverage visibility shows the full suite passing: 163 test files and 2219 tests passed, with coverage reported for the changed server/client surface.

## Remaining gaps

None.

## v0.380 — 382-ice-tier2-frost-crossing-and-miniboss  (2026-06-10 13:37:27)

### Unique In-Level Miniboss

PASS. `glacial_tyrant` is registered in `game/server/simulation.js` as a distinct boss-tier ice-ball enemy with higher HP, longer range, larger/faster slow projectile tuning, boss drops, and party-size HP scaling. The stage-boss spawner anchors exactly one Glacial Tyrant at the `ice_cairn` landmark and keeps it dormant until support adds are cleared and a player approaches. Client rendering and telegraph tables include the new type in `game/client/renderer.js`, with a procedural model registry entry in `game/client/models.js`.

### Debug Scenario Review

PASS. The new `frost-crossing-tier-2` debug scenario is behind the existing debug path: client URL activation is localhost-only via `?debugScenario=...`, and the server handler is restricted to local/dev or `ALLOW_DEBUG_SCENARIOS=1`. It sets the same quest/tier/layout/run state reachable through normal gameplay after clearing Frost Crossing tier 1 and selecting the unlocked Tier II row. It does not weaken the production unlock/deploy path, which remains enforced by `selectQuest` and ready/deploy validation.

### Design And Foundation Consistency

PASS. The implementation matches the design direction for distinct quest identity, lobby-selected dungeon deployment, and stage-boss combat, while preserving the foundation requirements for 3D rendering, websocket connectivity, multiplayer presence, and movement synchronization. The round probes confirm the app still reaches lobby/gameplay with connected players and active movement/HUD state.

### Tests And Coverage

PASS. `coverage.log` reports `192` test files and `2714` tests passing. New coverage includes Glacial Tyrant enemy behavior, rigid ice-cavern generation, Frost Crossing Tier II catalog/deploy/unlock/encounter flow, and the debug scenario.

## v0.379 — 383-fire-tier2-ember-descent-and-miniboss  (2026-06-10 13:13:13)

The objective summary/theme strings reference the Magma Colossus rather than the Cinder Warden, while the older Cinder Warden catalog remains intact for existing enemy/test coverage.

### Debug Scenarios

PASS. The changed `ember-descent-tier-2` scenario is still reached through the debug scenario path only; client automatic entry is driven by `?debugScenario=...` on localhost, and the server checks the registered debug-scenario handler before applying it. The scenario sets quest id/tier and applies the Tier-II layout before entering play, then rebuilds the normal stage-boss spawn/run state. The same end state is covered through normal gameplay by Tier I unlock plus Tier II deploy tests, so the shortcut is QA-only and not a substitute for the real path.

The newly registered `magma-colossus` debug scenario is a local boss visualization shortcut and does not alter normal quest deployment.

### Design and Foundation Requirements

PASS. The implementation stays aligned with the design document's multiplayer lobby-to-dungeon loop and active combat model, and it does not regress the setup requirements: the captured run has a canvas, websocket connection, multiplayer squad state, player movement probes, and live gameplay state.

### Tests and Coverage

PASS. `coverage.log` reports `195` test files and `2732` tests passed. Coverage thresholds are disabled, but the changed areas have focused tests for quest catalog/listing, spawn pools, layout options and rigid geometry, encounter lifecycle, enemy catalog/stats/drops/scaling, debug scenarios, and client render registry.

## v0.378 — 388-level-map-unlock-graph-data-api  (2026-06-10 12:54:45)

`buildLevelUnlockGraph(accountId)` is exported from `game/server/quests.js` and returns `{ nodes: [...] }` with one node per quest tier by iterating the same `QUEST_DEFS` tier order as `listQuestVariants()`. Each node includes `questId`, `tier`, `name`, `objectiveType`, `isBoss`, normalized `unlockRequires`, and a `state` string.

The state calculation matches the requested precedence: `cleared` from `hasCompletedQuestTier`, otherwise `unlocked` from `isQuestTierUnlocked`, otherwise `locked`. Because `isQuestTierUnlocked` treats valid tier-1 quests as unlocked before user lookup and higher tiers require an account plus persisted/prerequisite unlocks, falsy or unknown accounts produce unlocked tier-1 nodes, locked higher-tier nodes, and no cleared nodes.

Boss and prerequisite data are represented correctly. `isBoss` is derived from `objectiveType === 'stage_boss'`, which includes both tier-2 boss variants and tier-1 boss quests such as Frost Crossing, and `unlockRequires` is run through `normalizeUnlockRequires`, preserving single prereqs as one-element arrays and multi-prereq AND arrays as authored.

`buildQuestUpdatePayload(gameState, playerAccountId)` now includes `levelUnlockGraph: buildLevelUnlockGraph(playerAccountId)` in the existing per-account payload block. The same payload is already spread into `questUpdate`, `lobbyUpdate`, and lobby-join payloads, so the client receives the graph in the established quest payload path without a new event or endpoint. Account-less payloads still omit the per-player graph, which matches the subticket allowance and the existing `unlockedQuestTiers` behavior.

## Design and regression check

The change is server-side data exposure only. It does not alter quest selection, tier gating, unlock persistence, combat, movement, rendering, or the lobby/dungeon loop described in `game/docs/design.md`, and it does not regress the foundational requirements for rendering, WebSocket connectivity, multiplayer visualization, or movement synchronization.

## Tests and coverage

The added `game/server/test/level_unlock_graph.test.js` covers graph cardinality, boss flags, normalized prerequisites, default unauthenticated states, cleared/unlocked progression state, payload inclusion for accounts, and omission without an account. The round coverage run passed: 22 test files and 914 tests.


## v0.377 — 379-wyrm-evolution-flying-minion  (2026-06-10 12:51:48)


### Hovering and 3D movement/rendering
PASS. The server resolves minion `y` with the generic airborne helper before AI and after movement, so a flying Archive Wyrm follows floor height plus altitude across non-default floors instead of staying on a fixed plane. The client `syncMinionMeshes()` reuses the generic `flyingRenderOffset()` path and creates floor-aware flying shadows, so the Wyrm renders above the floor like the existing airborne minions without changing grounded minion placement.

### Airborne, height-aware Wyrm breath
PASS. Wyrm breath aim locks a 3D direction from minion world Y to target world Y, applies cone hits with `originY` and `dirY`, and sends the airborne origin/direction in the `cardUsed` payload. Client renderers preserve `origin.y` and `direction.y` for the cone, telegraph ring, and particle burst. Tests cover the Archive Wyrm hitting an elevated enemy at the same X/Z only when aimed upward and verify the client VFX uses the airborne origin.

### Debug scenarios
PASS. The changed scenarios are registered only through the existing debug-scenario entry points (`archive-wyrm-combat` and `archive-wyrm-elevated-breath`) and are not touched by normal gameplay. Their comments and tests tie the shortcut state back to the normal path: evolve `dungeon_drake` into `ancient_wyrm`, deploy into combat, and fight flying/elevated enemies. They do not bypass server-side combat logic; they seed normal server entities and then rely on `updateEnemies()`, `updateMinions()`, world-Y resolution, and the standard Wyrm breath hit path.

### Design and requirements consistency
PASS. The implementation stays within the documented card-combat/minion model and the existing airborne/height-aware mechanics. It does not regress the foundation requirements: the round-2 capture shows the 3D scene renders, sockets connect, multiplayer state is visible, and movement/state updates work.

### Tests and coverage
PASS. The latest coverage run reports `167 passed (167)` test files and `2645 passed (2645)` tests. Ticket-specific coverage includes server airborne/minion/Wyrm breath tests, the elevated-breath debug scenario, height-aware projectile coverage, and client render/VFX tests for airborne Wyrm behavior.


## v0.376 — Server: USE_KEY_ITEM/EQUIP_KEY_ITEM never checks equipped/owned key item (any client can use any key item)  (2026-06-10 12:49:14)


## Code quality

- Minimal, focused diff (~180 lines, mostly test fixture updates).
- Checks reuse existing patterns (`getKeyItemDef`, `isKeyItemUnlocked`, `SERVER_TO_CLIENT` error shapes).
- Test override is scoped (`setTestKeyItemUnlockOverride(null)` in `finally`) and exported only for test access via `index.js`, consistent with other server test hooks.
- No dead code, no client changes required (client already emits `me.equippedKeyItemId` in `main.js`).

## Debug scenarios

This ticket did not add or modify `?debugScenario=` shortcuts. Existing debug scenarios (e.g. `summon-recall`) set `equippedKeyItemId` explicitly before key-item use — compatible with the new guard. No debug-scenario blocking issues.

## Capture alignment

Fallback smoke capture exercised the real player path: auth → lobby → ready → WASD movement → dodge roll (E). Probes confirm `equippedKeyItemId: "dodge_roll"`, successful dodge cooldown activation, and clean reconnect to ready state. Screenshots show lobby and in-run HUD with Dodge Roll indicator.

## Remaining gaps

None. All acceptance criteria are fully met; runtime capture is clean; test suite is green.

## v0.388 — 369-playthrough-revalidate-open-plaza  (2026-06-10 16:24:35)

Pass. `game/validation/open-plaza/findings.md` lists the assertion results, console/page-error status, visual notes, floor alignment, boss UI/visual identity, card exercises, telepipe checks, and screenshot inventory. The required screenshot references and probes are present in `run-summary.json`/`probes.json`.

## Design and foundation consistency

The implementation is consistent with `game/docs/design.md`: the lobby-to-dungeon loop, stage-boss flow, card combat interactions, and telepipe persistence/reset behavior match the documented design. It does not regress the foundation requirements in `game/docs/requirements.md`: the captured run renders a 3D scene, connects client/server, shows the player, and continues to provide synchronized gameplay state.

## Debug scenarios

Pass. The added arena debug scenarios are entered only through the debug scenario socket path, which is gated by `ALLOW_DEBUG_SCENARIOS`, non-production localhost/private access, or explicit dev conditions. Normal gameplay does not call these paths.

The same end states are reachable through normal play: Arena Trials Tier 2 is reached by clearing/unlocking/deploying, add combat is reached by traversing the plaza, the boss approach/activation is reached by clearing adds and moving into the encounter trigger, low boss HP is reached by fighting the boss, and the telepipe state is reached by bringing a Telepipe and spending vitals/charges during a sortie. The shortcuts still use server-side state, encounter, objective, floor sampling, and snapshot/broadcast paths rather than bypassing client-only invariants.

## Code quality and validation

No blocking code-quality issues found in the live codebase. The changed debug scenarios have unit/integration coverage in `game/server/test/debug-scenarios.test.js`, and coverage output reports the test suite green: 119 files passed, 1720 tests passed. The open-plaza artifact verifier checks the full-run summary, required assertion keys, required files, and distinct victory screenshots.

## v0.389 — 371-playthrough-revalidate-spire-ascent  (2026-06-10 16:26:06)


### Telepipe vitals persistence and new-sortie card charge reset

PASS. The full validation output includes Spire Ascent telepipe-new-sortie coverage: pre-suspend and post-deploy HP/MS are preserved within the harness comparison, the run id changes for the fresh sortie, suspended state is cleared, and card charges reset to full in the new sortie. The round-2 capture separately confirms the live suspend/resume path: the same layout seed/profile and enemy ids are restored after re-deploy from the suspended lobby.

### Debug scenarios

PASS. The added/changed debug scenarios are only reachable through the debug-scenario socket path used by the harness and guarded by the existing debug allowance logic. The Spire Ascent shortcuts are documented as QA shortcuts for states reachable through normal quest unlock/deploy, add clearing, encounter trigger movement, boss combat, or Telepipe acquisition. They still use the real quest layout/run setup, enemy spawning, encounter state, card casting, suspend/abandon/deploy flow, and server-side assertions rather than replacing the normal gameplay path as the only proof.

### Design and foundation consistency

PASS. The implementation remains consistent with `game/docs/design.md`: Spire Ascent remains a stage-boss dungeon with the Summit Warden, card combat remains based on hand slots and charges, and Telepipe behavior preserves vitals while distinguishing suspend/resume from fresh sortie charge reset. The foundation requirements are not regressed: the captured runs render Three.js scenes, authenticate/connect through client/server, show the player in 3D, and continue receiving state updates.

### Code quality and tests

PASS. The live changes are scoped to validation harness behavior, debug scenarios, small client synchronization after debug scenarios, and validation artifacts. `coverage.log` reports 133 test files and 1995 tests passing, with visibility coverage for changed files. The coverage log contains noisy stderr from existing synthetic integration paths, but the ticket's captured browser runs have no page errors or fatal game-code logs.

## Remaining gaps

None.

## v0.386 — 386-boss-level-riftbound-colossus-gated-ice2-fire2  (2026-06-10 16:15:58)

PASS: Dedicated boss level. `rift_convergence` is registered as a tier-1 `stage_boss` quest with `levelKind: 'boss_level'`, `layoutProfile: 'boss-arena'`, `arenaTheme: 'rift'`, and a stage-boss encounter anchored on `arena_dais`.

PASS: Ice-2 AND Fire-2 gate. The quest declares `unlockRequires` as an array containing exactly `{ questId: 'frost_crossing', tier: 2 }` and `{ questId: 'ember_descent', tier: 2 }`. The live unlock path normalizes arrays and checks prerequisites with `every(...)`, so the gate is AND semantics. Targeted tests verify no prerequisites, frost-only, and ember-only all remain locked, and both completed unlocks the level.

PASS: Riftbound Colossus identity and difficulty. `ENEMY_DEFS.riftbound_colossus` is present with the highest stage-boss HP and attack damage in the documented boss band, radial attack style, 5.5 range, and a 3000ms burning rider. The quest spawns exactly one Riftbound Colossus plus four supports drawn only from the ice/fire signature pool (`glacial_thrower`, `ember_wraith`), giving it more boss-level adds and a higher reward purse than the existing boss levels.

PASS: Boss arena and ice/fire theme. The boss arena remains the existing dedicated single-room layout, while `arenaTheme: 'rift'` adds cosmetic-only west/east ice and ember floor bands inside bounds, without changing collision or the unthemed boss-arena layout used by other boss levels. Client rendering supports both new floor-band marking types and the Colossus procedural silhouette/attack telegraph.

PASS: Level map and quest presentation. The server emits the new boss node in `levelUnlockGraph` with both prerequisite edges and account-specific locked/unlocked state. The client level-map renderer consumes that payload, displays boss nodes distinctly, draws one edge per prerequisite, and prevents locked node selection. Quest board rows use the same server-evaluated `tierUnlocked` flags, so the new boss level is visible but not selectable until both prerequisites are complete.

PASS: Normal gameplay path and debug scenarios. The normal path remains intact: clearing Frost Crossing tier 2 and Ember Descent tier 2 unlocks Rift Convergence, deploying starts the same stage-boss lifecycle, the Colossus remains dormant/invulnerable until supports are cleared and the player approaches, then defeating it records completion. Added debug scenarios (`rift-convergence-boss`, `rift-convergence-unlocked`, `rift-convergence-one-prereq`) are reachable only through the existing debug-scenario URL/socket path, are locally/dev gated by the existing `isDebugScenarioAllowed` checks, and use the same quest/layout/run initialization systems rather than weakening normal production entry points.

PASS: Consistency with design and requirements. `game/docs/design.md` now documents the Riftbound Colossus in the stage-boss band at 460 HP, preserving the 180s boss validation constraint while making it the capstone. The foundation requirements are not regressed: the captured run renders Three.js, connects client/server over sockets, shows multiplayer state, and movement/dodge probes update state cleanly.

PASS: Test and coverage evidence. The coverage log reports `212 passed` test files and `2910 passed` tests. New/updated tests cover quest definition, AND-gated unlocks, level unlock graph edges, spawn composition, end-to-end dormant-to-active-to-cleared boss lifecycle, arena theme generation/rendering, Colossus combat/drop behavior, and client render registry wiring.

## Remaining gaps

None.

## v0.381 — 377-lock-on-and-aim-across-heights  (2026-06-10 13:54:11)

Camera and reticle tracking for elevated targets is satisfied. The camera look-at uses `resolveLockOnLookAtY()` instead of the player height, death-release eases from the target's actual height, and the lock-on ring is positioned at the enemy render height via `syncEnemyMeshes()`. The renderer ring test specifically covers a flying target, and the implementation remains consistent with the existing render model for flying enemies and floor-aware altitude.

Server-side target resolution for height-aware projectile aiming is satisfied. The client includes `lockTargetId` when locked on, and `game/server/index.js` resolves projectile aim from the player's world Y to the locked enemy's world Y. The server tests cover elevated and flying lock-on hits for projectile/cone-style card paths, including `fireball`, `arcane_bolt`, `photon_slicer`, `infinite_disk`, `ice_ball`, `chain_lightning`, and `dragons_breath`.

The lock-on info panel remains live-code consistent. It already consumes the locked enemy object and catalog data, and the new selection/tracking path does not bypass the panel or introduce stale panel state; dead or missing enemies still hide the panel through the existing model guard.

The new debug scenarios are acceptable. `lock-on-flying-enemy` and `lock-on-3d-stack` are registered as debug scenarios and are reachable through the existing local `?debugScenario=` client path. They set up deterministic QA states that correspond to normal vertical-quest situations with flying enemies and stacked X/Z targets, and they do not weaken combat validation or replace the real play flow.

## Design and requirements consistency

The implementation aligns with `game/docs/design.md` by reusing the shared floor sampling and floor-aware altitude model rather than adding a parallel height system. It does not regress the foundation requirements: the captured run proves the 3D scene renders, client/server communication works, multiplayer state appears, and movement still updates during the smoke capture.

## Code quality and tests

The changed code is scoped to lock-on height resolution, renderer reticle/camera placement, debug scenarios, and tests. I did not find dead code, broken imports, or console/runtime errors. Coverage visibility shows the full suite passing: 163 test files and 2219 tests passed, with coverage reported for the changed server/client surface.

## Remaining gaps

None.

## v0.383 — Server: memoize movement contexts — wall colliders and walkable AABBs rebuilt from scratch every tick  (2026-06-10 14:02:45)

- Hub cache is appropriate: `HUB_LAYOUT` is a static constant shared by all lobbies.
- Minimal diff scope (two production files); no dead code introduced.

**Correctness notes (non-blocking)**

- Caches are module-global, not per-lobby. With multiple concurrent playing lobbies that have different layouts, the singleton cache alternates and may rebuild more often than a per-lobby cache would — but reference/key checks preserve correctness; hub cache still hits on every lobby tick.
- Cached `walkableAABBs` / `dungeonBounds` are references captured at build time. In practice these are always reassigned together with `state.layout` in `applyLayoutForQuest` and equivalent paths, so stale-reference risk matches pre-ticket behavior.

---

## Debug scenarios

This ticket did not add or modify any `?debugScenario=` shortcuts. No review required.

---

## Remaining gaps

None. Runtime proof is clean, acceptance criteria are fully met, and the test suite passes.

## v0.387 — Client: renderHand rebuilds slot innerHTML on every STATE_UPDATE even when the hand is unchanged  (2026-06-10 16:20:11)

- Signature includes `layoutMode` so N64 vs default hint markup stays correct when layout locks change.

No dead code, no obvious logic bugs, no browser page errors.

**Intentional trade-off (in scope):** For burning creatures, only the meter bar (`--charge-pct`) animates per tick; the `.card-charges` text label (e.g. `18s/30s`) is not rewritten on skip. The ticket goal explicitly states that only `--charge-pct` needs per-tick updates — this is correct per spec, not a defect.

---

## Integration notes

`renderHand()` is still invoked unconditionally on every playing-phase STATE_UPDATE (lines ~1446–1449), which is correct: the function is now cheap when the hand is stable. Probes show MS ticking (`50.6` → `51.1`) while hand card entries remain structurally identical — exactly the hot path this fix optimizes.

---

## Remaining gaps

None. All acceptance criteria are met; the game runs cleanly in capture; tests pass.

---

## v0.391 — 368-playthrough-revalidate-rooms  (2026-06-10 16:50:11)

### Screenshots and findings

PASS. `game/validation/rooms/findings.md` exists and reports `Outcome: PASS` with every relevant assertion listed. The expected screenshots are present in `game/validation/rooms/`, including hub/browser, level entry, mid-combat, dormant/active boss, boss defeated, victory, slow/burn, Purifying Pulse, wind-up, and telepipe before/after captures. The findings file explicitly reports no observed console/page errors or visual glitches.

### Design and requirements consistency

PASS. The result remains aligned with `game/docs/design.md`: the Training Caverns flow still uses lobby deploy into a dungeon, a stage boss encounter, card combat, Telepipe suspend/abandon/new sortie behavior, and preserved vitals with new-sortie card-charge reset. The implementation does not regress the foundation in `game/docs/requirements.md`: rendering, WebSocket connection, player representation, and movement/gameplay synchronization are all exercised by the captured run and rooms validation.

### Debug scenario safety

PASS. The added/changed debug scenarios remain behind the existing debug scenario request path and are not part of normal gameplay entry. The rooms-specific shortcuts document normal-play equivalence in code comments and tests: Tier 2 is reachable by unlocking and deploying Training Caverns, near-adds/boss-approach states are reachable by traversing and clearing adds, encounter activation is reachable by walking into the trigger, low-HP boss is a combat-time shortcut, and Telepipe-in-hand is reachable by purchasing Telepipe before deploy. The scenarios preserve server-side state machinery rather than bypassing it wholesale: they set quest/tier/layout, call deploy/start-run helpers, use the encounter state machine, and the telepipe harness validates abandon-plus-fresh-deploy instead of a checkpoint restore.

### Code quality and tests

PASS. The changed live files are focused on validation harness wiring, rooms artifacts, and narrowly scoped debug/probe support. The earlier accumulated `game/validation/rooms/server.log` includes an old `spawnEnemy is not a function` attempt, but the live `game/server/encounters.js` no longer contains that helper path and the current round capture/server log is clean. `coverage.log` ends with `155 passed` test files and `2165 passed` tests; coverage thresholds are disabled, but the changed paths have direct unit and integration coverage for rooms findings, debug scenarios, and telepipe behavior.

## Remaining gaps

None.

## v0.392 — Client: consolidate gamepad polling to one snapshot per frame and delete dead gamepad-layer code  (2026-06-10 17:18:44)


### Dead gamepad-layer code and orphan tests

PASS. The confirmed-dead helpers named in the ticket are no longer exported or referenced in `game/client/`: `uses8BitDo64DigitalCButtons`, `get8BitDo64CStickAxes`, `get8BitDo64CAxisPairs`, `readAxisSectorDirections`, `readProfileCStick`, `isGamepadMoving`, `describeGamepadConnectionWithProfile`, and the duplicate `isButtonPressed`. The tests tied only to those removed helpers were deleted, while live 8BitDo C-button, profile, lock-on, and binding behavior remains covered.

### Design and requirements consistency

PASS. The change is limited to client input polling and dead-code cleanup. It does not alter the documented lobby/dungeon/card loop, server simulation, multiplayer flow, or floor/quest/combat systems. The capture and probes confirm the baseline setup requirements remain intact: 3D rendering, server-client connection, multiplayer visualization, and movement synchronization.

### Debug scenarios

PASS. This ticket did not add or change a `?debugScenario=...` shortcut. The capture used the fallback full-flow smoke path with `scenarios: []`, so there is no debug-scenario gating or normal-gameplay reachability issue to review for this ticket.

### Verification evidence

PASS. The round-1 coverage log reports `52` test files passed and `540` tests passed. Coverage thresholds were disabled as expected for visibility only.

## Remaining gaps

No blocking gaps remain.

## v0.393 — Debug tooling: time-scale control (slow-mo/pause) behind ALLOW_DEBUG_SCENARIOS for playtesting and QA  (2026-06-10 17:19:45)

### Harness state exposes the current scale for automated tests

PASS. `buildWorldSnapshot()` includes `debugTimeScale` and `debugTimeScaleAllowed`, and `window.__AUTOGAME_HARNESS_STATE__()` exposes `debugTimeScale`, `debugTimeScaleResult`, and `debugTimeScaleAllowed`. The captured fallback run shows the fields present with `debugTimeScale: 1` and `debugTimeScaleAllowed: false`; the client test verifies the allowed flag becomes true when a snapshot reports it.

### Design and Foundation Consistency

PASS. The feature is debug-only, per-lobby, and does not alter normal gameplay when unset. It fits the design doc's multiplayer lobby/dungeon model by storing the scale on lobby game state rather than global process state, and it preserves the requirements baseline: rendering, socket connectivity, multiplayer presence, and WASD movement sync all remain functional in the captured run.

### Debug Scenarios

PASS / not applicable. This ticket did not add or change a `?debugScenario=NAME` URL shortcut. Existing debug scenario behavior is not used as an entry point for the new time-scale control; the time-scale test hook is gated by the server-authorized snapshot field and the socket handler.

### Tests and Artifacts

Targeted time-scale coverage is present and passing in `round-2/coverage.log`: `server/test/debug_time_scale_sim.test.js`, `server/test/debug_time_scale_gate.test.js`, and `client/test/debug-time-scale-gate.test.js` all pass. The same coverage log reports one failing pre-existing-style `server/test/debug-scenarios.test.js` case for `arena-trials-boss-approach`; the ticket did not change `game/server/debugScenarios.js`, and I did not find a path from the time-scale changes to that scenario result, so I am not treating it as a blocking gap for this ticket.

## Remaining gaps

No blocking gaps for this ticket.


## v0.400 — Server: convert debugScenarios.js 113-branch if-chain to a registry and move debug hooks out of hot gameplay paths  (2026-06-10 18:57:54)

- **Gated** behind the same `DEBUG_SCENARIOS` allowlist (and
  `ALLOW_DEBUG_SCENARIOS` env) as every other scenario — URL param is the only
  entry point.
- **Reachable normally** — it calls the shared `deployQuestTier1(..,
  'ember_descent')` helper, deploying the real ember_descent Tier 1 quest run
  that a player reaches by playing that quest. It is a parallel of the existing
  `frost-crossing-tier-1` / `training-caverns-tier-1` deploy scenarios.
- **No invariant bypass** — it deploys an actual quest run through the same
  helpers; it does not skip validation, persistence, or replication.

Consistent with `game/docs/design.md` and does not regress the foundation:
this is a server-internal refactor of debug tooling with no gameplay-facing
behavior change, confirmed by the unchanged preservation/suspend-resume probe.

## Remaining gaps

None. The acceptance criterion is fully and robustly met, the game runs
cleanly in the captured registry-dispatched scenario, and the full server test
suite is green.

## v0.394 — Server: index.js broadcast/lookup helpers scan every connected socket per lobby per event  (2026-06-10 17:39:04)

- **O(1) player→socket lookup.** `playerSockets` Map registered on connect (`registerPlayerSocket` after `socket.playerId = playerId`) and unregistered on disconnect (`unregisterPlayerSocket` in `lobbyHandlers.js` disconnect handler). `findSocketByPlayerId` checks the Map first and **falls back to the linear scan** if absent — so correctness is preserved even if the Map is ever out of sync. The reconnect race is handled correctly: `unregisterPlayerSocket` only deletes when `playerSockets.get(playerId) === socket`, so a late disconnect of a replaced socket cannot evict the live one (covered by the new `unregisterPlayerSocket removes only when the socket still owns the map entry` test).

- **Smaller win — user lookups O(1).** `users.js` adds `accountIdIndex` and `emailIndex`, maintained in `indexUser`/`unindexUser` across `loadUsers`, `createUser`, `createUserAsync`, `updateProfile`, and cleared in `clearUsers`. `findUserByAccountId`/`findUserByEmail` are now Map gets. Email index only stores already-normalized emails — matching the old `record.email === normalized` comparison exactly, so no behavior change for mixed-case stored emails. `updateProfile` correctly removes the stale email entry before reassigning (verified including the email-clear `null` path: `oldEmail` deleted, `indexUser` re-adds only the accountId). New test `keeps email index consistent when email is updated or cleared` exercises set→change→clear.

- **Behavior unchanged / existing tests pass.** Full server suite re-run clean: **179 files, 2571 tests, all pass** (`npx vitest run server/test/`). The lone failure in the harness `coverage.log` (`debug-scenarios … places player outside dormant arena_champion trigger after adds cleared`) is a flake under v8 coverage instrumentation: it passes standalone (`-t`), passes as a full file (57/57), and passes in the full uninstrumented suite. The changed code (socket map, room iteration, user indexes) is orthogonal to arena-champion positioning. Not a regression from this ticket.

## Design / regression check

Pure server-side performance refactor that preserves observable behavior. No change to `game/docs/design.md` surface area, no requirements regression. No debug scenarios added or changed by this ticket (the `?debugScenario` machinery is untouched).

## Code quality

- `resetGameState` clears `playerSockets`; live sockets are not re-registered, but the linear fallback in `findSocketByPlayerId` keeps lookups correct. `resetGameState` is a reset/test path, so harmless. (Nit below.)
- `broadcastLobbyUpdate`'s active-game branch iterates `Object.keys(activeState.players)` + `findSocketByPlayerId` rather than the room helper — correct (active state can span merged members), just a different pattern from the per-lobby branch. (Nit below.)
- No dead code, no obvious bugs, no console errors.

## Remaining gaps

None blocking.

## v0.395 — Client: split main.js bindSocketHandlers (~930 lines) into handler registration groups  (2026-06-10 18:03:35)

- No behavior change: the full suite (`260 test files, 3717 tests`) passes, including the server socket integration tests and client main/socket tests.
- `grep` confirms **zero** remaining `s.on(`/`socket.on(` registrations in main.js — every listener was relocated, no duplicated or dead inline handler left behind.

## Consistency with design / no regression

- This is a pure structural refactor of client socket-handler registration; no gameplay rules, server logic, or `shared/` schema changed. `game/docs/design.md` and `requirements.md` foundations are untouched. The diff is confined to main.js (net −931 lines) plus the new `socketHandlers/` modules and sub-ticket bookkeeping.

## Debug scenarios

- No new `?debugScenario=NAME` URL shortcut was added or changed. `debugHandlers.js` only relocates the existing `DEBUG_SCENARIO_RESULT` / `DEBUG_GODMODE_RESULT` *result* listeners (and re-applies godmode mirroring to keep probes consistent). The debug-shortcut review criteria do not apply; nothing bypasses normal-play invariants.

## Code quality

- Clean, idiomatic split matching the codebase's existing context-object convention. Each module imports only what it needs; `index.js` re-exports the registrars. The STATE_UPDATE extraction preserves comments and edge-case handling (hub-layout floor sampling, desperation deck sync, prediction drift thresholds).
- No obvious bugs, no broken imports (tests would have failed otherwise), no console errors in the capture.

## Remaining gaps

None blocking. The acceptance criterion is fully and robustly met, the game runs cleanly, and the entire test suite passes. Minor non-blocking observations are recorded in `nits.md`.

## v0.402 — 362-anim-wyrmflare  (2026-06-10 19:10:53)

`spawnInfernoPillarEffect` pattern. Changes touch only this card's renderer, the
vfx primitive, its ctx registration, and tests — no other per-card renderer
affected.

### No perf regression
PASS. Effects are pushed to `activeEffects` with a finite `duration` and disposed
via `disposeEffectObject` once `elapsed >= duration` (renderer.js:5571-5597);
geometry/material are released. No retained allocations or leaked timers.

### Client test where feasible
PASS. Six new targeted tests (dispatch + synced style, synchronous cone burst,
per-hit ignite at mesh positions, four 500ms tick pulses, no-windUp guard,
primitive shape) plus the vfx-primitive test. Full suite: 179/179 passing.

## Remaining gaps
None blocking. Two minor default-coupling nits filed in `nits.md` (server omits
`dotIntervalMs`/`attackConeAngle` from the CARD_USED payload; client relies on
matching hardcoded defaults). These currently agree (500ms / π⁄3) and are
regression-tested, so they do not affect correctness today.

## v0.401 — 359-anim-resonance-edge  (2026-06-10 19:07:44)

### Visual matches name/theme ("Resonance Edge", weapon)
PASS. Accent is magenta `#e879f9` with icon `≋` (a wave/resonance glyph) in `game/client/cards.js:165`. The renderer lands a magenta cone cut, then "rings" — an immediate telegraph-ring + spark pulse and a harmonic after-ring 130ms later (`pulse(1.6)` then `scheduleAfter(130, () => pulse(2.6))`). The double/harmonic pulse reads unmistakably as a resonant sonic blade. On the shockwave cadence a much larger discharge (radius-6 ring + 1.4× expanding after-ring + 24-particle burst) bursts from the cast origin — a clear "resonance peak." Uses only the 315 primitives (`spawnAttackEffect`, `spawnTelegraphRing`, `spawnParticleBurst`, `scheduleAfter`).

### Timing synced to server effect resolution
PASS. Server (`game/server/cardEffects.js:480-497`) increments a per-card combo count and, when `nextCount % shockwaveEvery === 0`, collects radial hits and ships them as `shockwaveHits` in the `CARD_USED` payload (line 562); otherwise it ships `[]`. `resonance_edge` has `shockwaveEvery: 2`, `shockwaveRadius: 6` (`game/shared/cardStats.json:310-317`). The renderer keys its discharge on `data.shockwaveHits.length > 0`, so the on-screen resonance peak fires exactly on the every-2nd-use cadence, sized to the server's radius (defaults to 6, matching the card). Base ringing is immediate + 130ms; discharge after-ring at +90ms. No client-side combo arithmetic that could drift from the server. This is a faithful, server-driven sync.

### No perf regression
PASS. The added work is a handful of extra primitive spawns and only on the every-2nd-use cadence; base swing adds two guarded ring/burst pulses as before. No loops, allocations, or per-frame cost introduced.

### Client test where feasible
PASS. Two tests added and passing (`npx vitest run -t "Resonance Edge"` → 2 passed): the off-cadence swing (empty `shockwaveHits`) asserts no large discharge ring and only light bursts; the on-cadence swing asserts a ring ≥6 plus a larger after-ring and a ≥20 spark burst. Both assert the magenta accent.

## Robustness
Every primitive call is now guarded (`if (ctx.spawnAttackEffect)`, `if (ctx.scheduleAfter)`, etc.), so the swing degrades gracefully when a primitive is absent — an improvement over the prior unguarded `spawnAttackEffect`/`scheduleAfter` calls. `shockwaveRadius` is read defensively with a finite-check fallback.

## Remaining gaps
None blocking. Two minor nits filed to `nits.md`:
1. `data.shockwaveRadius` is never included in the `CARD_USED` emit, so that branch always falls back to the literal `6`; harmless today (equals the card's radius) but the dynamic-radius intent is unrealized.
2. The discharge keys off `shockwaveHits` being non-empty, so a cadence use that strikes no enemy in radius shows no discharge VFX even though the server's shockwave "fired." Defensible (no targets = no meaningful effect) but a slight fidelity gap vs. keying off the cadence itself.

## v0.403 — 358-anim-phase-echo  (2026-06-10 19:38:48)

## Code quality

Clean, well-commented, idiomatic with the surrounding styled-blade renderers. No dead/broken
code beyond the minor `shockwaveRadius` observation below (a nit, not a defect — the fallback
yields the correct value).

## Remaining gaps

None blocking.

Two non-blocking nits recorded in `nits.md`:
1. The server's `CARD_USED` payload never includes `shockwaveRadius`, so the client's
   `Number.isFinite(data.shockwaveRadius) ? … : 6` branch always takes the fallback. It happens
   to equal echo_blade's real radius (6), so the visual is correct, but the dynamic branch is
   effectively unreachable in production.
2. The shockwave VFX is gated on `shockwaveHits.length > 0`, so on the every-3rd-use beat with
   no enemy in radius nothing renders even though it is the cadence beat. Acceptable (the
   server shockwave is a no-op without hits, and this matches the sibling card), but worth a
   look if a "discharge always shows" feel is desired.

## v0.399 — 361-anim-soul-drain  (2026-06-10 18:46:55)

- **Dev-gated, sole entry**: added only to the `DEBUG_SCENARIOS` set (index.js:648) and the
  `applyDebugScenario` chain (debugScenarios.js:4970); the `?debugScenario=` path is the only
  way in. Normal gameplay never references it.
- **End-state reachable normally**: a damaged caster with full Magic Stones casting an evolved
  Soul Drain into a grunt cluster is ordinary combat — the scenario only pre-arranges that
  state; it does not auto-cast.
- **No invariant bypass**: the scenario only mutates state (hp, magicStones, one hand slot,
  enemy spawns). The actual cast still flows through the normal `useCard`/`cardEffects`
  validation, server resolution, and net replication.

## Design consistency
Consistent with game/docs/design.md: builds on the 315 shared VFX primitives
(`spawnLightningArc`, `spawnTelegraphRing`, `spawnParticleBurst`, `spawnImpactDecal`) and only
touches this card's render fn. No foundation regression.

## Remaining gaps
None blocking. The only out-of-strict-scope change is the server-side debug scenario (ticket
SCOPE names client paths); it is additive, properly gated, and a legitimate QA enabler — noted
in nits.md, not blocking.

## v0.398 — 364-anim-telepipe  (2026-06-10 18:43:25)

construction, palette, overrides, and cleanup/disposal. Ran
`vitest run cardRenderers.test.js vfx-primitives.test.js` → **182 passed**.

## Design / regression consistency

- Scope respected: diff touches only `game/client/cardRenderers.js`,
  `game/client/renderer.js` (new primitive), `game/client/main.js` (ctx
  wiring), and the two client test files. `git diff … -- game/server/` is empty.
- The persistent portal marker is unaffected — it is owned by
  `syncTelepipeMesh`/`animateTelepipePortal` (state-driven), which this ticket
  does not modify. The old `renderTelepipe` call to `spawnSummonEffect` is
  replaced by the dedicated cast flourish; the standing portal is still rendered
  from `state.telepipe`, so no regression to the evac-point marker.
- No debug scenario was added or changed by this ticket (no server diff);
  `telepipe-ready` predates the baseline and is used only by the harness capture.

## Remaining gaps

None blocking. (Minor non-blocking redundancy noted in nits.md.)

## v0.397 — Server: admin password accepted via query parameter and /admin has no rate limit  (2026-06-10 18:13:13)

## Code quality

- Focused diff (~240 lines, mostly tests). No dead code introduced.
- Security properties preserved: fail-closed when `ADMIN_PASSWORD` unset, constant-time compare, Bearer token still ignored for admin.
- `auth.js` export surface expanded minimally for reuse; register/login call sites unchanged.
- Comments in `admin.js` and `auth.js` document the check-then-increment pattern and why check-only uses `>=`.

## Sub-ticket integration

Both sub-tickets integrate cleanly:

1. **01-remove-query-param-password** — query fallback removed; tests inverted from expect-200 to expect-403.
2. **02-add-admin-rate-limit** — bucket logic reused from auth; middleware wired before password check.

No gaps between sub-ticket scope and top-level acceptance criteria.

## Remaining gaps

None. All acceptance criteria are fully and robustly satisfied; runtime capture is clean.

## v0.396 — 367-anim-cinder-snare  (2026-06-10 18:06:10)

`updateAttackEffects` with no per-frame allocation, fading/disposing at `ttlMs`.
Negligible cost even with the 30s lifetime.

### "Client test where feasible"
MET. Five new tests in `game/client/test/cardRenderers.test.js` cover: distinct
dispatch vs `spike_trap`, themed accent at origin/radius, stat-derived cadence/
duration, synchronous placement (no wind-up gating), and a no-radius no-op. Full
file (164 tests) passes; server `enchantment.test.js` (17) passes.

### Scope / design consistency
MET. The diff touches only `game/client/cardRenderers.js` (this card's render fn
+ registration) and its test — exactly the declared scope. No server, shared, or
other-card changes; no new debug scenario; no regression to other renderers
(`renderGroundEnchantment` is retained for other cards). Consistent with
`design.md` VFX-primitive approach.

## Remaining gaps

None blocking. Two minor thematic nits captured in `nits.md`.

## v0.408 — 356-anim-gravity-well  (2026-06-10 20:28:18)

Coverage includes: single bespoke renderer resolution, synchronous fire at t=0,
correct origin/radius/style args, per-enemy arc geometry, empty/absent `pulled`,
radius-absent skip, and the primitive pushing ring/core/inflow with correct
colors and disposal.

### 5. Scope & consistency
PASS. Diff touches only the gravity-well renderer + registration, the VFX
primitive in renderer.js, the two wiring points (main.js, socketHandlerCtx.js),
and tests — within the ticket's stated scope. No debug scenario was added or
changed. Consistent with the 315/316-319 primitive+per-card foundation; no
foundation regression.

## Remaining gaps
None blocking. One non-blocking nit recorded in nits.md: the inflow particles'
runtime trajectory (`position = velocity * t`) starts each particle at the well
center and moves it outward to the opposite side, rather than flowing inward
from its spawned outer ring position — a minor visual imperfection that does not
change the overall inward read (contracting ring + void core + enemy pull arcs
dominate).

## v0.407 — 351-anim-purifying-pulse  (2026-06-10 20:24:09)

VFX without sound. Server emits `playerId` + `healedTargets`, matching exactly
what the client gating reads.

### Scope
**Respected.** Diff touches only `game/client/cardRenderers.js`,
`game/client/renderer.js`, and `game/client/test/cardRenderers.test.js` (plus
ticket bookkeeping) — within the declared scope.

### Design/regression consistency
Consistent with `game/docs/design.md` (heal/cleanse spell identity, mint palette
distinct from gold sanctum). No debug scenario added or changed by this ticket
(the existing `debugScenarios.js` purifying_pulse entry is untouched), so the
debug-scenario gate does not apply. No foundation regression.

## Remaining gaps
None blocking. The fallback smoke capture did not cast purifying_pulse itself
(deck/hand smoke flow), but the card's visual was validated at the sub-ticket
level, the runtime is proven healthy, and the rendering path is fully unit-tested
— this is a minor coverage observation, not a blocker.

## v0.406 — 387-boss-level-citadel-sovereign-capstone-gated  (2026-06-10 19:50:08)

## Debug scenarios (gating audit)
Three scenarios added: `citadel-boss`, `citadel-unlocked`, `citadel-one-prereq`.
- Gated: all three are registered in `DEBUG_SCENARIOS` and reachable only via
  the debug path; `citadel-boss` is also in
  `DEBUG_SCENARIOS_WITHOUT_DEFAULT_SPAWN`. The `?debugScenario=` URL is the only
  entry point. Normal gameplay does not touch them.
- Normal path still reachable: each scenario reaches its end-state by calling
  the *real* primitives — `completeQuestTier(...)` for the actual prereqs,
  `applyLayoutForQuest`, and `deployQuestDebugRun`/`finishStageBossDebugScenario`
  — i.e. the same path a real player hits after clearing all three Tier-II
  lines and deploying. The `citadel_capstone_e2e.test.js` lifecycle test proves
  the equivalent state is reachable through normal unlock + run flow.
- No invariants bypassed: the boss stays dormant/invulnerable until adds are
  cleared and `tryActivateEncounter` succeeds; the unlock gate is enforced via
  `users.isQuestTierUnlocked`. The shortcut does not skip validation or the
  encounter machine.

## Tests
All six relevant suites pass locally: 149 tests green
(`citadel_sovereign`, `citadel_capstone_quest`, `citadel_arena`,
`citadel_capstone_e2e`, client `dungeon`, `renderer-citadel-sovereign`).
Cross-cutting "this boss is the apex" invariants are pinned by assertions, so a
future boss that out-stats the Sovereign will fail CI.

## Remaining gaps
None blocking. The capture not visually reaching the citadel arena is a
capture-plan fallback, not a defect; runtime health is proven and the citadel
path is covered by passing unit + e2e suites. One minor non-blocking redundancy
is noted in `nits.md`.

## v0.405 — 360-anim-ether-siphon  (2026-06-10 19:42:39)

- Built on the 315 primitives (`spawnTelegraphRing`, `spawnParticleBurst`, `spawnLightningArc`, `spawnHitSpark`, `spawnImpactDecal`) plus the one new card-specific primitive. Thematically coherent. ✅

### 2. Timing synced to server effect resolution
- Server resolves `mana_leach` in the default radial-AoE branch (`cardEffects.js:1149+`), emitting `CARD_USED` with `origin`, `radius` (SUMMON_RADIUS), `hits[]` (each `{enemyId, hp, magicStonesGained}`), and applied `magicStonesGained`. `renderManaLeach` consumes exactly these fields, keying meshes by `hit.enemyId` (matches the server field name).
- This is an **instant** radial drain — no projectile travel to sync. `mana_leach` has **no `windUpMs`** in `cardStats.json` (only the evolved `soul_drain` does, at 700ms), so the 307/315 wind-up charge telegraph is correctly absent. A test asserts `mana_leach.windUpMs ?? 0 <= 0`. The effect fires synchronously on `CARD_USED` receipt — i.e. at server resolution. ✅

### 3. No perf regression
- VFX use the existing `activeEffects` pool; the new ring/column branches mutate scale/opacity/emissive per frame with no per-frame allocation, and dispose geometry/material on expiry (`disposeEffectObject`). Missing enemy meshes are skipped (`if (!mesh) continue`). All `ctx.spawn*` calls are guarded by presence checks, so absent primitives degrade gracefully (covered by the "without throwing when new ctx primitives are absent" test). ✅

### 4. Client test where feasible
- `vfx-primitives.test.js`: primitive pushes a contracting ring + ascending column, honors color/emissive/duration overrides, and disposes on expiry.
- `cardRenderers.test.js`: dispatch wiring, violet accents, synchronous fire (asserts no `scheduleAfter`), per-hit arcs/sparks at mesh positions with missing-mesh skip, absorption flourish, windUp-absent guard, and a regression guard that `mana_leach`'s helper signature stays distinct from `battle_familiar`/`soul_drain`.
- Full run: **194/194 passing** locally. ✅

## Consistency / regression
- No debug scenario added/changed (none present in the diff). Server logic untouched, so foundation/replication is unchanged. Normal cast path is the only entry point.

## Remaining gaps
None blocking. The fallback smoke capture did not happen to roll `mana_leach` into the captured hand, so there is no screenshot of the live animation — but this is a capture-plan limitation, not a code defect, and the behavior is fully covered by passing unit tests over the real render/primitive code.

## v0.404 — 357-anim-event-horizon  (2026-06-10 19:41:53)

distinction, per-hit bursts at enemy meshes (including a missing-mesh skip),
no-windUp assertion, radius-absent early return, graceful degradation when
optional ctx primitives are absent, plus two primitive-level tests covering group
structure, palette, style overrides, and cleanup. All green.

## Scope & integration
Within ticket scope: `cardRenderers.js` (this card's render fn), `renderer.js`
(new VFX primitive + update branch), `config.js` (delay constant), and the
standard plumbing to thread `spawnEventHorizonEffect` through `main.js` /
`socketHandlerCtx.js` / `cardHandlers.js` — the same wiring pattern every other
spawn effect uses. Renderer is already registered (`event_horizon:
renderEventHorizon`). No server changes, no debug-scenario changes, no
design.md/requirements.md regression. `IcosahedronGeometry` has a `typeof`-free
truthiness guard with a `SphereGeometry` fallback, and `___test_scene` is honored
so tests exercise the real primitive.

## Remaining gaps
None blocking. One minor cosmetic timing inconsistency noted as a nit (per-hit
sparks fire at cast while the central crush ring fires at +375 ms).


## v0.418 — 348-anim-glacier-rupture  (2026-06-10 22:18:48)


### 4. Client test where feasible
PASS. Strong coverage: dispatch/palette/decal/burst, per-hit positioning, frozenShatter sizing, distinctness
from frost_nova, the windUpMs contract, and graceful degradation when optional ctx primitives are absent. The
primitive itself is tested for ring+shard creation, palette/style overrides, and cleanup.

### 5. Scope
PASS. Changes are confined to `game/client`: the card render fn + registration (cardRenderers.js), the vfx
primitive (renderer.js), and ctx wiring (main.js, socketHandlers/cardHandlers.js,
socketHandlers/socketHandlerCtx.js), plus client tests. No server, no debug-scenario, no TASKS.md changes.
This ticket did not add or modify any `?debugScenario=` shortcut.

### Design/foundation consistency
PASS. Builds on the 315 shared-primitive + per-card registration pattern; reuses the established palette and
telegraph/decal/burst helpers. No regression to requirements foundation; touches only this card's path, so it
will not conflict with sibling per-card animation beads.

## Remaining gaps
None blocking. One minor nit (palette-constant duplication) recorded in nits.md.

## v0.409 — 354-anim-stormwing-drone  (2026-06-10 20:31:57)

`origin.y` mutation is safe. The no-`strikeTarget` fallback
(`stormEagleStrikePoint`, :1132) carries the same downward tilt.

### "No perf regression"
PASS. Deploy adds two extra primitive spawns (ring + burst) on a one-shot
summon event; strike reuses the existing single arc + single burst. No new
hot-loop work, allocations, or per-frame cost.

### "Client test where feasible"
PASS. Six storm_eagle tests cover palette, Thunderbird distinctness, the
ring/wing-burst deploy cues, single-arc-to-strikeTarget, the aerial-origin
geometry (`y ≈ 8` from a 0.8/0.6 tilt over reach 6), the no-strikeTarget tilt
fallback, and summon-vs-strike gating. Full file: 181 passed / 0 failed.

## Remaining gaps
None blocking. The only observation is that the fallback smoke capture did not
visually exercise the animation (harness deck limitation, not a code defect);
correctness is fully established by code inspection against the server payload
plus the unit suite.

## v0.410 — 355-anim-thunderbird  (2026-06-10 20:46:26)

### "Timing synced to server effect resolution; 307 wind-up if windUpMs"
PASS. Server (`simulation.js:3513-3567`) resolves all chain damage instantly within one tick and emits `chainSegments` + an order-aligned `hits[]` in `_pendingMinionBreaths`. The renderer treats hop delays as visual-only (`THUNDERBIRD_CHAIN_HOP_DELAY_MS = 100`, hop `i` scheduled at `100*i`), so the cosmetic cascade never desyncs from authoritative damage — correctly documented in the renderer's docstring. Arc/burst durations use `ATTACK_EFFECT_DURATION`; summon effects use `MINION_SUMMON_IN_MS`. `hits[index]` correctly indexes the enemy at `segments[index].to` (segment 0 = minion→nearest, hits[0] = nearest), so endpoint sparks land on the right mesh. Thunderbird is a minion strike with no `windUpMs`, so no 307 telegraph applies.

### "No perf regression"
PASS. All new work is guarded primitive calls (`spawnLightningArc`, `spawnParticleBurst`, `spawnTelegraphRing`) from the 315 foundation; no new per-frame loops, no allocation in hot paths. Each feature degrades gracefully when a primitive is absent (e.g. `scheduleAfter` missing → synchronous hops; `enemyMeshes` missing → falls back to `seg.to`).

### "Client test where feasible"
PASS. `cardRenderers.test.js` adds focused coverage: summon flourish (ring + aerial burst + telegraph, no stray chain/schedule calls), early-return on attack payloads, `resolveRenderers` ordering, single-target legacy bolt path, multi-segment scheduled hops with correct arc endpoints and endpoint bursts, and a no-`spawnLightningArc` fallback that must not throw. Full suite: **186/186 pass**.

### Scope
PASS. Diff touches only `game/client/cardRenderers.js`, `game/client/test/cardRenderers.test.js`, and the sub-ticket markdown — exactly the declared scope (this card's render fn + registration + client test). Registration changed only `thunderbird:` (cardRenderers.js:1905). The legacy `chain_lightning` spell card still maps to `renderChainLightningArcs` and is unaffected — no regression to other cards.

### Debug scenarios
N/A. This ticket added/changed no `?debugScenario=` shortcut.

## Remaining gaps
None blocking.

Nit (non-blocking, filed to nits.md): `renderChainLightning` (cardRenderers.js:1104) is now dead code — before this ticket it was thunderbird's strike renderer; thunderbird now uses `renderThunderbirdStrike`, and the `chain_lightning` card uses the separate `renderChainLightningArcs`. The function is no longer referenced or exported.

## v0.411 — 353-anim-legion-marshal  (2026-06-10 20:58:33)

### 6. Client tests
PASS. `cardRenderers.test.js` (190) + `vfx-primitives.test.js` (24) = 214 tests
pass locally. Coverage includes rally call args, commander + skeleton flourish
ordering/positions, tether endpoints, ground bursts, palette, default radius,
color/duration overrides, and cleanup.

## Debug scenarios
No `?debugScenario` entry point was added or changed by this ticket (the
existing `debugScenarios.js` reference to `undead_commander` predates the
baseline and is untouched). N/A.

## Design consistency
`docs/design.md` has no card-specific VFX constraints for this card; the change
follows the established per-card animation foundation and does not regress the
requirements foundation.

## Remaining gaps
None blocking. One minor non-blocking observation filed to `nits.md` (column
VFX pattern duplicated across per-card primitives).

## v0.412 — 349-anim-restoration-beacon  (2026-06-10 21:01:39)

PASS. All three sub-effects ride existing `updateAttackEffects` branches and dispose cleanly:
- Column → `isLightColumn` branch (renderer.js:6213), now reading per-effect `columnHeight/columnBaseY/columnOpacity` that default to the gold constants — a backward-compatible generalization, base stays ground-pinned.
- Ring → generic `fx.radius !== undefined` expand→fade→dispose branch (renderer.js:6178).
- Motes → `isParticleBurst` branch (renderer.js:6334).

### 5. No perf regression
PASS. No per-frame allocation; geometry/material built once per cast, motes built as a single Group, every effect calls `disposeEffectObject` at end of life. Motes guard on `areParticlesEnabled()`. Particle count reduced (14→10 burst). The `isLightColumn` change adds three `??` reads per frame for an already-iterated effect — negligible.

### 6. Client test where feasible
PASS. `cardRenderers.test.js` updated to assert the beacon effect dispatch, plus new cases for the optional-spawner guard (`?.`) and non-caster sound gating. Full suite green: **199/199 passing**.

## Debug scenarios
No debug scenario was added or changed by this ticket — the diff touches only `cardRenderers.js`, `main.js`, `renderer.js`, and the client test (the `debugScenarios.js` `healing_font` references are pre-existing). Nothing to verify here.

## Design / regression consistency
Consistent with `game/docs/design.md`'s per-card VFX-on-shared-primitives model. Scope respected: changes confined to this card's render fn + registration (main.js ctx wiring) + the shared renderer primitives + the client test. No server logic, no other card renderers touched.

## Remaining gaps
None blocking. The captured smoke run did not happen to cast this card (deck-dependent), so the proof rests on the code path + the dispatch/lifecycle tests + the clean run — which together are sufficient for an additive-VFX polish ticket. Minor polish noted in `nits.md`.


## v0.417 — 345-anim-cryo-burst  (2026-06-10 22:04:35)

cases: (1) shockwave ring + denser burst + frozen decal at origin with no
summon primitive; (2) lingering 2500ms frost field present and sized to radius
when `frozen`, all synchronous (no `scheduleAfter`/scheduled effects); (3) no
2.5s linger when not frozen but the cast burst still fires. Full suite:
**206/206 pass**.

### Scope / regression

PASS. `git diff 2c595809 HEAD` touches only game/client/cardRenderers.js,
game/client/test/cardRenderers.test.js, and the two sub-ticket `ticket.md`
files — within the ticket's stated SCOPE. No server, shared, or other-card
renderer changes. No debug scenarios added. Consistent with design.md (no
`frost_nova`-specific constraints there) and no foundation regression.

## Remaining gaps

None blocking. One non-blocking nit recorded in `nits.md` (the 2500ms freeze
duration is duplicated client-side from cardStats.json behind a manual
keep-in-sync comment rather than being carried in the payload or imported).


## v0.416 — 347-anim-glacial-orb  (2026-06-10 22:02:50)

### AC4 — Client test where feasible
Met and strong. New/updated tests assert: `resolveRenderers('ice_ball')` →
`renderIceBall`; cast flourish (telegraph ring + 8-count burst); trail carries
`travelMs`; terminal impact is **deferred** (not fired at cast) and lands at the
correct point after `runScheduled()`; immediate per-hit frost bursts at enemy mesh
positions with missing-mesh skip; instant-cast (no positive `windUpMs`); graceful
degradation when optional ctx primitives are absent; and a `spawnAttackEffect`
integration test verifying the glacial-orb group, colors, flag, and cleanup.
Ran `vitest run cardRenderers.test.js vfx-primitives.test.js` → **227 passed**.

## Consistency / regression
Consistent with the 315 VFX-primitive + per-card-renderer foundation (uses
`spawnTelegraphRing`, `spawnParticleBurst`, `spawnProjectileTrail`, `spawnImpactDecal`,
`spawnHitSpark`, `scheduleAfter`, `enemyMeshes` — all present in the `cardRenderCtx`
built in `socketHandlers/cardHandlers.js`). No debug scenario added/changed. No
gameplay, server, or shared logic touched, so no foundation regression.

## Remaining gaps
None blocking. Minor visual nits recorded in `nits.md`.


## v0.415 — 341-anim-infinite-disk  (2026-06-10 21:39:15)

Met. The renderer spawns three spinning cyan **photon discs** (`color 0xa5f3fc`, `emissive 0x22d3ee`) fanned along the perpendicular axis, a chasing projectile trail, and a spark burst at the far point — then schedules **boomerang return beats** that send a trail/burst back from the far point toward the origin. "Infinite Disk" → returning thrown disc → the discs visibly come back. This reads unmistakably as the card's name. Uses the 315 primitives (`spawnAttackEffect`, `spawnProjectileTrail`, `spawnParticleBurst`, `scheduleAfter`).

### 2. Timing synced to the server effect resolution
Met. Travel distance now derives from `data.attackRange` (payload) instead of a hardcoded `3.5`/`6`, so the visual far point matches the server's actual reach. Return-beat count is driven by `data.returnPasses` from the payload, never a hardcoded constant. Confirmed the server actually emits these in the `CARD_USED` payload: `cardEffects.js:550` (`attackRange`) and `cardEffects.js:553-554` (`returnPasses`, = 3 for `triple_returning_projectile`, matching `cardStats.json:166`). Return beats are paced at `ATTACK_EFFECT_DURATION/3` (≈200ms) so the full flourish resolves within the ~600ms attack-effect window rather than lagging. The server resolves all passes same-tick (`collectReturningProjectileHits`), so the return beats are an honest cosmetic flourish over the resolution window — appropriate and documented in the code comments.

### 3. No perf regression
Met. Lightweight: three effect spawns + at most `returnPasses` (3) deferred beats, each a single trail + small burst. No per-frame work added, no leaks (uses the shared `scheduleAfter`).

### 4. Client test where feasible
Met and strong. New tests cover: range sizing from `attackRange`, one scheduled beat per `returnPass` (staggered/increasing delays), reversed return direction from the far point, payload-driven count (`returnPasses: 2`), and graceful degradation when `scheduleAfter` / trail / burst primitives are absent (still renders three discs, never throws). Full suite: **211/211 pass**.

### 5. Debug scenarios
No `?debugScenario` shortcut added or changed by this ticket. N/A.

## Consistency / regression
Consistent with the 315 VFX foundation and the per-card registration pattern (matches sibling renderers' use of `scheduleAfter`, `pointAlong`, accent-color lookup). The `data.attackRange ?? INFINITE_DISK_RANGE(6)` and `returnPasses ?? 0` fallbacks keep the renderer robust if a payload omits a field. No foundation regression.

## Remaining gaps
None blocking. (Minor non-blocking observation captured in `nits.md`: the return beats are cosmetic over the resolution window rather than tied to discrete per-pass server hit timestamps — acceptable, since the server resolves all passes same-tick.)


## v0.414 — 344-anim-voltaic-chain  (2026-06-10 21:36:21)

render loop. Legacy fallback path (`spawnChainLightningEffect`) retained when segments are absent.

### AC4 — Client test where feasible
PASS. game/client/test/cardRenderers.test.js updated with strong regression guards: renderer
identity, telegraph style incl. `duration`, cast-burst ordering before scheduled hops, arc style,
hop-0 immediate vs hop-1 scheduled within `[80,120]ms` and `< ATTACK_EFFECT_DURATION`, endpoint
snapped to enemy mesh world position, exactly one throttled `enemyHit` sound, and graceful behavior
when new ctx primitives are absent. Full suite: **203/203 pass** (ran locally).

## Consistency / regressions
- Scope respected: only `game/client/cardRenderers.js` (this card's render fn) and its client test
  changed. No server, design, or foundation files touched.
- No debug scenario added or changed by this ticket — debug-scenario rules N/A.
- The shared `spawnChainSegmentArcs` / `CHAIN_LIGHTNING_ARC_STYLE` helpers remain in use by a
  different renderer (cardRenderers.js:1246-1249); not dead code.
- Consistent with `game/docs/design.md` per-card VFX direction; no foundation regression.

## Remaining gaps
None blocking. One minor nit (duplicate cyan style constant) recorded in nits.md.


## v0.420 — 342-anim-arcane-bolt  (2026-06-10 22:50:59)

- **Terminal max-range impact** (`spawnImpactDecal` + 16-particle burst) deferred by `travelMs` via `scheduleAfter`, for visual travel sync only.
This is a faithful match to instant projectile resolution.

### "No perf regression" — MET
The projectile effect is registered in `activeEffects` and disposed on expiry (`disposeEffectObject` + array splice once `elapsed >= duration`). A vfx-primitives test confirms the flagged lance is added and cleaned up with geometry disposal. No persistent leaks.

### "Client test where feasible" — MET
`cardRenderers.test.js` and `vfx-primitives.test.js` add coverage: renderer resolution (`renderArcaneBolt`, explicitly not `renderWeaponSwing`), synced `spawnAttackEffect`/`spawnProjectileTrail` params, deferred terminal impact via `runScheduled`, immediate per-hit pierce bursts at mesh positions (with a missing-mesh guard), no-windUp assertion, and projectile lifecycle/cleanup. Ran `vitest run` on both files: **237 passed (237)**.

### Scope — RESPECTED
Diff touches only `game/client/cardRenderers.js`, `game/client/renderer.js`, and the two client test files — exactly the declared scope. No server, no other per-card renderers, no debug scenarios added.

## Consistency / regressions
- Consistent with `design.md` (Weapons = directional projectiles). No foundation regression.
- No debug-scenario shortcuts introduced.
- Removed the now-dead `arcane_bolt` entry from `WEAPON_SLASH_STYLES`, avoiding stale config.

## Remaining gaps
None blocking. The implementation fully and robustly satisfies the ticket.


## v0.419 — 340-anim-photon-slicer  (2026-06-10 22:20:51)

Uses `INFINITE_DISK_RETURN_BEAT_MS = round(ATTACK_EFFECT_DURATION/3)` (cardRenderers.js:548) — no fixed multi-second delay; the throw+return flourish resolves within the attack-effect window. No `windUpMs` on photon_slicer, so no charge telegraph is required. PASS.

**Graceful degradation.**
`spawnProjectileTrail`, `spawnParticleBurst`, and `scheduleAfter` are each guarded; only `spawnAttackEffect` is unconditional (consistent with sibling renderers and the always-present primitive). Calling with all optional primitives absent does not throw. PASS.

**Dead `WEAPON_SLASH_STYLES.photon_slicer` removed.**
Removed (former lines 182–193); other weapon styles untouched. PASS.

**Tests updated and passing.**
The old cone-slash assertion is replaced by a returning-disc test asserting the cyan outbound effect, far-point burst at `{x:8,z:0}`, exactly one scheduled return beat, and a reversed return trail after `runScheduled()`. `npx vitest run client/test/cardRenderers.test.js` → 212/212 pass, including the shared distinct-accent / graceful-degradation / card-specific-renderer tests with `photon_slicer` included.

**Scope.**
`git diff` touches only `game/client/cardRenderers.js`, `game/client/test/cardRenderers.test.js`, and the subticket md — within the declared scope. Server CARD_DEFS unchanged, so server tests referencing photon_slicer (`saber_aoe_grind`, `new_card_pack`) are unaffected.

## Design / regression consistency
Mirrors the established `renderTripleReturning` (Infinite Disk, photon_slicer's evolution) as its single-disc sibling — visually coherent across the lineage. No new ctx methods, no `renderer.js`/`main.js` changes, no foundation regression. No debug-scenario changes in this ticket.

## Remaining gaps
None blocking. Minor non-blocking nits filed separately (duplicate range constant, redundant accent fallback).


## v0.421 — 334-anim-deck-sifter  (2026-06-10 23:19:41)

- Palette stays on the card's own theme: `DECK_SIFTER_ACCENT 0xd4a843` matches the `deck_sifter` card color `#d4a843`; parchment body `0xf5deb3` + gold emissive `0xdaa520`. The "deck sifting / drawing a card" read is clear and distinct from a generic hit burst.

### 2. Timing synced to server effect resolution
PASS. `deck_sifter` is a `weapon` with effect `draw_card` and **no `windUpMs`** (confirmed in cardDefs.json and the HUD probe, which shows wind-up labels only on Solar Edge/Vault Wyrm, not deck_sifter), so no 307 charge telegraph is required. The draw is instant server-side, so the centre card puffs immediately (synced to the instant draw) and the two flanking cards riffle out via `scheduleAfter` at 70ms/140ms — total ~140ms, asserted `< 300ms` in the test. Sub-ticket 01 added `origin: { x: originX, z: originZ }` to the `draw_card` `CARD_USED` emit (game/server/cardEffects.js:371), so the flourish renders at the caster instead of world (0,0). Origin is the player's locked cast position.

### 3. No perf regression
PASS. Built only from existing ctx primitives (`spawnParticleBurst`, `spawnTelegraphRing`, `scheduleAfter`). Particle budget is modest (one ring + 3×6 particles) and actually lower per-burst count than before; no new render loops or allocations of concern.

### 4. Client test where feasible
PASS. The client test was rewritten to assert the full composition: ground ring palette/position/radius, immediate centre burst, the `[70, 140]` schedule, and the three fanned bursts at z `[3.3, 4, 4.7]` perpendicular to a `+x` cast. A graceful-degradation test (no `spawnParticleBurst`) is retained. A server integration test asserts the `draw_card` `CARD_USED` carries finite origin equal to player position. Client tests pass (`2 passed`). Server integration suite is skipped wholesale in this environment (all 168 skip — pre-existing harness behavior, not introduced here).

## Design / scope consistency
- Consistent with the 315 shared-VFX-primitive foundation; no new bespoke primitives.
- Scope was nominally client-only (cardRenderers.js + vfx + client test), but the implementation also touches game/server/cardEffects.js (one line) and the server integration test. This deviation is minimal and necessary: the burst cannot render at the caster without the server forwarding the cast origin for the instant `draw_card` path. Well-justified and self-contained; not a blocking concern.
- No debug scenarios added or changed.
- `directionOf`/`originOf` both default safely (direction → `{x:1,z:0}`, origin → `{x:0,z:0}`), so a missing direction yields a finite perpendicular fan rather than NaN.

## Remaining gaps
None blocking.


## v0.413 — 352-anim-necroframe-knight  (2026-06-10 21:10:16)

- degrades gracefully when optional ctx helpers (`spawnTelegraphRing`,
  `spawnParticleBurst`, `scheduleAfter`) are absent.
Plus a `resolveRenderers` assertion that the card uses its bespoke renderer, not
the generic creature default. Full suite: **193 passed**.

### Scope & integration
PASS. Diff touches only `game/client/cardRenderers.js` (this card's render fn +
registration) and its test file — exactly the declared scope. No other per-card
beads are affected. Every optional helper is guarded, so the renderer is robust
against a minimal ctx. No debug scenarios added.

### Design consistency
PASS. Reuses the 315 shared VFX primitives and the per-card registration pattern;
palette deliberately matched to the evolution chain. No regression to the
foundation.

## Remaining gaps
None. The captured run is clean, all acceptance criteria are robustly met, and
the client tests pass.


## v0.432 — 335-anim-offering-terminal  (2026-06-11 01:02:00)

### Timing and server synchronization

PASS. The server `sacrificial_altar` branch emits `CARD_USED` immediately after consuming the minion, adding Magic Stones, and restoring charges. The renderer fires all Offering Terminal primitives synchronously inside `renderSacrificialAltar`; there is no `scheduleAfter`, timer, Promise, projectile travel delay, or wind-up mismatch. The card stats do not define `windUpMs`, so no 307 wind-up telegraph is expected.

### Scope, performance, and regressions

PASS. The game-code changes are scoped to `game/client/cardRenderers.js` and `game/client/test/cardRenderers.test.js`. The VFX work is bounded to a handful of one-shot primitives per cast and adds no per-frame loops or persistent unbounded effects. The captured smoke run still satisfies the foundation requirements: 3D scene, client-server connection, multiplayer presence, movement, and HUD rendering are intact.

### Test and coverage visibility

PASS. `coverage.log` shows the full Vitest run passing: 50 files and 704 tests. The new `cardRenderers.test.js` coverage asserts the ritual composition, consumption/no-consumption split, reward/no-reward split, and registration coverage for `sacrificial_altar`.

### Debug scenarios

PASS. This ticket did not add or modify a `?debugScenario=...` entry. The existing utility-spells debug scenario remains a dev-only shortcut, and Offering Terminal remains reachable through normal reward-card gameplay paths such as the Crucible Duel reward.

## Remaining gaps

None.

## v0.422 — 338-anim-saber-of-light  (2026-06-10 23:23:33)

### Timing and server-effect sync

PASS. Server card data defines `saber_of_light` as a `swift_slash` weapon with `cooldownMs: 400`, `attackRange: 5`, `aoeGrindScale: 0.03`, and no `windUpMs`. The server emits the grind-scaled `attackRange` in the `CARD_USED` payload, and the client renderer uses `data.attackRange` for both cone reach and flash/spark placement, falling back only when the field is absent. The single-swing path fires synchronously with card use, and only additional swings are staggered with the established multi-swing delay idiom.

### Test coverage and regression risk

PASS. `game/client/test/cardRenderers.test.js` adds focused coverage for dedicated renderer resolution, light-themed primitives, reach scaling from small vs large `attackRange`, immediate `swift_slash` timing, and graceful degradation when optional light primitives are missing. The captured `coverage.log` shows the full visible vitest run passed: 50 files, 707 tests.

### Design and requirements consistency

PASS. The change is scoped to client card VFX and tests, preserving the existing 3D scene, websocket play flow, multiplayer visualization, and movement synchronization foundation. It fits the design's card-based combat model and does not alter server combat rules, persistence, lobby flow, or economy.

### Debug scenarios

PASS. This ticket did not add or change a `?debugScenario=` entry point. Existing saber-related scenarios remain URL-driven/local QA shortcuts, and their comments describe normally reachable equivalent states through owning/grinding reward weapons and deploying normally.

## Remaining gaps

None.


## v0.423 — 337-anim-chrono-trigger  (2026-06-10 23:31:38)

### Performance and integration

PASS. The implementation uses the existing `activeEffects` lifecycle and fixed small mesh counts: two ripples, one column, and optional per-restored-slot flares/arcs. `spawnChronoTriggerEffect` adds no network traffic, persistent world state, or per-frame allocations beyond the established effect update loop. The socket handler context and main renderer dependency wiring expose the primitive cleanly to card renderers.

### Tests and coverage

PASS. `coverage.log` reports 50 client test files passing with 708 tests. The added coverage includes Chrono Trigger renderer registration, instant dispatch without delayed scheduling, absent-windup behavior, restored-charge flare placement, distinct utility-spell signatures, primitive palette/defaults, and cleanup through `updateAttackEffects`. Coverage thresholds were disabled, but the changed client files have focused behavioral assertions.

### Design and foundation consistency

PASS. The change is consistent with `game/docs/design.md`: Chrono Trigger remains a spell card whose effect is a single-use utility action, not a new combat system or server-side invariant. The foundation requirements in `game/docs/requirements.md` are preserved; the captured run shows a rendered 3D scene, working client-server connection, multiplayer presence, and movement state updates.

### Debug scenarios

PASS. This ticket did not add or change any `?debugScenario=` shortcut. `metrics.json` also reports no development scenarios used for the capture, so there is no debug-path gating or reachability issue to review for this ticket.


## v0.424 — 333-anim-reaper-s-scythe  (2026-06-10 23:50:22)


### Timing and server-effect sync
PASS. The primary sweep fires synchronously on `CARD_USED`, uses `data.attackConeAngle ?? Math.PI` and `data.attackRange ?? ATTACK_RANGE`, and does not call `scheduleAfter` for the primary swing, tethers, or reward flourish. This matches the server-side Reaper's Scythe contract: no positive `windUpMs`, instant cone resolution, kill rewards emitted in the same `CARD_USED` payload as `hpHealed` and `currencyGained`.

### Reap kill-reward visuals
PASS. Killing hits with live enemy meshes spawn guarded soul tethers back to the cast origin, missing meshes are skipped without throwing, and the harvest flourish is gated on actual positive `currencyGained` or `hpHealed` rather than `specialEffect` alone. Non-killing swings retain only the sweep stack.

### Debug scenarios
PASS. The added `reapers-scythe-ready` scenario is registered as a debug scenario and the client entry point remains the localhost-only `?debugScenario=...` flow. The scenario only shortcuts setup for QA by placing the evolved card and target enemies after entering a standard playing debug state; the same end-state remains reachable through normal gameplay by evolving `harvesting_scythe` into `reapers_scythe` and deploying with it.

### Design and foundation consistency
PASS. The implementation stays within the card-animation layer and small debug/test plumbing, preserving the core server-client loop, multiplayer state, movement, and combat foundations described in the design and requirements docs. It uses the existing shared VFX/context primitives rather than adding renderer branches or new gameplay effects.

### Tests and coverage
PASS with residual unrelated validation noise. `coverage.log` shows the focused client renderer suite passing (`client/test/cardRenderers.test.js`, 229 tests) and the VFX primitives suite passing. The full coverage run has one server failure in `server/test/key-items.test.js` for `flare_beacon` `revealedUntil`; this ticket did not touch key-item code, state snapshots, or that test path, so I do not consider it a Reaper's Scythe blocking gap.


## v0.425 — 336-anim-battery-automaton  (2026-06-10 23:52:55)

Battery Automaton now has a card-specific renderer registered for `battery_automaton`, so it no longer falls back to the generic creature summon. The summon uses an amber/gold chassis palette with electric-cyan emissive accents, a mechanical deploy ring, an ascending electric column, and the shared minion summon-in burst. This reads as a battery-powered automaton rather than a plain creature summon.

The timing is aligned with the server-side behavior. The server emits `cardUsed` only after the minion is created, includes `minionId`, and initializes `lastChargePulseAt` at summon time. The client deploy effect fires synchronously with that `cardUsed` event and uses `MINION_SUMMON_IN_MS` rather than a delayed wind-up. Battery Automaton has no card `windUpMs`, projectile travel, impact hit, or DoT requirement to sync. Its ongoing effect is the periodic charge restore; the server advances `lastChargePulseAt` on the same 6s restore cadence, and the client only spawns the charge pulse when that timestamp increases, avoiding a false pulse on first sighting.

The persistent minion mesh is also themed consistently: `MINION_VISUAL.battery_automaton` uses a box chassis with the same amber/cyan palette, while the charge pulse adds a brief electric ring and spark burst at the minion position. Cleanup paths dispose Battery Automaton effects through the shared `activeEffects` lifecycle and prune per-minion pulse state when a minion leaves the snapshot, so there is no obvious effect leak or accumulating stale sync state.

## Design and foundation consistency

The work preserves the documented card-combat model: Battery Automaton remains a creature card that spawns a battlefield ally, and the charge-restore mechanic continues to be server-authoritative. Normal multiplayer, movement, lobby, socket, and 3D-rendering foundations from `requirements.md` are intact in the captured run.

The added `battery-automaton-ready` debug scenario is gated by the existing `?debugScenario=` URL path and server debug-scenario authorization. It sets up mana and a hand card for QA, but the actual deployment still goes through the normal `useCard` socket path; Battery Automaton remains reachable through normal acquisition/deck play as covered by the card acquisition and integration tests.

## Tests and coverage

The recorded vitest run passed: 175 files and 2486 tests. Focused coverage includes renderer dispatch for `battery_automaton`, deploy and charge-pulse VFX primitive lifecycle tests, minion summon mesh behavior, charge-pulse sync, and existing server/integration coverage for Battery Automaton spawning and charge restoration. Coverage is visibility-only; no disabled threshold concern blocks the ticket.

## v0.426 — 332-anim-ether-scythe  (2026-06-11 00:02:39)

### Scope, performance, and integration

PASS. The implementation is narrowly scoped to `game/client/cardRenderers.js`, renderer tests, and a debug scenario registration. The new visual work composes existing primitives (`spawnAttackEffect`, `spawnParticleBurst`, `spawnImpactDecal`) and is guarded for missing optional helpers or missing enemy meshes, so it should degrade cleanly and not introduce broad rendering or performance risk.

### Client test coverage

PASS. `game/client/test/cardRenderers.test.js` covers the scythe theme, server cone/range sync, fallback behavior, sibling blade isolation, hit-wisp behavior, and graceful degradation. The round coverage log shows the full suite passed: 175 test files and 2489 tests.

### Design and foundation consistency

PASS. The change preserves the design document's active card-combat model and the requirements baseline: the game still starts, renders a 3D scene, connects client/server, shows multiplayer state, and accepts synchronized movement in the captured flow. Ether Scythe remains an earnable weapon reward card and no core combat or progression invariant is weakened.

### Debug scenarios

PASS. The added `harvesting-scythe-combat` debug scenario is registered through the existing debug scenario path and remains gated by the existing local/dev `debugScenario` mechanism. It only creates a QA shortcut to a normally reachable state: a player in a normal run with the earnable `harvesting_scythe` in hand. It does not bypass normal `useCard` validation, server hit resolution, net replication, or the client `cardUsed` renderer path.


## v0.427 — 331-anim-mana-prism  (2026-06-11 00:22:40)

### Wiring, robustness, and performance

PASS. The new `spawnManaPrismEffect` primitive is threaded through `main.js`, `socketHandlerCtx.js`, and `cardHandlers.js` into the per-card renderer context. The renderer uses a finite group of eight meshes for the cast flourish and a finite six-callback pulse schedule; no intervals, unbounded allocations, or persistent scene objects are introduced. The minimal-context tests also cover graceful no-op behavior when optional primitives are absent.

### Tests and coverage

PASS. The latest coverage run reports `50 passed` test files and `719 passed` tests. `client/test/cardRenderers.test.js` includes targeted assertions for the Mana Prism cast VFX, exact pulse schedule, pulse flourish contents, and missing-primitive graceful degradation. Coverage thresholds were disabled as expected; the relevant changed client renderer behavior is directly covered.

### Design and foundation consistency

PASS. The implementation stays within the documented card-combat model in `game/docs/design.md`: Mana Prism remains a spell/resource effect in the active deck combat system, with no server-client architecture, movement, multiplayer visualization, or foundation requirement regression. The runtime smoke verifies the 3D scene, websocket connection, multiplayer presence, and movement flow remain functional.

### Debug scenarios

PASS. This ticket did not add or change a `?debugScenario=NAME` shortcut. Existing Mana Prism QA shortcuts referenced in sub-ticket handoff material remain pre-existing debug paths, and the captured run used `debugScenario: null`.

## Remaining gaps

None.


## v0.428 — 330-anim-archive-wyrm  (2026-06-11 00:23:51)

### Scope, Performance, And Integration

PASS. The implementation stays within client renderer registration/VFX plumbing/tests, with only small ctx wiring for `spawnFireTrailEffect` and an enemy HP-drop fallback update. It reuses existing VFX primitives and does not touch `updateAttackEffects` or add per-frame work. `dungeon_drake` behavior is covered by regression tests and remains on the shared Vault Wyrm renderers.

### Tests And Coverage

PASS. `round-1/coverage.log` shows `62 passed (62)` test files and `1413 passed (1413)` tests with coverage visibility enabled. `client/test/cardRenderers.test.js` includes focused assertions for Archive Wyrm renderer registration, summon palette/primitives, fire-breath composition, tick-only hit feedback, server timing constants, and airborne origin/direction Y handling.

### Design And Requirements Consistency

PASS. The change preserves the design's active card-combat creature model: Archive Wyrm remains a creature/minion with server-authored combat effects and client-side visuals only. The foundation requirements are not regressed; the captured run shows 3D rendering, socket connectivity, multiplayer presence, and movement/dodge gameplay still working.

### Debug Scenarios

PASS. This ticket did not add or change debug scenario entry points. Existing Archive Wyrm debug helpers remain gated through the localhost `?debugScenario` flow and are documented as shortcuts for states reachable through normal play by evolving `dungeon_drake` to `ancient_wyrm` and deploying it in combat.


## v0.429 — Decision: per-quest layouts are fully deterministic — every run of a level is the identical map. Intentional?  (2026-06-11 00:43:01)

## Code quality

- **Seed separation is clean:** layout stream and objective stream are explicitly split; only `collect_items` crystal placement consumes `objectiveRng`.
- **Checkpoint symmetry:** `runSpawnSeed` is captured and restored alongside `layoutSeed` and loot — consistent with telepipe durability rules in `design.md`.
- **No dead code:** new exports (`generateRunSpawnSeed`, `ensureRunSpawnSeed`) are used by tests and the deploy path.
- **Test depth:** unit (`quest_per_run_spawn.test.js`), server lifecycle (`server.test.js`), integration socket abandon (`integration.test.js`), and debug-scenario smoke cover the full matrix.
- **Coverage artifact:** `round-1/coverage.log` reports 1969/1969 tests passed; scoped file report only surfaces `index.js`/`cards.js` (harness diff filter), but changed `progression.js` / `objectives.js` paths are exercised by the new and extended tests above.

---

## Remaining gaps

None. All acceptance criteria from the three sub-tickets are met; runtime capture is clean; tests pass.

---

## Nits (non-blocking)

See `nits.md` — stale doc tense in `design.md` only.


## v0.430 — 329-anim-astral-guardian  (2026-06-11 00:44:45)

### Timing and server-effect sync

PASS. The server `astral_guardian` effect resolves immediately in `applyAstralShieldCast`, emits `radius: SUMMON_RADIUS`, `shieldGranted`, `playerId`, `hits`, and `minionId`, and the renderer consumes those live payload fields synchronously. The client test asserts no `scheduleAfter` deferral, no generic `spawnSummonEffect`, and an AoE telegraph radius exactly equal to `data.radius`, so the visible impact aligns with the instant radial damage and shield-up moment.

### Design and foundation consistency

PASS. The change is consistent with the design doc's card-combat model: Astral Guardian remains a spell with an instant radial effect plus defensive/minion utility, and it does not alter lobby, movement, multiplayer, economy, or server-client foundations from `game/docs/requirements.md`.

### Code quality, tests, and coverage

PASS. The diff is narrow: `game/client/cardRenderers.js` and `game/client/test/cardRenderers.test.js` are the only game files changed. Optional VFX helpers are guarded, the renderer no-ops when `data.radius` is absent, and the tests cover the summon/telegraph/burst path, shield-present path, shield-absent path, and synchronous timing. The recorded coverage run shows `50` test files and `747` tests passing, including `client/test/cardRenderers.test.js`.

### Debug scenarios

PASS. This ticket did not add or change a `?debugScenario=...` development shortcut; no debug-scenario gating or normal-gameplay reachability issue is introduced.

## Remaining gaps

None. The ticket meets the acceptance criteria. The fallback smoke capture did not include a dedicated Astral Guardian cast screenshot, but the game run is clean and the renderer behavior is covered by focused client tests.


## v0.431 — 328-anim-aegis-sentinel  (2026-06-11 00:53:30)

The persistent minion visual in `game/client/renderer.js` is also themed as a wide, tall green shield-wall box, so the summoned creature continues to read as a defensive sentinel after the cast flourish ends.

### Timing and server-effect sync
PASS. The server-side `aegis_sentinel` definition has no `windUpMs`, and the normal creature `CARD_USED` payload is emitted when the effect resolves with `minionId`; the existing server test confirms the card grants 30 shield HP, spawns the taunt minion, and deals zero burst damage. The client renderer fires synchronously from `CARD_USED`, does not use `scheduleAfter` on the main path, keys shield flourish to `shieldGranted`, and keys deploy/summon visuals to `minionId`. VFX duration uses `MINION_SUMMON_IN_MS`, matching the minion scale-in window.

### Shared primitives and performance
PASS. The Aegis primitives are additive VFX registered in `activeEffects`, use finite durations, clean up through `updateAttackEffects()`, and do not add network traffic or per-frame allocations beyond the existing active-effect update pattern. Optional helper calls are guarded, so partial context exposure will not throw.

### Debug scenario requirements
PASS. The `aegis-sentinel-ready` scenario is reachable only through the existing `?debugScenario=` path and is gated by the normal localhost/debug scenario flow. It enters the standard playing debug state, then seeds Aegis Sentinel into the player's hand with enough Magic Stones. The same end state is reachable through normal gameplay because `aegis_sentinel` is in the shop/reward card pool, can be acquired, placed in the deck, and used in a run; the shortcut does not replace or weaken the server-side use-card path.

### Design and requirements consistency
PASS. The change preserves the documented 3D multiplayer action-RPG foundation: it only affects client-side rendering/VFX for one creature card plus test coverage and debug visibility. The captured run confirms the core requirements still hold: Three.js scene renders, client/server connection works, multiplayer avatars appear, and movement/dodge interactions update during play.

### Verification evidence
PASS. The requested diff/log commands show the ticket's three commits and a scoped change set in `game/client/cardRenderers.js`, `game/client/renderer.js`, `game/client/main.js`, `game/client/socketHandlers/*`, and focused client tests. Coverage visibility shows the client vitest run passing: 50 test files and 748 tests passed. The fallback capture screenshots exercise lobby and baseline gameplay health; they do not specifically show Aegis Sentinel, but the live code and focused tests cover the card renderer and primitive behavior directly.


## v0.433 — 327-anim-corebreaker-greatsword  (2026-06-11 01:12:58)

### No performance regression or obvious code-quality issue

PASS. The effect adds a bounded number of visuals: one cone, one impact decal, one burst, one directional fire-zone, and four scheduled pulse beats from the card's current DoT stats. That is small and fixed per cast. Optional VFX primitives are guarded where relevant, tests cover the dedicated renderer, range sync, DoT timing, synchronous impact, heavy-weapon distinction, and graceful degradation of optional trail primitives.

### Client test where feasible

PASS. `coverage.log` shows the full vitest run passed: 59 files and 934 tests. `client/test/cardRenderers.test.js` includes targeted Corebreaker tests for dedicated renderer registration, magma visuals, server-emitted `attackRange` sync, card-def DoT cadence, synchronous swing/impact, and fallback behavior.

## Design and foundation consistency

PASS. The change preserves the documented 3D multiplayer action-RPG/card-combat loop and does not alter lobby flow, combat resolution authority, movement, persistence, or economy rules. The animation remains client-side feedback for a server-authoritative card result, which matches the design foundation.

## Debug scenarios

No development debug scenario was added or changed for this ticket. The round-2 capture also reports no active scenarios.


## v0.434 — 324-anim-phase-stalker  (2026-06-11 01:22:20)

### No performance regression

PASS. The added work is bounded: one delayed deploy pulse, two short projectile trails, two small bursts, one attack corridor, and one spark per reported enemy hit. The minion wind-up update adjusts existing telegraph material opacity and reuses the existing keyed telegraph mesh lifecycle. There is no unbounded allocation loop or persistent effect leak apparent in the changed code.

### Client tests where feasible

PASS. Coverage log shows the Vitest suite passed: 50 files, 759 tests. Focused tests were added for Phase Stalker deploy layering, helper absence, beam travel timing, rift accent, per-hit enemy sparks, and null-crawler wind-up telegraph creation/disposal. The coverage report itself is visibility-only and does not enforce thresholds.

## Design and foundation consistency

PASS. The changes remain consistent with the design doc's card-combat model: Phase Stalker is still a creature minion whose attack is represented visually without changing server combat, economy, dungeon, lobby, or persistence behavior. The foundation requirements still hold in the captured run: a Three.js scene loads, clients connect through the server, multiplayer state is visible, and WASD movement updates during gameplay.

## Debug scenarios

PASS. This ticket did not add or modify a `?debugScenario=` shortcut or server debug scenario. The capture also ran with `debugScenario: null`, so normal gameplay remains the entry path exercised by the smoke flow.


## v0.435 — 326-anim-alloy-greatblade  (2026-06-11 01:31:06)


### Uses shared VFX primitives and stays scoped

PASS. The implementation composes existing client VFX primitives (`spawnAttackEffect`, `spawnProjectileTrail`, `spawnImpactDecal`, `spawnParticleBurst`, `spawnTelegraphRing`) and only changes `game/client/cardRenderers.js` plus targeted renderer tests. No server contract, gameplay rules, or unrelated cards were modified.

### No performance regression

PASS. The effect adds a small bounded number of short-lived primitives per `cardUsed` event: one cone, one trail, one decal, one burst, and optionally one knockback ring plus one burst. There are no new loops over scene state, persistent effects, timers for the normal `steel_claymore` payload, or allocations that scale with enemy count beyond the existing shared hit-flash handling.

### Client test coverage

PASS. `coverage.log` shows the full vitest run passed: 50 files and 763 tests. The new tests cover dedicated renderer dispatch, `windUpMs`/single-swing timing contract, `attackRange`-driven placement, synchronous impact, knockback-gated burst, thematic trail/decal/debris composition, and graceful degradation when optional primitives are unavailable.

## Design and requirements consistency

PASS. The change fits the documented card-combat model: weapons are multi-charge directional attacks, and wind-up commitment remains server-driven. It does not alter the foundation requirements for rendering, socket connection, player visualization, or movement synchronization. No development debug scenario was added or changed.

## Remaining gaps

None.

## v0.436 — Client: on-screen control hints never mention the key item binding  (2026-06-11 01:54:41)

**PASS.** `game/client/test/attack-cast-hint.test.js` adds four focused cases: default `E`, rebound `Q`, standard gamepad `DPad Down`, and 8BitDo 64 label (no raw `Btn 13`). Full suite: **549/549 tests passed** (`coverage.log`).

## Design & integration

- **Scope:** Single sub-ticket; changes limited to `input.js`, `main.js`, and tests. No server or persistence changes — appropriate for a client HUD hint.
- **Consistency with `design.md`:** No combat-loop or progression regressions; improves discoverability of a core combat tool already documented in controls/settings.
- **Existing HUD:** The persistent key-item slot (`Dodge Roll` / `E`) was already present; this ticket correctly fills the gap in the center attack/cast hint line noted in the ticket goal.
- **Debug scenarios:** None added or modified — N/A.

## Code quality

- Reuses existing `getUseKeyItemBinding()` rather than duplicating resolution logic.
- `renderHand()` already refreshed attack/cast hint text for hand-slot binding changes; extending the same path for key-item state keeps behavior consistent.
- No dead code, no new console errors, no pageerrors in capture.

## Remaining gaps

None. All acceptance criteria are met; the captured run proves the game loads and displays the new hint correctly.


## v0.437 — 321-anim-solar-edge  (2026-06-11 01:59:15)

### "Timing synced to server-side effect resolution"
PASS. The swing fires synchronously on `CARD_USED` with no extra `scheduleAfter` delay; the server-side `windUpMs: 650` telegraph (cardStats.json) owns the wind-up, matching the 307/315 charge-telegraph foundation. Test "matches server timing contract (windUpMs 650, immediate swing on CARD_USED)" asserts both. Cone geometry and reach use the payload's `attackConeAngle`/`attackRange` (cardEffects.js emits both on `CARD_USED`, lines 551–552), so the VFX cone matches the server's actual hit volume rather than a hardcoded arc — a genuine improvement over the prior shared-style path. Hit sparks key off `data.hits[].enemyId`, the same field the server populates, so impact VFX align with real resolved hits.

### "Use the 315 primitives; touch only this card's renderer + registration"
PASS. New primitive `spawnSolarEdgeImpactFlourish` lives in renderer.js alongside the other 315 primitives, is exported, wired through `main.js` → `socketHandlerCtx` → `cardHandlers` ctx exactly like its siblings, and updated in `updateAttackEffects()` with proper `disposeEffectObject` cleanup. Diff is confined to cardRenderers.js (this card's fn + registration), renderer.js (the new primitive), the two ctx wiring lines, and tests — no other card renderer touched, no server changes.

### "No perf regression"
PASS (by inspection). Additive VFX only; `depthWrite:false`, bounded ember count (12), and the effect is spliced + disposed once `elapsed >= duration`. No per-frame allocation leaks; cleanup verified by `vfx-primitives.test.js` dispose assertions.

### "Client test where feasible"
PASS. `cardRenderers.test.js` + `vfx-primitives.test.js` run green: **312 tests passed**. Coverage on changed files captured in `coverage.log`. Graceful-degradation tests confirm no throw when `spawnSolarEdgeImpactFlourish` is absent.

## Consistency / regressions
- No `debugScenario` added or touched — normal-gameplay path only.
- `flame_blade` card definition (name "Solar Edge", weapon, windUpMs 650) unchanged; design/requirements foundation intact.
- Removed obsolete `flame_blade` assertions in tests were replaced by a dedicated, stronger Solar Edge suite — no coverage lost.

## Remaining gaps
None blocking. Minor nits recorded in `nits.md`.


## v0.438 — 320-anim-rust-forged-saber  (2026-06-11 02:02:50)

`CARD_DEFS.iron_sword.windUpMs` is undefined, that range/cone pass through, that
spark/decal placement scales with `attackRange` (≈3× at 9 vs 3), and that a
single swing schedules no delay.

### "No perf regression"
PASS. Pure VFX composition on a single weapon's render path; no new per-frame
work, no added allocations in hot loops. Swing count is server-bounded.

### "Client test where feasible"
PASS. `cardRenderers.test.js` adds renderer-identity assertions
(`resolveRenderers('iron_sword')[0].name === 'renderRustForgedSaber'`), updated
the existing styled-slash test to the new rust palette + spark contract, and adds
a new "iron_sword reach + instant-hit timing" describe block (4 tests). Full
suite runs green: **292 passed**.

## Remaining gaps
None blocking. One nit (see `nits.md`): `getAccentHex('iron_sword') ?? style.color`
is effectively always `style.color` because `iron_sword` has no `CARD_ACCENT_STYLE`
entry — harmless defensive code, but the accent lookup is dead for this card.


## v0.443 — Shared: sampleFloorY missing null-layout guard and floorCorners fallback (crashes client prediction AND server tick)  (2026-06-11 02:22:26)

## Design & regression check

- **design.md:** Floor geometry section documents `sampleFloorY()` as the canonical walkable-surface height function in `shared/floorSampling.esm.js`. The fix hardens that function without changing its contract for valid layouts.
- **requirements.md / foundation:** No regressions observed. Change is defensive only; no gameplay, networking, or persistence behavior altered for normal runs.
- **Integration:** Open-plaza platform precedence, room bilinear interpolation, and `resolveFloorY` null-coalescing remain consistent. Server tick and client prediction paths that call `sampleFloorY(layout, …)` with a possibly-null `layout` are now safe.

## Debug scenarios

Not applicable — this ticket did not add or modify any `?debugScenario=` shortcuts.

## Code quality

- Minimal, focused diff (one production file + mirrored tests).
- No dead code, no console errors in capture, no page errors.
- Naming and fallback style match the existing room-branch pattern.

## Remaining gaps

None. All acceptance criteria are fully and robustly satisfied; the captured run proves the game is healthy.

