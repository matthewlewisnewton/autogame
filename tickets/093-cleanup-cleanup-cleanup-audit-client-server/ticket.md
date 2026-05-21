# Cleanup nits from 092-cleanup-cleanup-audit-client-server

> **Staleness note.** This follow-up ticket was written against commit
> `c451706` (2026-05-21). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `092-cleanup-cleanup-audit-client-server`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Monster card not exercised in visual capture

Round-2 capture pressed slot 2 for the “after-monster” step, but after the summon that slot held `flame_blade` (weapon). Probes show a weapon charge decrement, not monster hand replacement. AC §2 is met in code; browser proof for monsters is still missing.
### Acceptance Criteria
- Capture plan uses `pressCard` with `cardType: "monster"` (harness already resolves via `data-card-type`) instead of a fixed slot index.
- `metrics.json` final probe documents monster slot id before/after and a new card in that slot from `stateUpdate`, with no client-side `drawCard` in between.

## Client test: monster happy-path authority

`main.test.js` covers monster cooldown-not-consumed but not a successful monster play that waits for `stateUpdate` instead of calling `drawCard()`.
### Acceptance Criteria
- Add a client test that calls `useCard` on a monster slot, simulates `stateUpdate` with a replaced hand from the server, and asserts `drawCard` was never invoked and `hand[slot]` matches server data.

## Stale capture-plan slot assumptions

`capture-plan-gemini.txt` still describes “slot 2 a monster” in the initial screenshot step; `summon-ready` deals vary and the summon replacement shifts types across slots.
### Acceptance Criteria
- Capture plan descriptions and steps refer to `cardType` (summon / monster / weapon) rather than hard-coded slot numbers except where intentionally fixed.
