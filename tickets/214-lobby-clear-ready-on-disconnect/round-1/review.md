# Senior Review — 214-lobby-clear-ready-on-disconnect

## Runtime health (capture)

**The captured run did not load the game.** `metrics.json` reports `"ok": false` with `"failure_kind": "capture_failed"`. This is an automatic fail for runtime proof regardless of code quality.

- **`pageerrors`:** absent in `metrics.json`; `pageerrors.json` is `[]`. No browser uncaught exceptions from game JavaScript.
- **`console.log`:** no `pageerror` or `[fatal]` lines from game code. Errors are HTTP 502 (Vite proxy) and a capture timeout (`page.waitForFunction: Timeout 12000ms exceeded`).
- **Server:** started successfully on port **3002** (`server.log`: `Server listening on port 3002`, one player connected).
- **Client:** Vite started on port **5175** but every `/api/*` and `/socket.io/*` request failed with `ECONNREFUSED` through the proxy (`client.log`, `metrics.json` → `capture_diagnosis.client_log_tail`).

Root cause is harness port wiring, not ticket code. `game/client/vite.config.js` proxies to `HARNESS_GAME_PORT || PORT || 3000`, but the capture allocated the game server on **3002** without passing that port to Vite — so the client never reached the backend.

## Harness blockers

**Signature:** Vite proxy `ECONNREFUSED` / capture timeout (`capture_failed`).

Relevant log tail:

```
2:31:27 PM [vite] http proxy error: /api/register
AggregateError [ECONNREFUSED]:
2:31:28 PM [vite] http proxy error: /api/login
AggregateError [ECONNREFUSED]:
2:31:31 PM [vite] http proxy error: /socket.io/?EIO=4&transport=polling&t=0fvh7uo4
AggregateError [ECONNREFUSED]:
```

Server side confirms the backend was alive on a non-default port:

```
Server listening on port 3002
Player connected: socket=P0hzITeVMPKHLgk1AAAB, playerId=139e88ec-a1d2-4cea-9e85-babd6c4ec8cd
```

**Code-only assessment:** If capture had wired `HARNESS_GAME_PORT=3002` (or equivalent) to match the allocated server port, the game would likely have loaded cleanly. This ticket makes no client changes and introduces no module-load or runtime JS defects.

---

## Acceptance criteria

### 1. Clear `player.ready` on soft disconnect

**Met.** In `softDisconnectPlayerFromLobby`, `player.ready = false` is set immediately after `player.connected = false`:

```890:891:game/server/index.js
    player.connected = false;
    player.ready = false;
```

Integration test `clears ready on soft disconnect while player remains in lobby` asserts the lobby record retains the player with `connected === false` and `ready === false`.

### 2. Gate `checkAllReady` on connected players

**Met.** `checkAllReady` now:

- Filters to `connectedPlayers` where `p.connected !== false`
- Requires `connectedPlayers.length > 0` and `connectedPlayers.every(p => p.ready)`
- Adds `noStaleDisconnectReady` so any disconnected player with `ready: true` blocks start (defense-in-depth if ready is not cleared elsewhere)

```2935:2940:game/server/progression.js
function checkAllReady() {
  const all = Object.values(_gameState.players);
  const connectedPlayers = all.filter(p => p.connected !== false);
  const allConnectedReady = connectedPlayers.length > 0 && connectedPlayers.every(p => p.ready);
  const noStaleDisconnectReady = all.every(p => p.connected !== false || !p.ready);
  if (allConnectedReady && noStaleDisconnectReady) {
```

Unit test `checkAllReady does not start when a disconnected player has stale ready` covers the stale-ready ghost case directly.

### 3. Lobby test for ready-then-disconnect

**Met.** Two regression tests were added under `Socket Integration — Disconnect Event` in `integration.test.js`:

- `clears ready on soft disconnect while player remains in lobby`
- `does not start game when ready player soft-disconnects before opponent is ready` (asserts `gamePhase` stays `lobby`, no `startGame` on socket2)

The ticket wording references `lobbies.test.js`, but that file covers lobby module helpers, not socket disconnect flows. Placing these in `integration.test.js` alongside existing disconnect tests is the correct mirror pattern.

All three ticket-specific tests pass when run in isolation.

---

## Design & requirements consistency

- **design.md / lobbies.md:** Ready-up and deploy are server-authoritative; narrowing `checkAllReady` to connected players aligns with documented lobby flow. No client or debug-scenario changes.
- **requirements.md:** No regression to 3D rendering, WebSocket connectivity, or movement sync foundations. Change is narrowly scoped to lobby disconnect / deploy gating.

## Code quality

- Minimal, focused diff (3 commits): one line in `index.js`, a small guard refactor in `progression.js`, and targeted tests.
- No dead code, no new debug scenarios, no client-side changes.
- `pnpm test:quick` reports one **unrelated** flaky failure (`Spawner periodic spawn > add is placed within ~3 units of spawner` — distance 3.04 vs ≤3 threshold). Ticket tests and the broader suite (1756/1757) otherwise pass.

## Debug scenarios

No debug scenarios were added or modified. N/A.

---

## Remaining gaps

1. **Blocking (runtime):** Capture failed — Vite proxy could not reach the game server (`ECONNREFUSED` on `/api` and `/socket.io` while server listened on 3002). No runnable proof; verdict must fail until capture is re-run with correct port wiring.

No blocking gaps in the ticket's server-side implementation or tests were found on code review.

VERDICT: FAIL
