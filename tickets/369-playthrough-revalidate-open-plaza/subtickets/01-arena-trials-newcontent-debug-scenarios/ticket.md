# Arena-Trials new-content debug scenarios (telepipe + encounter-trigger)

Add the server debug scenarios the open-plaza (arena_trials Tier II) re-validation needs to
exercise the NEW content the way the sunken-canyon playthrough already does: a level-specific
telepipe-ready setup and an encounter-trigger shortcut that activates the dormant Arena Champion
and spawns a nearby add (so `bossDistinctFromAdds` has a live add at active phase). The generic
card scenarios (`ice-ball-ready`, `fireball-hand-ready`, `purifying-pulse-ready`,
`magma-windup-ready`) already exist and are level-agnostic — do NOT recreate them.

## Acceptance Criteria

- `game/server/debugScenarios.js` defines a new scenario `arena-trials-telepipe-ready` that puts
  the player into a telepipe-ready vitals state on the arena_trials Tier II run, mirroring the
  existing `canyon-descent-telepipe-ready` handler (same vitals/charge setup, but anchored to the
  arena_trials quest / `arena-trials-tier-2` deploy).
- `game/server/debugScenarios.js` defines a new scenario `arena-trials-encounter-trigger` that
  activates the dormant Arena Champion encounter after `arena-trials-boss-approach` and ensures at
  least one live add (e.g. a grunt) near the boss, mirroring `canyon-descent-encounter-trigger`.
- Both new scenario ids are added to the `DEBUG_SCENARIOS` set (around line 502) AND the
  `DEBUG_SCENARIOS_WITHOUT_DEFAULT_SPAWN` set (around line 786) in `game/server/index.js`, placed
  next to the existing `arena-trials-*` / `canyon-descent-telepipe-ready` entries.
- Both scenarios are gated behind `ALLOW_DEBUG_SCENARIOS=1` exactly like the existing arena-trials
  and canyon-descent scenarios (no new always-on behavior).
- `cd game && pnpm test:quick` passes (no regression in debug-scenario / index wiring tests).

## Technical Specs

- `game/server/debugScenarios.js`:
  - Add an `arena-trials-telepipe-ready` branch modeled on the existing
    `canyon-descent-telepipe-ready` branch (see the `name === 'canyon-descent-tier-2' || name ===
    'canyon-descent-telepipe-ready'` block ~line 2127 and the `name ===
    'canyon-descent-telepipe-ready'` sub-block ~line 2179). Reuse the `arena-trials-tier-2` deploy
    setup (the `name === 'arena-trials-tier-2'` block ~line 1007) for level/quest context.
  - Add an `arena-trials-encounter-trigger` branch modeled on `canyon-descent-encounter-trigger`
    (activate the dormant boss + spawn a nearby add for `bossDistinctFromAdds`).
- `game/server/index.js`: add `'arena-trials-telepipe-ready'` and
  `'arena-trials-encounter-trigger'` to both the `DEBUG_SCENARIOS` set (~502) and the
  `DEBUG_SCENARIOS_WITHOUT_DEFAULT_SPAWN` set (~786), beside the existing arena-trials entries.
- SCOPE NOTE: the top-level ticket scope is "the validation driver + open-plaza outputs"; per the
  sunken-canyon precedent (documented harness-blocker exception), minimal arena_trials debug
  scenarios in `game/server/` are required to make a green full new-content playthrough reachable
  and are in-scope. Do not touch gameplay balance, card definitions, or any non-arena scenario.

## Verification: code
