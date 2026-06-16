# Cleanup nits from validation-spire-ascent-sunken-canyon-full-playthroughs-bloc-5xcz

> **Staleness note.** This follow-up ticket was written against commit
> `08243168` (2026-06-15). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `validation-spire-ascent-sunken-canyon-full-playthroughs-bloc-5xcz`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Deduplicate quest telepipe-ready extras helpers

`setupSpireAscentTelepipeReadyExtras` and `setupCanyonDescentTelepipeReadyExtras` in `game/server/debugScenarios.js` are byte-for-byte identical. A shared `setupQuestTelepipeReadyExtras(state, player)` would reduce drift risk if one quest's hand seeding changes later.

### Acceptance Criteria
- Single helper sets telepipe slot 0, `magma_greatsword` slot 1, clears minion/burn fields, and calls `syncCardProbeHand`.
- Both `spire-ascent-telepipe-ready` and `canyon-descent-telepipe-ready` call the shared helper.
- Existing telepipe-ready unit tests continue to pass.

## Add spire-ascent force-redeal regression test

Canyon has `canyon-descent-telepipe-ready forces fresh hand redeal over pre-existing hand` but spire lacks the symmetric test, even though both scenarios pass `forceRedeal: true`.

### Acceptance Criteria
- New test in `debug-scenarios.test.js` seeds a 6-slot hand with one non-null card, applies `spire-ascent-telepipe-ready`, and asserts `hand[0].id === 'telepipe'` and `hand[1].id === 'magma_greatsword'`.

## Update stale spire-ascent validation findings

`game/validation/spire-ascent/findings.md` still documents `throw_rock` in slot 1 for `spire-ascent-telepipe-ready`; the implementation now uses `magma_greatsword`.

### Acceptance Criteria
- Findings doc describes the current telepipe-ready hand seeding (`telepipe` + `magma_greatsword`, `forceRedeal`).
