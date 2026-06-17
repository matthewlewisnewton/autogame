# Migrate harness validate playthrough to session-cookie auth

The harness validation helper `harness/validate/lib/auth.mjs` still uses the removed JWT path (`body.token` + `localStorage('autogame_token')`), which breaks `npm run validate:playthrough`. Rewrite it to authenticate via in-page register/login with `credentials: 'include'` so the httpOnly `ag_session` cookie is set, mirroring `game/client/scripts/session-auth.mjs`.

## Acceptance Criteria

- `harness/validate/lib/auth.mjs` no longer reads `body.token`, returns JWT strings, or calls `localStorage.setItem('autogame_token', …)`. JWT-related comments are removed or updated to describe session-cookie auth.
- Browser auth is performed in-page (`fetch('/api/register'|'/api/login', { credentials: 'include' })` against the Vite client origin), followed by `page.reload()` and a wait until `#auth-overlay` is hidden and the socket is connected (reuse or mirror `loginInBrowser` / `waitForLobbyBrowser` from `game/client/scripts/session-auth.mjs`).
- `harness/validate/playthrough.mjs` call sites (`runAuthStep`, `runHubWalkStep`) use the new session helper instead of `registerUser` + `injectToken`; no callers pass or expect a token string.
- `harness/validate/lib/multiPlayer.mjs` re-exports the updated auth helpers (or drops JWT-era re-exports if unused).
- `rg -i 'autogame_token|body\.token|JWT' harness/validate --glob '*.{mjs,js}'` returns no matches.
- `cd harness && npm run validate:playthrough -- --preset rooms --steps auth` completes with `summary.ok === true` (auth step reaches lobby browser with `connected: true`).
- No `game/` runtime source changes are required; only harness validation files change.

## Technical Specs

- **`harness/validate/lib/auth.mjs`** — Replace `registerUser(serverUrl, …)` and `injectToken(page, token, …)` with a single `loginInBrowser(page, clientUrl, username, password)` (or equivalent names) that:
  1. `page.goto(clientUrl)`
  2. In `page.evaluate`, `fetch('/api/register', …)` then `fetch('/api/login', …)` both with `credentials: 'include'`
  3. `page.reload()` and wait for auth overlay hidden + socket ready (keep existing `isSocketConnected` logic or import `waitForLobbyBrowser` pattern from `game/client/scripts/session-auth.mjs`)
  - Remove all JWT/token-return paths. Keep `isSocketConnected(page)` unless inlined elsewhere.
- **`harness/validate/playthrough.mjs`** — Update imports and `runAuthStep` / `runHubWalkStep` to call the new helper directly per page (no intermediate token variable).
- **`harness/validate/lib/multiPlayer.mjs`** — Update re-exports to match renamed/merged auth exports from `auth.mjs`.
- **Reference (read-only pattern):** `game/client/scripts/session-auth.mjs` — `loginInBrowser`, `waitForLobbyBrowser`, `SESSION_COOKIE_NAME`.

## Verification: code
