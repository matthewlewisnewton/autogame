# 174-gameplay-survive-objective

## Difficulty: medium

## Goal

Add a new 'survive' objective type: instead of clearing the fixed scattered enemies, the run spawns a set total number of enemies over the encounter including a set number of minibosses, and the objective completes when all have been defeated. Builds on the objective system in game/server/progression.js (createRunState / recordEnemyDefeated / isRunObjectiveComplete, ~1238-1519) which already branches on objectiveType (collect_items vs defeat_enemies); add a QUEST_DEF with objectiveType:'survive', totalSpawns and minibossCount in game/server/quests.js; reuse spawnCombatEnemies / pickEnemySpawnPosition (progression.js ~2629) for staggered spawns; add a HUD progress case in game/client/questBoard.js (already branches on objectiveType, lines 10/15).

## Acceptance Criteria

- Implements the Goal above; the change is scoped to it.
- Existing server + client tests pass; the game starts and loads cleanly.

## Verification

`Verification: visual`
