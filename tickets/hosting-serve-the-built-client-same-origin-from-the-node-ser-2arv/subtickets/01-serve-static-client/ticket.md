# Add Express static middleware and SPA fallback for built client in production

## Description

In production mode (`NODE_ENV=production`), mount `express.static()` to serve the Vite build output (`game/client/dist`) from the same Node server that hosts `/api` and `/socket.io`. Add an SPA catch-all route to serve `index.html` for any non-API path so client-side routing works. Dev-mode (Vite dev server + proxy) must remain unchanged.

## Acceptance Criteria

- `startServer()` mounts `express.static(path.resolve(__dirname, '..', 'client', 'dist'))` when `NODE_ENV === 'production'`
- A catch-all `app.get('*', ...)` serves `client/dist/index.html` as fallback for SPA routing in production
- Static middleware and catch-all are placed **after** `/api` and `/admin` routes so they never shadow API or Socket.IO endpoints
- Static serving is **gated** — skipped when `NODE_ENV !== 'production'` (dev/test modes unaffected)
- Existing `/healthz`, `/api/*`, `/socket.io/*`, and `/admin` routes continue to work unchanged

## Technical Specs

- **File:** `game/server/index.js`
- Inside `startServer()`, after the `_routesMounted` block (which mounts `/api` and `/admin`), add a conditional block:
  ```js
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, '..', 'client', 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, '..', 'client', 'dist', 'index.html'));
    });
  }
  ```
- `path` and `express` are already imported at the top of the file — no new imports needed
- The `fs` module is also already imported, which can be used to guard against missing `dist/` (e.g., skip mounting if the directory doesn't exist, with a console warning)

## Verification: code
