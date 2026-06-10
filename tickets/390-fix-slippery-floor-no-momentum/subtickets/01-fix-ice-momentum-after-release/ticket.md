# Fix ice momentum after input release

Slippery-floor physics are non-functional at runtime: releasing movement on ice produces zero coasting (`momentumAfterRelease` FAIL with `ice=0.000`). Repair `applyPlayerMovement` so a player on `floorSurface: 'slippery'` builds horizontal velocity while input is fresh, keeps sliding after input ends (stale or `inputActive: false`), and decelerates via `SLIPPERY_FRICTION` instead of stopping instantly. Normal floors must still zero velocity each tick (`NORMAL_STOP_FRICTION === 0`).

## Acceptance Criteria

- After holding movement input on a slippery room for ≥12 ticks, then releasing input (stale `lastInputTime`), the player’s `x`/`z` continues to change for at least 5 subsequent ticks (`xAfterCoast > xAfterInput` or equivalent on Z).
- Post-release coasting speed `hypot(vx, vz)` is strictly greater on slippery than on normal for the same input-buildup + release pattern (slippery drift > normal drift; normal drift ≈ 0).
- Standing still on ice with zero initial `vx`/`vz` and no input produces no drift (regression guard).
- `game/server/test/slippery_floor.test.js` includes (or retains) an explicit ice-vs-normal post-release drift comparison test matching the playthrough probe; all slippery momentum tests pass under `pnpm test:quick`.

## Technical Specs

- **Primary:** `game/server/simulation.js` — `applyPlayerMovement()` slippery branch (~lines 587–657):
  - Ensure `sampleFloorSurface(ctx.layout, player.x, player.z)` resolves `'slippery'` for ice rooms (use `ctx.layout` from `resolveMovementContext`, not a stripped snapshot).
  - Slippery path must integrate `player.vx`/`player.vz` on every tick, including when `inputFresh` is false; apply `SLIPPERY_FRICTION` and displace via `tryPlayerMove` while speed ≥ threshold.
  - Normal-floor branch must not run for players standing on slippery tiles (do not zero `vx`/`vz` via `NORMAL_STOP_FRICTION` when surface is slippery).
  - Preserve existing speed caps (`MOVE_SPEED`, `playerMoveSpeedScale`, slow factor).
- **Tests:** `game/server/test/slippery_floor.test.js` — `describe('applyPlayerMovement() — slippery floors')` cases `carries momentum after input release` and `stops faster on normal floors than on slippery floors after input ends`; extend if needed to reproduce the reported `ice=0.000 normal=0.000` failure mode.
- **Constants (read-only unless tests expose bad tuning):** `game/server/config.js` — `SLIPPERY_ACCEL`, `SLIPPERY_FRICTION`, `NORMAL_STOP_FRICTION`, `INPUT_STALE_MS`.
- Reconcile with ticket 372 in-bead work: if physics already pass unit tests but fail live, trace why runtime differs (e.g. velocity cleared outside movement, layout missing `floorSurface`, movement skipped while card-committed) and fix within `simulation.js`.

## Verification: code
