function clampDefeatedEnemies(objective) {
  objective.defeatedEnemies = Math.min(objective.defeatedEnemies, objective.totalEnemies);
}

function clampCollectedItems(objective) {
  objective.collectedItems = Math.min(objective.collectedItems, objective.totalItems);
}

const OBJECTIVE_DEFS = {
  defeat_enemies: {
    objectiveType: 'defeat_enemies',
    createObjective(quest, ctx) {
      const objectiveLabel = `${quest.name}: ${quest.description}`;
      return {
        type: 'defeat_enemies',
        label: objectiveLabel,
        totalEnemies: ctx.enemyCount,
        defeatedEnemies: 0,
      };
    },
    isComplete(objective) {
      return objective.defeatedEnemies >= objective.totalEnemies;
    },
    clampProgress(run) {
      clampDefeatedEnemies(run.objective);
    },
    onEnemyDefeated(run, count) {
      run.objective.defeatedEnemies += count;
      clampDefeatedEnemies(run.objective);
    },
    syncToEnemyCount(run, enemyCount) {
      run.objective.totalEnemies = enemyCount;
      clampDefeatedEnemies(run.objective);
    },
  },
  collect_items: {
    objectiveType: 'collect_items',
    createObjective(quest) {
      const totalItems = Number.isFinite(quest.itemCount) ? quest.itemCount : 1;
      return {
        type: 'collect_items',
        label: `${quest.name}: recover ${totalItems} prisms`,
        totalItems,
        collectedItems: 0,
      };
    },
    isComplete(objective) {
      return objective.collectedItems >= objective.totalItems;
    },
    clampProgress(run) {
      clampCollectedItems(run.objective);
    },
    onCrystalCollected(run, count) {
      run.objective.collectedItems += count;
      clampCollectedItems(run.objective);
    },
  },
  survive: {
    objectiveType: 'survive',
    createObjective(quest) {
      const totalSpawns = Number.isFinite(quest.totalSpawns) ? quest.totalSpawns : 1;
      const minibossCount = Number.isFinite(quest.minibossCount) ? quest.minibossCount : 0;
      return {
        type: 'survive',
        label: `${quest.name}: outlast and defeat all ${totalSpawns} attackers`,
        totalSpawns,
        minibossCount,
        spawnedEnemies: 0,
        defeatedEnemies: 0,
        totalEnemies: totalSpawns,
      };
    },
    isComplete(objective) {
      return objective.defeatedEnemies >= objective.totalSpawns;
    },
    clampProgress(run) {
      clampDefeatedEnemies(run.objective);
    },
    onEnemyDefeated(run, count) {
      run.objective.defeatedEnemies += count;
      clampDefeatedEnemies(run.objective);
    },
  },
};

function isValidObjectiveType(type) {
  return typeof type === 'string' && Object.prototype.hasOwnProperty.call(OBJECTIVE_DEFS, type);
}

function getObjectiveDef(objectiveType) {
  return isValidObjectiveType(objectiveType) ? OBJECTIVE_DEFS[objectiveType] : null;
}

module.exports = {
  OBJECTIVE_DEFS,
  isValidObjectiveType,
  getObjectiveDef,
};
