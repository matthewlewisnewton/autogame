# Wyrmflare lingering breath-cone VFX primitive

Add a dedicated `spawnDragonsBreathEffect` primitive in `renderer.js` that reads unmistakably as a **forward dragon breath cone** — a directional fire sector that lingers for the server's DoT window — instead of relying on the generic short-lived `spawnAttackEffect` cone plus a misleading `spawnProjectileTrail`. This primitive is the visual foundation sub-ticket 02 composes via `renderDragonsBreath`.

## Acceptance Criteria

- A new exported primitive `spawnDragonsBreathEffect(origin, direction, style = {})` exists in `game/client/renderer.js`.
- The effect spawns **at least two** registered meshes: (1) a forward-oriented fire breath sector (reuse/extend `createConeHitboxGroup` or equivalent sector geometry) aligned to `direction` out to `style.range`, and (2) a ground scorch fan or ember ribbon along the cone footprint — both in the Wyrmflare fire palette (default accent `0xfb923c` / emissive `0xff3b00`).
- Both meshes are pushed to `activeEffects` with a finite `duration` derived from `style.duration ?? (dotTicks * dotIntervalMs + 250)` where `dotTicks` defaults to `4` and `dotIntervalMs` to `500` (matching server `expiresAt` buffer in `simulation.js` `spawnDragonsBreathEffect`).
- The breath sector entry uses a dedicated flag (e.g. `isDragonsBreathCone: true`); `updateAttackEffects()` animates it with a brief expand/fill phase then sustain/fade with emissive flicker — modeled on the `isThermalColumn` branch but oriented along `direction` rather than vertical.
- The ground scorch element rides an existing expand→fade lifecycle (`fx.radius` or equivalent) scaled to `style.range` and `style.coneAngle ?? Math.PI / 3`.
- The three-argument call with only `origin`, `direction`, and defaults remains backward-compatible.
- No per-frame geometry allocation; mesh count for one cast stays in the same order of magnitude as `spawnInfernoPillarEffect` (ring + column).
- The primitive is wired into the card-render ctx: import + `cardRenderCtx` entry in `game/client/main.js` and `game/client/socketHandlers/socketHandlerCtx.js` (mirroring `spawnInfernoPillarEffect`).
- `game/client/test/vfx-primitives.test.js` adds a smoke test: spawn pushes the expected `activeEffects` entries (breath cone flag + scorch element), asserts fire palette and finite duration `2250` with defaults, and cleans up after `updateAttackEffects()` when past duration.
- `pnpm test:quick` still passes.

## Technical Specs

- **`game/client/renderer.js`**:
  - Add palette constants (e.g. `WYRMFLARE_BREATH_COLOR`, `WYRMFLARE_BREATH_EMISSIVE`) near the thermal-column block (~L4806).
  - Implement `spawnDragonsBreathEffect(origin, direction, style)` near `spawnInfernoPillarEffect` (~L4851): build oriented cone sector + ground scorch fan; accept `style.color`, `style.emissive`, `style.range`, `style.coneAngle`, `style.duration`, `style.dotTicks`, `style.dotIntervalMs`.
  - Add `isDragonsBreathCone` branch in `updateAttackEffects()` (near `isThermalColumn` ~L5037): orient mesh to `direction`, sustain emissive flicker, fade opacity, dispose on expiry.
- **`game/client/main.js`**: import `spawnDragonsBreathEffect` from renderer and add to `cardRenderCtx`.
- **`game/client/socketHandlers/socketHandlerCtx.js`**: pass `spawnDragonsBreathEffect` through deps.
- **`game/client/test/vfx-primitives.test.js`**: import and assert primitive output.
- Do **not** modify `cardRenderers.js`, server code, or other card primitives in this sub-ticket.

## Verification: code
