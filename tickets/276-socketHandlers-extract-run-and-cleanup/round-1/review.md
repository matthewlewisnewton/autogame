# Senior Review — 276-socketHandlers-extract-run-and-cleanup

## Runtime health (gate)

The captured run is clean:
- `metrics.json`: `"ok": true`, `"pageerrors": []`, no `harness_failure` block, no
  `failure_kind`. Servers started; the full smoke flow (auth → lobby create/join → ready →
  movement → dodge/cooldown) completed and probes show `phase: "playing"`,
  `connectionState: "connected"`, `sceneInitialized: true`, dodge cooldown replicated to
  HUD (`keyItemIndicatorText: "0.4"`).
- `console.log`: only benign Vite connect lines and a `409 (Conflict)` resource load
  (the known auth re-login artifact, not game code). No `pageerror`/`[fatal]` lines.
- `coverage.log`: full server+client suite green — **984 tests passed (47 files)**.

Game runs and loads cleanly. Gate passes.

## Per-criterion findings

The ticket has a single combined AC; I assess each clause.

### "Remaining handlers moved" — MET
All remaining run/playing-phase handlers now live in
`game/server/socketHandlers/runHandlers.js`: `returnToLobby`, `giveUp`, `abandonRun`,
`claimCardReward`, `move`, `useCard`, `discardCard`, `lootPickup`. Bodies were moved
verbatim from `lobbyHandlers.js` (payload/sequence validation, vector normalization,
crystal terminal-state check all preserved). `runHandlers.register` is invoked from
`lobbyHandlers.register`; required deps come via direct imports (`isPlayingPhase`,
`LOOT_PICKUP_RADIUS`, progression fns) and `ctx` (runtime collaborators).

### "Dead handlers removed" — MET
The `buyShopCard` and `listKeyItems` socket handlers are deleted. Confirmed truly dead:
`grep` for `listKeyItems`/`keyItemsListed` across `game/` returns **zero** references, and
the `buyShopCard` socket message has no client caller. The `buyShopCard` and
`getUnlockedKeyItems` *progression functions* remain (exported and unit-tested in
`server.test.js`) — correctly untouched. The deleted tests in `integration.test.js` and
`key-items.test.js` are precisely the socket-handler tests for the two removed handlers; no
still-relevant coverage was lost.

### "Leave-broadcast deduped" — MET
The three copy-pasted leave-broadcast blocks (`softDisconnectPlayerFromLobby`,
`evictDisconnectedPlayers`, `leaveLobbyForSocket`) are replaced by a single
`notifyPlayerRemoved(lobby, { playerId, result, emitDisconnect })` helper, with behavior
preserved at each site:
- soft-disconnect: `emitDisconnect: false`, `result` undefined → `shouldBroadcast` true
  (always broadcasts), no `playerDisconnected` emit — matches original.
- evict / leave: `emitDisconnect: true`, passes `result` → broadcasts only when
  `result && !result.deleted`, and still emits `playerDisconnected` — matches original.
The helper re-enters `withLobbyContext` for the broadcast, functionally equivalent to the
original inline context.

### "Connection closure is thin" — MET
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

VERDICT: PASS
