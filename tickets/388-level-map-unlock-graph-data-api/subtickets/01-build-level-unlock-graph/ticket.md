# Build the level unlock-graph data builder

Add a `buildLevelUnlockGraph(accountId)` function to `game/server/quests.js` that
returns the full level-select unlock graph: one node per quest tier (tier-1,
tier-2, and stage-boss tiers alike), each carrying its normalized
`unlockRequires` prerequisite array (from ticket 384) and the player's
locked/unlocked/cleared state for that tier.

## Acceptance Criteria

- `buildLevelUnlockGraph(accountId)` is exported from `game/server/quests.js`.
- It returns an object `{ nodes: [...] }` with exactly one node for EVERY quest
  tier present in `QUEST_DEFS` (every tier of every quest, including tier-2 and
  stage-boss tiers) — i.e. node count equals the number of entries
  `listQuestVariants()` produces.
- Each node contains at minimum: `questId`, `tier`, `name`, `objectiveType`,
  `isBoss` (true when the tier's `objectiveType === 'stage_boss'`),
  `unlockRequires` (the normalized prerequisite array via
  `normalizeUnlockRequires`, or `null` when the tier has none), and `state`.
- `state` is exactly one of the strings `'locked'`, `'unlocked'`, or `'cleared'`,
  computed from `game/server/users.js`: `'cleared'` when
  `hasCompletedQuestTier(accountId, questId, tier)`; else `'unlocked'` when
  `isQuestTierUnlocked(accountId, questId, tier)`; else `'locked'`.
- When `accountId` is falsy/unknown, every tier-1 node is `'unlocked'`, every
  higher tier is `'locked'`, and no node is `'cleared'` (no crash).
- The `unlockRequires` array on each node lists each prerequisite as
  `{ questId, tier }`, matching the authored prereqs (single authored prereqs
  appear as a one-element array).

## Technical Specs

- Edit `game/server/quests.js`:
  - Add `buildLevelUnlockGraph(accountId)`. Iterate quest tiers the same way
    `listQuestVariants()` does (`Object.keys(QUEST_DEFS)` → sorted tier keys →
    `getQuest`). For each tier build the node fields above.
  - Resolve `unlockRequires` via the existing `normalizeUnlockRequires` on the
    resolved tier's `unlockRequires`.
  - Lazily `require('./users')` inside the function (mirror the existing
    `listQuestVariantsForAccount` / `buildQuestUpdatePayload` pattern that does
    `require('./users')` at call time to avoid a circular import) and use
    `isQuestTierUnlocked` + `hasCompletedQuestTier` to derive `state`.
  - Export `buildLevelUnlockGraph` in `module.exports`.
- Add a test file `game/server/test/level_unlock_graph.test.js` covering: node
  count equals `listQuestVariants().length`; a known boss tier (e.g.
  `arena_trials` tier 2 or `frost_crossing` tier 1) has `isBoss: true` and the
  expected `unlockRequires`; the unauthenticated default states; and that after
  marking a tier cleared via `completeQuestTier`, the corresponding node reports
  `'cleared'` and the dependent tier becomes `'unlocked'`. Follow the existing
  `quest_tier_unlock_persistence.test.js` / `quest_tier_gating.test.js` setup for
  the users store (e.g. `setTestFilePath`).

## Verification: code
