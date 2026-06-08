# Cleanup nits from 312-excalibur-photon-windup-balance

> **Staleness note.** This follow-up ticket was written against commit
> `7f84090a` (2026-06-07). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `312-excalibur-photon-windup-balance`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Clean Up Wind-Up Unit Test Disconnect Noise

`coverage.log` shows a caught `[socket:disconnect] handler error` during `server/test/card_windup_resolution.test.js` because the unit fixture installs a minimal `state.run` without the normal objective shape before disconnecting. The suite still passes and the captured game run is clean, but the fixture should use a normal run/objective or disconnect after clearing the lobby state so future coverage logs stay signal-rich.

### Acceptance Criteria
- The full Vitest suite still passes with no `[socket:disconnect] handler error` emitted by `server/test/card_windup_resolution.test.js`.
