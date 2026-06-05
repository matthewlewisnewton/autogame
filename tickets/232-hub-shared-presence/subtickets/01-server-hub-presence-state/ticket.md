# Server hub presence state on the lobby object

Add a per-lobby `hubPresence` store (on the lobby registry object, not module
globals) that holds lobby-phase player positions and cosmetics in a shape ready
for future interest-management culling. Provide sync helpers that mirror
`lobby.state.players` while `gamePhase === 'lobby'`.

## Acceptance Criteria

- Each lobby instance created in `lobbies.js` owns a `hubPresence` object
  (not a module-level map keyed by lobby id).
- `hubPresence` uses a player-id-keyed `entries` map (or equivalent) where each
  entry includes at minimum: `id`, `x`, `y`, `z`, `rotation`, `cosmetic`,
  `username`, and `connected`.
- A `syncHubPresenceFromLobby(lobby)` helper rebuilds `hubPresence.entries`
  from connected lobby-phase players in `lobby.state.players` (skip players with
  `connected === false` unless you intentionally keep ghosts — document the
  choice in code; default: only `connected !== false`).
- Sync runs after lobby-phase movement integration (`applyPlayerMovement` with
  `HUB_LAYOUT`) so positions reflect the latest tick.
- Cosmetic on each entry matches the player's in-memory `cosmetic` (with
  `backfillCosmetic` defaults when missing).
- Vitest unit tests cover: empty lobby, two players after sync, cosmetic
  backfill, and that sync updates coordinates when a player moves in lobby
  phase.

## Technical Specs

- `game/server/lobbies.js` — initialize `hubPresence` on lobby creation
  (`createLobby` / `createLobbyGameState` path) with a stable empty shape, e.g.
  `{ schemaVersion: 1, entries: {} }`.
- `game/server/hubPresence.js` (new) — export:
  - `createEmptyHubPresence()`
  - `buildHubPresenceEntry(player)` — slim entry from a player record
  - `syncHubPresenceFromLobby(lobby)` — writes `lobby.hubPresence.entries`
  - `getHubPresenceSnapshot(lobby)` — returns a JSON-safe clone for emit/tests
- `game/server/index.js` — call `syncHubPresenceFromLobby(lobby)` inside
  `runGameLoopTick` after `applyPlayerMovement` when `isLobbyPhase(state)` (same
  block that already uses `buildHubMovementContext(HUB_LAYOUT)`).
- Reuse `DEFAULT_COSMETIC` / `backfillCosmetic` from `game/server/cosmetic.js`;
  do not duplicate cosmetic defaults.
- `game/server/test/hub_presence.test.js` (new) — unit tests for sync and entry
  shape; use `createLobby` + manual player records or existing test helpers.

## Verification: code
