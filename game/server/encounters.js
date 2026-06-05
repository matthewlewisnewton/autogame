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

module.exports = {
  ENCOUNTER_PHASES,
  createEncounterState,
  setEncounterBoss,
  activateEncounter,
  lockEncounter,
  clearEncounter,
  isEncounterLocked,
  getEncounterBossId,
  isEncounterCleared,
};
