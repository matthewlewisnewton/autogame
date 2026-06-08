# Photon theme VFX composition

Extend `renderExcaliburPhoton` so the cast reads unmistakably as a photon/light
energy weapon — not a recolored heavy greatsword. Compose additional 315
primitives (projectile trail, telegraph ring, light-shard burst) into each swing
so the visual identity matches the card name and evolved Saber-of-Light lineage.

## Acceptance Criteria

- Each Excalibur Photon swing calls `ctx.spawnProjectileTrail` along the slash
  arc (from origin toward the strike point) with the photon magenta palette.
- Each swing spawns at least one `ctx.spawnTelegraphRing` at or near the strike
  point (`pointAlong(origin, direction, range)`) so the hit reads as a radiant
  photon pulse, not just a ground decal.
- Each swing includes an enhanced `ctx.spawnParticleBurst` configured as a
  light-shard shower (higher `count` / `spread` than a bare spark puff) at the
  impact point.
- The primitive mix differs from both `steel_claymore` and `magma_greatsword`
  heavy-greatsword renderers: Excalibur Photon must use `spawnProjectileTrail`
  and `spawnTelegraphRing` (the claymore/magma path does not).
- All new primitive calls are guarded (`if (ctx.spawn…)`) so the renderer
  degrades gracefully when a primitive is absent.
- `renderCardUsed` post-effects (hit flash, sound, shockwave) are unchanged;
  this renderer still only adds the card-unique visuals.
- New/updated tests in `game/client/test/cardRenderers.test.js` assert
  `excalibur_photon` emits `spawnProjectileTrail`, `spawnTelegraphRing`, and
  `spawnParticleBurst` with photon colors (`0xe879f9` accent / `0xc026d3`
  emissive or `getAccentHex` equivalent).
- Existing client + server vitest suites still pass; no per-frame allocation
  regressions.

## Technical Specs

- `game/client/cardRenderers.js`:
  - In `renderExcaliburPhoton`, after each `spawnAttackEffect`, compose:
    - `ctx.spawnProjectileTrail(origin, direction, { color, emissive, range })`
    - `ctx.spawnTelegraphRing(impactAt, radius, { color, emissive })` at the
      strike point
    - `ctx.spawnParticleBurst(impactAt, { color, emissive, count, spread })`
      tuned for light shards (suggested: `count` ≥ 16, `spread` ≥ 2.0)
    - Keep the existing `spawnImpactDecal` from sub-ticket 01 if present.
  - Suggested cone params (tune for photon greatslash readability):
    `coneAngle: Math.PI / 2.5`, `range: 6`, high `edgeOpacity` (~0.95).
  - Do not modify `renderHeavyGreatsword`, `HEAVY_GREATSWORD_STYLES`, or any
    other card's renderer registration.
- `game/client/test/cardRenderers.test.js`:
  - Extend the `excalibur_photon` recording-ctx test to assert trail, ring, and
    burst primitive calls and photon palette values.
  - Add a test that `steel_claymore` / `magma_greatsword` do **not** emit
    `spawnProjectileTrail` or `spawnTelegraphRing` (documents the visual
    distinction).

## Verification: code
