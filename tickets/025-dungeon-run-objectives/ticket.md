# Dungeon Run Objective Progress

Add the first explicit dungeon objective and progress HUD. This ticket should not implement victory/failure screens or return-to-lobby behavior; those are handled by `027-run-summary-return-to-lobby`.

## Goal

When players leave the lobby, the server should create a session-local dungeon run with one clear objective: defeat all enemies spawned for the run. The client should show that objective while players are in the dungeon.

## Acceptance Criteria
- Starting the game from the lobby creates `gameState.run` on the server.
- `gameState.run` includes:
  - `id`: a unique string for the run.
  - `status`: initially `playing`.
  - `objective.type`: exactly `defeat_enemies`.
  - `objective.label`: a short player-facing label such as `Defeat all enemies`.
  - `objective.totalEnemies`: the number of enemies alive at run start.
  - `objective.defeatedEnemies`: initially `0`.
  - `startedAt`: a timestamp.
- The run id changes each time a new run starts.
- The objective total is based on the server enemy list after run setup, not a hardcoded constant in the client.
- Defeating enemies through weapon cards, summon cards, or minion attacks increments `objective.defeatedEnemies`.
- The defeated count never exceeds `totalEnemies`.
- The server includes the run object in `init` and `stateUpdate` payloads.
- The client renders an objective HUD while `gamePhase === 'playing'`.
- The HUD shows the objective label and progress in the form `Defeated X / Y`.
- The HUD updates from server state; it does not infer objective progress from local mesh counts.
- Existing lobby ready flow still starts the game for all ready players.
- Existing combat/card/loot behavior still works while the run object exists.

## Implementation Notes
- Prefer helpers in `game/server/index.js`:
  - `createRunState()`
  - `startDungeonRun()`
  - `recordEnemyDefeated(count = 1)`
  - `clampObjectiveProgress(run)`
- Call the enemy-defeat accounting from every code path that removes dead enemies:
  - weapon card resolution
  - summon card resolution
  - minion update cleanup
- Do not add persistence, accounts, deck editing, victory screens, or return-to-lobby controls in this ticket.
- If enemy removal logic is duplicated, a small helper is acceptable, but avoid a large combat refactor.

## Files
- `game/server/index.js`
- `game/client/main.js`
- `game/client/index.html`
- `game/client/style.css`
- `game/server/test/server.test.js`
- `game/server/test/integration.test.js`

## Tests
- Unit test `createRunState()` or equivalent helper.
- Unit test that `recordEnemyDefeated()` clamps at `totalEnemies`.
- Integration test that two ready players receive state with a `run` object after `startGame`.
- Integration test that killing an enemy through `useCard` advances objective progress.
- Client test, if practical, for rendering `Defeated X / Y` from a supplied run state.

## Verification: visual
