# 168-bug-intermittent-stuck-lobby-socket

## Difficulty: hard

## Goal

During QA, three back-to-back automated sessions hung at either 'create lobby -> lobby room visible' or 'ready -> UI shown', with no new 'Player connected' line server-side -- the socket never connected and the vite ws-proxy logged ECONNRESET. The socket.io endpoint itself was healthy (curl to /socket.io/ returned a fresh sid) and a fresh full run succeeded again, so this looks like a connection/reconnect timing flake under rapid sequential sessions rather than a hard bug. Risk: a dropped socket leaves the player in a silently stuck lobby with no surfaced error. Investigate reconnect handling and surface an error/timeout to the user when the socket fails to connect.

## Acceptance Criteria

- Implements the Goal above; the change is scoped to it.
- Existing server + client tests pass; the game starts and loads cleanly.

## Verification

`Verification: code`
