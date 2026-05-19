# Run Completion Summary and Return to Lobby

Finish the dungeon run loop by adding server-authoritative victory/failure detection, a client summary overlay, and a clean way to return to the lobby for another run.

## Dependencies

This ticket assumes `025-dungeon-run-objectives` has added `gameState.run` with objective progress.

## Acceptance Criteria
- The server marks `gameState.run.status = 'victory'` when the defeat-enemies objective reaches its total.
- The server marks `gameState.run.status = 'failed'` when every connected active player is dead at the same time.
- The server emits exactly one terminal run event per run:
  - `runComplete` for victory.
  - `runFailed` for failure.
- The terminal event payload includes:
  - `runId`
  - `status`
  - `durationMs`
  - `objective`
  - `players`
  - `defeatedEnemies`
  - `currencyCollected`
- Once a run is terminal, new combat actions and movement updates are ignored until players return to lobby.
- The client shows a summary overlay for `runComplete` and `runFailed`.
- The summary overlay shows win/loss status, duration, defeated enemies, and currency collected.
- The summary overlay includes a `Return to Lobby` button.
- Clicking `Return to Lobby` emits a server event, such as `returnToLobby`.
- The server handles `returnToLobby` by:
  - setting `gamePhase` back to `lobby`
  - clearing `gameState.run`
  - clearing enemies, minions, loot, and pending combat-only effects/state
  - setting all connected players to `ready: false`
  - respawning living/dead players at the first room spawn
  - restoring player HP to full
  - preserving session currency/inventory fields for later reward tickets
- The client hides gameplay HUD/card hand and shows the lobby after the server confirms the return.
- A second run can start from the lobby without refreshing the page.

## Implementation Notes
- Prefer explicit helpers in `game/server/index.js`:
  - `checkRunTerminalState()`
  - `buildRunSummary(status)`
  - `returnPlayersToLobby()`
  - `resetTransientRunState()`
- Call `checkRunTerminalState()` after:
  - enemy deaths
  - player deaths
  - disconnects during a run
- Ensure terminal events are idempotent by checking the previous run status before emitting.
- Keep the summary UI simple and text-first.
- Do not add card rewards or deck editing in this ticket; leave summary reward fields at zero or use existing collected currency only.

## Files
- `game/server/index.js`
- `game/client/main.js`
- `game/client/index.html`
- `game/client/style.css`
- `game/server/test/server.test.js`
- `game/server/test/integration.test.js`

## Tests
- Unit test that victory summary is built once when objective progress reaches total.
- Unit test that all-dead players produce failure.
- Integration test that `runComplete` is emitted after the last enemy is defeated.
- Integration test that `runFailed` is emitted when all players are dead.
- Integration test that `returnToLobby` resets game phase, readiness, and transient run entities.
- Integration test that players can ready up and start a second run after returning to lobby.

## Verification: visual
