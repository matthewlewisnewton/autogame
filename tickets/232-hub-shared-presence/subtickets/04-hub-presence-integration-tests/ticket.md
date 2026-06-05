# Hub presence multiplayer integration tests

Add end-to-end server integration coverage proving shared hub presence works for multiple lobby members: cosmetics in the payload, live movement sync during the lobby phase, and correct join/leave roster updates. This sub-ticket is test-only glue on top of sub-tickets 01–03.

Depends on sub-tickets 01–03 (hub presence state, broadcast, and client render).

## Acceptance Criteria

- A new integration test file exercises two authenticated clients in the same lobby during `gamePhase === 'lobby'`.
- **Cosmetics:** after patching distinct cosmetics on two accounts before join, the `hubPresenceUpdate` payload received by each client includes both players' `cosmetic` objects matching their account config.
- **Live movement:** client A emits `move` with a positive `dx`; after a tick, client B's `hubPresenceUpdate` shows A's `x`/`z` changed from the hub spawn while B's own position is unchanged.
- **Join:** when B joins an lobby where A is already present, A receives a `hubPresenceUpdate` containing B before B moves.
- **Leave:** when B calls `leaveLobby`, A's next `hubPresenceUpdate` omits B's id.
- All new tests pass under `cd game && pnpm exec vitest run server/test/hub_presence_integration.test.js`.
- Existing hub/movement tests (`lobby_hub_movement.test.js`, `hub_presence_broadcast.test.js` from sub-ticket 02) still pass — no regressions to lobby-phase movement bounds.

## Technical Specs

- `game/server/test/hub_presence_integration.test.js` (new):
  - Reuse `startTestServer`, `closeServer`, `connectClient`, `waitForEvent`, and the HTTP cosmetic patch helper pattern from `cosmetic_runtime.test.js`.
  - `connectTwoClientsInLobby(baseUrl)` helper: create lobby with A, B joins same `lobbyId`, both wait for `hubPresenceUpdate` / `lobbyJoined`.
  - Scenarios listed in acceptance criteria; use `sleep` or `waitForEvent` after `move` emits to allow `runGameLoopTick` to integrate.
- `game/docs/lobbies.md` (optional, only if missing): add `hubPresenceUpdate` to the server→client events table with payload shape — skip if sub-ticket 02 already documented it.

## Verification: code
