## Refresh Stale Registry Comments

`game/client/renderer.js` still contains comments in `attachRegistryModel()` saying every registry path is null and that the early return is the only path for the ticket. The runtime behavior is correct, but the comments now contradict the wired enemy/minion paths and can mislead future model work.

### Acceptance Criteria
- Comments around `attachRegistryModel()` accurately describe the current registry behavior with non-null enemy/minion model paths and procedural fallback.
