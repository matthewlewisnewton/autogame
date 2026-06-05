## Stabilize user persistence temp-file writes under parallel tests

The full coverage run reported an unrelated `server/test/account.test.js` registration failure where `saveUsers()` could not rename `game/data/users.json.tmp` to `users.json`. This appears to be a shared temp-file race when user persistence writes overlap, and it makes the full suite noisy even when focused ticket tests pass.

### Acceptance Criteria
- Parallel account/user persistence tests no longer race on the same `.tmp` path.
- The full vitest coverage run completes without intermittent account registration 500s.
