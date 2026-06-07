# Server: slippery floor surface model and momentum physics

Introduce a `floorSurface` tile type (`'normal' | 'slippery'`) and server-authoritative momentum movement for slippery floors. Normal floors keep today's instant-stop behavior; slippery floors accelerate from input, carry velocity after input release, and decelerate slowly. Include a `slippery-floor-lab` debug scenario with a tiny two-room layout so the physics can be exercised before the ice level lands.

## Acceptance Criteria

- Rooms may carry `floorSurface: 'slippery'` (default `'normal'` when omitted).
- `sampleFloorSurface(layout, x, z)` returns `'slippery'` or `'normal'` using the same room-containment rules as `sampleFloorY` (rooms take precedence; platforms inherit `'normal'` unless explicitly tagged).
- `applyPlayerMovement` in `game/server/simulation.js`:
  - On **normal** floors: behavior matches current HEAD (direct `tryPlayerMove` step while input is fresh; no drift when input stops).
  - On **slippery** floors: maintains `player.vx` / `player.vz`; input accelerates along the input vector (respecting analog magnitude and existing speed modifiers like `block`, `rally`, `anchor`); releasing input lets the player keep sliding with slow deceleration; speed is capped at `MOVE_SPEED`.
  - Floor height snapping (`player.y` via `sampleFloorY`) still runs every tick.
- Debug scenario `slippery-floor-lab` deploys a synthetic layout with a normal entry room adjacent to a slippery ice room, seats the player on the slippery side, and returns `ok: true`.
- Unit tests in `game/server/test/slippery_floor.test.js` (or extended `applyPlayerMovement.test.js`) cover: acceleration onto slippery while holding input, measurable displacement after input release (momentum carry), and faster stop on normal vs slippery when input ends.

## Technical Specs

- `game/shared/floorSampling.esm.js` (+ CJS bridge `game/shared/floorSampling.js`): export `sampleFloorSurface(layout, x, z)`; re-export from `game/server/dungeon.js` and client collision/dungeon imports.
- `game/server/config.js`: add tunables, e.g. `SLIPPERY_ACCEL`, `SLIPPERY_FRICTION` (per-tick velocity retention when coasting), `NORMAL_STOP_FRICTION` (aggressive decay on normal — can be instant zeroing).
- `game/server/simulation.js`:
  - Initialize / clear `player.vx`, `player.vz` when absent.
  - Branch movement inside the per-player loop: slippery path integrates velocity then calls `tryPlayerMove` with the displacement vector; normal path keeps the existing input-fresh direct-step branch.
  - On slippery + wall hit, zero or project velocity along the blocked axis (mirror `tryDisplacement` slide behavior).
- `game/server/debugScenarios.js`: add `slippery-floor-lab` handler building a minimal inline layout (two abutting rooms, south room `floorSurface: 'slippery'`), rebuild colliders, spawn player in the slippery room.
- `game/server/index.js`: register `slippery-floor-lab` in `DEBUG_SCENARIOS`.
- Tests: `game/server/test/slippery_floor.test.js` with helpers to tick movement N times on synthetic layouts.

## Verification: code
