# 386-boss-level-riftbound-colossus-gated-ice2-fire2

## Difficulty: hard

## Goal

Add a BOSS LEVEL (dedicated boss arena) gated behind completing BOTH Ice-2 AND Fire-2 (unlockRequires array: frost_crossing tier2 AND ember_descent tier2). Thematic ice+fire convergence boss: the Riftbound Colossus. Should be HARDER overall than the standard levels. Uses the boss-level framework (385). Shows on the level map. DEPENDS ON 385 + 382 + 383. SCOPE: game/server/quests.js (boss level + multi-prereq unlock) + game/server (boss enemy + arena) + game/client + test.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
