## Update Stale Progression State Comments

Some server test comments still refer to `progression._gameState` or old ambient-state assumptions after the progression split removed that pattern. This is non-blocking because the runtime progression modules no longer use `_gameState`, but the stale comments can mislead future maintenance.

### Acceptance Criteria
- Comments in touched server tests no longer claim `progression._gameState` exists; references to `simulation._gameState` remain only where they describe the current simulation module accurately.
