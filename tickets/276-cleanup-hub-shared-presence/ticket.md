# Cleanup nits from 232-hub-shared-presence

> **Staleness note.** This follow-up ticket was written against commit
> `9c9d6f3b` (2026-06-05). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `232-hub-shared-presence`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Quiet Hub Presence Render Test Model Loading

The new client hub presence render test passes, but the coverage log includes stderr from the renderer trying to load `/models/player.glb` under the test environment. Mocking or disabling registry model loading in this focused render test would keep future QA logs easier to scan.

### Acceptance Criteria
- `client/test/hub-presence-render.test.js` still verifies remote hub avatar render/removal without emitting model-loading errors to stderr.
