# Gravity Well — inward pull VFX primitive

Add a dedicated `spawnGravityWellEffect` primitive in `renderer.js` that reads unmistakably as a **gravity well / singularity pull** — a contracting purple pull radius, a dark void core, and inward-flowing particle streams — instead of the generic outward-expanding `spawnTelegraphRing` plus outward `spawnParticleBurst` used today. This primitive is the visual foundation sub-ticket 02 composes via `renderGravityWell`.

## Acceptance Criteria

- A new exported primitive `spawnGravityWellEffect(origin, radius, style = {})` exists in `game/client/renderer.js`.
- The effect spawns **at least two** registered meshes: (1) a ground pull ring that **contracts inward** from `radius` toward the origin (opposite lifecycle from `spawnTelegraphRing`'s expand-out), and (2) a dark void singularity at the center (small emissive sphere or funnel silhouette) in the Gravity Well palette (default accent `0xc084fc` / emissive `0xa855f7`, with a darker void core `0x581c87` family).
- Optional inward-flow particle streaks (third element or child group) travel from the outer ring toward the core during the collapse — velocities point **toward** the origin, not outward.
- All meshes are pushed to `activeEffects` with a finite `duration` defaulting to `ATTACK_EFFECT_DURATION` (600 ms) unless overridden via `style.duration`; a dedicated flag (e.g. `isGravityWellPull: true`) drives cleanup in `updateAttackEffects()`.
- `updateAttackEffects()` animates the pull ring scale from `radius` down to a tight core, fades the void singularity with a brief emissive pulse at t ≈ 0, and disposes on expiry — no per-frame geometry allocation.
- Mesh count for one cast stays in the same order of magnitude as `spawnInfernoPillarEffect` (ring + column); no perf regression.
- The primitive is wired into the card-render ctx: import + entry in `game/client/main.js` and `game/client/socketHandlers/socketHandlerCtx.js` (mirroring `spawnDragonsBreathEffect`).
- `game/client/test/vfx-primitives.test.js` adds a smoke test: spawn pushes the expected `activeEffects` entry/entries with the gravity-well flag, asserts purple palette and finite duration, and cleans up after `updateAttackEffects()` when past duration.
- Do **not** modify `cardRenderers.js`, server code, or other card primitives in this sub-ticket.

## Technical Specs

- **`game/client/renderer.js`**:
  - Add palette constants near the other spell VFX blocks (e.g. `GRAVITY_WELL_VFX_COLOR`, `GRAVITY_WELL_VFX_EMISSIVE`, `GRAVITY_WELL_VOID_CORE`).
  - Implement `spawnGravityWellEffect(origin, radius, style = {})` near the shared-primitives section (~L5535). Build: (a) unit-radius ring mesh scaled from `radius` → `~0.3` over the first 40% of duration, (b) void core sphere at origin with dark purple emissive, (c) optional inward particle group with negative radial velocities. Accept `style.color`, `style.emissive`, `style.duration`.
  - Add `isGravityWellPull` branch in `updateAttackEffects()` (near `isTelegraphRing` ~L5777): contract ring scale, pulse void core emissive, fade opacity, dispose on expiry.
  - Export the function.
- **`game/client/main.js`**: import `spawnGravityWellEffect` from renderer and add to `cardRenderCtx`.
- **`game/client/socketHandlers/socketHandlerCtx.js`**: pass `spawnGravityWellEffect` through deps.
- **`game/client/test/vfx-primitives.test.js`**: import and assert primitive output.
- **Read-only reference**: `getCardDef('gravity_well')` has `pullRadius: 12`, no `windUpMs`, instant resolution in `cardEffects.js` — sub-ticket 02 wires timing; do not wire card logic here.

## Verification: code
