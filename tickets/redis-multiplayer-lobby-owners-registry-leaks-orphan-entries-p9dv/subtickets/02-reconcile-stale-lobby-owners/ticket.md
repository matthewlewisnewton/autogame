# Reconcile stale `lobby:owners` entries for dead instances and local ghosts

When a Fly machine crashes or redeploys, its lobbies never call `unregisterLobby`, so `lobby:owners` accumulates entries pointing at instance ids whose `lobbies:<instanceId>` publish keys have already expired. Add a periodic reconcile sweep (mirroring the self-healing TTL on `lobbies:*`) that removes owner hash fields whose owning instance is no longer publishing and local owner fields for lobbies that no longer exist in memory.

## Acceptance Criteria

- A new `reconcileStaleLobbyOwners()` function scans `lobby:owners` and `HDEL`s any field where:
  - the owner equals the local instance id but the lobby id is not present in the local in-memory lobby map, **or**
  - the owner is a remote instance id and Redis has no `lobbies:<ownerInstanceId>` key (publish key absent / expired).
- Living instances with an active publish key (`lobbies:<instanceId>` set with TTL) keep their owner entries; a lobby that still exists locally and is registered under the local instance id is **not** removed.
- The sweep is wired to run on the existing server cleanup cadence (`STALE_CLEANUP_INTERVAL_MS` in `startServer()`), alongside `reapAbandonedLobbies`, and is exported for direct unit-test invocation.
- With Redis enabled (ioredis-mock or memory shim): seed an owner entry for instance `dead-A` with no `lobbies:dead-A` key → after reconcile, the field is gone; seed a local owner for a lobby id not in `_lobbies` → after reconcile, the field is gone; seed a remote owner where `lobbies:remote-B` exists → field remains.
- Simulated dead-instance scenario: instance A registers two lobbies and publishes `lobbies:instance-A`; instance B registers one lobby; delete / expire `lobbies:instance-A` without unregistering A's owner fields → instance B's reconcile removes A's stale fields while keeping B's.
- Existing server vitest suites pass.

## Technical Specs

- `game/server/lobbyRegistry.js`:
  - Add `reconcileStaleLobbyOwners(getLocalLobbyIds)` where `getLocalLobbyIds` is a zero-arg function returning an iterable of lobby id strings (keeps the module free of a hard `lobbies` import cycle).
  - Implementation: `HGETALL lobby:owners`; for each `[lobbyId, instanceId]`, compare against local ids from the callback and `EXISTS lobbies:${instanceId}` (reuse `LOBBY_KEY_PREFIX` from `lobbyBrowser.js` or duplicate the `'lobbies:'` prefix constant locally to avoid circular deps — prefer importing the prefix constant from `lobbyBrowser.js` only if require graph stays acyclic).
  - Export the new function; no-op when Redis is disabled.
- `game/server/index.js`:
  - Add `reconcileStaleLobbyOwnersSweep()` wrapper that passes `() => [...lobbies._lobbies.keys()]` into the registry helper.
  - Register on `_intervals` with `safeIntervalTick('reconcileStaleLobbyOwners', …)` at `STALE_CLEANUP_INTERVAL_MS`.
  - Export `reconcileStaleLobbyOwnersSweep` (or the registry function) for tests alongside `reapAbandonedLobbies`.
- `game/server/test/lobby_registry.test.js` (and/or a new focused test file):
  - Cover local-ghost removal, remote dead-instance removal, and preservation of valid entries.
  - Use `lobbyBrowser.lobbyKeyForInstance` / `publishLocalLobbies` or direct `SET lobbies:<id> EX 30` to simulate live vs dead publishers.
- Optional hardening (include if straightforward): call `reconcileStaleLobbyOwners` at the end of `publishLocalLobbies()` in `game/server/lobbyBrowser.js` so local ghost entries are pruned promptly on the next lobby-list broadcast — only if it does not introduce a require cycle.

## Verification: code
