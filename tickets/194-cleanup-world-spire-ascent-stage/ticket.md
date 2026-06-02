# Cleanup nits from 136-world-spire-ascent-stage

> **Staleness note.** This follow-up ticket was written against commit
> `909e7ab` (2026-06-02). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `136-world-spire-ascent-stage`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Capture plan does not exercise the spire-ascent scenario

The round-1 browser capture fell back to the generic `sloped-dungeon` scenario
(`capturePlanSource: "fallback"`, `scenarios: ["sloped-dungeon"]`), so there is
no in-browser screenshot of the new spire-ascent stage despite the ticket adding
`?debugScenario=spire-ascent` and `spire-ascent-stage`. The stage is covered by
passing unit tests, but a direct visual capture would prove camera-follow and
multi-tier ascent end-to-end and catch any render regressions future tickets
might introduce.

### Acceptance Criteria
- The capture plan for spire-ascent work uses the `spire-ascent` (or
  `spire-ascent-stage`) debug scenario and produces at least one screenshot
  showing stacked tiers / a ramp at elevation.
- `metrics.json` `scenarios` includes `spire-ascent` rather than only the
  generic sloped-dungeon fallback.

## ensureWeaponInHand helper duplicates an iron_sword literal

`game/server/test/integration.test.js` gained an `ensureWeaponInHand` helper that
hardcodes an `iron_sword` card object inline. This is a reasonable flaky-test fix
but duplicates card-shape knowledge in test code.

### Acceptance Criteria
- The injected weapon card is sourced from a shared test fixture / card
  definition rather than an inline literal, or a short comment documents why the
  literal is intentional.
