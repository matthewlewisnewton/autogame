## Stale "JWT recovery" comment in client test

The `connect_error` handler no longer has anything to do with JWT — it recovers
session-auth errors (the regex was narrowed to `session|unauthorized|authentication`).
The describing comment still says "JWT recovery", which is misleading for future
readers.

### Acceptance Criteria
- `game/client/test/main.test.js:3468` comment `// ── connect_error handler (JWT
  recovery) ──` is updated to reflect session-auth recovery (no "JWT").
- No behavioural change to the test.
