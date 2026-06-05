# GET /admin read-only roster page

Wire a standalone `GET /admin` HTTP route that uses the `requireAdminPassword`
gate and renders the full account/character roster from `buildAdminRoster()` as a
read-only HTML page. This is the user-facing deliverable of the top-level ticket.

## Acceptance Criteria

- `GET /admin` is mounted in `game/server/index.js` and protected by the
  `requireAdminPassword` middleware from `admin.js` (env `ADMIN_PASSWORD`,
  separate from player auth).
- With the correct password (via `x-admin-password` header or `?password=`
  query), the route responds `200` with an HTML page (`Content-Type: text/html`)
  that lists EVERY account/character record and, for each, displays all required
  data: username, accountId, cosmetic config (including equipped hat),
  unlocked hats, unlockedQuestTiers (progression / level-2 unlocks), currency,
  selected deck, and inventory/owned cards.
- With a wrong password, a missing password, or when `ADMIN_PASSWORD` is unset,
  the route responds `403` and does NOT render any account data.
- A valid player JWT (Bearer token) does NOT grant access to `/admin` — the
  route ignores it and still requires the admin password.
- The page is read-only: it contains no form/button/handler that mutates account
  or player state, and the route is `GET`-only (no POST/PATCH/DELETE on `/admin`).
- A password hash / `passwordHash` field is never included in the response.
- A test in `game/server/test/admin_roster.test.js` (extend the file from
  sub-ticket 01) covers: seeded accounts appear in the `200` HTML with their
  currency/hat/deck data; wrong/missing password → `403` with no account data;
  a Bearer-only request (no admin password) → `403`.

## Technical Specs

- `game/server/index.js`: in the `_routesMounted` block (near
  `app.use('/api', authRouter)`), add the admin route, e.g.
  `app.get('/admin', requireAdminPassword, adminHandler)` where `requireAdminPassword`
  and `buildAdminRoster` come from `require('./admin')`. The handler builds the
  roster via `buildAdminRoster()`, renders an HTML string (server-side template
  literal; escape interpolated values to avoid breaking markup), and sends it
  with `res.type('html').send(html)`.
- Render each account as a clearly labelled block/row (e.g. a `<table>` or
  per-account `<section>`) showing all fields listed in the acceptance criteria.
  No client JS framework — plain server-rendered HTML.
- Do not expose `passwordHash`; strip it in the handler if `buildAdminRoster`
  includes it.
- `game/server/test/admin_roster.test.js`: add HTTP-level tests using `fetch`
  against `startServer(0)` (same harness as `test/account.test.js`), asserting
  status codes and that the HTML body contains seeded usernames/currency and
  excludes account data on denial.

## Verification: code
