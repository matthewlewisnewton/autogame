/**
 * Stage-boss encounter state machine attached to `run.encounter`.
 * Combat wiring, triggers, and quest definitions live in later sub-tickets.
 */

const ENCOUNTER_PHASES = Object.freeze({
  DORMANT: 'dormant',
  ACTIVE: 'active',
  CLEARED: 'cleared',
});

const VALID_PHASE_TRANSITIONS = Object.freeze({
  dormant: ['active'],
  active: ['cleared'],
  cleared: [],
});

/** World-unit radius for proximity activation around `run.encounter.spawnAnchor`. */
const ENCOUNTER_TRIGGER_RADIUS = 8;

function normalizeSpawnAnchor(spawnAnchor) {
  if (
    !spawnAnchor ||
    !Number.isFinite(spawnAnchor.x) ||
    !Number.isFinite(spawnAnchor.z)
  ) {
    return null;
  }
  return { x: spawnAnchor.x, z: spawnAnchor.z };
}

function assertPhaseTransition(encounter, nextPhase) {
  const allowed = VALID_PHASE_TRANSITIONS[encounter.phase];
  if (!allowed || !allowed.includes(nextPhase)) {
    throw new Error(
      `Invalid encounter phase transition: ${encounter.phase} → ${nextPhase}`,
    );
  }
}

/**
 * @param {{ spawnAnchor?: { x: number, z: number } | null }} [opts]
 */
function createEncounterState({ spawnAnchor = null } = {}) {
  return {
    phase: ENCOUNTER_PHASES.DORMANT,
    bossEnemyId: null,
    locked: false,
    spawnAnchor: normalizeSpawnAnchor(spawnAnchor),
  };
}

function setEncounterBoss(run, enemyId) {
  if (!run?.encounter) return;
  run.encounter.bossEnemyId = enemyId;
}

function activateEncounter(run) {
  const encounter = run?.encounter;
  if (!encounter) return;
  assertPhaseTransition(encounter, ENCOUNTER_PHASES.ACTIVE);
  encounter.phase = ENCOUNTER_PHASES.ACTIVE;
}

function lockEncounter(run) {
  if (!run?.encounter) return;
  run.encounter.locked = true;
}

function clearEncounter(run) {
  const encounter = run?.encounter;
  if (!encounter) return;
  assertPhaseTransition(encounter, ENCOUNTER_PHASES.CLEARED);
  encounter.phase = ENCOUNTER_PHASES.CLEARED;
}

function isEncounterLocked(run) {
  return !!run?.encounter?.locked;
}

function getEncounterBossId(run) {
  return run?.encounter?.bossEnemyId ?? null;
}

function isEncounterCleared(run) {
  return run?.encounter?.phase === ENCOUNTER_PHASES.CLEARED;
}

function isEncounterDormant(run) {
  return run?.encounter?.phase === ENCOUNTER_PHASES.DORMANT;
}

function ensureEncounterSpawnAnchor(run, enemies) {
  const encounter = run?.encounter;
  if (!encounter || encounter.spawnAnchor) return;
  const bossId = encounter.bossEnemyId;
  if (!bossId || !Array.isArray(enemies)) return;
  const boss = enemies.find((e) => e.id === bossId);
  if (boss && Number.isFinite(boss.x) && Number.isFinite(boss.z)) {
    encounter.spawnAnchor = { x: boss.x, z: boss.z };
  }
}

function resolveEncounterAnchor(run, gameState) {
  const configured = normalizeSpawnAnchor(run?.encounter?.spawnAnchor);
  if (configured) return configured;
  const bossId = getEncounterBossId(run);
  if (!bossId) return null;
  const boss = gameState?.enemies?.find((e) => e.id === bossId);
  if (!boss || !Number.isFinite(boss.x) || !Number.isFinite(boss.z)) return null;
  return { x: boss.x, z: boss.z };
}

function areAllNonBossEnemiesDefeated(gameState, bossId) {
  if (!bossId || !Array.isArray(gameState?.enemies)) return false;
  return !gameState.enemies.some((e) => e.id !== bossId && e.hp > 0);
}

function isPlayerNearEncounterAnchor(gameState, anchor, radius) {
  if (!anchor) return false;
  for (const player of Object.values(gameState.players || {})) {
    if (!player || player.dead || player.extracted) continue;
    const dist = Math.hypot(player.x - anchor.x, player.z - anchor.z);
    if (dist <= radius) return true;
  }
  return false;
}

function clearNonBossEnemies(gameState, bossId) {
  if (!bossId || !Array.isArray(gameState?.enemies)) return;
  gameState.enemies = gameState.enemies.filter((e) => e.id === bossId);
}

/**
 * While dormant, transitions to active + locked only after all non-boss enemies
 * are defeated AND an active player enters the trigger radius around spawnAnchor.
 */
/** Optional hooks invoked once per stage-boss defeat (after loot, before filter). */
const encounterRewardHooks = [];
const encounterActivationHooks = [];

function registerEncounterRewardHook(fn) {
  if (typeof fn === 'function') {
    encounterRewardHooks.push(fn);
  }
}

function clearEncounterRewardHooks() {
  encounterRewardHooks.length = 0;
}

/**
 * Called from `removeDeadEnemies` when the encounter boss dies while active.
 * Clears the encounter, marks the stage_boss objective, and runs reward hooks.
 */
function onStageBossDefeated(gameState, bossEnemy) {
  const run = gameState?.run;
  const encounter = run?.encounter;
  if (!encounter || encounter.phase !== ENCOUNTER_PHASES.ACTIVE) return;

  clearEncounter(run);

  const { getObjectiveDef } = require('./objectives');
  const def = getObjectiveDef('stage_boss');
  if (def?.onBossDefeated) {
    def.onBossDefeated(run, bossEnemy);
  }

  for (const hook of encounterRewardHooks) {
    hook(gameState, bossEnemy, run);
  }
}

function tryActivateEncounter(gameState) {
  const run = gameState?.run;
  if (!run || run.status !== 'playing' || !isEncounterDormant(run)) return false;

  const bossId = getEncounterBossId(run);
  if (!bossId) return false;
  const boss = gameState.enemies?.find((e) => e.id === bossId);
  if (!boss || boss.hp <= 0) return false;

  const anchor = resolveEncounterAnchor(run, gameState);
  const addsCleared = areAllNonBossEnemiesDefeated(gameState, bossId);
  if (!addsCleared) return false;
  const playerNear = isPlayerNearEncounterAnchor(
    gameState,
    anchor,
    ENCOUNTER_TRIGGER_RADIUS,
  );
  if (!playerNear) return false;

  activateEncounter(run);
  lockEncounter(run);
  if (anchor && !run.encounter.spawnAnchor) {
    run.encounter.spawnAnchor = { x: anchor.x, z: anchor.z };
  }
  const deadAddCount = gameState.enemies.filter(
    (e) => e.id !== bossId && e.hp <= 0,
  ).length;
  if (deadAddCount > 0) {
    const { recordEnemyDefeated } = require('./progression');
    recordEnemyDefeated(deadAddCount);
  }
  clearNonBossEnemies(gameState, bossId);
  for (const hook of encounterActivationHooks) {
    hook(gameState, boss);
  }
  return true;
}

function registerEncounterActivationHook(fn) {
  if (typeof fn === 'function') encounterActivationHooks.push(fn);
}

function clearEncounterActivationHooks() {
  encounterActivationHooks.length = 0;
}

module.exports = {
  ENCOUNTER_PHASES,
  ENCOUNTER_TRIGGER_RADIUS,
  createEncounterState,
  setEncounterBoss,
  activateEncounter,
  lockEncounter,
  clearEncounter,
  isEncounterLocked,
  isEncounterDormant,
  getEncounterBossId,
  isEncounterCleared,
  ensureEncounterSpawnAnchor,
  resolveEncounterAnchor,
  areAllNonBossEnemiesDefeated,
  clearNonBossEnemies,
  tryActivateEncounter,
  onStageBossDefeated,
  registerEncounterRewardHook,
  clearEncounterRewardHooks,
  encounterRewardHooks,
  registerEncounterActivationHook,
  clearEncounterActivationHooks,
  encounterActivationHooks,
};
