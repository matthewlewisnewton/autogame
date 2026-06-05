# 04 — Client main.js socket constants

Wire `game/client/main.js` to the shared event catalog for all custom Socket.IO listeners and outbound emits. Socket.IO transport built-ins stay as string literals.

## Acceptance Criteria

- `game/client/main.js` imports `SERVER_TO_CLIENT` and `CLIENT_TO_SERVER` from `game/shared/events.json` (or a thin client-side re-export).
- Every `s.on('…')` for custom game events uses `SERVER_TO_CLIENT.*` (including `runComplete` / `runFailed` at ~L1816–1817, `stateUpdate`, lobby events, deck/key-item/trade/run handlers).
- Every `socket.emit('…')` for custom game events uses `CLIENT_TO_SERVER.*` (movement, cards, lobby browser, ready, key items, etc.).
- Built-in Socket.IO events `connect`, `disconnect`, and `connect_error` remain literal strings (not in the game catalog).
- No custom event string literals remain in `s.on(` / `socket.emit(` first arguments in `main.js`.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **Edit:** `game/client/main.js` only — add import at top; replace ~50 `s.on` and ~25 `socket.emit` custom names.
- Match server catalog keys from sub-ticket 01; do not add new event names.
- Do not change handler logic, payloads, or UI side effects.

## Verification: code
