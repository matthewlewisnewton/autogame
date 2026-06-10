# 07 — Persist tier-2 quest completion for multi-prereq AND gating

`hasCompletedQuestTier` currently infers tier *N* completion only when tier *N+1* is unlocked. That works for tier-1 prerequisites (tier-1 victory unlocks tier 2) but not for tier-2 prerequisites: catalog quests have no tier 3, and `checkRunTerminalState` never records tier-2 victories as completion evidence. Add explicit persisted completion tracking and wire tier-2 run victories into it so `{ questId, tier: 2 }` prerequisites can be satisfied through normal gameplay.

## Acceptance Criteria

- User records persist a `completedQuestTiers` map (`questId` → sorted unique completed tier numbers). Legacy accounts without the field backfill to `{}` on load; invalid entries are dropped (mirror `backfillUnlockedQuestTiers` patterns).
- A new `completeQuestTier(accountId, questId, tier)` helper in `users.js` validates catalog ids, is idempotent, persists to disk, and is exported for tests.
- `hasCompletedQuestTier(accountId, questId, tier)` returns `true` when:
  - tier *N* completion is recorded in `completedQuestTiers`, **or**
  - the existing tier-*N+1* unlock inference applies (preserves tier-1 prereq behavior without requiring migration of existing accounts).
- `checkRunTerminalState` in `progression.js` calls `completeQuestTier` for every in-run player on **tier-2 victory** (`status === 'victory'` and `run.questTier === 2`). Tier-1 victories should continue to unlock tier 2 via the existing `unlockQuestTier(..., 2)` path; optionally also record tier-1 completion for consistency.
- After a real tier-2 victory (simulated via `checkRunTerminalState` on a tier-2 run, not `completeQuestTier` called directly in the test setup), `hasCompletedQuestTier(accountId, questId, 2)` is `true`.
- New normal-flow test in `unlock_prereqs.test.js`: fixture quest tier 2 requires AND of `{ questId: QUEST_A, tier: 2 }` and `{ questId: QUEST_B, tier: 2 }`. Drive tier-1 victories for A and B through `checkRunTerminalState`, then tier-2 victories for A and B the same way. Assert `isQuestTierUnlocked(accountId, fixtureId, 2)` becomes `true` without manually calling `unlockQuestTier` on the prerequisite quests to fake completion.
- Existing tier-1-only multi-prereq tests and `cd game && pnpm test:quick` continue to pass.

## Technical Specs

- **`game/server/users.js`**
  - Add `backfillCompletedQuestTiers(existing)` and apply it in `loadUsers` / `createUser` alongside `unlockedQuestTiers`.
  - Add `completeQuestTier(accountId, questId, tier)`; persist `user.completedQuestTiers`.
  - Update `hasCompletedQuestTier` to check `completedQuestTiers[questId]` first, then fall back to `unlockedTier > normalizedTier` inference.
  - Export `completeQuestTier`.
- **`game/server/progression.js`**
  - In `checkRunTerminalState`, after setting `status === 'victory'`, when `(_gameState.run.questTier ?? DEFAULT_QUEST_TIER) === 2`, call `completeQuestTier(player.accountId, questId, 2)` for each player with an `accountId` (import from `./users`).
  - Leave the existing tier-1 victory → `unlockQuestTier(..., 2)` block unchanged.
- **`game/server/test/unlock_prereqs.test.js`**
  - Extend `installMultiPrereqFixtureQuest` (or add a sibling fixture) so tier-2 `unlockRequires` is `[{ questId: QUEST_A, tier: 2 }, { questId: QUEST_B, tier: 2 }]`.
  - Add helper to run a minimal tier-*N* victory through `checkRunTerminalState` (same pattern as `quest_tier_gating.test.js`: zero enemies, objective counts met, `runSimulationInPrimaryLobby`).
  - Add the normal-flow AND-prereq integration test described above.
- **`game/server/test/quest_tier_unlock_persistence.test.js`** (if needed) — cover `completedQuestTiers` backfill and disk round-trip.

Do **not** change quest payload shape, client quest-board rendering, or sub-tickets 01–06 behavior beyond what this completion model requires.

## Verification: code
