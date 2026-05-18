# Create Vite Config with Socket.IO Proxy

Create `game/client/vite.config.js` to proxy WebSocket (`/socket.io`) traffic from the Vite dev server to the Express backend on port 3000.

## Acceptance Criteria
- `game/client/vite.config.js` exists and exports a valid Vite config object
- The config sets `server.proxy` with key `/socket.io` pointing to `http://localhost:3000` with `ws: true`
- Running `npm run dev` in `game/client/` starts without config errors

## Technical Specs
- **File to create**: `game/client/vite.config.js`
- Content: `export default { server: { proxy: { '/socket.io': { target: 'http://localhost:3000', ws: true } } } }`
- No other files modified

## Verification: code
