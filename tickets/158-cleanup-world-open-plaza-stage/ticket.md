# Cleanup nits from 135-world-open-plaza-stage

> **Staleness note.** This follow-up ticket was written against commit
> `f47eb13` (2026-06-02). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `135-world-open-plaza-stage`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Add Open Plaza Capture Coverage

Round 2 used the fallback `sloped-dungeon` capture, so the automated screenshot set proves runtime health but does not directly exercise the new `open-plaza-arena` shortcut or `arena_trials` quest visually. A feature-specific capture would make future regressions easier to catch without reading the tests.

### Acceptance Criteria
- The capture plan includes an `open-plaza-arena` or normal `arena_trials` scenario screenshot showing the plaza, cover pieces, and sloped platforms.
