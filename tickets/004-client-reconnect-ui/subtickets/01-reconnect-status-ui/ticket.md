# Wire Reconnect Status to UI

Add CSS color classes and Socket.IO event handlers so the `#status` element reflects the current connection state (Connected / Disconnected / Reconnecting…). Also resolve the conflict with the existing `heartbeat_ack` handler that overwrites `#status` with latency — status text must take priority during disconnect/reconnect, and latency should resume only after a successful reconnect.

## Acceptance Criteria
- Three CSS classes exist on `#status`: `.connected` (green `#4ade80`), `.disconnected` (red `#f87171`), `.reconnecting` (yellow `#facc15`)
- On `socket.on('connect')`, `#status` text becomes "Connected" and class becomes `connected`
- On `socket.on('disconnect')`, `#status` text becomes "Disconnected" and class becomes `disconnected`
- On `socket.on('reconnect_attempt')`, `#status` text becomes "Reconnecting..." and class becomes `reconnecting`
- On `socket.on('reconnect')`, `#status` text becomes "Connected" and class becomes `connected`
- The `heartbeat_ack` handler no longer overwrites the status text while in a disconnect or reconnecting state; latency display resumes only after a successful reconnect
- The heartbeat interval is stopped on disconnect and restarted on reconnect (so heartbeats aren't sent to a dead socket)

## Technical Specs
- **Files to modify**: `game/client/style.css`, `game/client/main.js`

**CSS** (`game/client/style.css`) — append after the existing `#status` block:
```css
#status.connected { color: #4ade80; }
#status.disconnected { color: #f87171; }
#status.reconnecting { color: #facc15; }
```

**JS** (`game/client/main.js`) — key changes:
- Track connection state with a variable (e.g., `let connectionState = 'connecting';`)
- Wrap the heartbeat `setInterval` id in a variable so it can be cleared/restarted:
  ```js
  let heartbeatTimer = null;
  function startHeartbeat() {
    if (heartbeatTimer) return;
    heartbeatTimer = setInterval(() => {
      socket.emit('heartbeat', { type: 'heartbeat', timestamp: Date.now() });
    }, 2000);
  }
  function stopHeartbeat() {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  ```
- Update the `connect` handler to set `connectionState = 'connected'`, apply class/text, then call `startHeartbeat()`
- Add `disconnect` handler: set `connectionState = 'disconnected'`, stop heartbeat, update status
- Add `reconnect_attempt` handler: set `connectionState = 'reconnecting'`, update status
- Add `reconnect` handler: set `connectionState = 'connected'`, restart heartbeat, update status
- Modify `heartbeat_ack` to only update status text when `connectionState === 'connected'`

## Verification: code
