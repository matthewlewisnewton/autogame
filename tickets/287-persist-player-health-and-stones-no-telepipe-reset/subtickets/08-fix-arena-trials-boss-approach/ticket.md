# 08 — Fix arena-trials-boss-approach debug scenario test

The server test suite fails on `debugScenario — arena-trials-* > places player outside dormant boss trigger after adds cleared` because `game/server/debugScenarios.js` contains duplicate unreachable `arena-trials-boss-approach` branches (and related arena-trials duplicates). Remove the dead duplicate logic so the surviving handler uses `resolveEncounterAnchor` consistently and the test passes.

## Acceptance Criteria

- `pnpm test:quick` (or targeted `server/test/debug-scenarios.test.js`) passes the test `places player outside dormant boss trigger after adds cleared`.
- Only one `arena-trials-boss-approach` handler remains in `debugScenarios.js`; the removed duplicate is the earlier unreachable branch (~line 632) or the later one (~line 789), keeping the version that satisfies the test's `resolveEncounterAnchor` distance assertion.
- Duplicate `arena-trials-near-adds` and `arena-trials-boss-low-hp` branches in the same file are merged or removed if they are unreachable dead code from the same duplication.
- Duplicate scenario name entries in `game/server/index.js` debug-scenario allowlists are deduplicated.
- `rejects arena-trials-boss-approach while adds remain` continues to pass.

## Technical Specs

- **`game/server/debugScenarios.js`** — Delete the unreachable duplicate `arena-trials-boss-approach` block (and sibling duplicates for `arena-trials-near-adds`, `arena-trials-boss-low-hp` if present in the same duplicated section). Ensure the remaining handler places the player outside `ENCOUNTER_TRIGGER_RADIUS` with encounter phase `dormant` after adds are cleared.
- **`game/server/index.js`** — Deduplicate the `arena-trials-*` scenario name arrays (~lines 520–723) so each name appears once.
- **`game/server/test/debug-scenarios.test.js`** — No test rewrites unless the surviving handler's anchor resolution differs; the test at ~line 1106 should pass without changing its expectations.

## Verification: code
