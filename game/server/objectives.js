/**
 * Objective type registry. To add a fourth (or later) objective kind, append one
 * entry to OBJECTIVE_DEFS with objectiveType, createObjective, isComplete, and
 * any optional hooks (skipBulkCombatSpawn, spawnQuestEntities, tickSpawns, …).
 * Quests reference the type via quest.objectiveType in quests.js; progression
 * dispatches through getObjectiveDef — no type switches elsewhere.
 */
const { getEnemyPool, pickWeightedEnemyType } = require('./quests');

function clampDefeatedEnemies(objective) {
  objective.defeatedEnemies = Math.min(objective.defeatedEnemies, objective.totalEnemies);
}

function clampCollectedItems(objective) {
  objective.collectedItems = Math.min(objective.collectedItems, objective.totalItems);
}

// Interval (ms) between staggered survive spawns. The first enemy spawns on the
// first tick the run is playing; each subsequent enemy waits this long.
const SURVIVE_SPAWN_INTERVAL_MS = 3000;

// Regular (non-miniboss) enemy types used by the staggered survive spawner,
// cycled in order for the non-miniboss portion of the wave.
const SURVIVE_REGULAR_TYPES = ['grunt', 'skirmisher'];

const OBJECTIVE_DEFS = {
  defeat_enemies: {
    objectiveType: 'defeat_enemies',
    skipBulkCombatSpawn() {
      return false;
    },
    preferNearestEnemySpawns() {
      return false;
    },
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
    skipBulkCombatSpawn() {
      return false;
    },
    preferNearestEnemySpawns() {
      return true;
    },
    spawnQuestEntities(layout, rng, quest, _gameState, ctx) {
      const crystalCount = Number.isFinite(quest.itemCount) ? quest.itemCount : 1;
      ctx.spawnCrystals(layout, rng, crystalCount);
    },
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
    skipBulkCombatSpawn() {
      return true;
    },
    preferNearestEnemySpawns() {
      return false;
    },
    tickSpawns(now, gameState, ctx) {
      const run = gameState.run;
      if (!run || run.status !== 'playing' || gameState.gamePhase !== 'playing') return;

      const objective = run.objective;
      if (!objective || objective.type !== 'survive') return;

      const total = objective.totalSpawns;
      if (!(objective.spawnedEnemies < total)) return;

      // Throttle on a stored timestamp; the very first spawn fires immediately.
      const last = Number.isFinite(objective.lastSpawnAt) ? objective.lastSpawnAt : 0;
      if (last !== 0 && now - last < SURVIVE_SPAWN_INTERVAL_MS) return;

      const layout = gameState.layout;
      const seed = gameState.layoutSeed || 42;
      const index = objective.spawnedEnemies;
      // Seed per spawn so placement is deterministic for a given seed/index.
      const rng = ctx.mulberry32(seed + 2000 + index);

      const minibossCount = Number.isFinite(objective.minibossCount) ? objective.minibossCount : 0;
      // The final `minibossCount` spawns of the wave are minibosses.
      const isMiniboss = index >= total - minibossCount;
      // Draw the regular (non-miniboss) type from the quest's pool (minus
      // `miniboss`, which is governed by `minibossCount`). Fall back to the
      // legacy cycle if the filtered pool is empty.
      const regularPool = Array.isArray(objective.enemyPool)
        ? objective.enemyPool.filter((entry) => entry.type !== 'miniboss')
        : [];
      const type = isMiniboss
        ? 'miniboss'
        : (regularPool.length > 0
          ? pickWeightedEnemyType(regularPool, rng)
          : SURVIVE_REGULAR_TYPES[index % SURVIVE_REGULAR_TYPES.length]);

      const pos = ctx.pickEnemySpawnPosition(layout, rng, false, index, total);
      const enemy = ctx.spawnEnemy(pos.x, pos.z, type, undefined, {
        tier: ctx.roomTierAt(layout, pos.x, pos.z),
        rng,
      });
      enemy.wanderTarget = ctx.randomWanderTarget();

      objective.spawnedEnemies += 1;
      objective.lastSpawnAt = now;
    },
    createObjective(quest) {
      const totalSpawns = Number.isFinite(quest.totalSpawns) ? quest.totalSpawns : 1;
      const minibossCount = Number.isFinite(quest.minibossCount) ? quest.minibossCount : 0;
      return {
        type: 'survive',
        label: `${quest.name}: outlast and defeat all ${totalSpawns} attackers`,
        totalSpawns,
        minibossCount,
        // Snapshot the quest's pool so staggered regular spawns draw from it.
        enemyPool: getEnemyPool(quest.id),
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
  SURVIVE_SPAWN_INTERVAL_MS,
  SURVIVE_REGULAR_TYPES,
  isValidObjectiveType,
  getObjectiveDef,
};
