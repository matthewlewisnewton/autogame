# Password-gated /admin roster view

Add a standalone, read-only `GET /admin` route that renders every
account/character record (from `buildAdminRoster()`) as an HTML page. It is
gated by its OWN `ADMIN_PASSWORD` environment variable — completely separate
from player JWT auth — and is never reachable by normal players.

## Acceptance Criteria

- `GET /admin` with the correct password (matching `process.env.ADMIN_PASSWORD`)
  returns HTTP 200 and an HTML body (`Content-Type: text/html`) listing every
  account, showing for each: username, currency, equipped hat, unlocked hats,
  cosmetic config, quest-tier / level-2 unlocks, and selected deck.
- The password is supplied via the `?password=` query parameter (e.g.
  `GET /admin?password=<ADMIN_PASSWORD>`); an `X-Admin-Password` request header
  is also accepted.
- Wrong password or no password supplied returns HTTP 401 and does NOT render
  any account data.
- When `ADMIN_PASSWORD` is unset/empty in the environment, every `/admin`
  request is denied (HTTP 403/401) — the view never opens up with no password
  configured.
- The route is read-only: it accepts only `GET` and performs no writes, no
  mutation of user/character state, and is not behind the player JWT
  middleware (a valid player token grants no access; only `ADMIN_PASSWORD`
  does).
- The rendered HTML escapes account-derived strings (e.g. usernames) so a
  username cannot inject markup.
- A vitest file `game/server/test/admin_view.test.js` covers: correct password
  → 200 + HTML containing a seeded account's username; wrong password → 401;
  missing password → 401; unset `ADMIN_PASSWORD` → denied; and that a normal
  player JWT in the `Authorization` header alone does NOT grant access.

## Technical Specs

- `game/server/adminView.js` (NEW): export an Express `Router` (mirror the
  structure of `account.js`). Implement a `requireAdminPassword` middleware
  reading `req.query.password` / `req.headers['x-admin-password']`, comparing
  against `process.env.ADMIN_PASSWORD`; deny when env is unset/empty or the
  value mismatches (return 401, or 403 for unconfigured). Add `GET /admin`
  calling `buildAdminRoster()` from `./adminRoster` and rendering an HTML
  string (build with a small `escapeHtml` helper for interpolated values).
- `game/server/index.js`: inside the `if (!_routesMounted)` block in
  `startServer`, mount the new router at the app root, e.g.
  `app.use(require('./adminView'))` (route path is `/admin`, NOT under `/api`).
  Keep it outside/independent of the JWT socket middleware and the `account`
  router's `requireAuth`.
- `game/server/test/admin_view.test.js` (NEW): follow `test/account.test.js`
  — `startServer(0)`, real `fetch`. Set `process.env.ADMIN_PASSWORD` in the
  test, seed an account via `createUser()` + `provider.savePlayer()`, and
  restore/delete the env var in `afterEach`.

## Verification: code
