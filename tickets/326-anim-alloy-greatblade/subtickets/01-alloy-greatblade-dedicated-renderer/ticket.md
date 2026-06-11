# Alloy Greatblade dedicated renderer

Split `steel_claymore` out of the shared `renderHeavyGreatsword` path used by
Corebreaker Greatsword. Register a card-specific `renderAlloyGreatblade` renderer
so later polish can target only Alloy Greatblade without touching
`magma_greatsword`.

## Acceptance Criteria

- `steel_claymore` is registered in `CARD_RENDERERS` and resolves to a dedicated
  renderer function — not `renderHeavyGreatsword` and not the `renderConeSwings`
  type default.
- `magma_greatsword` still resolves to `renderHeavyGreatsword`; only
  `steel_claymore` moves to the new renderer.
- `steel_claymore` is removed from `HEAVY_GREATSWORD_STYLES`; its styling lives
  in an alloy-specific style constant used only by `renderAlloyGreatblade`.
- The new renderer composes the 315 primitives for a slate heavy cleave:
  `ctx.spawnAttackEffect` (wide cone) plus guarded `ctx.spawnImpactDecal` and
  `ctx.spawnParticleBurst` at the strike point. Accent color comes from
  `getAccentHex('steel_claymore')` (`#94a3b8`) with slate fallbacks
  (`0x94a3b8` / `0x64748b`).
- Firing `renderCardUsed` for `steel_claymore` through a recording ctx emits at
  least one `spawnAttackEffect` with the slate accent color and an impact
  primitive call (`spawnImpactDecal` and/or `spawnParticleBurst`).
- Existing client + server vitest suites still pass.

## Technical Specs

- `game/client/cardRenderers.js`:
  - Add `renderAlloyGreatblade(data, ctx)` and an `ALLOY_GREATBLADE_STYLE` (or
    equivalent) constant holding cone/impact params migrated from the current
    `HEAVY_GREATSWORD_STYLES.steel_claymore` entry (`coneAngle: Math.PI / 2.2`,
    `range: 7`, `decalRadius: 3.2`, `debrisCount: 18`, `debrisSpread: 2.4`).
  - Remove `steel_claymore` from `HEAVY_GREATSWORD_STYLES`.
  - Change `CARD_RENDERERS.steel_claymore` from `renderHeavyGreatsword` to
    `renderAlloyGreatblade`.
  - Reuse `originOf`, `directionOf`, `pointAlong`, and `getAccentHex`; do not
    alter `renderHeavyGreatsword` or `magma_greatsword`.
- `game/client/test/cardRenderers.test.js`:
  - Assert `resolveRenderers('steel_claymore')[0]` is not
    `resolveRenderers('magma_greatsword')[0]`.
  - Add/update a recording-ctx test that fires `steel_claymore` and checks slate
    accent color on `spawnAttackEffect` plus at least one impact primitive.

## Verification: code
