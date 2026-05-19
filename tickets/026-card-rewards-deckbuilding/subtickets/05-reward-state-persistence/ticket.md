# Reward State Persistence Across Runs

Ensure that a player's `currency`, `ownedCards`, and `runRewards` survive the return-to-lobby flow and are carried forward into subsequent runs within the same server session. Verify with integration tests.

## Acceptance Criteria
- After completing a run and returning to lobby, the player's `currency` and `ownedCards` are preserved (not reset to 0 or empty).
- Starting a second run after returning to lobby uses the same `currency` and `ownedCards` from the previous run.
- `returnPlayersToLobby()` already preserves `currency` and `inventory` — extend it to also preserve `ownedCards` and `runRewards`.
- Integration test: complete a run, return to lobby, verify `ownedCards` and `currency` are non-zero / non-empty.
- Integration test: complete a second run and verify reward state accumulates (e.g., currency increases, ownedCards grows).
- Integration test: returning to lobby preserves session reward state.

## Technical Specs
- **File**: `game/server/index.js`
  - In `returnPlayersToLobby()`, ensure `ownedCards` and `runRewards` are preserved alongside `currency` and `inventory`. Currently the function preserves `currency` and `inventory` — add `ownedCards` and `runRewards` to the preserve-and-restore logic.
  - On player reconnect (new socket connection), if a player with the same `socket.id` already existed in `gameState.players`, the state is already preserved. No special handling needed beyond what exists.
  - Ensure the player initialization on connection only sets progress state for NEW players (socket.id not already in `gameState.players`), so reconnecting players don't lose accumulated state.
- **File**: `game/server/test/integration.test.js`
  - Integration test: connect, complete a victory run, return to lobby, verify player still has `ownedCards` with rewarded cards and accumulated `currency`.
  - Integration test: start and complete a second run, verify `currency` and `ownedCards` accumulate (are not reset).
  - Integration test: verify `returnPlayersToLobby()` preserves `ownedCards` and `runRewards`.

## Verification: code
