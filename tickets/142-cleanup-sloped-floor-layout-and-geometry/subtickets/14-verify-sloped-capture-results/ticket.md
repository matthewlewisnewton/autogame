# Verify sloped-dungeon capture results

The harness capture for the sloped-dungeon scenario completed in round-3 and produced `metrics.json` with `"ok": true`. Verify the captured artifacts satisfy the top-level ticket's ramp-focused capture criterion: at least one screenshot whose description mentions a sloped room/ramp, taken after deploy with `{ slopes: true }` layout.

## Acceptance Criteria
- `tickets/142-cleanup-sloped-floor-layout-and-geometry/round-3/metrics.json` exists and contains `"ok": true`.
- `metrics.json` `screenshots[]` array contains at least one entry whose `description` field includes the word "sloped", "ramp", or "slope".
- `metrics.json` `scenarios[]` array includes `"sloped-dungeon"`.
- `tickets/142-cleanup-sloped-floor-layout-and-geometry/round-3/console.log` contains no `[pageerror]` or `[fatal]` lines from game code.
- At least one `.png` screenshot file exists in `round-3/` corresponding to a sloped-room description.

## Technical Specs
- **No code changes**. This is a verification-only sub-ticket.
- Read `tickets/142-cleanup-sloped-floor-layout-and-geometry/round-3/metrics.json` and check all fields listed in Acceptance Criteria.
- Read `tickets/142-cleanup-sloped-floor-layout-and-geometry/round-3/console.log` and confirm absence of errors.
- List files in `round-3/` to confirm `.png` screenshots are present.

## Verification: code
