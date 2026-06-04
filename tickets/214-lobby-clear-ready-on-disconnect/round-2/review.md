# Senior Review — 214-lobby-clear-ready-on-disconnect

**Ticket:** Clear `ready` on soft disconnect and gate `checkAllReady` on connected players only.  
**Baseline:** `1482b4e9b309955484dcc734ea1bf0becdbd9775`  
**Commits:** `28feda3` → `349d1a5` (four sub-tickets: clear ready, gate `checkAllReady`, integration/unit tests, harness `HARNESS_GAME_PORT` for Vite).

---

## Runtime health (capture proof)

| Check | Result |
|-------|--------|
| `metrics.json` present | Yes |
| `ok` | `true` |
| `pageerrors` | `[]` |
| `failure_kind` / `harness_failure` | Absent |
| `console.log` `pageerror` / `[fatal]` | None |

Round-2 capture reached squad lobby, both players ready, entered `phase: "playing"`, movement and dodge-roll probes succeeded (`metrics.json` probes, screenshots `01`–`04`). Benign noise only: Vite connect lines and HTTP 409 on resource load (harness dual-client auth), not uncaught game exceptions.

**Runtime verdict:** Game starts and loads cleanly for this ticket.

---

## Acceptance criteria

### 1. `softDisconnectPlayerFromLobby` sets `player.ready = false` alongside `connected = false`

**Met.** In `game/server/index.js`, `softDisconnectPlayerFromLobby` sets `player.ready = false` immediately after `player.connected = false` inside `withLobbyContext`. This is the only server path that sets `connected = false` (grep confirms single assignment site).

### 2. Gate `checkAllReady` on `p.connected !== false && p.ready` and require ≥1 connected player

**Met.** `checkAllReady` in `game/server/progression.js` now:

- Builds `connectedPlayers` with `p.connected !== false`.
- Requires `connectedPlayers.length > 0` and `connectedPlayers.every(p => p.ready)`.
- Adds `noStaleDisconnectReady`: `all.every(p => p.connected !== false || !p.ready)` so a disconnected player with a stale `ready` flag (any future code path) cannot satisfy start.

This matches the ticket’s intent and aligns with `game/docs/design.md` / `lobbies.md` (“every **connected** player … `ready: true`”) better than the old `all.every(p => p.ready)` over all lobby members including ghosts.

On start, the existing loop still runs `initPlayerHand` / spawn setup over `Object.values(_gameState.players)` (including soft-disconnected members still in the lobby). That behavior predates this ticket and supports drop-in rejoin; this ticket correctly fixes the **erroneous start** and **stale-ready block** cases without widening scope.

### 3. Lobby test for ready-then-disconnect (mirror `lobbies.test.js`)

**Met.** Socket-level coverage lives in the right file for disconnect behavior:

- `game/server/test/integration.test.js` — `Socket Integration — Disconnect Event`:
  - `clears ready on soft disconnect while player remains in lobby`
  - `does not start game when ready player soft-disconnects before opponent is ready`
- `game/server/test/server.test.js` — `checkAllReady does not start when a disconnected player has stale ready`

`lobbies.test.js` focuses on lobby CRUD/persistence; mirroring its *style* here means integration + unit regression, which is appropriate. Round-2 `coverage.log`: **930/930** tests passed, including the new integration case (608ms).

---

## Design & requirements consistency

- **`game/docs/design.md`:** Core loop still “ready up → zone in when squad is ready.” Connected-only gating is the correct interpretation when members can be `connected: false` during grace-period drop-in.
- **`game/docs/requirements.md`:** No lobby-ready invariant regressed; change is server-only, narrow, disconnect-mid-lobby as stated in the ticket.
- **No new `?debugScenario=` shortcuts** — nothing to audit under debug-scenario rules.

---

## Code quality

- Minimal, focused diff (one line in `index.js`, small `checkAllReady` change, tests).
- Defense-in-depth (`noStaleDisconnectReady`) is justified even after clearing ready on disconnect.
- `softDisconnect` in lobby phase calls `broadcastLobbyUpdate` (not `checkAllReady`); opponent ready-up later re-evaluates with correct flags — covered by integration test.
- Harness sub-ticket (`HARNESS_GAME_PORT` → Vite) is orthogonal to game logic; explains clean round-2 capture on `:5175`.

---

## Sub-ticket integration

| Sub-ticket | Delivers |
|------------|----------|
| 01-clear-ready-on-soft-disconnect | `player.ready = false` on soft disconnect |
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

VERDICT: PASS
