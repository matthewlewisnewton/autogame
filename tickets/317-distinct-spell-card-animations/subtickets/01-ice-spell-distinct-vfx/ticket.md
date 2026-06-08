# Ice spell distinct cast / impact VFX

Replace the generic accent ring for Cryo Burst and Permafrost Lance, and enhance the existing ice projectile and glacier rupture renderers so every ice-themed spell composes distinct 315 VFX primitives (telegraph ring, particle burst, projectile trail, impact decal) with a shared cold palette.

## Acceptance Criteria

- `frost_nova` and `permafrost_lance` are registered in `CARD_RENDERERS` with bespoke renderers (not the `spell` type default `renderGenericSpellBurst`).
- `frost_nova` renderer calls `spawnTelegraphRing` and `spawnParticleBurst` at the cast origin with icy accent colors (`#67e8f9` family); `permafrost_lance` uses a visibly different primitive mix (e.g. narrower telegraph and/or directional frost shards via `spawnProjectileTrail` or a second burst) so the two cards are not identical call signatures.
- `renderIceBall` is upgraded to add `spawnProjectileTrail` along the cast direction plus `spawnImpactDecal` and `spawnParticleBurst` at the impact point (mirror the `renderFireball` pattern); guards optional ctx helpers with `if (ctx.spawnProjectileTrail)` etc.
- `renderGlacierCollapse` is enhanced beyond the single `spawnSummonEffect` ring: add at least one 315 primitive (`spawnTelegraphRing` and/or `spawnParticleBurst`) with the fixed glacier palette (`0x38bdf8` / `0x0ea5e9`).
- Vitest tests in `cardRenderers.test.js` assert the new/changed helper calls for all four card ids; existing tests for glacier collapse and ice ball continue to pass.
- `pnpm test:quick` (client vitest) passes with no regressions.

## Technical Specs

- `game/client/cardRenderers.js`:
  - Add `renderFrostNova` and `renderPermafrostLance` (or one shared base with per-card style overrides).
  - Upgrade `renderIceBall` (~lines 304–314) with trail + impact primitives using `pointAlong()` for impact position.
  - Upgrade `renderGlacierCollapse` (~lines 127–130).
  - Register `frost_nova`, `permafrost_lance` in `CARD_RENDERERS`.
- `game/client/test/cardRenderers.test.js`:
  - Add cases for `frost_nova`, `permafrost_lance`, upgraded `ice_ball`, and upgraded `glacier_collapse`.
  - Update `resolveRenderers` test: `frost_nova` and `permafrost_lance` must not resolve to the spell type default.

Payload reference (server `cardUsed`): frost spells emit `{ origin, radius, frozen?: true, hits }`; ice_ball emits `{ origin, direction, attackRange, projectileTravelMs }`.

## Verification: code
