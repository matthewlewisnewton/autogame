# Expose the unlock graph in the quest update payload

Ship the level unlock graph to the client inside the existing per-player quest
update payload so the level-select map can render every node, its prerequisites,
and its locked/unlocked/cleared state from one payload.

## Acceptance Criteria

- `buildQuestUpdatePayload(gameState, playerAccountId)` in
  `game/server/quests.js` includes a `levelUnlockGraph` field whose value is the
  result of `buildLevelUnlockGraph(playerAccountId)` (the `{ nodes: [...] }`
  object from sub-ticket 01) whenever `playerAccountId` is provided.
- When `playerAccountId` is absent, `levelUnlockGraph` is omitted (or its nodes
  carry the unauthenticated default states), matching how `unlockedQuestTiers`
  is only attached for a known account today.
- The graph travels in the SAME payload object already emitted on `questUpdate`
  (no new socket event or HTTP endpoint is added) — i.e. the field is present on
  the object returned by `buildQuestUpdatePayload`, which `game/server/index.js`
  already spreads into its `questUpdate` emits.
- Each node in `levelUnlockGraph.nodes` retains the per-player `state` and
  normalized `unlockRequires` from sub-ticket 01.

## Technical Specs

- Edit `game/server/quests.js`:
  - In `buildQuestUpdatePayload`, inside the existing `if (playerAccountId)`
    block (which already sets `unlockedQuestTiers` and the per-account
    `questVariants`), add `payload.levelUnlockGraph = buildLevelUnlockGraph(playerAccountId);`.
  - Do NOT change the `index.js` emit sites — they already spread
    `buildQuestUpdatePayload(state, player.accountId)` into the `questUpdate`
    payload (see `game/server/index.js` around lines 677/703/724/1228).
- Add/extend a server test (e.g. `game/server/test/level_unlock_graph.test.js`
  from sub-ticket 01, or a new `quest_update_payload.test.js`): assert
  `buildQuestUpdatePayload(state, accountId)` returns an object with a
  `levelUnlockGraph.nodes` array of the expected length and per-node `state` /
  `unlockRequires`, and that calling it WITHOUT an accountId does not attach a
  populated per-player graph.

## Verification: code
