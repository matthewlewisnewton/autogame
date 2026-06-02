# Cleanup nits from 136-world-spire-ascent-stage

> **Staleness note.** This follow-up ticket was written against commit
> `b1c49b6` (2026-06-02). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `136-world-spire-ascent-stage`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Round-1 capture did not exercise spire-ascent

`metrics.json` reports `capturePlanSource: "fallback"` and scenario `sloped-dungeon`, so round-1 screenshots never show the new stacked tiers or ramp climb. Layout and render behavior are well covered by unit tests, but future top-level captures should prefer `?debugScenario=spire-ascent` or a quest-select flow into `spire_ascent` for visual regression on this stage.

### Acceptance Criteria
- Round-1 (or equivalent) `metrics.json` includes at least one screenshot whose description references spire tiers/ramps or `spire-ascent` scenario.
- Capture probe shows `layout.profile === 'spire-ascent'` or `debugScenario === 'spire-ascent'`.

## Camera ascent lacks play-mode visual check

`camera-orbit.test.js` only asserts the `playerY + CAMERA_HEIGHT` formula. No browser capture shows the camera tracking a player walking up spire ramps. Low risk because spire reuses the same floor-follow and orbit paths as other sloped layouts, but a short harness clip climbing tier 1→top would close the loop on the ticket’s “no clipping while ascending” criterion.

### Acceptance Criteria
- Harness capture includes movement from bottom tier toward top tier on `spire-ascent` layout.
- No visible camera stuck below floor or inside geometry in the captured frames (human or vision QA sign-off).

## Middle-tier perimeter walls not explicitly asserted

Server wall tests focus on bottom tier, top tier, and ramp sides. Middle tiers rely on the same `buildSpireTierRoom` helper without dedicated assertions on north/south gap segments. Behavior is correct by construction; an extra test on a 4-tier seed would guard against future regressions in gap placement.

### Acceptance Criteria
- One test seed with ≥ 4 tiers asserts each middle `band: 'tier'` room has west and east full-length walls and north/south wall segments (with gaps only at ramp width).
