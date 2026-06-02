1. Open-plaza enemy/loot/objective placement can choose positions inside solid cover when the single-room layout has no combat or treasure rooms.
   Files: game/server/progression.js, game/server/simulation.js, game/server/dungeon.js
   Fix: Add a seeded, cover-aware spawn-position helper for the open-plaza/no-role fallback that retries/rejects positions colliding with cover or walls, use it for enemy/objective/loot placement, and add an `arena_trials` test proving spawned entities are unblocked.
