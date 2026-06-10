# Cleanup nits from content-rework-crystal-rescue-frost-crossing-training-cavern-o0vv.7

> **Staleness note.** This follow-up ticket was written against commit
> `dcc303c9` (2026-06-10). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `content-rework-crystal-rescue-frost-crossing-training-cavern-o0vv.7`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Target Frost Wave-Cleared Dialogue More Explicitly

`frost_crossing` has an `onWaveCleared` beacon for the first ice-band thrower wave that uses `band: 'ice'` and `waveIndex: 0`, but `matchesWaveCleared()` currently ignores `band`. This can make the Rimecast setup line eligible when any room's wave 0 clears; the authored arc would be clearer if wave-cleared beacons either honored `band` or the frost beacon targeted the resolved ice room directly.

### Acceptance Criteria
- The "First thrower line is down" frost dialogue only fires after the first ice-band thrower wave is cleared, not after the stone dock wave.
