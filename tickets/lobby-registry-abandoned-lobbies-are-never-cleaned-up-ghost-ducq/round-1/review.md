# Senior Review — lobby-registry: reap abandoned lobbies / hide ghost entries

## Runtime health
- `metrics.json`: `ok: true`, `pageerrors: []`, no `harness_failure` block. Servers
  started, full smoke flow (auth → lobby create/join → ready → movement → dodge
  with cooldown HUD) captured cleanly.
- `console.log`: no `pageerror` / `[fatal]` / uncaught lines from game code.
- The game starts and loads cleanly — runtime-health gate satisfied.

## Acceptance criteria

The ticket has a single compound AC, judged clause by clause.

### Clause 1 — "A lobby with zero connected players disappears from the registry within a bounded TTL (or immediately)"
**Met.** A new `reapAbandonedLobbies()` interval (`game/server/index.js:1507`),
wired into `restartBackgroundTimers()` on the `STALE_CLEANUP_INTERVAL_MS` cadence:
- Lobbies with **zero player records** (orphans) are deleted immediately.
- Lobbies with records but **zero connected players** get an `emptySince`
  timestamp on first sighting; after `EMPTY_LOBBY_TTL_MS` (60 s, `config.js`)
  their disconnected records are evicted via the registry and the lobby is
  deleted.
- A connected player clears `emptySince`, so reconnection within the window keeps
  the lobby alive. `assignPlayerToLobby` also clears it on join/reconnect.
Covered by `reap_abandoned_lobbies.test.js` (orphan immediate, TTL gating,
emptySince clear, within-TTL survival).

### Clause 2 — "no registry entry can show 'In run · 0 player(s)'"
**Met.** `lobbies.js`:
- `connectedPlayerCount()` counts only `connected !== false` records.
- `lobbySummary().playerCount` now advertises the connected count, not raw
  records.
- `listLobbySummaries()` **filters out** any lobby with zero connected players,
  so even an `In run`/`playing` lobby vanishes from the advertised list in the
  window before the reaper deletes it. On disconnect, `broadcastLobbyList()`
  re-runs (`index.js:1473`), so the ghost disappears immediately client-side.
Covered by `lobbies.test.js` (`listLobbySummaries excludes ... zero connected`
with `gamePhase = 'playing'`, and `connectedPlayerCount` ignoring disconnected).

### Clause 3 — "joining a reaped lobby id returns a clean error"
**Met.** `lobbyHandlers.js:102` — `getLobbyById` returns falsy for a deleted
lobby and emits a single `LOBBY_ERROR { reason: 'Lobby not found' }`. Covered by
the new integration test that reaps a lobby then asserts exactly one clean
`lobbyError` on join.

## Integration / regression notes
- `simulation.js cleanupStalePlayers()` now routes stale removal through
  `lobbies.removePlayerFromLobby` (cleaning lobby mapping, minions, trades and
  deleting emptied lobbies), with a bare-`delete` fallback for legacy/test
  gameState. All 170 integration tests still pass.
- Reconnection is unaffected by list-hiding: the reconnect path
  (`lobbyHandlers.js:90`) resolves the lobby via the `playerLobby` mapping, not
  the advertised summaries, and the player record survives (connected=false)
  until the TTL elapses.
- Map deletion during `for...of` iteration in the reaper is safe (only the
  current/visited entry is removed).
- Consistent with `design.md`; no foundation regressions.

## Tests
`vitest run` over `reap_abandoned_lobbies.test.js`, `lobbies.test.js`,
`integration.test.js`: **189 passed (3 files)**.

## Remaining gaps
None blocking. (Minor nit — redundant `cancelTradesForPlayer` in the reaper that
`removePlayerFromLobby` already performs — recorded in `nits.md`.)

VERDICT: PASS
