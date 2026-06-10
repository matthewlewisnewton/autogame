# Cleanup nits from 385-boss-level-framework

> **Staleness note.** This follow-up ticket was written against commit
> `0da7d7f6` (2026-06-10). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `385-boss-level-framework`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Add A Dedicated Boss-Arena Player Spawn

Dedicated boss arenas currently use the single room center as both the player run spawn and the `arena_dais` boss landmark. The encounter still works, but a small player-spawn landmark or offset would make boss-level starts feel cleaner and avoid spawning players directly on the boss.

### Acceptance Criteria
- Boss-arena layouts expose a deterministic player start position distinct from the `arena_dais`.
- Normal boss-level deploy places players at that start position while keeping the boss on the dais.
