# Cleanup nits from 226-data-objective-registry

> **Staleness note.** This follow-up ticket was written against commit
> `a9d6e85` (2026-06-04). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `226-data-objective-registry`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Rename Objective Spawn Dispatcher

`game/server/progression.js` now uses `updateSurviveSpawns()` as a generic dispatcher for any objective registry entry with a `tickSpawns` hook. The behavior is correct, but the survive-specific function name can mislead future objective authors.

### Acceptance Criteria
- Rename the dispatcher and exported/imported references to a generic name such as `updateObjectiveSpawns`.
- Keep the existing survive spawn tests passing after the rename.
