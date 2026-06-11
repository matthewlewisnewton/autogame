# Server: index.js broadcast/lookup helpers scan every connected socket per lobby per event

## Difficulty: medium

## Goal

emitQuestPayloadToLobby and broadcastLobbyUpdate iterate io.sockets.sockets.values() (all sockets on the server) for each lobby broadcast, and findSocketByPlayerId is a full linear scan used on hot paths (trade notifications, simulation callbacks via setFindSocketCallback) — game/server/index.js:625-633,652-659,673-681,691-701. With many lobbies/sockets this is O(lobbies x sockets) per update wave. Fix: maintain a Map<playerId, socket> updated on connect/disconnect (playerId is already the stable accountId), and iterate io.sockets.adapter.rooms.get(lobby.id) for per-lobby emits. Related smaller wins: users.js findUserByAccountId/findUserByEmail are O(n) scans on hot socket paths (game/server/users.js:233-252). Found in code review 2026-06-09.

## Acceptance Criteria

- Per-lobby emits use socket.io rooms; player->socket lookup is O(1) via a maintained Map; behavior unchanged (existing tests pass)

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
