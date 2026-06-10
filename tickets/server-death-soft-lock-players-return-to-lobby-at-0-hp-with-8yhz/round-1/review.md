# Senior Review — Server death soft-lock (LOBBY_REVIVE_HP)

**Ticket:** `server-death-soft-lock-players-return-to-lobby-at-0-hp-with-8yhz`  
**Baseline:** `e35b4cd6ffcc08175a3b5675021dbed24bc68fa4`  
**Commits reviewed:** `aafe3081`, `5f4ed349`, `ed1974af`  
**Reviewer:** Senior harness gate (round 1)

## Runtime health

| Check | Result |
| --- | --- |
| `metrics.json` present | Yes |
| `metrics.json` `"ok"` | `true` |
| `pageerrors` | `[]` (empty) |
| `harness_failure` | absent |
| `console.log` pageerror / `[fatal]` | none |

The captured run on `http://localhost:5178/` completed the fallback smoke flow (auth, lobby, ready, movement, dodge). Console output is limited to Vite connect lines, a benign HTTP 409 on registration (duplicate username retry), and normal `[initScene]` logs. No uncaught browser exceptions.

**Runtime verdict:** game starts and loads cleanly.

## Per-criterion findings

### Returning to the lobby after a failed run restores at least LOBBY_REVIVE_HP

**Met.** `LOBBY_REVIVE_HP` (10) is now imported and applied in `revivePlayerInLobby()` (`game/server/progression.js`). When a player is dead or has `hp <= 0`, the function clears `dead` and sets `player.hp = LOBBY_REVIVE_HP`. Players with `hp > 0` and `dead: false` are unchanged (early return).

All hub-return paths that matter for this bug call `revivePlayerInLobby()`:

- `returnPlayersToLobby()` — primary path after the player clicks **Return to lobby** on a failed/completed run summary
- `suspendRunToLobby()` — telepipe full-squad extract
- `giveUpRun()` — in-run give-up
- `joinPlayerToLobby()` — reconnect safety net (see below)

Unit tests in `server.test.js` (`revivePlayerInLobby()` describe block and `returnPlayersToLobby` dead-player case) assert the new HP floor. Persistence saves after revive in `returnPlayersToLobby`, so the restored HP is written to disk before the next session.

### A fresh account that dies at 0 money can subsequently complete a run

**Met.** Integration test `player with 0 currency dies, returns to lobby with LOBBY_REVIVE_HP, and redeploy succeeds` (`integration.test.js`) exercises the full socket flow:

1. Start run with 0 currency
2. Trigger `run-failed` debug scenario (all players dead, `hp: 0`)
3. `returnToLobby` → lobby phase with `hp === LOBBY_REVIVE_HP`, `dead: false`
4. Ready + deploy → `gamePhase === 'playing'`, `run.status === 'playing'`, `hp > 0`

This directly breaks the reported loop (0 HP redeploy → instant Signal Lost via `checkRunTerminalState` seeing all players `hp <= 0`).

### LOBBY_REVIVE_HP is no longer dead code

**Met.** Constant is defined in `config.js` and referenced in `progression.js` (implementation) plus tests. Grep shows no remaining config-only reference.

### Consistency with design.md / requirements.md

**Acceptable.** `design.md` states HP at the hub is normally restored via the Medic station. The top-level ticket explicitly lists wiring `LOBBY_REVIVE_HP` on lobby return as an acceptable fix path for this soft-lock; the implementation follows that chosen path without touching unrelated systems. `requirements.md` foundation (3D render, socket connectivity, movement sync) is unaffected; capture probes confirm connected gameplay with canvas, movement, and dodge.

### Code quality

**Good.** Change is minimal and focused:

- Core fix: one import + one assignment in `revivePlayerInLobby()`
- Reconnect hardening: `joinPlayerToLobby()` calls `revivePlayerInLobby()` unconditionally (moved outside the `isLobbyPhase` guard) so stale persisted `hp: 0` cannot re-lock an account on reconnect

No dead code introduced. No new debug scenarios added by this ticket.

### Debug scenarios

**N/A — no new scenarios.** The integration test uses the pre-existing `run-failed` server debug scenario (socket-gated, not a client URL shortcut). Normal gameplay path remains: die in combat → `runFailed` event → player clicks return to lobby → `returnPlayersToLobby` → revive. The scenario does not bypass server validation for the revive logic under test.

### Test coverage

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

VERDICT: PASS
