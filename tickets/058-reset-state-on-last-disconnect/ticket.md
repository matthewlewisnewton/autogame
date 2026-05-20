# Reset Game State When the Last Player Disconnects

## Bug

When the last connected client disconnects during an active dungeon run, the
server removes the player from `gameState.players` but leaves the session in
`gamePhase: 'playing'` with enemies, loot, minions, and a partial
`gameState.run` intact.

Relevant handler today (`game/server/index.js`):

```js
socket.on('disconnect', () => {
  delete gameState.players[socket.id];
  gameState.minions = gameState.minions.filter(m => m.ownerId !== socket.id);
  io.emit('playerDisconnected', socket.id);

  if (gameState.gamePhase === 'playing') {
    checkRunTerminalState();
  }

  if (gameState.gamePhase === 'lobby') {
    broadcastLobbyUpdate();
  }
});
```

`checkRunTerminalState()` only ends the run on victory (all enemies dead) or
failure (every **remaining** player dead). With zero players left, neither
condition applies, so the run never terminates and the lobby is never restored.

The next client to connect receives `init` with `gamePhase: 'playing'`. The
client skips the lobby (`main.js` checks `data.state.gamePhase === 'playing'`)
and drops them into a stale mid-run dungeon with no Ready button and no clean
deck-editor gate.

This was observed during manual playtesting: disconnect mid-run, reconnect, and
the lobby never appears until the server process is restarted.

## Expected Behavior

When the **last** player disconnects, the server should reset the session to a
clean lobby state so the next connection starts fresh:

- `gamePhase` returns to `'lobby'`
- `gameState.run` is cleared (or fully reset)
- Enemies, minions, and loot are cleared
- Remaining session data that should persist across runs (layout seed, player
  progress such as `ownedCards` / `currency` on reconnect) follows existing
  `returnPlayersToLobby()` conventions

When **some** players remain connected, behavior should be unchanged: the run
continues for the remaining squad.

## Suggested Implementation

- After removing the disconnected player, if `Object.keys(gameState.players).length === 0`:
  - Call `returnPlayersToLobby()` (or a small shared helper with the same effect)
  - This should apply whether the run was active (`run.status === 'playing'`) or
    already terminal (`victory` / `failed`) with no one left to view the summary
- Do **not** reset when other players are still connected
- Keep the existing `broadcastLobbyUpdate()` path for lobby-phase disconnects

Reuse `returnPlayersToLobby()` rather than duplicating reset logic, unless a
lighter reset is needed for the zero-player case (no players to iterate).

## Client Notes

No client change is strictly required if the server emits `stateUpdate` with
`gamePhase: 'lobby'` before the next `init`. Verify that a reconnecting browser
still shows the lobby and deck editor after the fix.

## Acceptance Criteria

- When the last player disconnects during an active run, the server resets to
  `gamePhase: 'lobby'` and clears transient run state (`enemies`, `minions`,
  `loot`, `gameState.run`).
- A new connection after that reset sees the lobby UI and can Ready up normally.
- When at least one other player remains connected, disconnecting one player
  does **not** reset the run for everyone else.
- Integration test covers: start run → sole player disconnects → reconnect (or
  second socket connects) → `gamePhase === 'lobby'`, no stale enemies/run.
- `npm test` (or project-standard test command) passes.

## Test Snippet

Adapt into `game/server/test/integration.test.js`:

```js
it('resets to lobby when the last player disconnects during an active run', async () => {
  const startGame = waitForEvent(socket1, 'startGame');
  socket1.emit('playerReady', true);
  await startGame;
  await waitForEvent(socket1, 'stateUpdate');

  expect(gameState.gamePhase).toBe('playing');
  expect(gameState.run).toBeDefined();
  expect(gameState.enemies.length).toBeGreaterThan(0);

  socket1.disconnect();
  await sleep(100);

  expect(Object.keys(gameState.players)).toHaveLength(0);
  expect(gameState.gamePhase).toBe('lobby');
  expect(gameState.run).toBeUndefined();
  expect(gameState.enemies).toHaveLength(0);

  socket1 = await connectClient(baseUrl);
  const init = await waitForEvent(socket1, 'init');
  expect(init.state.gamePhase).toBe('lobby');
});
```

## Files

- `game/server/index.js`
- `game/server/test/integration.test.js`
