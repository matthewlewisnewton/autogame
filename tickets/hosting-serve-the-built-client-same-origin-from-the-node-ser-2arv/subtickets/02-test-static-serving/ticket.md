# Test static client serving does not shadow API routes

## Description

Add a server test that verifies the production static-serving middleware correctly serves `index.html` for unknown paths and does **not** intercept `/api` or `/healthz` routes. The test starts the server with `NODE_ENV=production`, builds the client first (or uses a mock `dist/` directory), and issues HTTP requests to check responses.

## Acceptance Criteria

- Test starts the server with `NODE_ENV=production` (and a free port)
- Test verifies `GET /` (or an unknown path like `/foo`) returns HTTP 200 with HTML content containing `<title>` or `index.html` content
- Test verifies `GET /healthz` still returns JSON `{ ok: true }` (not HTML)
- Test verifies `GET /api/some-path` returns a non-HTML response (404 JSON or similar — not the SPA fallback)
- Test cleans up server and restores `NODE_ENV` after running

## Technical Specs

- **File:** `game/server/test/hosting-static-serve.test.js` (new file)
- Use the same test pattern as existing server tests: `startServer(port)`, `supertest` or direct `http.get()`, `clearAllTimers()` + `server.close()` in teardown
- Before the test, ensure `game/client/dist/` exists by either:
  - Running `vite build` in a setup step, OR
  - Creating a minimal mock `dist/` with an `index.html` file containing a known marker string (simpler, faster, avoids Vite devDependency in server tests)
- Use `afterEach` to remove the mock `dist/` directory and restore `NODE_ENV`
- Pattern for mock dist:
  ```js
  const mockDist = path.resolve(__dirname, '..', '..', 'client', 'dist');
  fs.mkdirSync(mockDist, { recursive: true });
  fs.writeFileSync(path.join(mockDist, 'index.html'), '<html><title>Void Grimoire</title></html>');
  ```

## Verification: code
