# Quest scripting foundation: data-driven hand-placed waves + room triggers (replaces random bulk spawn for scripted quests)

## Difficulty: hard

## Goal

PSO model: quest enemies are hand-placed and grouped into waves; waves are bound to rooms and fire on triggers (enter room / previous wave cleared). This is the foundation every other child of autogame-o0vv builds on.

DESIGN
Extend QUEST_DEFS tiers (game/server/quests.js) with an optional script block, e.g.:
  script: { waves: [ { id, room: {x,z} | landmark, trigger: 'enter_room' | { waveCleared: id } | 'run_start', spawns: [ { type, x, z } ] } ] }
When a tier defines script.waves, skip the existing weighted bulk combat spawn (objectives.js skipBulkCombatSpawn / spawn pipeline) and drive spawning from the script: arm wave triggers at run start, spawn each wave's entries at their authored positions when triggered, track wave-cleared state on the run object, expose wave progress in the state snapshot so the client/harness can see it. defeat_enemies totalEnemies should derive from the script when present.

Positions are authorable because layouts are deterministic per quest (questLayoutSeed); reuse the positional spawn path that debugScenarios.js already uses (spawnEnemy(x, z, type)).

ACCEPTANCE
- A quest tier with script.waves spawns exactly the authored enemies at authored positions; no random pool spawns.
- 'enter_room' wave does not exist until a player enters the trigger room; waveCleared chaining works.
- Existing non-scripted quests are unchanged (no script block -> current behavior).
- Unit test: scripted run completes when all waves die; snapshot exposes wave state.

NOTE: refs @ commit b4a5bb8; may have drifted.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
