# Cleanup nits from theme-quest-entry-rooms-per-biome-first-30-seconds-of-every-o0vv.8

> **Staleness note.** This follow-up ticket was written against commit
> `ffbd35a7` (2026-06-10). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `theme-quest-entry-rooms-per-biome-first-30-seconds-of-every-o0vv.8`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Harness capture should screenshot quest entry spawn rooms

Round-1 used the generic `fallback` plan (`sunken-canyon-stage`) instead of capturing spawn-room views for `frost_crossing`, `ember_descent`, and `training_caverns`. `metrics.json` lists PNG filenames but no image files are stored under `round-1/`, so top-level visual proof of the ticket's primary acceptance criterion is missing even though code and tests satisfy it.

### Acceptance Criteria
- Agent-guided or development-scenario capture deploys each of the three tier-1 quests and saves a spawn-room screenshot.
- Reviewer can open the three PNGs side-by-side and confirm distinct palette and props without reading test output.

## Extend entry theming to sunken-canyon and spire profiles

The ticket design blurb mentions sunken-canyon and spire generators, but only `ice-cavern`, `fire-cavern`, and `crowded` received `entryFloor`/`entryWall` palettes and `entryDecor`. Quests on those other profiles still open with their deep-band look in the start room.

### Acceptance Criteria
- `sunken-canyon` and `spire-ascent` profiles define `entryFloor`/`entryWall` (or equivalent band tags) and optional start-room decor consistent with their biome identity.
- A regression test or capture shows their spawn rooms are distinguishable from the three tier-1 quests already themed.
