## Remove dead auth-token plumbing

After migrating to cookie auth, `getAuthToken()` always returns `null` and
`setAuthToken()` is an empty no-op, yet `main.js` still imports `getAuthToken`
(unused) and calls `setAuthToken(...)` in several places. This is leftover
plumbing that adds noise and can mislead future readers into thinking a
client-side token still exists.

### Acceptance Criteria
- `getAuthToken` is no longer imported in `game/client/main.js` (or is removed
  from `settings.js` entirely if unused everywhere).
- `setAuthToken` is either removed along with its now-pointless call sites, or
  documented as intentionally retained; no dead no-op calls remain.
- Client tests still pass.

## Clean up dead page-load auth fallback

On page load `main.js` runs an IIFE whose `catch` calls
`showAuthOverlay()`/`showRegisterForm()`, but `restoreSession()` swallows the
`/api/me` failure internally and never throws, so that `catch` is dead code.
The login screen for an unauthenticated visitor is instead reached via the
socket `connect_error` path, which first flashes the lobby browser
(`hideAuthOverlay()`) before the socket rejection swaps in the login form.

### Acceptance Criteria
- The unauthenticated page-load path shows the login/register overlay directly
  from the `/api/me` result (e.g. `restoreSession()` distinguishes
  authenticated vs. 401 and only proceeds to `createSocket()`/`hideAuthOverlay()`
  when authenticated), without relying on the socket error to recover.
- No brief lobby-browser flash for a logged-out visitor on initial load.
- Client tests still pass.
