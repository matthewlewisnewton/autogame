# 01 — Spherical distance core + instant player-card AoE helpers

Add a shared 3D spherical-distance helper to `game/server/simulation.js` and convert the instant point-cast AoE helpers (`applyFreezeInRadius`, `healPlayersInRadius`, `pullEnemiesToward`, `applyEventHorizon`, `collectRadialHits`) from XZ-plane `Math.hypot(dx, dz)` checks to true 3D sphere checks that include the Y axis. Update every caller (including `game/server/cardEffects.js` and existing tests) to pass the cast origin's world Y.

## Acceptance Criteria

- [ ] A helper exists in `game/server/simulation.js` (e.g. `sphericalDistanceToEntity(originX, originY, originZ, entity)`) that returns the 3D distance from an origin point to an entity, resolving the entity's Y via the existing `getEntityWorldY(entity)`. It is exported from `simulation.js` (and re-exported wherever the other helpers are re-exported, e.g. `game/server/index.js`) so tests can import it.
- [ ] `applyFreezeInRadius`, `healPlayersInRadius`, `pullEnemiesToward`, `applyEventHorizon`, and `collectRadialHits` each accept an `originY` parameter and include targets only when the **3D** distance (dx, dy, dz) is ≤ radius. If `originY` is null/undefined they fall back to the floor Y at (originX, originZ) (via the existing `sampleFloorY`/`resolveFloorY` path used by `getEntityWorldY`), never to 2D behavior.
- [ ] `pullEnemiesToward` uses the 3D sphere for target *inclusion* but still displaces enemies horizontally only (XZ via `tryEntityDisplacement`) — no vertical movement is introduced.
- [ ] All call sites in `game/server/cardEffects.js` (frost_nova/glacier_collapse → `applyFreezeInRadius`, purifying_pulse → `healPlayersInRadius`, gravity_well → `pullEnemiesToward`, event_horizon → `applyEventHorizon`, inferno_pillar initial burst → `collectRadialHits`) pass the caster's world Y (`getEntityWorldY(player)`) as `originY`, plumbed alongside the existing `originX`/`originZ` (including through the wind-up resolution path that carries `options.originX`/`options.originZ`).
- [ ] No remaining caller of these five helpers anywhere under `game/server/` (grep) still uses the old signature; existing tests that call them (`game/server/test/purifying_pulse.test.js`, `game/server/test/new_card_pack.test.js`, `game/server/test/burn_slow_mutual_exclusion.test.js`) are updated and pass.
- [ ] New unit tests in `game/server/test/` cover, for EACH of the five helpers: (a) a target at a different height whose 3D distance is within the radius IS affected, and (b) a target whose XZ distance is within the radius but whose 3D distance exceeds it (e.g. directly above at dy > radius) is NOT affected.
- [ ] `pnpm test:quick` (from `game/`) passes.

## Technical Specs

- `game/server/simulation.js`:
  - `healPlayersInRadius` (~line 1298), `collectRadialHits` (~line 1416), `applyFreezeInRadius` (~line 1817), `pullEnemiesToward` (~line 1847), `applyEventHorizon` (~line 1896). Insert `originY` as the second positional parameter (`(originX, originY, originZ, radius, …)`) and update all internal callers — `applyEventHorizon` calls `pullEnemiesToward` and `collectRadialHits`; `updateAreaEffects` (~line 2005) calls `collectRadialHits` (pass `effect.originY ?? null` for now; full area-effect plumbing is sub-ticket 02).
  - Reuse `getEntityWorldY` (~line 1324) for target Y; players default to `y: 0.5`, enemies without finite `y` resolve to floor.
  - Export the new spherical-distance helper in `module.exports` (~line 3428).
- `game/server/cardEffects.js`: handlers at ~lines 732 (freeze), 805 (purifying_pulse), 830 (gravity_well), 850 (event_horizon), 920 (inferno_pillar burst). Compute `originY` next to where `originX`/`originZ` are resolved (~line 340, both the precomputed and `fromWindup` branches) and pass it through.
- Update the three existing test files listed above to the new signatures.
- New test file e.g. `game/server/test/spherical_radius_helpers.test.js` following the existing pattern (import from `../index.js`/`../simulation.js`, mutate `gameState` directly, set entity `y` values).
- Out of scope: area-effect spawners/ticks (sub-ticket 02), enemy attack resolution and medic heal (03), barrier dome/smoke zones (04), detection/chase AI radii, movement/collision radii, spawn-placement radii.

## Verification: code
