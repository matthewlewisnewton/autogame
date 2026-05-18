# Validate `move` Payload Structure and Types

Guard the `move` socket handler against malformed or missing payloads so the server never crashes when a client sends bad data.

## Acceptance Criteria
- The `move` handler returns early (without updating state) when `data` is `null`, `undefined`, or not a plain object
- The `move` handler returns early when any of `data.x`, `data.y`, `data.z`, or `data.rotation` is not a finite number (`Number.isFinite`)
- Missing fields (e.g., `{ x: 1 }`) cause the handler to return early
- Server remains stable (no uncaught exceptions) when receiving empty objects, `null`, strings, or arrays as `move` payloads

## Technical Specs
- **File to modify**: `game/server/index.js`
- **Key change**: Insert a guard at the top of the `socket.on('move', ...)` callback:

  ```js
  if (!data || typeof data !== 'object' ||
      ![data.x, data.y, data.z, data.rotation].every(Number.isFinite)) return;
  ```

- Place this guard **before** any state mutation inside the handler.

## Verification: code
