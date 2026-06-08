# Shared VFX primitives in the renderer + ctx wiring

Add a family of reusable, accent-themeable VFX primitives to the renderer
(particle burst, projectile trail, lingering impact flash/decal, telegraph
ring), give each a lifecycle in the `updateAttackEffects` loop, export them,
and expose them on the `cardRenderCtx` bundle so per-card renderers can call
them. Document the new ctx helpers in the `cardRenderers.js` header comment.
No exemplar card changes here (that is sub-ticket 03) — this lays the
foundation only.

## Acceptance Criteria
- `game/client/renderer.js` exports the following new VFX helper functions,
  each accepting an `(…, style = {})` style bundle that honors a `color`
  and `emissive` override (used for accent theming):
  - `spawnParticleBurst(position, style)` — a multi-particle spark/ember burst
    (a richer sibling of the existing single `spawnHitSpark`); honors
    `count`, `spread`, `color`, `emissive`.
  - `spawnProjectileTrail(origin, direction, style)` — a fading streak that
    follows a projectile path along `direction` over `range`/`travelMs`.
  - `spawnImpactDecal(origin, style)` — a short-lived lingering ground
    flash/decal ring at an impact point that fades out.
  - `spawnTelegraphRing(origin, radius, style)` — an expanding/pulsing ground
    ring used to telegraph an incoming AoE.
- Each new primitive pushes onto the existing `activeEffects` array and is
  advanced + disposed by `updateAttackEffects()` (its own `fx.<flag>` branch),
  so it leaves no leaked meshes after its `duration` elapses.
- The primitives reuse the existing geometry/material/`disposeEffectObject`
  patterns already in renderer.js and allocate nothing per animation frame in
  `updateAttackEffects` (no `new` inside the per-frame update branches).
- All four new helpers are imported into `game/client/main.js` and added to
  the `cardRenderCtx` object (alongside `spawnHitSpark`, `spawnLightningArc`,
  etc.) under the names `spawnParticleBurst`, `spawnProjectileTrail`,
  `spawnImpactDecal`, `spawnTelegraphRing`.
- The `ctx interface` doc comment block at the top of
  `game/client/cardRenderers.js` lists the four new helpers with one-line
  descriptions.
- New primitives respect the existing particle/effect toggle the same way
  `spawnHitSpark` does (early-return via `areParticlesEnabled()` for the
  particle-style burst).
- Vitest unit tests cover the new primitives: spawning each adds to
  `getActiveEffects()`, and running `updateAttackEffects()` past `duration`
  removes/disposes them. Tests use the existing `window.___test_scene`
  override pattern already used by renderer tests.

## Technical Specs
- `game/client/renderer.js`: add the four exported helpers near the existing
  `spawnHitSpark` / `spawnLightningArc` / `spawnFireTrailEffect` (~lines
  4321–4556); add a matching `fx.<flag>` branch in `updateAttackEffects()`
  (~line 4558) for each new effect's expand/fade/dispose lifecycle. Reuse
  `disposeEffectObject`, `SUMMON_EFFECT_DURATION`, `HIT_SPARK_DURATION`, and
  the `targetScene = window.___test_scene || scene` pattern.
- `game/client/main.js`: add the four `… as renderer…` imports to the
  `renderer.js` import block (~lines 131–155) and four entries to the
  `cardRenderCtx` object (~lines 1106–1121).
- `game/client/cardRenderers.js`: extend the `ctx interface` comment block
  (lines 13–27) with the four new helper signatures. No registry/renderer
  logic changes in this sub-ticket.
- `game/client/test/`: add a `vfx-primitives.test.js` (or extend an existing
  renderer test) exercising spawn + `updateAttackEffects` cleanup for each
  primitive.

## Verification: code
