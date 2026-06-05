# Cleanup nits from 230-hub-client-render

> **Staleness note.** This follow-up ticket was written against commit
> `25974d4` (2026-06-05). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `230-hub-client-render`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Silence Hub Lobby Renderer Test Stderr

`client/test/hub-lobby-render.test.js` passes, but the coverage log includes renderer stderr because the test environment cannot parse the absolute model URL `/models/player.glb`. This does not affect gameplay or assertions, but it makes the test output noisier than necessary and can hide real warnings later.

### Acceptance Criteria
- The hub lobby renderer test still verifies local avatar creation in the hub.
- Running the coverage suite no longer prints the `/models/player.glb` URL parse warning from this test.
