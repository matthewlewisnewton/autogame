# Cleanup nits from 244-canyon-walkability-fixes

> **Staleness note.** This follow-up ticket was written against commit
> `10dfc3f` (2026-06-04). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `244-canyon-walkability-fixes`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Collapse Duplicate Shared Ramp Walls

Adjacent central sunken-canyon ramps that exactly touch can still each emit a side wall on the same shared X boundary. This does not recreate the original wedge because the walls are coincident rather than separated, but collapsing exact duplicates would make the geometry cleaner and align the code more closely with the "merged ramp" intent.

### Acceptance Criteria
- Shared ramp boundaries that have identical X/Z spans are represented by at most one wall collider or are intentionally opened as a contiguous ramp surface.
