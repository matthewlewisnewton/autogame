# Cleanup nits from 137-world-sunken-canyon-stage

> **Staleness note.** This follow-up ticket was written against commit
> `c6f4ddf` (2026-06-02). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `137-world-sunken-canyon-stage`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Harness capture should use sunken-canyon debug scenarios for ticket 137

Round-3 `metrics.json` used `capturePlanSource: "fallback"` with scenario `sloped-dungeon` on the default `training_caverns` quest. Screenshots show generic sloped rooms, not the plateau→canyon vista this ticket defines. Sub-ticket QA may have covered it elsewhere, but top-level capture should prove the shipped stage.

### Acceptance Criteria
- For tickets whose `ticket.md` adds a `sunken-canyon` layout or `DEBUG_SCENARIOS` entry matching `sunken-canyon-*`, `screenshot.mjs` (or agent capture plan) emits `sunken-canyon-stage` after gameplay starts and saves a spawn/plateau vista frame.
- `metrics.json` `scenarios` includes `sunken-canyon-stage` (not only `sloped-dungeon`) when the ticket branch touches `generateSunkenCanyon` or sunken-canyon quest defs.

## Extend `generateLayout({ stage })` routing for future stage strings

The object selector only special-cases `sunken-canyon`; other stage names fall through to legacy numeric handling. Fine for 137, but the API shape invites follow-up when more bespoke stages land.

### Acceptance Criteria
- Unknown `stage` values throw or return a documented error instead of coercing the options object as a seed.
- At least one unit test asserts invalid `{ stage: 'unknown' }` fails predictably.
