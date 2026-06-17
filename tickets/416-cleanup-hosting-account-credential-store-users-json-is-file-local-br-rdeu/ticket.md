# Cleanup nits from hosting-account-credential-store-users-json-is-file-local-br-rdeu

> **Staleness note.** This follow-up ticket was written against commit
> `dd685293` (2026-06-16). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `hosting-account-credential-store-users-json-is-file-local-br-rdeu`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Handle rejection on fire-and-forget terminal-state calls

After the async conversion, `cleanupAfterDamage()` and `checkRunTerminalState()` became async, but
several production call sites still call them as bare statements with no `await`, no `void`, and no
`.catch()` — e.g. `server/simulation.js` (lines ~1624, 2469, 2496, 2728, 2787, 4009),
`server/index.js:1523`, `server/keyItemEffects.js:361`, `server/escort.js`, and
`server/progression.js`. The synchronous terminal logic (status, emit, rewards) still runs inline
because the trailing provider writes are the only awaited work, so behavior is correct today. But the
floating quest-tier persistence promise has no rejection handler: a provider write failure would
surface as an unhandledRejection rather than a logged, contained error.

### Acceptance Criteria
- Unawaited calls to `checkRunTerminalState()`/`cleanupAfterDamage()` in production code either use
  `void fn()` with an attached `.catch(err => /* log */)` or are awaited where the caller is async.
- A simulated provider write failure during run completion logs an error and does not produce an
  unhandledRejection.
- Full server test suite still passes.
