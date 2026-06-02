# Cleanup nits from 137-world-sunken-canyon-stage

> **Staleness note.** This follow-up ticket was written against commit
> `61d3546` (2026-06-02). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `137-world-sunken-canyon-stage`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Top-level capture should use sunken-canyon debug scenario

Round-1 and sub-ticket harness captures used the fallback `sloped-dungeon` plan with `training_caverns`, so screenshots show a crowded annex maze—not the plateau-to-canyon vista the ticket calls out. The game runs cleanly, but future top-level QA should emit `debugScenario=sunken-canyon` (or `sunken-canyon-stage`) and save a spawn-facing screenshot for regression on elevation rendering and line-of-sight.

### Acceptance Criteria
- `metrics.json` lists `sunken-canyon` in `scenarios` and includes a screenshot described as plateau overlook into the canyon floor.
- `pageerrors` remains empty and probe data shows `selectedQuestId: 'canyon_descent'` when using the full-play scenario.

## Explicit “two flat bands” unit assertion

Tests already assert one `plateau` and one `canyon` room plus 2–3 `ramp` connectors; adding a one-liner that only `plateau` and `canyon` rooms have uniform `floorCorners` at distinct Y values would mirror the ticket wording and guard against accidental third flat bands.

### Acceptance Criteria
- New test in `game/server/test/dungeon.test.js` fails if any non-ramp room shares another band’s flat Y or if more than one room exists per flat band.
