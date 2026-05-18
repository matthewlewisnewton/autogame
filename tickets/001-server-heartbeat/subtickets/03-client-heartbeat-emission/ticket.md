# Client Heartbeat Emission

The client sends a `heartbeat` event to the server every 2 seconds carrying the current client-side timestamp. This keeps the server's `lastActivity` fresh even when the player is idle.

## Acceptance Criteria
- After receiving `init` (i.e., once `myId` is set), the client begins emitting `heartbeat` events every 2000 ms
- Each emitted payload is `{ type: 'heartbeat', timestamp: Date.now() }`
- The heartbeat interval starts only once and does not restart on reconnect
- No visual or gameplay changes are introduced — this is purely a network-layer addition

## Technical Specs
- **File**: `game/client/main.js`
- Add `setInterval(() => { socket.emit('heartbeat', { type: 'heartbeat', timestamp: Date.now() }); }, 2000)` inside the `socket.on('init', ...)` handler, after `myId = data.id`
- Do NOT modify Socket.IO's built-in ping/pong configuration

## Verification: code
