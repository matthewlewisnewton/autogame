# Vite Socket.IO Proxy

Configure Vite to proxy Socket.IO requests to the backend so the client doesn't hardcode localhost:3000.

## Acceptance Criteria
- Client connects with `io()` (no URL argument) instead of `io('http://localhost:3000')`
- Vite dev server proxies `/socket.io` to `http://localhost:3000`
- No CORS errors in the browser console

## Technical Specs
- **Files to modify**: `game/client/vite.config.js` (new), `game/client/main.js`
- Create `vite.config.js` with `server.proxy` config: `'/socket.io': { target: 'http://localhost:3000', ws: true }`
- In `main.js`, change `io('http://localhost:3000')` to `io()`
