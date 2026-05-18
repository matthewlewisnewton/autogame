# Server Heartbeat System

Track player connection health on the server side. Detect stale/dead connections beyond what Socket.IO's built-in ping/pong provides, and clean up disconnected players from game state.

## Background
Socket.IO already sends automatic PING/PONG frames (default `pingInterval: 25000ms`, `pingTimeout: 20000ms`). This ticket adds an **application-level** heartbeat on top of that for game-specific needs: tracking per-player latency, detecting idle players, and ensuring clean state removal.

## Acceptance Criteria
- Server tracks `lastActivity` timestamp per player
- Server runs a periodic stale-player check (every 5s)
- Players with no activity for >10s are removed from `gameState.players` and disconnected
- Server logs when a player is removed due to inactivity
- Client sends a `heartbeat` event every 2s to keep alive
- Server responds with `heartbeat_ack` containing the player's round-trip latency

## Technical Specs
- **File to modify**: `game/server/index.js`, `game/client/main.js`
- **Server changes**:
  - Add `lastActivity: Date.now()` to each player entry in `gameState.players`
  - Update `lastActivity` on any `move` or `heartbeat` event from that socket
  - Add `setInterval` (5000ms) that iterates `gameState.players`, disconnects and deletes any with `Date.now() - lastActivity > 10000`
  - On `heartbeat` event, respond with `heartbeat_ack` containing `{ latency: Date.now() - data.timestamp }`
- **Client changes**:
  - Add `setInterval` (2000ms) that emits `{ type: 'heartbeat', timestamp: Date.now() }`
  - On `heartbeat_ack`, store `latency` and optionally display in the UI status element
- **Do NOT modify** Socket.IO's built-in `pingInterval`/`pingTimeout` defaults
