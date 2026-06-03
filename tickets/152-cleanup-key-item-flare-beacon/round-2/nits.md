## Raise vitest coverage timeout for `key-items.test.js`

Round-2 `coverage.log` killed the vitest process after 120s while `echo_strike` tests were still running, even though all `flare_beacon` and `revealedUntil` cases had already passed. The harness coverage step should allow enough wall time for the full file (or scope coverage to changed test names only).

### Acceptance Criteria
- `round-2/coverage.log` completes without `[vitest] timed out after 120s` when re-run on this branch.
- Flare-beacon and cleanup tests remain in the coverage report.

## Narrow `isFlareBeaconTicket` outDir regex

`harness/screenshot.mjs` uses `/flare|152-cleanup-key-item-flare-beacon/i` on `outDirAbs`, which could append flare-beacon capture steps to unrelated tickets whose artifact path contains the substring `flare`.

### Acceptance Criteria
- Fallback flare steps run only when the ticket file or output directory clearly matches ticket 152 (or an explicit allowlist), not arbitrary paths containing `flare`.
- Other tickets’ fallback captures are unchanged.
