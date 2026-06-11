# Alloy theme VFX composition

Extend `renderAlloyGreatblade` so the cast reads unmistakably as a heavy alloy
metal greatblade cleave — not a recolored magma swing or a generic cone flash.
Compose additional 315 primitives into each swing so the visual identity matches
the card name: slate alloy palette, metallic streak along the arc, and a ground-
shattering metal debris burst at impact.

## Acceptance Criteria

- Each Alloy Greatblade swing calls `ctx.spawnProjectileTrail` along the cleave
  arc (from origin toward the strike point) with the slate/metallic palette
  (`0x94a3b8` / `0x64748b`).
- Each swing includes an enhanced `ctx.spawnParticleBurst` configured as a metal
  shard shower (high `count` / `spread`, slate colors) at the impact point,
  clearly heavier than lighter blades but visually distinct from Corebreaker's
  molten debris (`0xf97316`).
- Each swing keeps a large-radius `ctx.spawnImpactDecal` at the strike point so
  the blow reads as ground-shattering alloy impact.
- The primitive mix differs from `magma_greatsword`'s `renderHeavyGreatsword`
  path: Alloy Greatblade must use `spawnProjectileTrail` (magma does not).
- All new primitive calls are guarded (`if (ctx.spawn…)`) so the renderer
  degrades gracefully when a primitive is absent.
- `renderCardUsed` post-effects (hit flash, sound, shockwave) are unchanged;
  this renderer still only adds the card-unique visuals.
- New/updated tests in `game/client/test/cardRenderers.test.js` assert
  `steel_claymore` emits `spawnProjectileTrail` and `spawnParticleBurst` with
  slate alloy colors, and that `magma_greatsword` does **not** emit
  `spawnProjectileTrail`.
- Existing client + server vitest suites still pass; no per-frame allocation
  regressions.

## Technical Specs

- `game/client/cardRenderers.js`:
  - In `renderAlloyGreatblade`, after each `spawnAttackEffect`, compose:
    - `ctx.spawnProjectileTrail(origin, direction, { color, emissive, range })`
    - `ctx.spawnImpactDecal(impactAt, { color, emissive, radius })` (keep from
      sub-ticket 01)
    - `ctx.spawnParticleBurst(impactAt, { color, emissive, count, spread })`
      tuned for metal shards (suggested: `count` ≥ 18, `spread` ≥ 2.4)
  - Suggested cone params (keep migrated from sub-ticket 01):
    `coneAngle: Math.PI / 2.2`, `range: 7`, slate `fillOpacity`/`edgeOpacity`.
  - Do not modify `renderHeavyGreatsword`, `HEAVY_GREATSWORD_STYLES`, or any
    other card's renderer registration.
- `game/client/test/cardRenderers.test.js`:
  - Extend the `steel_claymore` recording-ctx test to assert trail + burst
    primitive calls and slate palette values.
  - Update the existing test that asserts both heavy greatswords omit
    `spawnProjectileTrail` so it applies only to `magma_greatsword` (alloy now
    uses a metallic trail by design).

## Verification: code
