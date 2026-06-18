## Add a dedicated test for the `launch-bay-invalid-deck` debug scenario
The new debug scenario in `game/server/debugScenarios.js` (`setupLaunchBayInvalidDeckDebug`) has no test asserting it actually leaves the player with a sub-`DECK_MIN_SIZE` deck and lobby phase. Other scenarios are exercised by `server/test/debug-scenarios.test.js`; this one only rides registry-consistency coverage.
### Acceptance Criteria
- A server test invokes the `launch-bay-invalid-deck` scenario and asserts `player.selectedDeck.length < DECK_MIN_SIZE`, `player.ready === false`, and lobby phase.

## Toast only humanizes the min-size deck error
`formatDeckErrorToast` (game/client/main.js) only rewrites the `Deck must have at least N cards` reason; any other `validateDeck` rejection reason is shown verbatim in the toast. Worth normalizing the copy for all deck-error reasons surfaced from the Launch Bay booth.
### Acceptance Criteria
- Each `validateDeck` failure reason maps to a player-facing toast message that names the Deck booth, or there is a clear default fallback phrasing.
