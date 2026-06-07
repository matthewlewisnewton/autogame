# Cleanup nits from 305-recapture-walkable-hub-after-overlay-fix

> **Staleness note.** This follow-up ticket was written against commit
> `63918f44` (2026-06-06). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `305-recapture-walkable-hub-after-overlay-fix`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Remove Stale Lobby-Visibility Warnings From Walkable Hub Capture

The ticket-305 screenshot fallback succeeds, but `screenshot.log` still records timeout warnings from generic `createLobby` and `joinLobby` actions waiting for `#lobby` to become visible. After the post-304 hub flow, the correct success state is the hidden lobby menu plus active hub canvas, so these warnings are noisy and can make future capture logs look suspicious even when the probe passes.

### Acceptance Criteria
- The walkable-hub fallback capture uses the post-304 hub-ready condition for lobby creation/join waits and no longer emits timeout warnings for the expected hidden `#lobby` state.
