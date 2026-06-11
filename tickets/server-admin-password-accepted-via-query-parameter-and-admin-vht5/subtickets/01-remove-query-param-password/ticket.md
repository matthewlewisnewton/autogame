# Remove query-param password from admin auth

The `readSuppliedPassword()` function in `game/server/admin.js` falls back to `req.query.password`, allowing the admin secret to land in browser history, proxy logs, and access logs. Strip the query-param fallback so the `x-admin-password` header is the only accepted channel.

## Acceptance Criteria

- `readSuppliedPassword(req)` returns `null` when only `req.query.password` is set (no header)
- `readSuppliedPassword(req)` still returns the password when `x-admin-password` header is present
- Existing test "accepts the admin password via ?password= query param" is updated to expect 403 rejection
- All other admin tests continue to pass (header auth, fail-closed, Bearer token ignored, POST rejected)

## Technical Specs

- **File:** `game/server/admin.js` — remove the `req.query.password` fallback from `readSuppliedPassword()` (lines ~184–196, ~205–218). The function should read only the `x-admin-password` header and return `null` otherwise.
- **File:** `game/server/test/admin_roster.test.js` — update test at line ~267 ("accepts the admin password via ?password= query param") to assert HTTP 403 when only query param is supplied. Add a new test asserting query param is rejected even when header is absent.

## Verification: code
