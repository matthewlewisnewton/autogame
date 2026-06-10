1. Citadel Siege is not the hardest overall level: it spawns only a lone 420 HP boss, while existing Tier-II boss levels have comparable or higher boss HP plus 4-5 supports.
   Files: game/server/quests.js, game/server/simulation.js, game/server/test/citadel_siege.test.js, game/server/test/citadel_sovereign_enemy.test.js
   Fix: Retune the capstone so its total encounter pressure clearly exceeds arena_trials/spire_ascent/frost_crossing Tier-II, then add a regression test comparing total capstone difficulty, not only attackDamage.
