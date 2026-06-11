# Cleanup nits from 387-boss-level-citadel-sovereign-capstone-gated

> **Staleness note.** This follow-up ticket was written against commit
> `2dddce72` (2026-06-10). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `387-boss-level-citadel-sovereign-capstone-gated`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Redundant spawn positioning in setupCitadelBossDebug
`setupCitadelBossDebug` (game/server/debugScenarios.js) sets the player to
`firstRoomPosition()` and resolves its floor Y, but the `citadel-boss` handler
immediately overrides `player.x/z/y` with the `arena_dais` anchor right after
calling it. The first placement is dead work. Minor — follows the existing
boss-debug pattern, so it is consistent but could be tidied.

### Acceptance Criteria
- `setupCitadelBossDebug` no longer computes a player spawn that is
  unconditionally overwritten by its sole caller, OR the override is moved into
  the helper so there is a single source of truth for the citadel-boss spawn.
- `citadel_capstone_e2e.test.js` still passes unchanged.
