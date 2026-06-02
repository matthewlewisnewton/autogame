# Cleanup nits from 136-world-spire-ascent-stage

> **Staleness note.** This follow-up ticket was written against commit
> `9c83c3b` (2026-06-02). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `136-world-spire-ascent-stage`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Add a small safety margin to spire total rise

`generateSpireAscent` sets `risePerRamp = minTotalRise / numRamps`, so the total
bottom→top Y gain lands *exactly* on the `≥ 10` acceptance boundary with zero
slack. A future tweak to rounding, `DEFAULT_FLOOR_Y`, or rise distribution could
silently drop it under 10. A tiny margin (e.g. target 10.5–11, or `Math.ceil`
the per-ramp rise) makes the criterion robust without changing feel.

### Acceptance Criteria
- Total Y gain from bottom tier to top tier is strictly greater than 10 (not equal) for all seeds tested.
- Existing slope (≥ 0.2) and tier-count (3–5) tests still pass.

## Document the spire-ascent stage selection API

The ticket describes the entry point as `generateLayout({ stage: "spire-ascent" })`
but the actual (and convention-consistent) call is `generateLayout(seed, 'spire-ascent')`.
Worth a one-line note near the `LAYOUT_PROFILES` table or in stage docs so the
positional-profile convention is discoverable and the ticket wording doesn't
mislead a later reader.

### Acceptance Criteria
- A short comment or doc line records that stage variants are selected via the positional `profile` argument of `generateLayout`, listing the valid profile names.
