# Cleanup nits from client-extract-a-booth-module-factory-boothdeck-js-and-booth-idbm

> **Staleness note.** This follow-up ticket was written against commit
> `30a27d5c` (2026-06-11). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `client-extract-a-booth-module-factory-boothdeck-js-and-booth-idbm`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Deduplicate DEBUG_BOOTH_ALLOWED_HOSTS

`boothCommon.js` exports `DEBUG_BOOTH_ALLOWED_HOSTS`, but `main.js` still inlines the same `['localhost', '127.0.0.1', '::1']` array for `debugBoothAllowed`. Import the shared constant to avoid drift if loopback hosts change.

### Acceptance Criteria
- `main.js` imports `DEBUG_BOOTH_ALLOWED_HOSTS` from `boothCommon.js` instead of duplicating the array inline.
- No behavioral change to debug gating; existing booth debug tests still pass.

## Stale questBooth test describe label

`questBooth.test.js` still labels its `getBoothDebugHook` block as "re-exported from launchBooth", but the hook now comes from `boothCommon.js` via `questBooth.js`.

### Acceptance Criteria
- Update the `describe` string to reference `boothCommon.js` (or drop the parenthetical).
- Tests continue to pass unchanged.
