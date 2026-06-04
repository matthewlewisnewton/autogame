## Replace Last Server-Side Phase Literal In Debug Scenario
`game/server/debugScenarios.js` still has one direct `state.gamePhase === 'playing'` comparison after the phase helper refactor. It is not behavior-breaking, but replacing it with `isPlayingPhase(state)` would make the server-side phase model more consistently centralized.

### Acceptance Criteria
- `game/server/debugScenarios.js` uses the `lobbies.js` phase helper for the remaining playing-phase guard.
