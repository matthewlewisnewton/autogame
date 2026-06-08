# Thermal Column pillar VFX primitive

Rework `spawnInfernoPillarEffect` in `renderer.js` so it reads unmistakably as a **Thermal Column** — a rising vertical fire shaft plus an expanding ground scorch ring — instead of the current flat red ring that shares the generic summon-burst silhouette. This primitive is the visual foundation sub-ticket 02 composes via `renderInfernoPillar`.

## Acceptance Criteria

- `spawnInfernoPillarEffect(origin, radius, style = {})` spawns **two** registered meshes: (1) a vertical thermal column (tapered `CylinderGeometry`, fire palette defaulting to accent `0xef4444` / emissive `0xdc2626`) that rises from the ground, and (2) an expanding ground scorch ring scaled to `radius` (attack range).
- Both meshes are pushed to `activeEffects` with a finite `duration` derived from `style.duration ?? (dotTicks * dotIntervalMs + 250)` where `dotTicks` defaults to `4` and `dotIntervalMs` to `500` (matching server `expiresAt` buffer in `simulation.js` `spawnInfernoPillarEffect`).
- The column entry uses a dedicated `isThermalColumn: true` flag; `updateAttackEffects()` animates it with a rise phase (~first 35% of duration) then sustain/fade with emissive flicker — modeled on the existing `isLightColumn` branch used by Sanctum Pulse, but in the fire palette.
- The scorch ring rides the existing radius-based expand→fade lifecycle (`fx.radius !== undefined` path) and expands to the full `radius` world units.
- The two-argument call `spawnInfernoPillarEffect(origin, radius)` remains backward-compatible (defaults apply).
- No per-frame geometry allocation; mesh count for one cast stays in the same order of magnitude as `spawnDivineGraceEffect` (ring + column).
- `game/client/test/vfx-primitives.test.js` adds a smoke test: spawn pushes two `activeEffects` entries (one `isThermalColumn`, one with `radius`), asserts fire palette on the column, and cleans up after `updateAttackEffects()` when past duration.
- `pnpm test:quick` still passes.

## Technical Specs

- **`game/client/renderer.js`**:
  - Replace the body of `spawnInfernoPillarEffect` (~L4612): split into `spawnThermalColumnShaft(origin, style)` and reuse/inline the ground ring (similar structure to `spawnDivineGracePulseRing` / `spawnDivineGraceColumn` ~L4436–4498, but fire palette constants e.g. `THERMAL_COLUMN_COLOR`, `THERMAL_COLUMN_EMISSIVE`, `THERMAL_COLUMN_HEIGHT`).
  - Add `isThermalColumn` branch in `updateAttackEffects()` before or after the `isLightColumn` block (~L5037): rise `scale.y`, pin base to ground, fade opacity, dispose on expiry.
  - Accept optional `style.color`, `style.emissive`, `style.duration`, `style.dotTicks`, `style.dotIntervalMs`.
- **`game/client/test/vfx-primitives.test.js`**: import `spawnInfernoPillarEffect`; assert two effects, column flag, finite duration `2250` with defaults, cleanup.
- Do **not** modify `cardRenderers.js`, server code, or other card primitives in this sub-ticket.

## Verification: code
