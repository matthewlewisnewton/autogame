# 226-data-objective-registry

## Difficulty: medium

## Goal

createRunState (game/server/progression.js:1191-1253) builds 3 different objective literal shapes by if(quest.objectiveType===...); fields like spawnedEnemies/lastSpawnAt/minibossCount exist only on the survive shape, collectedItems only on collect_items. Consumers read them defensively scattered across the file (Number.isFinite(objective.lastSpawnAt)?...:0). A 4th objective type means editing this function plus every reader.

## Acceptance Criteria

- 1. Add an objective registry keyed by objectiveType, each entry with createObjective(quest) (the fields it owns) and isComplete(objective) (unify isRunObjectiveComplete at L1513-1522). 2. New objective types become one registry entry, not scattered ifs. 3. Cover with existing quest/integration tests before+after.

## Verification

SIMPLICITY (reduces correctness foot-guns). Medium risk: central to run-completion logic. Model on the clean QUEST_DEFS registry in quests.js.
