## Rename Objective Spawn Dispatcher

`game/server/progression.js` now uses `updateSurviveSpawns()` as a generic dispatcher for any objective registry entry with a `tickSpawns` hook. The behavior is correct, but the survive-specific function name can mislead future objective authors.

### Acceptance Criteria
- Rename the dispatcher and exported/imported references to a generic name such as `updateObjectiveSpawns`.
- Keep the existing survive spawn tests passing after the rename.
