1. `stage-boss-dormant` and `stage-boss-active` debug scenarios synthesize a Tier 1 stage-boss run instead of the real Arena Trials Tier 2 encounter state.
   Files: `game/server/debugScenarios.js`
   Fix: Change both scenarios to select/unlock `arena_trials` Tier 2, apply the Tier 2 layout, let `enterPlayingPhase()`/`startDungeonRun()` build the real `stage_boss` run and encounter, then use normal trigger mechanics (`tryActivateEncounter` via proximity or add clearing) plus minimal positioning/HP setup for the shortcut.
