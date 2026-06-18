# Cleanup nits from playability-ux-launch-bay-ready-up-failure-invalid-deck-give-au9f

> **Staleness note.** This follow-up ticket was written against commit
> `3be86faa` (2026-06-18). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `playability-ux-launch-bay-ready-up-failure-invalid-deck-give-au9f`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Add a dedicated test for the `launch-bay-invalid-deck` debug scenario
The new debug scenario in `game/server/debugScenarios.js` (`setupLaunchBayInvalidDeckDebug`) has no test asserting it actually leaves the player with a sub-`DECK_MIN_SIZE` deck and lobby phase. Other scenarios are exercised by `server/test/debug-scenarios.test.js`; this one only rides registry-consistency coverage.
### Acceptance Criteria
- A server test invokes the `launch-bay-invalid-deck` scenario and asserts `player.selectedDeck.length < DECK_MIN_SIZE`, `player.ready === false`, and lobby phase.

## Toast only humanizes the min-size deck error
`formatDeckErrorToast` (game/client/main.js) only rewrites the `Deck must have at least N cards` reason; any other `validateDeck` rejection reason is shown verbatim in the toast. Worth normalizing the copy for all deck-error reasons surfaced from the Launch Bay booth.
### Acceptance Criteria
- Each `validateDeck` failure reason maps to a player-facing toast message that names the Deck booth, or there is a clear default fallback phrasing.
