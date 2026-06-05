# Wire hub layout for lobby phase

While `gamePhase === 'lobby'`, each lobby's active geometry must be the ship-interior
`hub` profile (from ticket 229), not the selected quest's dungeon layout. Quest layouts
apply only when the squad deploys into a run. Add `applyHubLayout(state)` and call it
on every path that enters or restores lobby phase; call `applyLayoutForQuest` on deploy.

## Acceptance Criteria

- `applyHubLayout(state)` in `index.js` sets `state.layout` via `generateLayout(seed, 'hub')`,
  plus `layoutSeed`, `dungeonBounds`, and `walkableAABBs`, and rebuilds wall colliders
  inside `withLobbyContext`.
- Lobby creation (`createLobby`), run teardown (`returnPlayersToLobby`, `giveUpRun`,
  `abandonSuspendedRun`, `suspendRunToLobby`), and fresh lobby joins operate on a state
  whose `layout.profile === 'hub'`.
- `selectQuest` updates `selectedQuestId` / `selectedQuestTier` only — it does **not**
  call `applyLayoutForQuest` or reposition players while still in lobby phase.
- `checkAllReady` (fresh run, not suspended checkpoint restore) calls
  `applyLayoutForQuest(state, …)` before `assignRunSpawnPositions`, so deployed runs
  use the quest dungeon layout.
- Suspended-checkpoint resume continues to restore the saved dungeon layout unchanged.
- `questUpdate` / `lobbyJoined` payloads still include `layout` + `layoutSeed` reflecting
  the hub layout during lobby.
- New or updated server unit tests assert hub profile on lobby state and quest profile
  after a simulated deploy path.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- `game/server/index.js`:
  - Add `HUB_LAYOUT_SEED` constant (fixed integer, e.g. `0`) and `applyHubLayout(state)`
    mirroring `applyLayoutForQuest` but using profile `'hub'`.
  - `createLobby` handler: replace `applyLayoutForQuest` with `applyHubLayout`.
  - Export `applyHubLayout` for tests if needed.
- `game/server/progression.js`:
  - `checkAllReady`: before `assignRunSpawnPositions` on a non-checkpoint deploy, call
    `applyLayoutForQuest` (import/inject from index or pass via existing debug callback
    pattern — follow how `applyLayoutForQuest` is already referenced from progression).
  - `suspendRunToLobby`, `returnPlayersToLobby`, `giveUpRun`, `abandonSuspendedRun`:
    call `applyHubLayout(state)` after phase returns to lobby (before repositioning
    players at `firstRoomPosition()`).
  - Remove `applyLayoutForQuest` + `assignRunSpawnPositions` from the `selectQuest`
    handler path in `index.js` (quest selection is metadata-only in lobby).
- `game/server/test/` — add `hubLobbyLayout.test.js` (or extend `lobbies.test.js`):
  - lobby create → `state.layout.profile === 'hub'`.
  - simulate ready/deploy → `state.layout.profile !== 'hub'` (matches quest profile).
  - `selectQuest` does not change `layoutSeed` while in lobby.

## Verification: code
