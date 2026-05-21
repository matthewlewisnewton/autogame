# WebSocket JWT Authentication

Require a JWT token in the Socket.IO connection handshake `auth` object. On valid token, use the `accountId` from the token as the player's identity. Fall back to anonymous (random UUID) when no token is provided so existing dev/test flows continue working.

## Acceptance Criteria
- Socket.IO `connection` handler in `game/server/index.js` reads `socket.handshake.auth.token`.
- When a token is present, the server verifies it with `jwt.verify()` using the same `JWT_SECRET`.
- On valid token: the server uses the decoded `accountId` as the persistent player identity (replaces the current `playerId` generation logic for authenticated connections).
- On invalid/expired token: the server disconnects the socket immediately (`socket.disconnect()`).
- When no token is provided: the server falls back to the existing anonymous flow (generate/reuse random UUID via `localStorage`-stored `playerId`).
- The `init` event emitted on connect includes `accountId` (the authenticated account ID, or `null` for anonymous).
- Unit tests cover: valid token path, invalid token disconnect, and anonymous fallback.

## Technical Specs
- **Modify**: `game/server/index.js` — in the `io.on('connection', ...)` callback, before the existing player-identity block:
  - Read `socket.handshake.auth.token`.
  - If present, `jwt.verify(token, secret)` → on success set `accountId = decoded.accountId`, on failure `socket.disconnect()`.
  - Use `accountId` as the stable player identity for the rest of the connection lifecycle (stored in `socket.playerId` and `gameState.players[playerId].accountId`).
  - When no token, fall through to the existing anonymous playerId logic.
- **New file**: `game/server/auth.js` (or add to existing if created by sub-ticket 02) — export `verifyToken(token)` helper that wraps `jwt.verify()` and returns the decoded payload or `null`.
- Add `const jwt = require('jsonwebtoken');` import at top of `index.js` (or re-export from `auth.js`).

## Verification: code
