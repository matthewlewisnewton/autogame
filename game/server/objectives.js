/**
 * Objective type registry. Registered kinds: defeat_enemies, collect_items,
 * survive, stage_boss, escort. To add another objective kind, append one entry
 * to OBJECTIVE_DEFS with objectiveType, createObjective, isComplete, and any
 * optional hooks (skipBulkCombatSpawn, spawnQuestEntities, tickSpawns, …).
 * Quests reference the type via quest.objectiveType in quests.js; progression
 * dispatches through getObjectiveDef — no type switches elsewhere.
 */
const {
  getEnemyPool,
  getEncounterConfig,
  getQuestScript,
  countScriptedEnemies,
  pickWeightedEnemyType,
} = require('./quests');
const { isScriptedQuest, countAuthoredScriptedEnemies } = require('./scriptedEncounters');
const { formatEscortDestinationLabel } = require('./escort');
const { setEncounterBoss } = require('./encounters');
const { DIFFICULTY_SPAWN_RATE_PER_PLAYER, difficultyScaleFactor, runPlayerCount } = require('./config');

function clampDefeatedEnemies(objective) {
  objective.defeatedEnemies = Math.min(objective.defeatedEnemies, objective.totalEnemies);
}

function clampCollectedItems(objective) {
  objective.collectedItems = Math.min(objective.collectedItems, objective.totalItems);
}

function countLiveNonSpawnerEnemies(enemies) {
  return (enemies || []).filter((enemy) => enemy.hp > 0 && !enemy.spawnedBy).length;
}

function syncScriptedDefeatEnemiesActiveCount(run, enemies) {
  if (!run?.scriptedEncounter || run.objective?.type !== 'defeat_enemies') return;
  run.objective.activeEnemyCount = countLiveNonSpawnerEnemies(enemies);
}

// Interval (ms) between staggered survive spawns. The first enemy spawns on the
// first tick the run is playing; each subsequent enemy waits this long.
const SURVIVE_SPAWN_INTERVAL_MS = 3000;

// Regular (non-miniboss) enemy types used by the staggered survive spawner,
// cycled in order for the non-miniboss portion of the wave.
const SURVIVE_REGULAR_TYPES = ['grunt', 'skirmisher'];

function resolveStageBossSpawnPosition(layout, encounterConfig) {
  const landmarkType = encounterConfig?.landmark;
  if (landmarkType && Array.isArray(layout?.landmarks)) {
    const match = layout.landmarks.find((lm) => lm.type === landmarkType);
    if (match && Number.isFinite(match.x) && Number.isFinite(match.z)) {
      return { x: match.x, z: match.z };
    }
  }
  const startRoom = layout?.rooms?.find((r) => r.role === 'start') || layout?.rooms?.[0];
  if (startRoom && Number.isFinite(startRoom.x) && Number.isFinite(startRoom.z)) {
    return { x: startRoom.x, z: startRoom.z };
  }
  return { x: 0, z: 0 };
}

function wireEncounterBoss(gameState, bossEnemyId) {
  if (!bossEnemyId || !gameState) return;
  if (gameState.run?.encounter) {
    setEncounterBoss(gameState.run, bossEnemyId);
  } else {
    gameState._pendingEncounterBossId = bossEnemyId;
  }
}

const OBJECTIVE_DEFS = {
  defeat_enemies: {
    objectiveType: 'defeat_enemies',
    skipBulkCombatSpawn(quest) {
      return isScriptedQuest(quest) || getQuestScript(quest) != null;
    },
    preferNearestEnemySpawns() {
      return false;
    },
    createObjective(quest, ctx) {
      const objectiveLabel = `${quest.name}: ${quest.description}`;
      let totalEnemies = ctx.enemyCount;
      const script = getQuestScript(quest);
      if (script != null) {
        totalEnemies = countScriptedEnemies(script);
      } else if (isScriptedQuest(quest)) {
        totalEnemies = countAuthoredScriptedEnemies(quest);
      }
      const objective = {
        type: 'defeat_enemies',
        label: objectiveLabel,
        totalEnemies,
        defeatedEnemies: 0,
      };
      if (isScriptedQuest(quest)) {
        objective.activeEnemyCount = 0;
      }
      return objective;
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
    syncToEnemyCount(run, enemiesOrCount) {
      const enemies = Array.isArray(enemiesOrCount) ? enemiesOrCount : null;
      const enemyCount = enemies
        ? countLiveNonSpawnerEnemies(enemies)
        : enemiesOrCount;
      if (run.scriptedEncounter) {
        run.objective.activeEnemyCount = enemyCount;
        return;
      }
      run.objective.totalEnemies = enemyCount;
      clampDefeatedEnemies(run.objective);
    },
  },
  collect_items: {
    objectiveType: 'collect_items',
    skipBulkCombatSpawn(quest) {
      return isScriptedQuest(quest);
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
      const objective = {
        type: 'collect_items',
        label: `${quest.name}: recover ${totalItems} prisms`,
        totalItems,
        collectedItems: 0,
      };
      if (isScriptedQuest(quest)) {
        objective.totalEnemies = countAuthoredScriptedEnemies(quest);
        objective.defeatedEnemies = 0;
      }
      return objective;
    },
    isComplete(objective) {
      if (objective.collectedItems < objective.totalItems) return false;
      if (Number.isFinite(objective.totalEnemies)) {
        return objective.defeatedEnemies >= objective.totalEnemies;
      }
      return true;
    },
    clampProgress(run) {
      clampCollectedItems(run.objective);
      if (Number.isFinite(run.objective.totalEnemies)) {
        clampDefeatedEnemies(run.objective);
      }
    },
    onCrystalCollected(run, count) {
      run.objective.collectedItems += count;
      clampCollectedItems(run.objective);
    },
    onEnemyDefeated(run, count) {
      if (!Number.isFinite(run.objective.totalEnemies)) return;
      run.objective.defeatedEnemies += count;
      clampDefeatedEnemies(run.objective);
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
      // Scale the interval by the live player count: 1–4 players stay at the
      // baseline, while 5..16 players spawn faster. Re-read the count on every
      // tick so a mid-run JOIN shortens the interval and a LEAVE lengthens it.
      const scaleFactor = difficultyScaleFactor(runPlayerCount(gameState), DIFFICULTY_SPAWN_RATE_PER_PLAYER);
      const interval = SURVIVE_SPAWN_INTERVAL_MS / scaleFactor;
      const last = Number.isFinite(objective.lastSpawnAt) ? objective.lastSpawnAt : 0;
      if (last !== 0 && now - last < interval) return;

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
        enemyPool: getEnemyPool(quest.id, quest.tier),
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
  stage_boss: {
    objectiveType: 'stage_boss',
    skipBulkCombatSpawn() {
      return true;
    },
    preferNearestEnemySpawns() {
      return false;
    },
    spawnQuestEntities(layout, rng, quest, gameState, ctx) {
      const encounterConfig = getEncounterConfig(quest);
      if (!encounterConfig) return;

      const bossType = encounterConfig.bossType || 'miniboss';
      const addCount = Number.isFinite(encounterConfig.addCount) ? encounterConfig.addCount : 0;
      const bossPos = resolveStageBossSpawnPosition(layout, encounterConfig);

      const boss = ctx.spawnEnemy(bossPos.x, bossPos.z, bossType, undefined, {
        tier: ctx.roomTierAt(layout, bossPos.x, bossPos.z),
        rng,
      });
      boss.wanderTarget = ctx.randomWanderTarget();
      wireEncounterBoss(gameState, boss.id);

      const pool = getEnemyPool(quest.id, quest.tier).filter(
        (entry) => entry.type !== 'miniboss' && entry.type !== bossType,
      );
      const addPool = pool.length > 0
        ? pool
        : getEnemyPool(quest.id, quest.tier).filter((entry) => entry.type !== 'miniboss');

      for (let i = 0; i < addCount; i++) {
        const type = addPool.length > 0 ? pickWeightedEnemyType(addPool, rng) : 'grunt';
        const pos = ctx.pickEnemySpawnPosition(layout, rng, false, i, addCount);
        const add = ctx.spawnEnemy(pos.x, pos.z, type, undefined, {
          tier: ctx.roomTierAt(layout, pos.x, pos.z),
          rng,
        });
        add.wanderTarget = ctx.randomWanderTarget();
      }
    },
    createObjective(quest) {
      const encounterConfig = getEncounterConfig(quest);
      const addCount = Number.isFinite(encounterConfig?.addCount) ? encounterConfig.addCount : 0;
      return {
        type: 'stage_boss',
        label: `${quest.name}: defeat the stage warden`,
        bossDefeated: false,
        addCount,
        totalEnemies: addCount + 1,
        defeatedEnemies: 0,
      };
    },
    isComplete(objective, run) {
      if (run?.encounter?.phase === 'cleared') return true;
      if (objective.bossDefeated) return true;
      return false;
    },
    clampProgress(run) {
      clampDefeatedEnemies(run.objective);
    },
    onEnemyDefeated(run, count) {
      run.objective.defeatedEnemies += count;
      clampDefeatedEnemies(run.objective);
    },
    onBossDefeated(run) {
      run.objective.bossDefeated = true;
    },
  },
  escort: {
    objectiveType: 'escort',
    skipBulkCombatSpawn() {
      return true;
    },
    preferNearestEnemySpawns() {
      return false;
    },
    createObjective(quest, ctx) {
      const npcName = quest.escortNpc?.name || 'VIP';
      const destinationLabel = formatEscortDestinationLabel(quest);
      const totalEnemies = isScriptedQuest(quest)
        ? countAuthoredScriptedEnemies(quest)
        : ctx.enemyCount;
      return {
        type: 'escort',
        label: `${quest.name}: escort ${npcName} to ${destinationLabel}`,
        totalEnemies,
        defeatedEnemies: 0,
        reachedDestination: false,
      };
    },
    isComplete(objective, run) {
      if (!objective.reachedDestination && !run?.escort?.atDestination) return false;
      if (run?.escort?.failed) return false;
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
  countLiveNonSpawnerEnemies,
  syncScriptedDefeatEnemiesActiveCount,
};
