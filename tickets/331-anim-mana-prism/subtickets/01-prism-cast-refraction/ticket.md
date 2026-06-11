# Mana Prism — signature refracting-prism cast visual

Replace Mana Prism's generic summon/burst cast VFX with a bespoke crystalline
prism that unmistakably reads as its name: a violet→cyan refracting prism core
that rises and spins while throwing rainbow dispersion light shards outward.
This builds on the 315 shared VFX primitives and touches only this card's
renderer + its registration/wiring.

## Acceptance Criteria

- A new dedicated VFX function `spawnManaPrismEffect(origin, style?)` exists in
  `game/client/renderer.js` and is exported.
- `spawnManaPrismEffect` builds a recognizable prism shape (e.g. an octahedral /
  bipyramidal crystal core, NOT a plain summon ring) that rises and rotates, and
  emits multiple refracted light shards/beams radiating outward to read as
  light dispersion. It reuses existing primitives/geometry helpers where
  practical and disposes its meshes when the effect ends (no leaked geometry).
- The shards use a spread of prism-dispersion hues (violet through cyan, e.g.
  spanning `MANA_PRISM_COLOR` 0xa855f7 and `MANA_PRISM_EMISSIVE` 0x22d3ee) so
  the refraction reads as multi-colored, not a single flat tint.
- `renderManaPrism` in `game/client/cardRenderers.js` calls
  `spawnManaPrismEffect` on the real cast path (the `data.radius !== undefined`
  branch, which the server emits with `radius: 1`) in place of the generic
  telegraph-ring-only visual; the violet/cyan telegraph ring and particle burst
  may remain as accent but the prism is the primary read.
- `spawnManaPrismEffect` is wired through the ctx bundle end-to-end:
  exported from `renderer.js`, imported/added to deps in `client/main.js`,
  passed through `client/socketHandlers/socketHandlerCtx.js`, and forwarded in
  `client/socketHandlers/cardHandlers.js`.
- `renderManaPrism` still does not throw when `spawnManaPrismEffect` and the
  optional `ctx.spawnTelegraphRing`/`ctx.spawnParticleBurst` primitives are
  absent (graceful-degradation path used by the existing minimal-ctx test).
- Client unit tests in `game/client/test/cardRenderers.test.js` are updated to
  assert `renderManaPrism` invokes `spawnManaPrismEffect` with the cast origin
  and a violet/cyan style on the `radius` cast path.
- `pnpm test` (vitest server+client) passes; no perf regression (effect is a
  bounded one-shot that fully tears down its meshes).

## Technical Specs

- `game/client/renderer.js`: add and export `spawnManaPrismEffect(origin, style)`.
  Model on existing bespoke effects (e.g. `spawnInfernoPillarEffect` /
  `spawnGlacierRuptureEffect` / `spawnSummonEffect`) for mesh creation, the
  animated-update registration, and teardown/disposal. Build a rotating prism
  core mesh plus N radial shard meshes tinted across the violet→cyan dispersion
  range; animate rise + spin + fade over a short bounded lifetime (~0.8–1.2s).
- `game/client/cardRenderers.js`: in `renderManaPrism`, on the
  `data.radius !== undefined` branch call `ctx.spawnManaPrismEffect?.(origin,
  { color: MANA_PRISM_COLOR, emissive: MANA_PRISM_EMISSIVE })`; keep the
  telegraph ring + particle burst as accents (guarded with `?.`/existence
  checks so the minimal-ctx test still passes).
- `game/client/main.js`: import `spawnManaPrismEffect as
  rendererSpawnManaPrismEffect` and add it to the ctx deps object.
- `game/client/socketHandlers/socketHandlerCtx.js` and
  `client/socketHandlers/cardHandlers.js`: thread `spawnManaPrismEffect`
  through alongside the existing `spawnInfernoPillarEffect` entries.
- `game/client/test/cardRenderers.test.js`: extend the existing `mana_prism`
  describe/it blocks (add `spawnManaPrismEffect` to the mock ctx `makeCtx`) and
  assert it is called; keep the existing minimal-ctx no-throw case green.

## Verification: code
