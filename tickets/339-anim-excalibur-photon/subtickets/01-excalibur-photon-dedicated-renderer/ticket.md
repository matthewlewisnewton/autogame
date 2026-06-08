# Excalibur Photon dedicated renderer

Split `excalibur_photon` out of the shared `renderHeavyGreatsword` path used by
Alloy Greatblade and Corebreaker Greatsword. Register a card-specific
`renderExcaliburPhoton` renderer so later polish can target only this weapon
without touching the other heavy greatswords.

## Acceptance Criteria

- `excalibur_photon` is registered in `CARD_RENDERERS` and resolves to a
  dedicated renderer function — not `renderHeavyGreatsword` and not the
  `renderConeSwings` type default.
- `steel_claymore` and `magma_greatsword` still resolve to `renderHeavyGreatsword`;
  only `excalibur_photon` moves to the new renderer.
- `excalibur_photon` is removed from `HEAVY_GREATSWORD_STYLES`; its styling
  lives in a photon-specific style constant used only by `renderExcaliburPhoton`.
- The new renderer composes the 315 primitives for a magenta photon greatslash:
  `ctx.spawnAttackEffect` (wide cone) plus `ctx.spawnImpactDecal` and
  `ctx.spawnParticleBurst` at the strike point, guarded with `if (ctx.spawn…)`.
  Accent color comes from `getAccentHex('excalibur_photon')` (`#e879f9`) with a
  magenta fallback (`0xe879f9` / `0xc026d3`).
- Firing `renderCardUsed` for `excalibur_photon` through a recording ctx emits
  at least one `spawnAttackEffect` with the photon accent color and an impact
  primitive call (`spawnImpactDecal` and/or `spawnParticleBurst`).
- Existing client + server vitest suites still pass.

## Technical Specs

- `game/client/cardRenderers.js`:
  - Add `renderExcaliburPhoton(data, ctx)` and a `EXCALIBUR_PHOTON_STYLE` (or
    equivalent) constant holding cone/impact params migrated from the current
    `HEAVY_GREATSWORD_STYLES.excalibur_photon` entry.
  - Remove `excalibur_photon` from `HEAVY_GREATSWORD_STYLES`.
  - Change `CARD_RENDERERS.excalibur_photon` from `renderHeavyGreatsword` to
    `renderExcaliburPhoton`.
  - Reuse `originOf`, `directionOf`, `pointAlong`, and `getAccentHex`; do not
    alter `renderHeavyGreatsword`, `steel_claymore`, or `magma_greatsword`.
- `game/client/test/cardRenderers.test.js`:
  - Assert `resolveRenderers('excalibur_photon')[0]` is not
    `resolveRenderers('steel_claymore')[0]`.
  - Add/update a recording-ctx test that fires `excalibur_photon` and checks
    photon accent color on `spawnAttackEffect` plus at least one impact primitive.

## Verification: code
