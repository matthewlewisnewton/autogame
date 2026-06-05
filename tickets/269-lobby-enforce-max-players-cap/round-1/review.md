# Senior Review — 269-lobby-enforce-max-players-cap

**Baseline:** `268ee3657883ca044d6d499cd60a380f5dcddf36`  
**Commits:** 4 sub-ticket commits (`01-add-max-players-constant` through `04-test-max-players-cap`)

## Runtime health

Captured run is clean:

- `metrics.json`: `"ok": true`, empty `pageerrors`, no `harness_failure`, no `failure_kind`
- `console.log`: no `pageerror` or `[fatal]` lines; only benign Vite connect logs and HTTP 409 on auth register (duplicate username during harness setup, not a game crash)
- Screenshots/probes show normal lobby → ready → dungeon gameplay (movement, dodge cooldown HUD)

The game starts and loads cleanly. No harness infra blockers.

## Per-criterion findings

### MAX_PLAYERS=16 in config; join rejected with clear lobbyError when full

**Met.**

- Server: `MAX_LOBBY_PLAYERS = 16` in `game/server/config.js`, exported and imported in `game/server/index.js`.
- Client mirror: `MAX_LOBBY_PLAYERS = 16` in `game/client/config.js` for lobby-browser UI.
- Enforcement lives in `joinLobbyWithPhasePolicy()` — checks **connected** players before both lobby-phase join and drop-in paths:

```794:799:game/server/index.js
function joinLobbyWithPhasePolicy(socket, lobby) {
  const connectedCount = Object.values(lobby.state.players).filter(p => p.connected).length;
  if (connectedCount >= MAX_LOBBY_PLAYERS) {
    socket.emit('lobbyError', { reason: 'Lobby is full' });
    return;
  }
```

- Rejection reason is explicit: `{ reason: 'Lobby is full' }`.
- Client `lobbyError` handler already surfaces the reason via `showLobbyBrowserError(reason)`.
- Lobby list renders a disabled **Full** button when `playerCount >= MAX_LOBBY_PLAYERS`, with distinct styling (`.lobby-full-btn`).

### Leave/disconnect slot freeing; counts do not drift/leak; freed slot allows re-join after cap

**Met (server-authoritative behavior; covered by tests).**

New file `game/server/test/maxPlayers.test.js` (5 cases, all pass in `coverage.log`: 63 files / 1365 tests green):

| Scenario | Result |
|---|---|
| 16 connected → 17th `joinLobby` | `lobbyError` `"Lobby is full"` |
| Explicit `leaveLobby` from full lobby | `playerCount` 16→15; new player joins |
| Socket disconnect (ghost, grace period) | Ghost does **not** count toward cap; 17th player joins while ghost remains |
| Post-`evictDisconnectedPlayers` | `lobbySummary.playerCount` drops 16→15 after grace expiry |

Disconnect path intentionally keeps ghost rows in `state.players` during the 60s grace window (`DISCONNECT_GRACE_MS`) while the **connected** cap frees a slot immediately — consistent with existing drop-in/reconnect architecture and the sub-ticket spec.

Explicit leave removes the player from `state.players` immediately via existing `removePlayerFromLobby`, so counts and UI stay aligned on that path.

### Spawn assignment stays mod-4 (up to 4 stacked per spawn point at cap)

**Met — no regression.** This ticket did not touch spawn logic. `assignRunSpawnPositions()` in `game/server/progression.js` still uses four offsets with `index % RUN_SPAWN_OFFSETS.length` (4 spawn points). At 16 players, each offset receives up to 4 stacked spawns.

### Goal: lobby-finder routes/creates another lobby when full

**Not implemented as automatic routing** — players must manually create or pick another lobby. This behavior is stated in the ticket **Goal** but is **not** listed in **Acceptance Criteria**. Manual create/join flow remains intact; not treated as a blocking gap for this ticket.

### Consistency with design.md and requirements.md

**No regressions.**

- Aligns with multi-lobby browser flow in `game/docs/design.md` (browse → create/join).
- Does not affect movement sync, WebSocket connectivity, or 3D rendering foundations in `game/docs/requirements.md`.

### Code quality

- Change set is minimal and focused: config constant, one server guard, client list UI, dedicated tests.
- Cap check placement inside `joinLobbyWithPhasePolicy` correctly covers lobby-phase and drop-in without duplicating logic.
- No dead code, no new debug scenarios, no console page errors in capture.

### Debug scenarios

**N/A** — this ticket did not add or modify any `?debugScenario=` shortcuts.

## Test & coverage summary

- Full vitest suite: **1365 passed**, 0 failed (`coverage.log`).
- Changed-file coverage (harness snapshot): `server/index.js` ~89% statements; client files in snapshot are pre-existing modules, not the small `main.js`/`config.js` delta (thresholds disabled per harness note).

## Remaining gaps

None blocking. All acceptance criteria are satisfied server-side with automated test coverage; runtime capture confirms the game still runs cleanly.

## Nits (non-blocking)

See `nits.md` for follow-up backlog items:

1. Client **Full** label keys off `lobby.playerCount` (total rows including disconnect ghosts) while the server cap keys off connected count — during the grace window a lobby can show **Full** in the browser even though the server would accept a new join.
2. `MAX_LOBBY_PLAYERS` is duplicated in client and server config rather than shared via `shared/constants.json`.

VERDICT: PASS
