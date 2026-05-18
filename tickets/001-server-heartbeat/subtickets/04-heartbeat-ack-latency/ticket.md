# Server Heartbeat Handler and Latency Response

The server listens for `heartbeat` events from clients, updates the player's `lastActivity`, and responds with `heartbeat_ack` containing the computed round-trip latency. The client stores and optionally displays the latency value.

## Acceptance Criteria
- Server handles `heartbeat` events: updates `lastActivity` and emits `heartbeat_ack` back to the sender
- `heartbeat_ack` payload contains `{ latency: <number> }` where latency = `Date.now() - data.timestamp`
- Client listens for `heartbeat_ack` and stores the latency value in a variable
- Client updates the `#status` DOM element to display the latest latency (e.g., `"Latency: 12ms"`)
- Server logs are NOT spammed — heartbeat handling is silent on the server side (no console.log per heartbeat)

## Technical Specs
- **Files**: `game/server/index.js`, `game/client/main.js`
- **Server** (`game/server/index.js`):
  - Add `socket.on('heartbeat', (data) => { ... })` inside the `connection` handler
  - Update `gameState.players[socket.id].lastActivity = Date.now()`
  - Emit `socket.emit('heartbeat_ack', { latency: Date.now() - data.timestamp })`
- **Client** (`game/client/main.js`):
  - Declare `let latency = null` near the top with other state variables
  - Add `socket.on('heartbeat_ack', (data) => { latency = data.latency; statusEl.innerText = `Latency: ${latency}ms`; })`

## Verification: visual
