# Server: comprehensive slippery-floor physics tests

Add the thorough server test coverage requested in ticket 292 for slippery movement: deceleration curve, direction changes while sliding, normal↔slippery transitions, wall collision while sliding, and standing still on ice. Builds on the physics from sub-ticket 01 and the ice-cavern layout from sub-ticket 02.

## Acceptance Criteria

- `game/server/test/slippery_floor.test.js` (extend if created in 01) includes dedicated `describe` blocks for:
  - **Deceleration curve**: velocity magnitude decreases monotonically over N coasting ticks on slippery; remains above zero for at least 3 ticks after release from max speed; reaches ~0 within a bounded tick budget.
  - **Direction change while sliding**: applying perpendicular input while coasting redirects velocity (dot product with old direction drops) without instant teleport.
  - **Normal → slippery transition**: player accelerated on normal, crosses into slippery room mid-tick series, and continues with momentum (does not hard-reset velocity to zero).
  - **Slippery → normal transition**: player sliding on ice crossing onto stone decelerates sharply and stops within fewer ticks than ice-only coast.
  - **Wall collision while sliding**: velocity into a wall is removed/projected; player does not tunnel; position stays inside walkable AABB.
  - **Standing still on ice**: no input + zero initial velocity ⇒ player does not drift; tiny residual velocity from a previous slide eventually reaches ~0.
- Tests use synthetic layouts (inline room fixtures and/or `generateLayout(seed, 'ice-cavern')` slices) — no live socket required.
- `pnpm test:quick` passes with zero failures in the slippery test file.

## Technical Specs

- `game/server/test/slippery_floor.test.js`: helpers `tickMovement(state, n)`, `makeSlipperyLabLayout()`, `makeTransitionLayout()` (normal room north, slippery room south, shared edge).
- Import `applyPlayerMovement`, `buildMovementContext`, `generateLayout` from existing modules; mirror patterns in `game/server/test/applyPlayerMovement.test.js`.
- Use fixed `vi.setSystemTime` / controlled `lastInputTime` where input freshness matters.
- Do **not** change gameplay constants unless a test exposes a clear bug; prefer testing against the tuned values from sub-ticket 01.

## Verification: code
