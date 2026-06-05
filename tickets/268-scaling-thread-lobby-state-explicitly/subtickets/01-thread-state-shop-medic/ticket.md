# Thread explicit lobby state through shop & medic services

Migrate the lobby-phase shop and medic helpers in `progression.js` to take an
explicit `state` argument instead of reading the module-level `_gameState`
global, and pass the lobby state from the socket handlers that invoke them.
Behaviour must be identical; the suite stays green.

## Acceptance Criteria

- `refreshShopOffer`, `ensureShopOffer`, and `healAtMedic` accept an explicit
  game-state argument and use it internally instead of the module-level
  `_gameState` for every read/write they currently do against it.
- The argument is a **trailing optional parameter that defaults to the current
  module global** (e.g. `state = _gameState`), so existing direct callers and
  unit tests that call `healAtMedic('p1')` / `ensureShopOffer()` /
  `refreshShopOffer()` with no state argument keep working unchanged.
- `ensureShopOffer(state)` forwards that same `state` into its internal
  `refreshShopOffer(...)` call (no implicit fallback to the global once a state
  was passed).
- The socket-handler call sites that already have an explicit lobby `state` in
  scope pass it through: `medicHeal` handler → `healAtMedic(socket.playerId, state)`,
  and the `withLobbyContext(lobby, () => ensureShopOffer())` site passes the
  lobby's state. Startup / module-singleton call sites may remain unchanged
  (they correctly default to the global).
- Internal `progression.js` callers (e.g. inside `suspendRunToLobby`,
  `abandonSuspendedRun`, `returnPlayersToLobby`, `giveUpRun`) may keep calling
  the migrated helpers with no explicit arg — they still operate on the
  context-swapped global and behaviour is unchanged.
- `cd game && pnpm test:quick` passes; no behavioural diffs.

## Technical Specs

- `game/server/progression.js`:
  - `refreshShopOffer()` (~L352): add trailing `state = _gameState`; replace the
    `_gameState.shopOffer` reads/writes with `state.shopOffer`; the guard
    `if (!_gameState) return null;` becomes `if (!state) return null;`.
  - `ensureShopOffer()` (~L374): add trailing `state = _gameState`; use
    `state.shopOffer`; call `refreshShopOffer(state)`.
  - `healAtMedic(playerId)` (~L392): add trailing `state = _gameState`; replace
    every `_gameState` read (`isLobbyPhase(_gameState)`, `_gameState.players`)
    with `state`.
- `game/server/index.js`:
  - `medicHeal` handler (~L1693-1698): pass the handler's `state` →
    `healAtMedic(socket.playerId, state)`.
  - `withLobbyContext(lobby, () => ensureShopOffer())` (~L816): pass the lobby
    state → `ensureShopOffer(lobby.state)`.
- Do NOT change `buyShopCard`, `pickShopOffer`, `isValidShopOffer`, or
  `revivePlayerInLobby` — they do not read the global and are out of scope.

## Verification: code
