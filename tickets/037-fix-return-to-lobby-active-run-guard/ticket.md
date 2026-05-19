# Fix Active-Run Return-to-Lobby Reset

> **Staleness note.** This bug ticket was written against commit
> `c8f0a9e` (2026-05-19). The codebase may have moved on since it was filed -
> before acting, re-check every file path and code reference below against the
> CURRENT code, and skip or revise any detail that is already resolved.

## Bug

`game/server/index.js` currently accepts the `returnToLobby` socket event at any
time:

```js
socket.on('returnToLobby', () => {
  returnPlayersToLobby();
});
```

That means any connected client can reset a live dungeon run before it reaches
`victory` or `failed`. The server immediately clears enemies, minions, loot, and
`gameState.run`, flips `gamePhase` back to `lobby`, and marks every player
unready. This is correct after the run summary overlay is shown, but it is a bug
while `gameState.run.status === 'playing'`.

The client UI normally only exposes the button in the summary overlay, but the
server cannot rely on that. A stale tab, browser console, buggy client, or test
harness can emit `returnToLobby` directly and silently abort the run for
everyone.

## Expected Behavior

The server should only return players to lobby after the current run has reached
a terminal state:

- `gameState.run.status === 'victory'`
- `gameState.run.status === 'failed'`

During an active run, `returnToLobby` should be ignored or rejected without
mutating `gameState`.

## Implementation Notes

- Add a small guard in the `returnToLobby` socket handler.
- Prefer making the allowed states obvious in code rather than relying on
  `gamePhase` alone, because `gamePhase` is still `'playing'` during the summary
  overlay.
- Existing tests that call `returnToLobby` immediately after starting a run need
  to mark the run terminal first or complete/fail the run through normal game
  behavior.
- If you emit an error for active-run attempts, keep it lightweight and
  client-specific; do not broadcast anything to other players.

## Test Snippet

Adapt this into `game/server/test/integration.test.js`. It should fail before
the fix because the active run is reset.

```js
it('ignores returnToLobby while the run is still playing', async () => {
  const startGame1 = waitForEvent(socket1, 'startGame');
  const startGame2 = waitForEvent(socket2, 'startGame');
  socket1.emit('playerReady', true);
  socket2.emit('playerReady', true);
  await Promise.all([startGame1, startGame2]);
  await waitForEvent(socket1, 'stateUpdate');

  expect(gameState.gamePhase).toBe('playing');
  expect(gameState.run.status).toBe('playing');
  const runId = gameState.run.id;
  const enemiesBefore = gameState.enemies.length;

  socket1.emit('returnToLobby');
  await sleep(100);

  expect(gameState.gamePhase).toBe('playing');
  expect(gameState.run).toBeDefined();
  expect(gameState.run.id).toBe(runId);
  expect(gameState.run.status).toBe('playing');
  expect(gameState.enemies.length).toBe(enemiesBefore);
});
```

Also update the existing happy-path return-to-lobby tests so they first put the
run in a terminal state:

```js
gameState.run.status = 'victory';
socket1.emit('returnToLobby');
```

or drive the run to `runComplete`/`runFailed` through existing helpers.

## Acceptance Criteria

- `returnToLobby` no longer resets `gameState` while the current run is still
  active.
- Returning to lobby still works after `runComplete` and after `runFailed`.
- Existing second-run and reward-persistence behavior still works after a
  terminal run.
- Add or update an integration test that reproduces the underlying active-run
  reset bug and proves it is fixed.
- `npm test -- --coverage.enabled=false` passes.
