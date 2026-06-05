1. Account-specific Tier 2 unlock state is not propagated or enforced robustly across lobby clients.
   Files: game/server/index.js, game/server/progression.js, game/server/quests.js, game/client/main.js
   Fix: send per-account quest unlock payloads to each socket after Tier 1 victory/return-to-lobby and avoid broadcasting one player's `unlockedQuestTiers` to the whole room; also validate Tier 2 run readiness/deploy against every participating account, not only the selecting socket.
