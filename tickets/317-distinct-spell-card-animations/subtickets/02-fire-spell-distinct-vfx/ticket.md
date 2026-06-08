# Fire spell distinct cast / breath / pillar VFX

Give Wyrmflare and Thermal Column bespoke fire-themed renderers that compose 315 primitives for cast telegraph, directional breath, and radial eruption — removing reliance on the generic spell burst ring.

## Acceptance Criteria

- `dragons_breath` is registered in `CARD_RENDERERS` with a bespoke renderer (not `renderGenericSpellBurst`).
- `renderDragonsBreath` renders a forward cone/breath using `spawnAttackEffect` with fire palette (`getAccentHex` fallback `0xfb923c`) plus `spawnProjectileTrail` or `spawnParticleBurst` along `data.direction` out to `data.radius` (attack range); impact embers at the cone tip via `spawnParticleBurst` and/or `spawnImpactDecal`.
- `inferno_pillar` no longer composes `renderGenericSpellBurst` in `CARD_RENDERERS` (drop the duplicate accent summon ring); `renderInfernoPillar` alone must still call `spawnInfernoPillarEffect`, `spawnTelegraphRing`, and `spawnParticleBurst` as today.
- `dragons_breath` and `inferno_pillar` renderers guard optional ctx helpers and do not throw when primitives are absent.
- Vitest tests assert `dragons_breath` helper calls (cone attack + at least one new primitive) and confirm `resolveRenderers('inferno_pillar')` returns a single renderer (not length 2).
- `pnpm test:quick` passes.

## Technical Specs

- `game/client/cardRenderers.js`:
  - Add `renderDragonsBreath(data, ctx)` — payload includes `{ origin, direction, radius, dotTicks, specialEffect: 'fire_dot' }` from `cardEffects.js`.
  - Update `CARD_RENDERERS.inferno_pillar` from `[renderInfernoPillar, renderGenericSpellBurst]` to `renderInfernoPillar` only.
- `game/client/test/cardRenderers.test.js`:
  - Add `dragons_breath` render dispatch tests.
  - Update `inferno_pillar` tests: `resolveRenderers` length 1; still asserts pillar + telegraph + burst calls.

## Verification: code
