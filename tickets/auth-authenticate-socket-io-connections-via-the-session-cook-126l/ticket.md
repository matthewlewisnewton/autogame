# Auth: authenticate socket.io connections via the session cookie (replace JWT handshake)

## Difficulty: medium

## Goal

The socket.io io.use() middleware in game/server/index.js (~1840-1870) currently verifies a JWT from the handshake. Switch it to read the session cookie from socket.handshake.headers.cookie (sent automatically on the same-origin WS upgrade), look the session up in the Redis session store from the [HTTP session] bead, and reject (connect_error) when the session is missing/expired/destroyed — setting the player accountId from the session. Multi-instance auth keeps working because sessions live in shared Redis (any instance validates). Keep the safe-accountId guard. Do not remove the JWT middleware path until the client is migrated.

## Acceptance Criteria

- socket.io connections authenticate via the session cookie validated against the Redis session store; destroyed/expired sessions are rejected with connect_error; accountId is set from the session; works cross-instance (shared Redis) and with the in-memory shim; covered by a socket-auth middleware test.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
