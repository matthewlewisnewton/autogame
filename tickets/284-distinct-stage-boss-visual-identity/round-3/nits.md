## Lock All Boss Visual Identity Assertions

`game/client/test/renderer-registry-normalize.test.js` checks the boss footprint values and has a distinct-silhouette assertion for `arena_champion`, but it does not explicitly assert color/emissive requirements for every stage boss. Adding table-driven assertions would make future visual identity regressions easier to catch without relying on screenshot review.

### Acceptance Criteria

- Add a renderer test that verifies `annex_overseer`, `arena_champion`, `spire_warden`, and `canyon_warden` each have boss-scale dimensions, non-null `emissive`, `emissiveIntensity >= 0.4`, and colors distinct from trash enemies.
