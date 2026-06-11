# Cleanup nits from 348-anim-glacier-rupture

> **Staleness note.** This follow-up ticket was written against commit
> `fff26a06` (2026-06-10). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `348-anim-glacier-rupture`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Deduplicate the glacier palette constants
`renderer.js` defines `GLACIER_RUPTURE_COLOR`/`GLACIER_RUPTURE_EMISSIVE` (0x38bdf8 / 0x0ea5e9) as fallback
defaults, while `cardRenderers.js` separately defines `GLACIER_COLOR`/`GLACIER_EMISSIVE` with the same hex
values and always passes them in as the palette. The duplication risks the two drifting apart if one is
retuned. Consolidate to a single source of truth (export the renderer constants and import them in
cardRenderers, or vice versa).

### Acceptance Criteria
- The glacier cyan/emissive hex values are defined in exactly one module and imported where needed.
- `renderGlacierCollapse` and the renderer primitive resolve to the same palette source.
- Existing client tests still pass.
