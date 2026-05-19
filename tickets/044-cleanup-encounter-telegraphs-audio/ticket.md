# Cleanup nits from 030-encounter-telegraphs-audio

> **Staleness note.** This follow-up ticket was written against commit
> `19e2028` (2026-05-19). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `030-encounter-telegraphs-audio`.
None blocked acceptance — clean them up when convenient.

## Fix the always-failing `deckAddCard during playing phase` test
`game/server/test/integration.test.js`'s test `deckAddCard during playing phase
is silently ignored` builds a timeout race with `new Promise((_, r) =>
setTimeout(() => r('timeout'), 500))` — `r` is the *reject* handler, so the
race rejects and the test always throws "timeout" regardless of behaviour. This
is pre-existing (ticket 028) but should be repaired so the suite is green.
### Acceptance Criteria
- The test resolves (not rejects) with `'timeout'` when no `deckUpdate`/`deckError` fires.
- `npm test` passes with 0 failures.

## `flashMesh` never preserves a non-zero emissive
`game/client/main.js` `flashMesh()` reads `mat.emissive.get` — `THREE.Color`
has no `.get()` method, so `origEmissive` is always `0x000000`. A flash applied
to an enemy currently in its red wind-up tint restores the enemy to black, and
`applyWindupFlash` will not re-apply it (the id is still in `windupFlashing`),
briefly losing the telegraph tint. Pre-existing from ticket 029.
### Acceptance Criteria
- `flashMesh` captures the real original emissive (e.g. `getHex()`) and restores it.
- An enemy hit mid-wind-up returns to its red telegraph tint, not black.

## `enemyHit` sound can stack many oscillators in one frame
`game/client/main.js` calls `playSound('enemyHit')` once per entry in
`cardUsed.hits`; a wide summon hitting several enemies fires many simultaneous
oscillators, producing a harsh overlapping blip.
### Acceptance Criteria
- A multi-hit card event plays at most one `enemyHit` cue (or a throttled/merged cue).
