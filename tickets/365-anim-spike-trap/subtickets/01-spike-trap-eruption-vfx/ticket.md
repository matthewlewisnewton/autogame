# Spike Trap — erupting-spikes VFX primitive

Add a dedicated `spawnSpikeTrapEffect(origin, radius)` VFX primitive in
`renderer.js` that reads unmistakably as a row of iron/steel spikes bursting up
out of the ground inside a hostile hazard ring — distinct from the fiery
`cinder_snare` look. Build it from the 315 shared VFX primitives / patterns
already in `renderer.js` (model the upward elements on `spawnInfernoPillarEffect`,
but with vertical spike geometry instead of a fire column).

## Acceptance Criteria

- A new exported primitive `spawnSpikeTrapEffect(origin, radius)` exists in
  `game/client/renderer.js`.
- The effect's silhouette clearly reads as erupting spikes, NOT a flat ring: it
  creates multiple upward-pointing spike meshes (e.g. `THREE.ConeGeometry`
  cones whose apex points up, `rotation.x` such that they stand vertically)
  arranged around the trap point within `radius`, PLUS a ground hazard ring at
  `radius`.
- The palette is a hostile steel-spike scheme — a metallic/steel `color`
  (grey, e.g. `~0x9ca3af`) for the spikes with a blood-red `emissive`
  (e.g. `0xef4444`/`0xdc2626`) — coherent with the card's red accent
  (`#f87171`) and visually distinct from `cinder_snare`'s orange fire
  (`spawnInfernoPillarEffect`, `0xef4444`/`0xdc2626` ring + ember palette).
- Every mesh the primitive creates is registered in `activeEffects` with a
  finite `duration` and added to `(window.___test_scene) || scene` exactly like
  the existing primitives, so it animates (spikes rise / ring expands) and is
  cleaned up.
- The primitive is a pure additive VFX call: no new network traffic, no change
  to server payloads, no global state beyond `activeEffects`.
- No perf regression: total mesh count for one cast stays in the same order of
  magnitude as comparable primitives (e.g. `spawnInfernoPillarEffect` /
  `spawnSummonEffect`); reuse shared geometry/material patterns and named
  palette constants, with no per-frame allocation.
- The primitive is wired into the card-render ctx so renderers can call it: a
  `spawnSpikeTrapEffect` import + `cardRenderCtx` entry is added in
  `game/client/main.js` (mirroring the existing `spawnInfernoPillarEffect`
  wiring at ~L149 / ~L1118).
- Existing client + server vitest suites still pass; add/extend a
  primitive-level test asserting the primitive pushes the expected
  `activeEffects` entries (multiple spike meshes + a ring) with the steel/red
  palette and a finite `duration`.

## Technical Specs

- `game/client/renderer.js` — add `spawnSpikeTrapEffect(origin, radius)` near the
  other ground/AoE primitives (e.g. just after `spawnInfernoPillarEffect`,
  ~L4577). Follow the `spawnInfernoPillarEffect` structure (L4551) for the ring
  mesh + `activeEffects.push({ ... duration: SUMMON_EFFECT_DURATION ... })`
  lifecycle, but add several vertical `ConeGeometry` spike meshes positioned in a
  small cluster/ring around `origin` (offsets within `radius`), starting scaled
  down so the existing `updateAttackEffects`/`activeEffects` animation lifts/scales
  them. Define named palette constants (e.g. `SPIKE_TRAP_SPIKE_COLOR`,
  `SPIKE_TRAP_EMISSIVE`, `SPIKE_TRAP_RING_COLOR`) near the existing inferno/volatile
  palette block. Add to `(window.___test_scene) || scene` and use
  `SUMMON_EFFECT_DURATION` (or a comparable existing duration constant).
- `game/client/main.js` — add `spawnSpikeTrapEffect as rendererSpawnSpikeTrapEffect`
  to the renderer import block (~L142–155) and a `spawnSpikeTrapEffect:
  rendererSpawnSpikeTrapEffect` entry to `cardRenderCtx` (~L1112–1128).
- `game/client/test/` — extend `vfx-primitives.test.js` (or a colocated test) to
  cover the new primitive's `activeEffects` output, spike-mesh count, and palette.
- Do NOT touch `renderGroundEnchantment`, the `spike_trap` renderer registration,
  the server, or any other card's primitive — those are handled in sub-ticket 02
  / out of scope.

## Verification: code
