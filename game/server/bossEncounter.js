// ── Stage-boss encounter state ──
// Registry/helpers for quest-tier stage-boss encounters. This sub-ticket only
// initializes run.encounter and exposes pure state transitions; spawn, trigger,
// and defeat hooks land in follow-up sub-tickets.

/**
 * Optional `stageBossEncounter` on a quest tier definition.
 *
 * @typedef {Object} StageBossEncounterConfig
 * @property {string} bossType - Enemy type key (e.g. `'miniboss'`) passed to spawnEnemy.
 * @property {'deploy'|'room_enter'|string} trigger - When the encounter should activate.
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

const ENCOUNTER_STATUSES = ['pending', 'active', 'cleared'];

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

module.exports = {
  ENCOUNTER_STATUSES,
  getStageBossEncounterConfig,
  getEncounterConfig,
  initRunEncounter,
  isEncounterLocked,
  setEncounterActive,
  setEncounterCleared,
  isStageBossEnemy,
};
