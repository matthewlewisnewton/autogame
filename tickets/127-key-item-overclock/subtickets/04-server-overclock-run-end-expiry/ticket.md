# 04 — Server: clear overclock charges on run end

Clear `player.overclockChargesRemaining` for all players whenever a run reaches a terminal state or is abandoned, so unused charges cannot carry into the next deployment.

## Acceptance Criteria

- `checkRunTerminalState()` clears `overclockChargesRemaining` to `0` for every player when it sets run status to `victory` or `failed`.
- `returnPlayersToLobby()` clears `overclockChargesRemaining` to `0` for every player in its per-player reset loop.
- `giveUpRun()` clears `overclockChargesRemaining` to `0` for every player in its per-player reset loop.
- `checkAllReady()` clears `overclockChargesRemaining` to `0` for every player before starting a fresh (non-suspended) run.
- A player who ends a run with unused charges sees `overclockChargesRemaining: 0` in the next run's `stateSnapshot`.

## Technical Specs

- **`game/server/progression.js`**:
  - In `checkRunTerminalState()` (~line 2911), after `_gameState.run.status = status`, add a loop to clear charges:
    ```javascript
    for (const p of Object.values(_gameState.players)) {
      p.overclockChargesRemaining = 0;
    }
    ```
  - In `returnPlayersToLobby()` (~line 3017), inside the per-player `for` loop (near `player.slotCooldowns = new Array(...)` at ~line 3054), add:
    ```javascript
    player.overclockChargesRemaining = 0;
    ```
  - In `giveUpRun()` (~line 3071), inside the per-player `for` loop (near `player.slotCooldowns = new Array(...)` at ~line 3124), add:
    ```javascript
    player.overclockChargesRemaining = 0;
    ```
  - In `checkAllReady()` (~line 3135), in the fresh-run path (the `if (!_gameState.suspendedCheckpoint)` branch), inside the per-player `for` loop (near `player.slotCooldowns = new Array(...)` at ~line 3156), add:
    ```javascript
    player.overclockChargesRemaining = 0;
    ```

## Verification: code
