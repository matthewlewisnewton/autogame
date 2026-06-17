# Senior Review — redis/multiplayer: lobby:owners registry leaks orphan entries

## Runtime health (gate)

- `metrics.json`: `"ok": true`, `"pageerrors": []`, servers started, full-flow smoke
  capture (auth → lobby → ready → movement → dodge) completed with live probes
  showing `phase: "playing"`, `connectionState: "connected"`, scene initialized.
- `console.log`: no `pageerror`, no `[fatal]`, no uncaught exceptions from game code.
- No `harness_failure` block.

The game starts and loads cleanly. Gate passed.

This is a server-side Redis-hygiene ticket (no client/render surface), so the
capture is a regression check that the lobby/gameplay flow still works — and it
does. The substance lives in the server unit tests, which I ran below.

## Acceptance criteria

The top-level ticket frames two leak paths in its ROOT CAUSE / FIX DIRECTION.
Both are addressed.

### Path 1 — orphan reaper bypasses unregisterLobby (permanent leak)

`reapAbandonedLobbies()` (`game/server/index.js:1620`) now calls
`unregisterLobby(lobbyId)` before `lobbies._lobbies.delete(lobbyId)` in the
zero-player orphan branch, with the same `.catch` error-logging pattern used by
the other registry call sites. This is exactly the missing `hdel` the ticket
identified. Covered by additions to `server/test/reap_abandoned_lobbies.test.js`.

### Path 2 — dead-instance entries never unregister (no self-heal)

A new `reconcileStaleLobbyOwners(getLocalLobbyIds)` in
`game/server/lobbyRegistry.js:56` sweeps the `lobby:owners` hash and prunes:
- local-owned fields whose lobby id is no longer in the in-memory map (ghost
  entries left by any future bypass), and
- remote-owned fields whose `lobbies:<instanceId>` publish key has expired —
  i.e. the instance is gone.

This is precisely the ticket's suggested "drop owners whose instance no longer
publishes" direction, reusing the existing 30s self-expiring publish key as the
liveness signal (consistent with `lobbyBrowser.js`, which already treats an
absent publish key as "instance gone").

The sweep is wired three ways:
- a 5s interval (`reconcileStaleLobbyOwnersSweep`, `index.js:514`) alongside the
  other cleanup timers;
- piggy-backed on every `publishLocalLobbies()` (`lobbyBrowser.js:66`).

`instancePublishKeyExists` handles both real Redis (`EXISTS`) and the in-memory
shim (`GET`) clients.

### Correctness checks I performed

- **No false-prune race for local lobbies.** `createLobby` inserts into
  `_lobbies` (`lobbies.js:214`) *before* the async `registerLobby` write
  (`lobbies.js:216`), so a concurrent sweep always sees the new lobby id in the
  local set and will not prune a just-registered owner.
- **`hdel` only when there is work** (`staleFields.length > 0`) — avoids an empty
  varargs call.
- **Tests** (`reconcile_stale_lobby_owners.test.js`, 8 cases) cover every branch:
  dead remote pruned, local ghost pruned, live remote preserved, live local
  preserved, mixed dead+live, the `index.js` sweep wrapper, and the
  `publishLocalLobbies` hook. All pass.

### Test run

`npx vitest run reconcile_stale_lobby_owners.test.js reap_abandoned_lobbies.test.js`
→ **14 passed** (8 + 6).

## Consistency with design / requirements

Pure backend Redis-registry hygiene; no change to `game/docs/design.md`
surfaces or the requirements foundation. The smoke capture confirms no
gameplay regression. No debug scenario was added or changed.

## Remaining gaps

None blocking. The implementation fully and robustly satisfies both leak paths
the ticket describes, with thorough unit coverage and a clean runtime capture.

One non-blocking robustness follow-up (see `nits.md`): a *live* remote instance
whose lobby list sees no churn for 30s lets its publish key lapse, after which a
peer's sweep would prune its owner entry. This is the tradeoff the ticket's fix
direction explicitly accepts and matches the pre-existing lobby-browser staleness
assumption, so it does not block — but a periodic heartbeat publish (or
re-register on publish) would harden routing correctness.

VERDICT: PASS
