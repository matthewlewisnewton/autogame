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
