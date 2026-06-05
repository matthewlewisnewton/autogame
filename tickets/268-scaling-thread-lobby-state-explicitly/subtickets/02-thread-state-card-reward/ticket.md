# Thread explicit lobby state through the card-reward claim flow

Migrate the end-of-run card-reward helpers `buildCardChoices` and
`claimCardReward` in `progression.js` to take an explicit `state` argument
instead of reading the module-level `_gameState`, and pass the lobby state from
the `claimCardReward` socket handler. Behaviour must be identical.

## Acceptance Criteria

- `buildCardChoices` and `claimCardReward` accept an explicit game-state
  argument and resolve the player via that argument's `players` map instead of
  `_gameState.players`.
- The argument is a **trailing optional parameter defaulting to the module
  global** (e.g. `state = _gameState`), so existing callers and unit tests that
  invoke them with no state argument keep working unchanged.
- The `claimCardReward` socket handler passes the explicit lobby `state` it
  already has in scope: `claimCardReward(socket.playerId, data.cardId, state)`.
- Any internal `progression.js` caller of `buildCardChoices` may continue to
  call it with no explicit arg (context-swapped global), behaviour unchanged.
- `cd game && pnpm test:quick` passes; no behavioural diffs.

## Technical Specs

- `game/server/progression.js`:
  - `buildCardChoices(playerId)` (~L1012): add trailing `state = _gameState`;
    replace `_gameState.players[playerId]` with `state.players[playerId]`.
  - `claimCardReward(playerId, cardId)` (~L1034): add trailing
    `state = _gameState`; replace `_gameState.players[playerId]` with
    `state.players[playerId]`. (The helper it calls, `grantCard(player, cardId)`,
    operates on the player object and needs no state arg.)
- `game/server/index.js`:
  - `claimCardReward` socket handler (~L1415-1422): the callback already binds
    `state`; change the call to `claimCardReward(socket.playerId, data.cardId, state)`.

## Verification: code
