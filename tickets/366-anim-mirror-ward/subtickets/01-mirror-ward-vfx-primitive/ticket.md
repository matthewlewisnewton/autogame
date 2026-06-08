# Mirror Ward — reflective ward VFX primitives

Add dedicated Mirror Ward VFX primitives in `renderer.js` so the card can show a
mirror-themed protective shell and a distinct reflect-impact burst. These
primitives are the visual foundation for the polished cast and reflect animations
— a shimmering teal/silver ward silhouette with a ground ring sized to the card's
`reflectRange`, not the generic `spawnSummonEffect` teal ring used today.

## Acceptance Criteria

- `spawnMirrorWardShellEffect(origin, radius, style?)` creates a visible ward
  silhouette around the caster: at minimum a pulsing ground ring at `radius` plus
  a vertical mirror-like facet/panel (or equivalent geometry) using the Mirror
  Ward palette (`#5eead4` / `#2dd4bf` accent family with a silver highlight).
- The shell primitive honors `style.duration` (default suitable for short cast
  flourishes) and registers every mesh in `activeEffects` with a finite
  `duration` so `updateAttackEffects()` cleans it up — no leaked meshes.
- `spawnMirrorWardReflectBurst(origin, direction, style?)` creates a short-lived
  reflect impact: a projectile streak along `direction` plus an impact
  burst/decal at the tip, using the same mirror palette. Duration defaults to
  `ATTACK_EFFECT_DURATION` (600 ms) unless overridden.
- Both primitives follow existing 315 conventions: add meshes to
  `window.___test_scene || scene`, reuse `THREE` geometry/material/dispose
  patterns, and allocate nothing per frame in the update loop.
- `game/client/test/vfx-primitives.test.js` adds smoke tests that spawn each
  primitive, assert entries land in `getActiveEffects()`, and verify cleanup
  after `updateAttackEffects()` when past duration.
- No changes to `cardRenderers.js`, server code, or other cards' primitives.

## Technical Specs

- **`game/client/renderer.js`**:
  - Define palette constants near the other heal/VFX blocks (e.g.
    `MIRROR_WARD_COLOR`, `MIRROR_WARD_EMISSIVE`, `MIRROR_WARD_SILVER`).
  - Add `spawnMirrorWardShellEffect(origin, radius, style = {})` before the
    shared-primitives section footer (~L4790). Build a unit-radius ground ring
    scaled to `radius` (mirror `spawnTelegraphRing` lifecycle with a slower
    pulse suitable for a lingering ward) and add 1–2 thin vertical planes
    (semi-transparent, emissive) arranged as a mirror facet around the origin.
    Push a grouped or multi-mesh `activeEffects` entry flagged
    `isMirrorWardShell: true` with `duration: style.duration ?? SUMMON_EFFECT_DURATION`.
  - Add `spawnMirrorWardReflectBurst(origin, direction, style = {})` composing
    `spawnProjectileTrail` + `spawnImpactDecal` + `spawnParticleBurst` internally
    (or equivalent inline meshes) with `travelMs` / `duration` defaulting to
    `ATTACK_EFFECT_DURATION`. Flag `isMirrorWardReflect: true` on the effect
    record(s) for testability.
  - Export both functions.
- **`game/client/test/vfx-primitives.test.js`**: import and smoke-test both
  primitives; assert palette emissive values and finite durations.
- **Read-only reference**: `getCardDef('mirror_ward')` has `reflectRange: 11` and
  `ttlMs: 20000` in `game/shared/cardStats.json` — sub-ticket 02 will use those
  for cast/linger timing; do not wire them here.

## Verification: code
