# Integration test: death at 0 money → return to lobby → redeploy succeeds

## Description

Add an end-to-end integration test that verifies the full soft-lock scenario is fixed: a player with 0 currency dies in a run, returns to the lobby with `LOBBY_REVIVE_HP` (not 0), and can successfully deploy into a new run without immediate failure.

## Acceptance Criteria

- New test in `game/server/test/integration.test.js` (or a dedicated test file) that:
  1. Connects a player with 0 currency
  2. Starts a run and lets the player die (set `hp: 0, dead: true`)
  3. Verifies `runFailed` is emitted
  4. Returns to lobby via `returnToLobby`
  5. Verifies player HP is `LOBBY_REVIVE_HP` (10) and `dead: false`
  6. Readies up and deploys into a new run
  7. Verifies the new run starts successfully (gamePhase is `PLAYING`, player HP > 0, no immediate `runFailed`)
- Test passes when run with `pnpm test` from `game/`

## Technical Specs

- **File**: `game/server/test/integration.test.js`
  - Add new `it()` test in the existing integration describe block
  - Follow the existing pattern: `connectClient()`, `waitForEvent()`, `startGame`/`runFailed` event handling, `returnToLobby` socket emit, `PLAYER_READY` emit
  - Import `LOBBY_REVIVE_HP` from `../config.js` if not already imported
  - Use `testGameState()` helper to inspect server state between steps

## Verification: code
