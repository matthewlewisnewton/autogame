# Cleanup nits from 136-world-spire-ascent-stage

> **Staleness note.** This follow-up ticket was written against commit
> `8264d2e` (2026-06-02). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `136-world-spire-ascent-stage`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Capture plan should drive the spire-ascent scenario

This round's capture fell back to the generic `sloped-dungeon` scenario, so no
screenshot actually shows the new tower. The `spire-ascent` debug scenario
exists and works; pointing the capture plan at `?debugScenario=spire-ascent`
(or `spire-ascent-stage`) would give direct visual proof of multi-tier ascent
for future regressions.

### Acceptance Criteria
- The capture for this stage drives `?debugScenario=spire-ascent` (or the
  quest's normal deploy) and saves at least one screenshot taken partway up the
  tower, showing tier elevation/ramp geometry.

## Unused `LAYOUT_PROFILES['spire-ascent']` entry

`generateLayout` short-circuits to `generateSpireAscent()` before
`normalizeLayoutProfile` is consulted, so the `'spire-ascent'` object added to
`LAYOUT_PROFILES` is never read for layout generation. It is a harmless
placeholder but reads as dead config.

### Acceptance Criteria
- Either remove the `LAYOUT_PROFILES['spire-ascent']` entry, or add a one-line
  comment stating it exists only so `normalizeLayoutProfile` has a fallback and
  is intentionally not used by `generateLayout`.
