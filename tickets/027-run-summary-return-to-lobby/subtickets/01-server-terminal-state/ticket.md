# Server Terminal State Detection and Terminal Events

Add server-side logic that detects when a run reaches a terminal state (victory or failure), emits exactly one terminal event per run, and blocks further combat/movement actions once terminal.

## Acceptance Criteria
- `checkRunTerminalState()` exists and checks:
  - Sets `gameState.run.status = 'victory'` when `run.objective.defeatedEnemies >= run.objective.totalEnemies`
  - Sets `gameState.run.status = 'failed'` when every connected active player has `hp <= 0` (all dead)
- `buildRunSummary(status)` exists and returns an object with: `runId`, `status`, `durationMs`, `objective`, `players`, `defeatedEnemies`, `currencyCollected`
- The server emits exactly one `runComplete` event (on victory) or `runFailed` event (on failure) — idempotent via checking `run.status` before emitting
- The terminal event payload matches the structure returned by `buildRunSummary()`
- Once `gameState.run.status` is `'victory'` or `'failed'`, the `move` handler ignores movement updates
- Once terminal, the `useCard` handler ignores card plays (no damage, no summon, no monster spawn)
- `checkRunTerminalState()` is called after enemy deaths (in both weapon and summon branches of `useCard`, and in `updateMinions`)
- `checkRunTerminalState()` is called in `damagePlayer` after a player dies
- `checkRunTerminalState()` is called in the `disconnect` handler when a run is in progress

## Technical Specs
- **File**: `game/server/index.js`
- Add `checkRunTerminalState()` — reads `gameState.run` and `gameState.players`, sets `run.status`, emits event (guard against double-emit by checking status is `'playing'`)
- Add `buildRunSummary(status)` — constructs `{ runId, status, durationMs, objective, players, defeatedEnemies, currencyCollected }` from `gameState.run` and `gameState.players`
- In `useCard` handler: guard at top with `if (gameState.run && gameState.run.status !== 'playing') return;`
- In `move` handler: guard with `if (gameState.run && gameState.run.status !== 'playing') return;`
- Call `checkRunTerminalState()` in these spots:
  - After `recordEnemyDefeated()` in weapon branch of `useCard`
  - After `recordEnemyDefeated()` in summon branch of `useCard`
  - After `recordEnemyDefeated()` in `updateMinions`
  - In `damagePlayer` after setting `player.dead = true`
  - In `disconnect` handler when `gameState.gamePhase === 'playing'`
- Export `checkRunTerminalState` and `buildRunSummary` in the module.exports block for test access

## Verification: code
