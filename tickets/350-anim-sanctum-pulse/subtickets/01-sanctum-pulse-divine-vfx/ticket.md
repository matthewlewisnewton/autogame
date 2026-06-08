# Sanctum Pulse — divine "pulse" VFX primitive

Rework the `spawnDivineGraceEffect` VFX primitive so it reads unmistakably as
"Sanctum Pulse": a holy, radiant golden pulse of divine light rather than the
current single ring whose emissive is accidentally green. Build it from the 315
shared VFX primitives / patterns already in `renderer.js`.

## Acceptance Criteria

- `spawnDivineGraceEffect(origin, radius)` uses a coherent holy-gold palette: the
  ring's `emissive` is a gold/amber tone (NOT the current green `0x86efac`),
  matching the gold `color`.
- The effect reads as a divine "pulse": it includes an expanding ground pulse
  ring AND a vertical ascending holy light column/shaft rising from the origin
  (modeled after the existing `spawnInfernoPillarEffect` column pattern), so the
  silhouette is clearly a sacred upward burst, not a flat ring.
- Every mesh the primitive creates is registered in `activeEffects` with a
  finite `duration` (so it animates and is cleaned up) and is added to
  `window.___test_scene || scene` exactly like the existing primitives.
- The primitive remains a pure additive VFX call: no new network traffic, no
  change to server payloads, no global state beyond `activeEffects`.
- No perf regression: total mesh/particle count for one cast stays in the same
  order of magnitude as the other heal-card primitives (e.g.
  `spawnPurifyingPulseEffect`); reuse shared geometry/material patterns, no
  per-frame allocation.
- Existing client tests still pass; add/extend a primitive-level test (in
  `game/client/test/vfx-primitives.test.js` or a new colocated test) asserting
  the primitive pushes the expected number of `activeEffects` entries with the
  gold emissive and a finite duration.

## Technical Specs

- `game/client/renderer.js` — rewrite `spawnDivineGraceEffect` (currently around
  L4363). Replace the green emissive constant with a gold/amber emissive; add a
  vertical light column following the structure of `spawnInfernoPillarEffect`
  (L4490) but in the holy-gold palette; keep the expanding pulse ring. Define
  named palette constants (e.g. `DIVINE_GRACE_RING_COLOR`,
  `DIVINE_GRACE_EMISSIVE`, `DIVINE_GRACE_COLUMN_COLOR`) near the existing
  `PURIFYING_HEAL_COLOR` block. Use `SUMMON_EFFECT_DURATION` (or a comparable
  existing duration constant) for cleanup.
- `game/client/test/vfx-primitives.test.js` — extend (or add a colocated test)
  to cover the new primitive's `activeEffects` output and palette.
- Do NOT touch `renderDivineGrace`, the renderer registration, the server, or
  any other card's primitive — those are handled in sub-ticket 02 / out of scope.

## Verification: code
