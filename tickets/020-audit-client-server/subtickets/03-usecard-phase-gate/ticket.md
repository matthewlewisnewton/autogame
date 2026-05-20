# Strict Phase Gate on useCard

The server's `useCard` handler currently guards against non-playing runs with `if (gameState.run && gameState.run.status !== 'playing') return`. When `gameState.run` is `undefined` (e.g., after returning to lobby or before any run starts), this guard passes — allowing a client to emit `useCard` with stale hand state, process card effects, and spawn minions outside an active run. Tighten the gate to require both `gamePhase === 'playing'` and an active run.

## Acceptance Criteria
- `useCard` is rejected (silently returns) when `gameState.gamePhase !== 'playing'`.
- `useCard` is rejected (silently returns) when `gameState.run` is undefined or `gameState.run.status !== 'playing'`.
- Both guards must pass for card processing to proceed — either condition alone is insufficient.
- Legitimate `useCard` during an active playing run is never rejected by this guard.

## Technical Specs
- **File**: `game/server/index.js` — In the `socket.on('useCard', ...)` handler, replace the existing guard line (`if (gameState.run && gameState.run.status !== 'playing') return;`) with two guards:
  1. `if (gameState.gamePhase !== 'playing') return;`
  2. `if (!gameState.run || gameState.run.status !== 'playing') return;`
- **No other files changed.** Do not modify client files, config, or tests.

## Verification: code
