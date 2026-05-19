# Explicitly clear pendingSummons on return to lobby

`returnPlayersToLobby()` currently relies on the next game-loop tick to clear each player's `pendingSummons` set (via `regenMagicStones`). Clearing it explicitly makes the intent self-evident and tick-independent.

## Acceptance Criteria
- `returnPlayersToLobby()` must clear every connected player's `pendingSummons` set synchronously — not deferred to the next game-loop tick.
- The clear should happen as part of the player reset loop in `returnPlayersToLobby()` (or in `resetTransientRunState()`), before the `stateUpdate` broadcast.

## Technical Specs
- **File:** `game/server/index.js`
- In `returnPlayersToLobby()`, inside the `for (const playerId of Object.keys(gameState.players))` loop (around line 500), add:
  ```js
  player.pendingSummons.clear();
  ```
  alongside the other per-player resets (dead, hp, position, etc.).
- Add a unit test in `game/server/test/server.test.js` confirming that after `returnPlayersToLobby()`, all players have `pendingSummons.size === 0` even if they had entries before the call.

## Verification: code
