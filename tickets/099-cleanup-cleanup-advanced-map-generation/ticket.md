# Cleanup nits from 098-cleanup-advanced-map-generation

> **Staleness note.** This follow-up ticket was written against commit
> `cc23c5c` (2026-05-22). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `098-cleanup-advanced-map-generation`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Stale “first room” comments in main.js

`buildDungeon()` now documents and computes spawn from the `start` role, but `game/client/main.js` still describes spawn as the “first room” in two places that sit next to the spawn flow.
### Acceptance Criteria
- Line ~574 (`spawnPosition` declaration) and line ~2020 (post-`buildDungeon()` placement) refer to the start room role (or “spawn from layout”) instead of “first room”.

## Unit test for client spawn role lookup

There is no `game/client/test/dungeon.test.js` (or equivalent) asserting that `buildDungeon()` picks `role === 'start'` and falls back when the role is missing. Server-side role/spawn tests exist; a small client test would lock the contract if start-room index selection changes in 023 follow-ups.
### Acceptance Criteria
- A vitest case builds a minimal layout with `start` on a non-zero room index and asserts `spawnPosition` matches that room’s center.
- A second case with no `start` role asserts fallback to `rooms[0]`.
