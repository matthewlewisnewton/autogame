# Cleanup nits from hosting-lobby-affinity-websocket-routing-via-fly-replay-suh3

> **Staleness note.** This follow-up ticket was written against commit
> `966a2579` (2026-06-16). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `hosting-lobby-affinity-websocket-routing-via-fly-replay-suh3`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Verify Fly-Replay handshake response status line against Fly proxy semantics

`sendFlyReplayResponse` in `game/server/flyReplayHook.js` writes a raw
`HTTP/1.1 101 Switching Protocols` line carrying the `fly-replay` header before
ending the socket. The header presence is what tests assert and what Fly reads,
but `101 Switching Protocols` is an unusual status for a replay (no protocol is
actually switched — the request is re-routed). Confirm against current Fly.io
Fly-Replay docs that a non-101 status (e.g. `200`/`409`) isn't required for the
edge to honor the replay on a WebSocket upgrade, and adjust if so.

### Acceptance Criteria
- Document or correct the status line used in `sendFlyReplayResponse` so it
  matches Fly's documented Fly-Replay contract for WebSocket handshakes.
- If the status is changed, update the integration test assertions accordingly.

## Note that `fly-force-instance-id` extra header only covers the polling handshake

In `game/client/main.js#createSocket`, affinity sets
`extraHeaders['fly-force-instance-id']`, which the browser can only attach to the
HTTP long-polling handshake, not the WebSocket upgrade. Routing still works via
the `lobbyId` query param (which the server hook reads), so this is harmless, but
a brief code comment would prevent a future reader assuming the header pins the
WS upgrade.

### Acceptance Criteria
- Add a one-line comment in `createSocket` clarifying that `lobbyId` on the query
  is the authoritative routing signal and `fly-force-instance-id` is a
  polling-only optimization.
