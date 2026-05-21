# Proxy API Requests from Vite to Express

Add a Vite dev-server proxy for `/api` so that browser registration and login requests reach the Express backend instead of failing on the Vite server.

## Acceptance Criteria
- `game/client/vite.config.js` includes a proxy entry for `/api` targeting `http://localhost:3000`.
- A `POST /api/register` request from the browser (originating at `http://localhost:5173`) is proxied to the Express server and returns a 201 response with `accountId`.
- A `POST /api/login` request from the browser is proxied to the Express server and returns a 200 response with `token`.
- The existing `/socket.io` proxy entry remains unchanged.
- `game/client/main.js` continues to POST to relative `/api/register` and `/api/login` paths (no client-side URL changes required).

## Technical Specs
- **Modify**: `game/client/vite.config.js` — add `/api` to the `server.proxy` object alongside the existing `/socket.io` entry, pointing to `http://localhost:3000` (no `ws: true` needed for HTTP-only routes).

## Verification: code
