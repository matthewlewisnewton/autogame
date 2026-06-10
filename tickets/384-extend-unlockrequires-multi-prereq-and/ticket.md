# 384-extend-unlockrequires-multi-prereq-and

## Difficulty: medium

## Goal

Extend the quest unlock schema to support MULTIPLE prerequisites (AND logic). Today unlockRequires is a single {questId,tier}; each tier-2 requires only its own tier-1. Extend unlockRequires to accept an ARRAY of {questId,tier} requirements (all must be completed = AND), and update isQuestTierUnlocked (game/server/users.js) + the quest payload (getUnlockedQuestTiers / buildQuestUpdatePayload) to evaluate and expose multi-prereq unlocks. Backward compatible with the existing single-object form. This enables gating levels behind completing level-2 of a COMBINATION of other stages. SCOPE: game/server/quests.js + game/server/users.js + game/server + test.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
