# Senior Review — 269-lobby-enforce-max-players-cap

**Baseline:** `a3c4af9a628532c2dd04347f614e3be84a0c6d19`  
**Commits reviewed:** `684d1b3c` (cap enforcement), `88153342` (tests)  
**Changed files:** `game/server/config.js`, `game/server/socketHandlers/lobbyHandlers.js`, `game/server/test/max_players_cap.test.js`

---

## Runtime health

| Check | Result |
|-------|--------|
| `metrics.json` present | Yes |
| `metrics.json` `"ok"` | `true` |
| `pageerrors` | `[]` (empty) |
| `harness_failure` | absent |
| `console.log` pageerrors / `[fatal]` | none |

Capture used the fallback full-flow smoke plan (auth → lobby create/join → ready → gameplay). Screenshots show both players in the squad lobby and normal dungeon gameplay (movement, dodge cooldown HUD). The 409 lines in `console.log` are auth/register conflicts from the two-player harness setup, not uncaught game exceptions.

**Runtime verdict:** Game starts and loads cleanly.

---

## Acceptance criteria

### MAX_PLAYERS=16 in config; join rejected with clear lobbyError when full

**Met.**

`MAX_PLAYERS = 16` is defined and exported from `game/server/config.js`.

The `joinLobby` handler in `game/server/socketHandlers/lobbyHandlers.js` checks player count before `joinLobbyWithPhasePolicy`:

```119:122:game/server/socketHandlers/lobbyHandlers.js
    if (Object.keys(lobby.state.players).length >= MAX_PLAYERS) {
      socket.emit('lobbyError', { reason: 'Lobby is full' });
      return;
    }
```

This runs for both lobby-phase joins and playing-phase drop-ins (the cap is evaluated before phase policy branches). Reconnect of an existing disconnected member still bypasses the cap via the earlier reconnect branch — correct, since that player already holds a slot.

On the client, `lobbyError` is surfaced through `showLobbyBrowserError(reason)`, so a rejected joiner sees **"Lobby is full"** in the lobby browser.

### TEST: leave and disconnect decrement count; no drift; freed slot allows new join

**Met.**

`game/server/test/max_players_cap.test.js` adds six cases (659 total server tests pass in `coverage.log`):

| Test | What it proves |
|------|----------------|
| rejects join at 16 (lobby phase) | 17th gets `lobbyError` containing "full"; count stays 16 |
| accepts 16th at 15 | boundary join succeeds |
| explicit `leaveLobby` | count drops to 15; new joiner succeeds; count returns to 16 |
| disconnect + grace eviction | during grace, join still rejected; after `evictDisconnectedPlayers`, slot frees and new join succeeds |
| drop-in at cap (playing phase) | same rejection after filling a mid-run lobby |

Leave path uses `removePlayerFromLobby` (immediate removal). Disconnect path uses `softDisconnectPlayerFromLobby` (slot held during `DISCONNECT_GRACE_MS`, then evicted). Both behaviors match existing lobby architecture and are covered by tests.

---

## Ticket goal (beyond acceptance criteria)

| Goal item | Status |
|-----------|--------|
| Cap at 16 | Implemented |
| Reject join when full | Implemented |
| Lobby-finder routes/creates another lobby on full | **Not implemented** — client shows the error; player must pick/create another lobby manually. This is **not** in the written acceptance criteria. |
| Spawn assignment stays mod-4 (4 offsets, up to 4 stacked at cap) | Unchanged; `assignRunSpawnPositions` still uses `index % RUN_SPAWN_OFFSETS.length` with 4 offsets |

---

## Design & regression

- Consistent with `game/docs/design.md` and `game/docs/lobbies.md` multi-lobby model.
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

VERDICT: PASS
