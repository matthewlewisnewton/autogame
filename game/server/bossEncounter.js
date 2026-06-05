// ── Stage-boss encounter state ──
// Registry/helpers for quest-tier stage-boss encounters: config validation,
// run.encounter lifecycle, boss spawn placement, and ambient-spawn lock helpers.

/**
 * Optional `stageBossEncounter` on a quest tier definition.
 *
 * @typedef {Object} StageBossEncounterConfig
 * @property {string} bossType - Enemy type key (e.g. `'miniboss'`) passed to spawnEnemy.
 * @property {'deploy'|'enter_room'|'room_enter'|string} trigger - When the encounter should activate.
 * @property {string} [roomRole] - Dungeon room role for boss spawn (e.g. `'combat'`).
 * @property {number} [rewardCurrencyBonus] - Extra run currency granted on boss clear.
 * @property {{ questId: string, tier: number }} [unlockOnClear] - Quest tier unlocked on clear.
 */

/**
 * Runtime encounter state attached to an active run when the quest tier declares
 * a stage-boss encounter.
 *
 * @typedef {Object} RunEncounterState
 * @property {'pending'|'active'|'cleared'} status
 * @property {string} bossType
 * @property {string|null} bossEnemyId - Set when the stage boss is spawned.
 * @property {string} trigger
 * @property {string|null} [roomRole]
 * @property {number|null} [rewardCurrencyBonus]
 * @property {{ questId: string, tier: number }|null} [unlockOnClear]
 */

const { roomsByRole } = require('./dungeon');
const { unlockQuestTier } = require('./users');

const ENCOUNTER_STATUSES = ['pending', 'active', 'cleared'];

/** Seeded RNG offset so boss placement is stable per layout seed. */
const STAGE_BOSS_SPAWN_RNG_OFFSET = 5000;

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Normalize and validate `quest.stageBossEncounter`. Returns null when absent
 * or malformed so non-boss quests stay unchanged.
 *
 * @param {object|null|undefined} quest - Resolved quest from getQuest().
 * @returns {StageBossEncounterConfig|null}
 */
function getStageBossEncounterConfig(quest) {
  if (!quest || !isPlainObject(quest.stageBossEncounter)) {
    return null;
  }
  const raw = quest.stageBossEncounter;
  if (typeof raw.bossType !== 'string' || raw.bossType.length === 0) {
    return null;
  }
  if (typeof raw.trigger !== 'string' || raw.trigger.length === 0) {
    return null;
  }

  const config = {
    bossType: raw.bossType,
    trigger: raw.trigger,
  };

  if (raw.roomRole != null) {
    if (typeof raw.roomRole !== 'string' || raw.roomRole.length === 0) {
      return null;
    }
    config.roomRole = raw.roomRole;
  }

  if (raw.rewardCurrencyBonus != null) {
    const bonus = Number(raw.rewardCurrencyBonus);
    if (!Number.isFinite(bonus) || bonus < 0) {
      return null;
    }
    config.rewardCurrencyBonus = bonus;
  }

  if (raw.unlockOnClear != null) {
    if (!isPlainObject(raw.unlockOnClear)) {
      return null;
    }
    const tier = Number(raw.unlockOnClear.tier);
    if (
      typeof raw.unlockOnClear.questId !== 'string' ||
      raw.unlockOnClear.questId.length === 0 ||
      !Number.isInteger(tier) ||
      tier <= 0
    ) {
      return null;
    }
    config.unlockOnClear = {
      questId: raw.unlockOnClear.questId,
      tier,
    };
  }

  return config;
}

/** Alias for {@link getStageBossEncounterConfig}. */
const getEncounterConfig = getStageBossEncounterConfig;

/**
 * Attach initial encounter state to a new run when the quest tier includes a
 * valid stage-boss config. No-op when config is absent.
 *
 * @param {object} run
 * @param {object} quest
 */
function initRunEncounter(run, quest) {
  const config = getEncounterConfig(quest);
  if (!config || !run) {
    return;
  }

  /** @type {RunEncounterState} */
  run.encounter = {
    status: 'pending',
    bossType: config.bossType,
    bossEnemyId: null,
    trigger: config.trigger,
    roomRole: config.roomRole ?? null,
    rewardCurrencyBonus: config.rewardCurrencyBonus ?? null,
    unlockOnClear: config.unlockOnClear ?? null,
  };
}

/**
 * @param {object|null|undefined} run
 * @returns {boolean}
 */
function isEncounterLocked(run) {
  return Boolean(run && run.encounter && run.encounter.status === 'active');
}

/**
 * @param {object} run
 * @returns {RunEncounterState}
 */
function setEncounterActive(run) {
  if (!run || !run.encounter) {
    throw new Error('Cannot activate encounter: run has no encounter state');
  }
  if (run.encounter.status !== 'pending') {
    throw new Error(`Cannot activate encounter from status "${run.encounter.status}"`);
  }
  run.encounter.status = 'active';
  return run.encounter;
}

/**
 * @param {object} run
 * @returns {RunEncounterState}
 */
function setEncounterCleared(run) {
  if (!run || !run.encounter) {
    throw new Error('Cannot clear encounter: run has no encounter state');
  }
  if (run.encounter.status !== 'active') {
    throw new Error(`Cannot clear encounter from status "${run.encounter.status}"`);
  }
  run.encounter.status = 'cleared';
  return run.encounter;
}

/**
 * @param {object|null|undefined} enemy
 * @param {object|null|undefined} run
 * @returns {boolean}
 */
function isStageBossEnemy(enemy, run) {
  if (!enemy || !run || !run.encounter || run.encounter.bossEnemyId == null) {
    return false;
  }
  return enemy.id === run.encounter.bossEnemyId;
}

function isOpenFloorLayout(layout) {
  return roomsByRole(layout, 'combat').length === 0 &&
         roomsByRole(layout, 'treasure').length === 0;
}

/**
 * True when point (x, z) lies inside any layout room with the given role.
 *
 * @param {object|null|undefined} layout
 * @param {number} x
 * @param {number} z
 * @param {string} role
 * @returns {boolean}
 */
function playerInRoomWithRole(layout, x, z, role) {
  if (!layout || typeof role !== 'string' || role.length === 0) {
    return false;
  }
  for (const room of roomsByRole(layout, role)) {
    const halfW = room.width / 2;
    const halfD = room.depth / 2;
    if (x >= room.x - halfW && x <= room.x + halfW &&
        z >= room.z - halfD && z <= room.z + halfD) {
      return true;
    }
  }
  return false;
}

const ROOM_ENTRY_TRIGGERS = new Set(['enter_room', 'room_enter']);

/**
 * Promote a pending stage-boss encounter to active when its trigger condition
 * is met. Returns true when the encounter was started (pending → active once).
 *
 * @param {object} gameState
 * @param {object} [opts]
 * @param {object} opts.spawnCtx - Passed through to {@link startStageBossEncounter}.
 * @param {(player: object) => boolean} [opts.isPlayerActive]
 * @returns {boolean}
 */
function tryStartStageBossEncounter(gameState, opts = {}) {
  const run = gameState?.run;
  if (!run?.encounter || run.encounter.status !== 'pending') {
    return false;
  }

  const { spawnCtx, isPlayerActive } = opts;
  if (!spawnCtx || typeof spawnCtx.spawnEnemy !== 'function') {
    return false;
  }

  const trigger = run.encounter.trigger;
  let shouldStart = false;

  if (trigger === 'deploy') {
    shouldStart = true;
  } else if (ROOM_ENTRY_TRIGGERS.has(trigger)) {
    const role = run.encounter.roomRole;
    if (typeof role !== 'string' || role.length === 0) {
      return false;
    }
    const isActive = typeof isPlayerActive === 'function'
      ? isPlayerActive
      : (player) => player && !player.dead && !player.extracted;
    const players = Object.values(gameState.players || {});
    shouldStart = players.some(
      (player) => isActive(player) &&
        playerInRoomWithRole(gameState.layout, player.x, player.z, role),
    );
  } else {
    return false;
  }

  if (!shouldStart) {
    return false;
  }

  startStageBossEncounter(gameState, spawnCtx);
  return true;
}

function randomPositionInRoom(room, rng) {
  const SPAWN_PADDING = 1;
  const halfW = Math.max(0, room.width / 2 - SPAWN_PADDING);
  const halfD = Math.max(0, room.depth / 2 - SPAWN_PADDING);
  return {
    x: room.x + (rng() * 2 - 1) * halfW,
    z: room.z + (rng() * 2 - 1) * halfD,
  };
}

/**
 * Deterministic arena position for the stage boss.
 * Open-plaza layouts use a seeded floor sample; multi-room layouts use the
 * first room matching `roomRole` when configured.
 *
 * @param {object} layout
 * @param {StageBossEncounterConfig|object|null|undefined} encounterConfig
 * @param {() => number} rng
 * @returns {{ x: number, z: number }}
 */
function resolveStageBossSpawnPosition(layout, encounterConfig, rng) {
  if (!layout) {
    return { x: 0, z: 0 };
  }

  if (isOpenFloorLayout(layout)) {
    const { pickFloorSpawnPosition } = require('./simulation');
    return pickFloorSpawnPosition(layout, rng);
  }

  const roomRole = encounterConfig?.roomRole;
  if (typeof roomRole === 'string' && roomRole.length > 0) {
    const roleRooms = roomsByRole(layout, roomRole);
    if (roleRooms.length > 0) {
      return randomPositionInRoom(roleRooms[0], rng);
    }
  }

  const combatRooms = roomsByRole(layout, 'combat');
  if (combatRooms.length > 0) {
    return randomPositionInRoom(combatRooms[0], rng);
  }

  const { pickFloorSpawnPosition } = require('./simulation');
  return pickFloorSpawnPosition(layout, rng);
}

/**
 * Clear ambient enemies before the stage boss spawns so the arena stays clean.
 * All existing enemies are removed — the boss has not been spawned yet.
 *
 * @param {object} gameState
 */
function clearNonBossEnemiesOnEncounterStart(gameState) {
  if (!gameState || !Array.isArray(gameState.enemies)) {
    return;
  }
  gameState.enemies.length = 0;
}

/**
 * Activate a pending stage-boss encounter: clear ambient enemies, spawn the
 * designated boss via `spawnCtx.spawnEnemy`, and record `bossEnemyId`.
 *
 * @param {object} gameState
 * @param {object} spawnCtx
 * @param {Function} spawnCtx.spawnEnemy
 * @param {Function} spawnCtx.mulberry32
 * @param {Function} [spawnCtx.roomTierAt]
 * @param {Function} [spawnCtx.randomWanderTarget]
 * @returns {object} spawned stage-boss enemy
 */
function startStageBossEncounter(gameState, spawnCtx) {
  const run = gameState?.run;
  if (!run?.encounter) {
    throw new Error('Cannot start stage-boss encounter: run has no encounter state');
  }
  if (run.encounter.status !== 'pending') {
    throw new Error(`Cannot start stage-boss encounter from status "${run.encounter.status}"`);
  }
  if (!spawnCtx || typeof spawnCtx.spawnEnemy !== 'function' || typeof spawnCtx.mulberry32 !== 'function') {
    throw new Error('startStageBossEncounter requires spawnCtx.spawnEnemy and spawnCtx.mulberry32');
  }

  const encounterConfig = {
    bossType: run.encounter.bossType,
    trigger: run.encounter.trigger,
    roomRole: run.encounter.roomRole ?? undefined,
  };

  clearNonBossEnemiesOnEncounterStart(gameState);

  const seed = gameState.layoutSeed || 42;
  const rng = spawnCtx.mulberry32(seed + STAGE_BOSS_SPAWN_RNG_OFFSET);
  const pos = resolveStageBossSpawnPosition(gameState.layout, encounterConfig, rng);

  setEncounterActive(run);

  const tier = typeof spawnCtx.roomTierAt === 'function'
    ? spawnCtx.roomTierAt(gameState.layout, pos.x, pos.z)
    : 0;
  const boss = spawnCtx.spawnEnemy(pos.x, pos.z, run.encounter.bossType, undefined, {
    tier,
    rng,
    isStageBoss: true,
  });
  if (!boss) {
    throw new Error('Failed to spawn stage boss');
  }

  boss.isStageBoss = true;
  run.encounter.bossEnemyId = boss.id;
  if (typeof spawnCtx.randomWanderTarget === 'function') {
    boss.wanderTarget = spawnCtx.randomWanderTarget();
  }

  return boss;
}

/**
 * Apply configured encounter clear rewards after the stage boss is defeated.
 * Mutates `run.rewardCurrency` and invokes optional quest-tier unlocks.
 *
 * @param {object} gameState
 */
function applyEncounterClearRewards(gameState) {
  const run = gameState?.run;
  if (!run?.encounter || run.encounter.status !== 'cleared') {
    return;
  }

  const bonus = run.encounter.rewardCurrencyBonus;
  if (Number.isFinite(bonus) && bonus > 0) {
    run.rewardCurrency = (run.rewardCurrency ?? 0) + bonus;
  }

  const unlock = run.encounter.unlockOnClear;
  if (!unlock || typeof unlock.questId !== 'string' || unlock.questId.length === 0) {
    return;
  }
  const tier = Number(unlock.tier);
  if (!Number.isInteger(tier) || tier <= 0) {
    return;
  }

  for (const player of Object.values(gameState.players || {})) {
    if (player?.accountId) {
      unlockQuestTier(player.accountId, unlock.questId, tier);
    }
  }
}

/**
 * Handle defeat of the active stage boss: clear the encounter and grant rewards.
 * No-op for non-stage-boss enemies or when no encounter is active.
 *
 * @param {object} gameState
 * @param {string} enemyId
 * @returns {boolean} true when the stage boss was cleared
 */
function onStageBossDefeated(gameState, enemyId) {
  const run = gameState?.run;
  if (!run?.encounter || run.encounter.status !== 'active') {
    return false;
  }
  if (enemyId !== run.encounter.bossEnemyId) {
    return false;
  }

  setEncounterCleared(run);
  applyEncounterClearRewards(gameState);
  return true;
}

module.exports = {
  ENCOUNTER_STATUSES,
  getStageBossEncounterConfig,
  getEncounterConfig,
  initRunEncounter,
  isEncounterLocked,
  setEncounterActive,
  setEncounterCleared,
  isStageBossEnemy,
  STAGE_BOSS_SPAWN_RNG_OFFSET,
  isOpenFloorLayout,
  resolveStageBossSpawnPosition,
  clearNonBossEnemiesOnEncounterStart,
  startStageBossEncounter,
  playerInRoomWithRole,
  tryStartStageBossEncounter,
  applyEncounterClearRewards,
  onStageBossDefeated,
};
