# 02 — Rift Convergence boss-level quest gated on Ice-2 AND Fire-2

Add the `rift_convergence` boss-level quest to the catalog: a dedicated boss-arena
contract against the Riftbound Colossus, unlocked only after completing BOTH
`frost_crossing` tier 2 AND `ember_descent` tier 2 (the first real multi-prereq
`unlockRequires` array from ticket 384). The quest appears automatically on the
level map with both prerequisite edges.

## Acceptance Criteria

- `QUEST_DEFS.rift_convergence` exists in `game/server/quests.js` with tier 1:
  - `name: 'Rift Convergence'`, `objectiveType: 'stage_boss'`, `levelKind: 'boss_level'`, `layoutProfile: 'boss-arena'`.
  - `unlockRequires` is an **array** with exactly two entries: `{ questId: 'frost_crossing', tier: 2 }` and `{ questId: 'ember_descent', tier: 2 }`.
  - `encounter: { bossType: 'riftbound_colossus', landmark: 'arena_dais', addCount: 4 }` — more adds than any other boss level (`crucible_duel` 0, `vault_onslaught` 2), so this is the hardest boss-level encounter.
  - A quest-level `enemyPool` containing ONLY ice and fire signature foes (e.g. `glacial_thrower` weight 2, `ember_wraith` weight 2) so the encounter adds embody the ice+fire convergence.
  - `rewardCurrency: 22` (above `crucible_duel`'s 18 — richest boss-level payout), `signatureCardId: 'glacier_collapse'`, `rewardCards: ['glacier_collapse', 'inferno_pillar']` (both exist in `shared/cardDefs.json`).
  - A `client` briefing (named NPC) and `dialogue` entries for at least `run_start` and `objective_complete`, written in the same voice as `crucible_duel`/`vault_onslaught`.
- Unlock gating works with AND semantics via the existing `isQuestTierUnlocked` path — a server test proves all four states for `rift_convergence` tier 1: locked with no prereqs completed; locked with only `frost_crossing` t2 completed; locked with only `ember_descent` t2 completed; unlocked once BOTH are completed (use `completeQuestTier` from `game/server/users.js` to set up).
- `buildLevelUnlockGraph` (in `game/server/quests.js`) includes a `rift_convergence` node with `isBoss` truthy and `unlockRequires` carrying BOTH prereq entries, and its `state` flips from `'locked'` to `'unlocked'` when both prereq tiers are completed — asserted in a server test (extend the pattern in `game/server/test/level_unlock_graph.test.js`).
- A spawn-pipeline server test asserts that starting a `rift_convergence` run spawns exactly one `riftbound_colossus` plus 4 adds, and every add's `type` is one of the quest's ice/fire pool types (pattern: `game/server/test/boss_level_spawn.test.js`).
- `cd game && pnpm test:quick` passes.

## Technical Specs

- `game/server/quests.js` — add the `rift_convergence` quest def after `vault_onslaught` (~line 650). No engine changes needed: multi-prereq array normalization (`normalizeUnlockRequires`, AND semantics in `areUnlockPrereqsMet`) shipped in ticket 384, the boss-level schema/spawn pipeline in ticket 385, and the level-map graph (`buildLevelUnlockGraph`) in ticket 388. The quest-select gate in `game/server/socketHandlers/lobbyHandlers.js` (~line 146) and `deckHandlers.js` already call `isQuestTierUnlocked`, so no handler changes.
- Depends on sub-ticket 01: `encounter.bossType` must already exist in `ENEMY_DEFS` (`spawnEnemy` throws on unknown types).
- Tests: new `game/server/test/rift_convergence.test.js` (def shape, gating, graph) — follow `game/server/test/unlock_prereqs.test.js` and `level_unlock_graph.test.js` for account/user setup helpers, and `boss_level_spawn.test.js` for run-start spawn assertions.
- The client level map (`game/client/levelMap.js`) is data-driven from the `levelUnlockGraph` payload — no client changes are needed or expected in this sub-ticket.

## Verification: code
