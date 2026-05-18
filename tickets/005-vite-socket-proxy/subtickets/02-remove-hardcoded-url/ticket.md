# Remove Hardcoded Socket.IO URL from Client

Change the Socket.IO client connection in `main.js` from `io('http://localhost:3000')` to `io()` so it connects to the Vite dev server on the same origin and relies on the proxy.

## Acceptance Criteria
- `game/client/main.js` uses `io()` with no URL argument
- The client successfully connects to the backend via the Vite proxy when both servers are running
- No CORS errors appear in the browser console

## Technical Specs
- **File to modify**: `game/client/main.js`
- Change line `const socket = io('http://localhost:3000');` to `const socket = io();`
- Depends on sub-ticket 01 (proxy must be configured first for this to work)

## Verification: visual
