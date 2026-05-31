# Cleanup nits from 138-fix-floor-sampling-esm-export

> **Staleness note.** This follow-up ticket was written against commit
> `40b1c7a` (2026-05-31). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `138-fix-floor-sampling-esm-export`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Deduplicate floorSampling CJS/ESM sources

Ticket 138 ships identical `sampleFloorY` / `DEFAULT_FLOOR_Y` implementations in `floorSampling.js` (CJS) and `floorSampling.esm.js` (ESM) because Vite cannot consume `module.exports` named exports. Any future slope or interpolation tweak must touch both files manually until unified.
### Acceptance Criteria
- Server CJS and client ESM read from one source of truth (shared ESM with async server import, codegen, or a test that asserts both modules return identical results for a fixed fixture set) with no duplicated function bodies.

## Align flat-room regression test with ticket spec coordinates

`game/client/test/shared-floor-sampling.test.js` samples `(5, 5)` inside a room centred at `(0, 0)`; the ticket text specifies `(0, 0)` at the centre. Behaviour under test is the same for a flat room.
### Acceptance Criteria
- Flat-room case uses `(0, 0)` (or a comment explains why an edge-inclusive point is preferred) and still expects `DEFAULT_FLOOR_Y`.
