# Wire Socket.IO Reconnect Lifecycle to Status UI

Add Socket.IO event handlers for `disconnect`, `reconnect_attempt`, and `reconnect` that update the `#status` element's text and CSS class to reflect the current connection state.

## Acceptance Criteria
- On `socket.on('disconnect')`, `#status` text becomes "Disconnected" and class becomes `disconnected`
- On `socket.on('reconnect_attempt')`, `#status` text becomes "Reconnecting..." and class becomes `reconnecting`
- On `socket.on('reconnect')`, `#status` text becomes "Connected" and class becomes `connected`
- On initial `socket.on('connect')`, `#status` text becomes "Connected" and class becomes `connected`
- The existing `heartbeat_ack` handler is preserved (latency display must still work)

## Technical Specs
- **File to modify**: `game/client/main.js`
- Replace the existing `socket.on('connect')` handler to also set `statusEl.className = 'connected'`
- Add three new handlers using `statusEl.innerText` and `statusEl.className`:

  ```js
  socket.on('disconnect', () => {
    statusEl.innerText = 'Disconnected';
    statusEl.className = 'disconnected';
  });

  socket.on('reconnect_attempt', () => {
    statusEl.innerText = 'Reconnecting...';
    statusEl.className = 'reconnecting';
  });

  socket.on('reconnect', () => {
    statusEl.innerText = 'Connected';
    statusEl.className = 'connected';
  });
  ```

- Socket.IO enables automatic reconnection by default, so no extra config is needed.

## Verification: code
