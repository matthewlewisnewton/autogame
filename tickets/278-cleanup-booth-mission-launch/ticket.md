# Cleanup nits from 237-booth-mission-launch

> **Staleness note.** This follow-up ticket was written against commit
> `a86154fe` (2026-06-05). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `237-booth-mission-launch`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Add End-To-End Coverage For Launch Booth Flow
The current ticket has good helper-level tests and the live code path is straightforward, but the main `boothAction` listener wiring is not directly exercised in an end-to-end client/server test. A focused smoke or integration test would make future booth refactors safer by proving a real Launch Bay interaction emits `playerReady` and reaches `startGame`.

### Acceptance Criteria
- Add a test that exercises the Launch Bay booth interaction path from an in-range hub player through server `boothAction` and client ready-up behavior.
- Verify the test still uses the normal `playerReady`/`checkAllReady` route rather than introducing a separate launch-only socket path.
