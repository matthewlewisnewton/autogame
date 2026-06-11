# Senior Review — Server: index.js broadcast/lookup helpers scan every connected socket per lobby per event

## Runtime health (gate)

- `metrics.json`: `"ok": true`, `pageerrors: []`, no `harness_failure` block. Servers started; URL served at :5177.
- `console.log`: no `pageerror`/`[fatal]`/uncaught lines. The single `409 (Conflict)` is the benign dual-player auth/resource-claim during two-client setup (both clients race the same account-bound resource), not a game-code error. THREE/WebGL/Vite noise absent or benign.
- Probes show a full live flow: two players in a squad lobby, gameplay after W/D, dodge roll with cooldown HUD (`keyItemCooldownRemaining` 411→60, indicator `0.4`→`0.1`), squadmate replicated (`squadmates[].id`), `Latency: 1ms`. Per-lobby broadcasts and player→socket delivery are demonstrably working end-to-end.

The game starts and loads cleanly. Gate passes.

## Acceptance criterion

> Per-lobby emits use socket.io rooms; player→socket lookup is O(1) via a maintained Map; behavior unchanged (existing tests pass)

**Met.**

- **Per-lobby emits use rooms.** `forEachSocketInLobby(lobbyId, cb)` (index.js) iterates `io.sockets.adapter.rooms.get(lobbyId)` instead of scanning all `io.sockets.sockets.values()`. `emitQuestPayloadToLobby` and the per-lobby branch of `broadcastLobbyUpdate` now call it. Verified sockets actually populate that room: `socket.join(lobby.id)` at index.js:1350,1379 and `socket.leave(lobby.id)` at :1487 — so `adapter.rooms.get(lobby.id)` is exactly the membership the old `socket.rooms.has(lobby.id)` check filtered on. Equivalent, narrower iteration. The `socketId === lobbyId` skip is harmless defensiveness.

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

VERDICT: PASS
