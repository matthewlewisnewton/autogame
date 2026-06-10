# 385-boss-level-framework

## Difficulty: hard

## Goal

Add a BOSS LEVEL type: a dedicated level whose entire content is a single BOSS fight (per owner terminology: a BOSS is an enemy that has its OWN level, as opposed to a MINIBOSS which is an in-level encounter). A boss level is a quest/level with a compact arena layout containing just the boss (no normal room-clearing waves, optional minimal adds), using the encounter framework for activation/defeat, with victory on boss defeat. Make it a reusable type so multiple boss levels can be defined. DEPENDS ON 384. SCOPE: game/server/quests.js (boss-level kind) + game/server (arena layout + encounter) + game/client + test.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
