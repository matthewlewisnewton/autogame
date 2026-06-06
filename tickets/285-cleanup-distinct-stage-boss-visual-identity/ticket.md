# Cleanup nits from 284-distinct-stage-boss-visual-identity

> **Staleness note.** This follow-up ticket was written against commit
> `e53cb192` (2026-06-06). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `284-distinct-stage-boss-visual-identity`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Lock All Boss Visual Identity Assertions

`game/client/test/renderer-registry-normalize.test.js` checks the boss footprint values and has a distinct-silhouette assertion for `arena_champion`, but it does not explicitly assert color/emissive requirements for every stage boss. Adding table-driven assertions would make future visual identity regressions easier to catch without relying on screenshot review.

### Acceptance Criteria

- Add a renderer test that verifies `annex_overseer`, `arena_champion`, `spire_warden`, and `canyon_warden` each have boss-scale dimensions, non-null `emissive`, `emissiveIntensity >= 0.4`, and colors distinct from trash enemies.
