const { getQuest, getQuestScript } = require('./quests');

function isRunStartTrigger(trigger) {
  return trigger === 'run_start';
}

/**
 * Initialize per-run wave script state from a quest tier's authored waves.
 * @param {object} run
 * @param {ReturnType<typeof getQuest>} quest
 * @param {object} [_layout] - Reserved for room binding (enter_room triggers).
 */
function initQuestScript(run, quest, _layout) {
  const script = getQuestScript(quest);
  if (!script) {
    run.waveScript = null;
    return;
  }
  run.waveScript = script.waves.map((wave) => ({
    id: wave.id,
    trigger: wave.trigger,
    status: 'pending',
    spawnedEnemyIds: [],
  }));
}

/**
 * Spawn hand-placed enemies for one scripted wave entry.
 * @param {object} waveState - Mutable entry on `run.waveScript`.
 * @param {import('./quests').QuestScriptWave} scriptWave
 * @param {object} ctx - Objective spawn context (`spawnEnemy`, `roomTierAt`, `layout`, …).
 */
function spawnWaveEntries(waveState, scriptWave, ctx) {
  const layout = ctx.layout;
  const ids = [];
  for (const spawn of scriptWave.spawns) {
    const enemy = ctx.spawnEnemy(spawn.x, spawn.z, spawn.type, undefined, {
      tier: ctx.roomTierAt(layout, spawn.x, spawn.z),
      rng: ctx.rng,
    });
    if (ctx.randomWanderTarget) {
      enemy.wanderTarget = ctx.randomWanderTarget();
    }
    ids.push(enemy.id);
  }
  waveState.spawnedEnemyIds = ids;
  waveState.status = 'spawned';
}

/**
 * Fire every `run_start` wave that is still pending.
 * @param {object} gameState
 * @param {object} ctx - Objective spawn context; `layout` may be supplied or read from gameState.
 */
function fireRunStartWaves(gameState, ctx) {
  const run = gameState?.run;
  if (!run?.waveScript) return;

  const quest = getQuest(run.questId, run.questTier);
  const script = getQuestScript(quest);
  if (!script) return;

  const spawnCtx = {
    ...ctx,
    layout: ctx.layout ?? gameState.layout,
  };
  const scriptWaveById = new Map(script.waves.map((wave) => [wave.id, wave]));

  for (const waveState of run.waveScript) {
    if (waveState.status !== 'pending') continue;
    if (!isRunStartTrigger(waveState.trigger)) continue;
    const scriptWave = scriptWaveById.get(waveState.id);
    if (!scriptWave) continue;
    spawnWaveEntries(waveState, scriptWave, spawnCtx);
  }
}

module.exports = {
  initQuestScript,
  spawnWaveEntries,
  fireRunStartWaves,
  isRunStartTrigger,
};
