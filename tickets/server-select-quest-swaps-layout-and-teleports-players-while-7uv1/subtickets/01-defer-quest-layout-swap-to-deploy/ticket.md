# Defer quest layout swap + spawn teleport from SELECT_QUEST to deploy

Selecting a quest in the lobby currently swaps the lobby's live layout to the
quest dungeon and immediately teleports every player to the quest spawn, which
soft-freezes them (WASD does nothing, booths go dead) while the client still
renders the hub. Make `SELECT_QUEST` only record `selectedQuestId`/
`selectedQuestTier` and emit a non-destructive layout *preview*; perform the
real layout swap and spawn assignment at run start (deploy) instead.

## Acceptance Criteria

- The `SELECT_QUEST` handler in `game/server/socketHandlers/lobbyHandlers.js`
  **no longer calls `assignRunSpawnPositions(...)`** — selecting a quest never
  mutates any player's `x`/`y`/`z`.
- The `SELECT_QUEST` handler **no longer mutates the live lobby state's active
  layout** when previewing a quest: it does not assign `state.layout`,
  `state.dungeonBounds`, or `state.walkableAABBs`, and does not rebuild wall
  colliders. (i.e. it no longer calls `applyLayoutForQuest(state, ...)`.)
- `SELECT_QUEST` still records `state.selectedQuestId` and
  `state.selectedQuestTier`, and still emits a quest payload that includes a
  `layout` and `layoutSeed` for the selected quest+tier so the client can cache
  the preview for deploy (the client's `applyQuestLayoutFromServer` reads
  `data.layout`/`data.layoutSeed`). The emitted preview is deterministic for a
  given questId+tier (same seed the run will use).
- After `SELECT_QUEST`, a player in the lobby can still move on the hub
  (movement is validated against `HUB_LAYOUT`) and still interact with hub
  booths — no freeze, no out-of-range booth failures.
- The fresh-deploy path in `checkAllReadyInner` (`game/server/progression.js`)
  applies the selected quest's layout into `state.layout` (regenerating
  `dungeonBounds`/`walkableAABBs` and rebuilding colliders) **before** calling
  `assignRunSpawnPositions(all)`, so the run still spawns players into the
  correct quest dungeon. This must NOT run on the suspended-checkpoint resume
  path (that path restores the saved checkpoint layout and returns early).
- Validation guards in `SELECT_QUEST` (missing questId, `isValidQuestSelection`,
  tier-lock, suspended-checkpoint) are unchanged.
- A server test asserts that emitting `SELECT_QUEST` for a non-default quest
  from a lobby leaves every player's position unchanged (no teleport) and sets
  `selectedQuestId`/`selectedQuestTier`, and that a subsequent deploy
  (all-ready) produces the selected quest's layout with players at run spawn.
- `pnpm test` (server + client vitest) passes from `game/`.

## Technical Specs

- `game/server/socketHandlers/lobbyHandlers.js` — in the
  `CLIENT_TO_SERVER.SELECT_QUEST` handler (~lines 126-164): after the existing
  validation, set `state.selectedQuestId = questId` and
  `state.selectedQuestTier = tier`, then remove the
  `applyLayoutForQuest(state, questId, tier)` and
  `assignRunSpawnPositions(Object.values(state.players))` calls. Replace the
  layout mutation with a non-destructive preview: compute `{ layout, layoutSeed }`
  for `questId`/`tier` without touching live `state`, and pass them as the
  `extraFields` to `emitQuestPayloadToLobby(lobby, { extraFields: { layoutSeed, layout } })`.
  Drop the now-unused `assignRunSpawnPositions` import if nothing else uses it.
  The `STATE_UPDATE`/`broadcastLobbyUpdate` emits may stay or be dropped — but
  must not broadcast teleported positions (there is no teleport anymore).
- Preview helper: add a non-mutating helper in `game/server/index.js` (next to
  `applyLayoutForQuest`, ~line 411) that returns `{ layoutSeed, layout }` for a
  questId+tier using the same `questLayoutSeed` + `getLayoutProfileForQuest` +
  `generateLayout` + `getLayoutGenerationOptions` inputs as `applyLayoutForQuest`,
  but assigns nothing to `state`. Expose it to the handler via the `ctx` object
  (built ~line 1670) — add e.g. `previewLayoutForQuest` alongside
  `applyLayoutForQuest`.
- `game/server/progression.js` — add a settable callback (mirror the existing
  `setRebuildWallColliders`/`_rebuildWallColliders` pattern around lines
  132/212), e.g. `let _applyLayoutForQuest = () => {}` + `setApplyLayoutForQuest(fn)`,
  exported in `module.exports`. In `checkAllReadyInner` (the fresh-deploy branch,
  after the `suspendedCheckpoint` early-return at ~line 3570 and after
  `setGamePhase(_gameState, PHASES.PLAYING)` ~line 3575, **before**
  `assignRunSpawnPositions(all)` ~line 3577), call
  `_applyLayoutForQuest(_gameState, _gameState.selectedQuestId || DEFAULT_QUEST_ID, _gameState.selectedQuestTier ?? DEFAULT_QUEST_TIER)`.
- `game/server/index.js` — wire the new callback once at startup near the other
  progression wiring (e.g. after `progression.setRebuildWallColliders(...)`,
  ~line 390): `progression.setApplyLayoutForQuest((state, questId, tier) => applyLayoutForQuest(state, questId, tier))`.
- Note `CREATE_LOBBY` already calls `applyLayoutForQuest` (and does NOT call
  `assignRunSpawnPositions`), so default-quest deploy keeps working; do not
  change `CREATE_LOBBY`.
- Add/extend a server vitest (e.g. under `game/server/test/` near existing
  lobby/quest handler tests) covering the no-teleport-on-select and
  layout-applied-on-deploy assertions.

## Verification: code
