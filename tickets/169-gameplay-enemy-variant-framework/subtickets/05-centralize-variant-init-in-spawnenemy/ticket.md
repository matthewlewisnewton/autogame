# Centralize variant initialization in the spawnEnemy path

Variant initialization currently happens only in `spawnCombatEnemies`, so direct
`spawnEnemy` callers and spawner-created adds bypass the framework and often lack a
`variant` field. Move the seam into `spawnEnemy` itself so every spawned enemy
consistently exposes `variant` (a tag or `null`), with combat spawns passing the
resolved `encounterTier`/seeded `rng` and unknown-tier spawns defaulting to tier 0.

## Acceptance Criteria

- Every enemy produced by `spawnEnemy` exposes a `variant` field that is either a
  registry variant id (a tag) or `null` — never `undefined`. This holds for direct
  callers and for spawner-created adds, not just combat spawns.
- `spawnCombatEnemies` continues to roll variants using the spawn room's resolved
  `encounterTier` and the run's seeded `rng` (behavior preserved — combat enemies
  in high-tier rooms can still be tagged with the same probability as before).
- Spawns with no known room/tier (e.g. spawner adds in `simulation.js`, ad-hoc
  spawns) default to `tier = 0`, so they get `variant: null` but the field is
  always present.
- The variant roll is applied exactly once per enemy (no double-rolling now that
  the call is centralized in `spawnEnemy`).
- A test proves spawned enemies consistently expose `variant` as a tag or `null`:
  cover both a combat spawn and a spawner-add / direct spawn (tier 0 → `null`).
- Existing server + client tests pass; the game starts and loads cleanly.

## Technical Specs

- `game/server/progression.js`:
  - Extend `spawnEnemy(x, z, type, spawnedBy, opts)` (or add `tier`/`rng`
    parameters) so it calls `applyVariant(enemy, tier, rng)` internally before
    pushing to `_gameState.enemies`. Default `tier` to `0` and `rng` to undefined
    (so `applyVariant` falls back to `Math.random`) when not supplied — this keeps
    `variant` present for every caller.
  - Update `spawnCombatEnemies` to pass the resolved tier
    (`roomTierAt(layout, pos.x, pos.z)`) and the seeded `rng` through `spawnEnemy`,
    and remove the now-redundant separate `applyVariant(...)` call so the roll
    happens once.
- `game/server/simulation.js` (~1742): the spawner-add `spawnEnemy(...)` call now
  gets `variant: null` automatically via the tier-0 default — confirm it does not
  need to pass a tier. No behavioral change beyond the field being present.
- `game/server/test/server.test.js`: add assertions that spawned enemies expose
  `variant` (tag or `null`) for both a combat spawn and a tier-0/direct spawn.

## Verification: code
