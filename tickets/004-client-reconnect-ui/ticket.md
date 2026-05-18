# Client Reconnect UI

Show connection status and handle reconnection gracefully on the client.

## Acceptance Criteria
- Status element shows "Connected", "Disconnected", or "Reconnecting..."
- On disconnect, status turns red and shows "Disconnected"
- On reconnect attempt, status turns yellow and shows "Reconnecting..."
- On successful reconnect, status turns green and shows "Connected"

## Technical Specs
- **File to modify**: `game/client/main.js`, `game/client/style.css`
- Add handlers for `socket.on('disconnect')`, `socket.on('reconnect_attempt')`, `socket.on('reconnect')`
- Update `#status` element text and color accordingly
- CSS: Add `.connected { color: #4ade80; }`, `.disconnected { color: #f87171; }`, `.reconnecting { color: #facc15; }`
