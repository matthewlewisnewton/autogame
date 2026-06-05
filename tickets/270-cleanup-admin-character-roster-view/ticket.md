# Cleanup nits from 264-admin-character-roster-view

> **Staleness note.** This follow-up ticket was written against commit
> `85db278` (2026-06-04). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `264-admin-character-roster-view`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Deep-Copy Admin User Snapshots
`getAllUsers()` strips `passwordHash` and shallow-copies account records, but nested fields like `cosmetic`, `unlockedHats`, and `unlockedQuestTiers` still share references with the in-memory store. The current admin route only renders them, so this is not blocking, but making the helper return deep copies would better match its read-only contract.

### Acceptance Criteria
- `getAllUsers()` returns detached copies for nested object and array fields.
- Tests prove mutating returned `cosmetic`, `unlockedHats`, or `unlockedQuestTiers` does not change stored user records.

## Prefer Header-Only Admin Passwords
The admin route accepts `?password=` as well as `x-admin-password`. Query-password support works, but URL credentials are easier to leak through browser history, screenshots, proxy logs, or copied links. Consider using only the header path for the admin secret in production-facing documentation and tests.

### Acceptance Criteria
- Admin access is documented and tested through `x-admin-password`.
- If query-password support remains, the security tradeoff is documented clearly; otherwise, requests using `?password=` are rejected.
