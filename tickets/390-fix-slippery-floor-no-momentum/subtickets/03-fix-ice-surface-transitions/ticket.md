# Fix normal↔ice surface transitions

Crossing between normal stone and slippery ice must preserve momentum appropriately (`surfaceTransition` FAIL today). Entering ice with held input or existing slide speed must not hard-reset velocity to zero; leaving ice for stone must decelerate sharply compared with ice-only coasting.

## Acceptance Criteria

- **Normal → slippery** (`makeTransitionLayout()`): player accelerated south on the stone room with held input continues moving after `sampleFloorSurface` becomes `'slippery'`; on-ice speed samples include values > 0; first tick after crossing does not zero `hypot(vx, vz)`.
- **Slippery → normal**: player injected with southward coast speed on ice, after 10 ticks on stone, `hypot(vx, vz) < 1e-3`; total drift on the transition path is less than drift from the same initial speed coasting 10 ticks on ice-only layout.
- Z monotonicity holds while holding input across the normal→ice boundary (no backward snap).
- Sub-tickets 01–02 regression tests continue to pass.

## Technical Specs

- **Primary:** `game/server/simulation.js` — `applyPlayerMovement()`:
  - Sample `floorSurface` at the player’s current position each tick; branch per tick (slippery integration vs normal instant-stop) without clearing `vx`/`vz` solely because the surface label changed.
  - On transition from slippery → normal, apply `NORMAL_STOP_FRICTION` (instant zero) so stone stops quickly; do not carry ice slide speed indefinitely on normal tiles.
  - On transition from normal → slippery, do not require a stationary restart: existing `vx`/`vz` (if any) plus input acceleration on the slippery branch should produce forward motion immediately.
  - Passage/corridor tiles outside room AABBs resolve as `'normal'` per `sampleFloorSurface`; transitions through passages should not corrupt velocity state for the next room entry.
- **Sampling reference:** `game/shared/floorSampling.esm.js` — `sampleFloorSurface()` room containment (same rules as `sampleFloorY`).
- **Tests:** `game/server/test/slippery_floor.test.js` — `describe('slippery floor — normal → slippery transition')` and `describe('slippery floor — slippery → normal transition')`; fixtures `makeTransitionLayout()`.
- **Depends on:** sub-tickets 01–02.

## Verification: code
