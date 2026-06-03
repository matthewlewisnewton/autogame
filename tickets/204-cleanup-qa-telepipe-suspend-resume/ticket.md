# Cleanup nits from 175-qa-telepipe-suspend-resume

> **Staleness note.** This follow-up ticket was written against commit
> `b1fea50` (2026-06-03). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `175-qa-telepipe-suspend-resume`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Include Screenshot PNGs In Round Artifacts

Round-3 `metrics.json` lists `01-in-dungeon.png`, `02-suspended-lobby.png`, and `03-resumed-dungeon.png`, but the PNG files were not present in the round-3 artifact directory during final review. The state probes and logs were sufficient for this ticket, but future reviewers should be able to open the named screenshots directly.

### Acceptance Criteria

- The round artifact directory contains every screenshot file named in `metrics.json`.
- If a screenshot cannot be written, the capture fails or omits that filename from `metrics.json`.

## Align Standalone Smoke Enemy Assertion With Harness Capture

`game/client/scripts/test-telepipe-suspend-resume.mjs` requires the resumed enemy count to exactly match the pre-suspend enemy count. The round-3 harness correctly allows extra enemies only when they are tagged with `spawnedBy`, which avoids false failures if a spawner creates an add during the scripted interval.

### Acceptance Criteria

- The standalone Telepipe smoke test preserves the original enemy ID/HP assertions.
- The smoke test either allows resumed extra enemies only when each has `spawnedBy`, or prevents spawner adds during the scripted capture window.
