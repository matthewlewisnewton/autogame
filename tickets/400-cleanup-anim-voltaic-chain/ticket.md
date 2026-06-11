# Cleanup nits from 344-anim-voltaic-chain

> **Staleness note.** This follow-up ticket was written against commit
> `8159bfb4` (2026-06-10). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `344-anim-voltaic-chain`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

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
