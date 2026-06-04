# Cleanup nits from 217-lobby-explicit-phase-state-machine

> **Staleness note.** This follow-up ticket was written against commit
> `22b7ab6` (2026-06-04). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `217-lobby-explicit-phase-state-machine`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Replace Last Server-Side Phase Literal In Debug Scenario
`game/server/debugScenarios.js` still has one direct `state.gamePhase === 'playing'` comparison after the phase helper refactor. It is not behavior-breaking, but replacing it with `isPlayingPhase(state)` would make the server-side phase model more consistently centralized.

### Acceptance Criteria
- `game/server/debugScenarios.js` uses the `lobbies.js` phase helper for the remaining playing-phase guard.
