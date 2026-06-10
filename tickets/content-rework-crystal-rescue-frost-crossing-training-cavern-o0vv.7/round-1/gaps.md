1. `frost-crossing-frostmaw` does not spawn Rimecast: it clears only pre-existing dock enemies, then enters the ice room and leaves ice wave 0 alive instead of advancing to the named-rare wave.
   Files: `game/server/debugScenarios.js`
   Fix: After entering the ice room and calling `updateScriptedEncounters()`, kill/remove the spawned `band:ice` wave 0 enemies so scripted progression spawns wave 1, then assert/reposition near `Rimecast the Slow`.

2. `crystal-rescue-extraction-phase` does not preserve the real post-ambush objective counters: normal play reaches extraction with 9/9 enemies defeated, but the shortcut leaves guard-only 6/6 counters.
   Files: `game/server/debugScenarios.js`
   Fix: Include `countFinalAmbushEnemies(QUEST_DEFS.crystal_rescue.tiers[1])` or equivalent when setting `objective.totalEnemies`, then set `objective.defeatedEnemies` to that full post-ambush total.
