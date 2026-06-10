# Citadel Siege boss-level quest and triple-prereq gating

Add the capstone boss-level quest `citadel_siege` (Tier 1) using the ticket-385 `boss_level` framework, gated behind **all three** harder stage Tier-II clears (`canyon_descent`, `spire_ascent`, `arena_trials`). Wire lobby copy, rewards, level-map graph node, and account/socket unlock enforcement.

## Acceptance Criteria

- `QUEST_DEFS.citadel_siege` exists with Tier 1 only and fields: `levelKind: 'boss_level'`, `layoutProfile: 'boss-arena'`, `objectiveType: 'stage_boss'`, `encounter: { bossType: 'citadel_sovereign', landmark: 'arena_dais', addCount: 0 }`.
- `unlockRequires` is an **array** of three entries: `{ questId: 'canyon_descent', tier: 2 }`, `{ questId: 'spire_ascent', tier: 2 }`, `{ questId: 'arena_trials', tier: 2 }` (normalized to that shape by `normalizeUnlockRequires`).
- `formatObjectiveSummary` / `listQuests()` expose **Defeat Citadel Sovereign** (via existing `levelKind === 'boss_level'` theme path — no new per-quest string branch).
- `buildLevelUnlockGraph()` emits a node for `citadel_siege:1` with `isBoss: true`, the triple `unlockRequires` array, and `state: 'locked'` for a fresh account.
- `isQuestTierUnlocked` returns `false` when only one or two of the three Tier-II prereqs are completed; returns `true` only when all three are completed.
- Socket `selectQuest` for `citadel_siege` Tier 1 emits `questError` with `reason: 'tier_locked'` until all prereqs are met; succeeds after all three Tier-II completions.
- Quest includes `client` briefing NPC copy, `dialogue` triggers (`run_start`, `objective_complete`), `rewardCurrency`, `signatureCardId`, and `rewardCards` appropriate to a capstone contract.
- `game/server/test/quests.test.js` quest-id list includes `citadel_siege`.
- `pnpm test:quick` passes.

## Technical Specs

- **`game/server/quests.js`** — Add `citadel_siege` quest block after existing boss-level quests (`vault_onslaught`). Use `enemyPool` pattern from `crucible_duel`. Suggested rewards: `rewardCurrency` ≥ 20, `signatureCardId` e.g. `gravity_well` or `chrono_trigger`, plus one complementary `rewardCards` entry.
- **`game/server/test/citadel_siege.test.js`** (new) — Catalog/metadata assertions (`isBossLevelQuest`, encounter config, objective summary, `listQuests` row). Level-unlock graph node shape. Multi-prereq gating via `users.completeQuestTier` permutations. Socket `selectQuest` lock/unlock flow (mirror `crucible_duel.test.js` unlock section).
- **`game/server/test/level_unlock_graph.test.js`** — Assert `citadel_siege:1` node exists with triple `unlockRequires` and locked baseline state for unknown accounts.
- **`game/server/test/quests.test.js`** — Add `citadel_siege` to registered quest id fixtures / variant count expectations.
- **`game/client/test/questBoard.test.js`** — Assert client `formatObjectiveSummary` returns `Defeat Citadel Sovereign` for a `citadel_siege` boss-level fixture payload.
- Depends on sub-ticket **01** (`citadel_sovereign` enemy type must exist for encounter `bossType`).

## Verification: code
