# 03 — isQuestTierUnlocked prerequisite gating

Wire multi-prerequisite AND logic into `isQuestTierUnlocked` so tier ≥ 2 is available only when the account has a **persisted** unlock **and** every `unlockRequires` entry for that quest tier is completed. Existing single-object prerequisites must behave exactly as before.

## Acceptance Criteria

- `isQuestTierUnlocked(accountId, questId, tier)` in `game/server/users.js` loads the quest tier via `getQuest(questId, tier)` and calls `areUnlockPrereqsMet(accountId, quest.unlockRequires)` in addition to the existing persisted-unlock check.
- Tier 1 remains always unlocked for valid catalog quests.
- With only the persisted tier-2 unlock and **no** prerequisites completed, a tier that lists two tier-1 prereqs from different quests returns `false`.
- When the persisted tier-2 unlock exists **and** all listed prerequisites are completed, `isQuestTierUnlocked` returns `true`.
- `selectQuest` / `playerReady` paths that already call `isQuestTierUnlocked` (`lobbyHandlers.js`, `deckHandlers.js`, `progression.js`) reject locked tiers with `tier_locked` without further handler changes.
- Regression tests in `game/server/test/quest_tier_gating.test.js` still pass for the default single-prereq tier-2 quests.
- New cases in `game/server/test/unlock_prereqs.test.js` (or `quest_tier_gating.test.js`) cover multi-prereq AND gating via a temporary `QUEST_DEFS` fixture quest.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **`game/server/users.js`** — Extend `isQuestTierUnlocked`; import `getQuest` and reuse `areUnlockPrereqsMet` from sub-ticket 02.
- **`game/server/test/unlock_prereqs.test.js`** (and/or **`game/server/test/quest_tier_gating.test.js`**) — Inject a fixture quest into `QUEST_DEFS` with `unlockRequires: [{ questId: 'training_caverns', tier: 1 }, { questId: 'crystal_rescue', tier: 1 }]` on tier 2; assert `isQuestTierUnlocked` and socket `selectQuest` behavior.
- **`game/server/socketHandlers/lobbyHandlers.js`**, **`deckHandlers.js`**, **`progression.js`** — No logic changes expected if they already delegate to `isQuestTierUnlocked`; touch only if a direct bypass is found.

## Verification: code
