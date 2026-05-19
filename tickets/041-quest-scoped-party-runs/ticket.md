# Quest-Scoped Party Runs

Add the second half of a *Phantasy Star Online Episodes I&II*-inspired quest
loop: selected quests should shape the next run's objective, enemy setup, and
summary rewards.

## Source Material Note

PSO's lobby loop is not just "press ready and enter any dungeon"; players choose
or join a mission, launch as a squad, and the run is framed around that mission.
`040-lobby-quest-board` adds selection. This ticket makes the selected quest
actually drive the run.

## Goal

When players ready up, the server should create a run from the currently
selected quest definition. The run payload and summary should show quest
identity, objective text, and quest reward values.

## Acceptance Criteria

- `startDungeonRun()` or its replacement accepts a quest definition/id.
- `gameState.run` includes quest metadata:
  - `questId`
  - `questName`
  - `questDescription` or short objective text
  - quest reward summary
- The run objective is initialized from the quest definition.
- For a defeat-enemies quest, spawned enemy count matches the quest definition
  instead of being hardcoded only in `spawnEnemies()`.
- The objective HUD includes the quest name or quest objective label.
- `runComplete` summary includes quest id/name and quest reward information.
- Victory rewards can use the selected quest's reward currency value instead of
  a single hardcoded value.
- Returning to lobby preserves the currently selected quest for the next run
  unless the player chooses another quest.
- Existing default behavior still works if no quest has been explicitly
  selected.

## Implementation Notes

- Keep this compatible with the current single-lobby/single-run architecture.
  Do not implement separate rooms, matchmaking, or multiple simultaneous
  dungeon instances in this ticket.
- If the existing `spawnEnemies()` helper is hardcoded to 5 enemies, change it
  to accept `{ count }` or a quest object.
- Keep all quest-derived fields server-authoritative. The client displays them
  but does not decide objective or reward values.
- If `collect_items` exists as metadata from `040`, it can still map to a
  defeat-enemies objective for now. Do not build item objectives unless it stays
  small.

## Test Snippet

Adapt this into `game/server/test/integration.test.js`:

```js
it('starts the selected quest with quest metadata and configured enemy count', async () => {
  socket1.emit('selectQuest', { questId: 'training_caverns' });
  await waitForEvent(socket1, 'questUpdate');

  const startGame1 = waitForEvent(socket1, 'startGame');
  const startGame2 = waitForEvent(socket2, 'startGame');
  socket1.emit('playerReady', true);
  socket2.emit('playerReady', true);
  await Promise.all([startGame1, startGame2]);
  const state = await waitForEvent(socket1, 'stateUpdate');

  expect(state.run.questId).toBe('training_caverns');
  expect(state.run.questName).toBe('Training Caverns');
  expect(state.run.objective.totalEnemies).toBe(5);
  expect(gameState.enemies.length).toBe(5);
});
```

Add a victory summary assertion:

```js
expect(summary.questId).toBe('training_caverns');
expect(summary.questName).toBe('Training Caverns');
expect(summary.rewards.currency).toBeGreaterThanOrEqual(10);
```

Adjust exact payload shape to match the implementation, but keep the test
focused on the selected quest shaping the run.

## Files

- `game/server/index.js`
- `game/client/main.js`
- `game/server/test/server.test.js`
- `game/server/test/integration.test.js`
- `game/client/test/main.test.js`

## Tests

- Unit test run creation from a quest definition.
- Unit test enemy count derivation from quest config.
- Integration test selected quest -> ready up -> `gameState.run` metadata.
- Integration test run summary includes quest metadata/reward data.
- Existing run objective and return-to-lobby tests still pass.

## Visual QA Checklist

- Select a quest in the lobby.
- Start the run and verify the HUD identifies the selected quest/objective.
- Complete the run and verify the summary mentions the selected quest and
  rewards.
- Return to lobby and verify the selected quest is still visible.
