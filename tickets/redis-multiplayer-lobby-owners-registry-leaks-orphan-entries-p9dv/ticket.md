# redis/multiplayer: lobby:owners registry leaks orphan entries (no TTL; orphan-reaper + dead-instance paths never unregister)

## Difficulty: medium

## Goal

REPRO (real Redis, two instances machine-A/B):
Inspect the owner registry after some lobby churn / instance restarts:
  docker exec autogame-e2e-redis redis-cli hgetall lobby:owners
Observed it accumulating stale entries that map dead lobby ids to long-gone instance ids (random UUIDs from instances started without FLY_MACHINE_ID, plus reaped lobbies), e.g.:
  8ae146eb -> 74fbe1af-...   d5a76bdb -> e1fbec9a-...   6bb8f887 -> 6629afd8-...   e49a53b2 -> a0cb6ba9-...   db9064b9 -> 9f1a0ab5-...   7576cc61 -> 721cf7b8-...
These lobbies no longer exist on either instance's browser, and their corresponding lobbies:<instanceId> publish keys have already self-expired.

ROOT CAUSE: 'lobby:owners' (server/lobbyRegistry.js) is a single Redis hash written with hset and only removed by an explicit unregisterLobby(lobbyId) hdel. It has NO TTL. Two paths never call unregisterLobby:
  1. reapAbandonedLobbies() orphan branch (server/index.js ~line 1616): a lobby with zero player records is deleted via lobbies._lobbies.delete(lobbyId) directly, bypassing removePlayerFromLobby — so unregisterLobby is never called. Permanent lobby:owners leak.
  2. An instance that crashes/redeploys (the normal Fly lifecycle) never gets to run unregisterLobby for its lobbies, so every lobby it owned leaks an owner entry forever.

CONTRAST: the lobby-browser publish keys (lobbies:<instanceId>, server/lobbyBrowser.js) use SET ... EX 30 so they self-heal; the owners hash does not.

IMPACT: P2. (a) Unbounded growth of lobby:owners. (b) Fly-Replay routing correctness: resolveLobbyRouting(lobbyId) returns action:'replay', machineId:<dead-instance> for any NEW lobby id that happens to collide with a leaked 8-hex id (generateLobbyId is 8 hex chars => birthday-bounded collision space), replaying a client to a dead/wrong machine instead of serving it. Even absent collision, the registry no longer reflects reality.

EVIDENCE: hgetall lobby:owners above; the matching lobbies:* keys show ttl=6/24 (self-expiring) while owners entries persist with no TTL (redis-cli object/ttl on a hash field is N/A — confirms hash has no per-field expiry).

NOTE on disconnect timing (related, lower severity): on socket disconnect the handler calls softDisconnectPlayerFromLobby (keeps the player for reconnect), so the owner entry legitimately lingers until the 60s EMPTY_LOBBY_TTL reaper evicts it via removePlayerFromLobby -> unregisterLobby. That part works (verified the entry cleared ~60s after the last player left). The leak is specifically the orphan-reaper + dead-instance paths.

FIX DIRECTION (not applied): call unregisterLobby in the orphan-reaper branch; and/or give owner entries a TTL refreshed alongside the lobbies:* publish, with a sweep/reconcile that drops owners whose instance no longer publishes. READ-ONLY QA.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
