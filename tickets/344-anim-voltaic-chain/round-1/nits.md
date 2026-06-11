## Consolidate duplicate cyan lightning style constants
`game/client/cardRenderers.js` now carries both the legacy `CHAIN_LIGHTNING_ARC_STYLE`
(`{ color: 0x38bdf8, emissive: 0x0ea5e9 }`, still used by `spawnChainSegmentArcs`) and the new
`VOLTAIC_CHAIN_ARC_STYLE`/`THUNDERBIRD_ARC_STYLE`, which are near-identical cyan styles repeated
across several lightning renderers. Folding the shared cyan palette into one named constant would
reduce drift if the lightning color is ever retuned.

### Acceptance Criteria
- A single shared cyan-lightning style/color constant is referenced by the chain_lightning and
  thunderbird renderers instead of duplicated literals, with no behavior change.
- Existing cardRenderers tests still pass unchanged.
