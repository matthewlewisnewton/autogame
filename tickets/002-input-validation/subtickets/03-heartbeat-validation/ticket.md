# Validate `heartbeat` Payload and Log Rejected Inputs

Add input validation to the `heartbeat` handler and log all rejected inputs from both `move` and `heartbeat` to the server console.

## Acceptance Criteria
- The `heartbeat` handler returns early when `data` is missing or `data.timestamp` is not a finite number
- Every rejected `move` payload logs a console message including the socket ID and a brief reason (e.g., `Rejected move from <id>: invalid payload`)
- Every rejected `heartbeat` payload logs a console message including the socket ID and reason
- Server remains stable when receiving malformed heartbeats (e.g., `null`, `{}`, strings)

## Technical Specs
- **File to modify**: `game/server/index.js`
- **Key changes**:
  1. Add guard to `heartbeat` handler:

     ```js
     if (!data || !Number.isFinite(data.timestamp)) return;
     ```

  2. Replace the early `return` in both `move` and `heartbeat` guards with `console.warn` (or `console.log`) calls that include `socket.id` and a reason string, then `return`.
  3. Example log line:

     ```js
     console.warn(`Rejected move from ${socket.id}: invalid payload`);
     return;
     ```

- This sub-ticket depends on **01-move-payload-validation** and **02-position-clamping** (logging wraps the existing guards).

## Verification: code
