# Fix Reconnection Event Source (Socket.IO v4 Manager vs Socket)

Change `socket.on('reconnect_attempt')` and `socket.on('reconnect')` to `socket.io.on(...)` so the handlers actually fire under Socket.IO v4. In v4, reconnection lifecycle events are emitted by the Manager (`socket.io`), not the Socket — the current handlers are dead code.

## Acceptance Criteria
- `reconnect_attempt` handler is registered on `socket.io` (Manager), not `socket`
- `reconnect` handler is registered on `socket.io` (Manager), not `socket`
- `connect` and `disconnect` handlers remain on `socket` (they are Socket events, correct as-is)
- The `heartbeat_ack` handler and `connectionState` gating are untouched

## Technical Specs
- **File to modify**: `game/client/main.js`

Replace lines 43–50:
```js
socket.on('reconnect_attempt', () => {
  updateStatus('Reconnecting...', 'reconnecting');
});

socket.on('reconnect', () => {
  updateStatus('Connected', 'connected');
  startHeartbeat();
});
```

With:
```js
socket.io.on('reconnect_attempt', () => {
  updateStatus('Reconnecting...', 'reconnecting');
});

socket.io.on('reconnect', () => {
  updateStatus('Connected', 'connected');
  startHeartbeat();
});
```

No other files need changes.

## Verification: code
