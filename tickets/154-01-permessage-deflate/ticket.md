# Enable socket.io permessage-deflate

## Difficulty: easy
## Verification: code
## Depends on: none

## Goal
Turn on WebSocket per-message compression for the game socket — near-free
bandwidth win on the repetitive JSON state stream.

## Acceptance Criteria
- socket.io server is configured with `perMessageDeflate` enabled, context
  takeover on, and a small-message threshold (don't compress tiny frames).
- Window/memory settings are conservative (e.g. modest `windowBits`) to bound
  per-connection memory.
- No functional regression: clients connect, play, reconnect normally.

## Technical Specs
- `game/server/index.js`: the `new Server(...)` / socket.io options object only.
  Do not change message shapes or game logic.

## Verification: code
- Server starts; a connected client negotiates the deflate extension and a
  `stateUpdate` frame is materially smaller on the wire than uncompressed.
- `pnpm test:quick` (server + client) green.
