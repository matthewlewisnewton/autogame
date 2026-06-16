# Hosting: serve the built client same-origin from the Node server in production

## Difficulty: medium

## Goal

In production the Vite client is a static build (vite build -> game/client/dist) that should be served by the same Node/express origin as /api and /socket.io (avoids CORS for WebSockets, no separate client host). When NODE_ENV=production (or a SERVE_CLIENT flag), have express serve game/client/dist as static assets with an SPA fallback to index.html, keeping /api and /socket.io routes intact. Dev (vite proxy) behavior unchanged.

## Acceptance Criteria

- In production mode the server serves the built client (index.html + hashed assets) same-origin with SPA fallback, and /api + /socket.io still work; dev unchanged; a test verifies the static route serves index.html and does not shadow /api.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
