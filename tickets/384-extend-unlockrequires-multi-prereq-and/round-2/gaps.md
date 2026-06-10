1. Multi-prereq unlocks cannot require completion of tier-2 stages through normal gameplay.
   Files: game/server/users.js, game/server/progression.js, game/server/quests.js, game/server/test/unlock_prereqs.test.js
   Fix: Persist explicit quest-tier completion, or otherwise record tier-2 victories, then make `hasCompletedQuestTier()` / `isQuestTierUnlocked()` satisfy `{ questId, tier: 2 }` prerequisites after real tier-2 clears and add a normal-flow AND-prereq test.
