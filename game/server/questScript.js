const { getQuest, getQuestScript } = require('./quests');

function isRunStartTrigger(trigger) {
  return trigger === 'run_start';
}

function isEnterRoomTrigger(trigger) {
  return trigger === 'enter_room';
}

function roomAt(layout, x, z) {
  if (!layout?.rooms) return null;
  return layout.rooms.find((room) => {
    const halfW = room.width / 2;
    const halfD = room.depth / 2;
    return x >= room.x - halfW && x <= room.x + halfW
      && z >= room.z - halfD && z <= room.z + halfD;
  }) ?? null;
}

/**
 * Resolve the layout room a scripted wave is bound to.
 * @param {object} layout
 * @param {import('./quests').QuestScriptRoom} roomBinding
 */
function resolveWaveRoom(layout, roomBinding) {
  if (!layout || !roomBinding) return null;

  let x;
  let z;
  if (roomBinding.landmark) {
    const landmark = layout.landmarks?.find((lm) => lm.type === roomBinding.landmark);
    if (!landmark || !Number.isFinite(landmark.x) || !Number.isFinite(landmark.z)) {
      return null;
    }
    x = landmark.x;
    z = landmark.z;
  } else if (Number.isFinite(roomBinding.x) && Number.isFinite(roomBinding.z)) {
    x = roomBinding.x;
    z = roomBinding.z;
  } else {
    return null;
  }

  return roomAt(layout, x, z);
}

/**
 * @param {object} player
 * @param {object} room
 */
function isPlayerInRoom(player, room) {
  if (!player || !room) return false;
  if (!Number.isFinite(player.x) || !Number.isFinite(player.z)) return false;
  const halfW = room.width / 2;
  const halfD = room.depth / 2;
  return player.x >= room.x - halfW && player.x <= room.x + halfW
    && player.z >= room.z - halfD && player.z <= room.z + halfD;
}

function isActivePlayer(player) {
  return !!(player && !player.dead && !player.extracted);
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

/**
 * Spawn pending `enter_room` waves when an active player enters the bound room.
 * @param {object} gameState
 * @param {object} ctx - Objective spawn context; `layout` may be supplied or read from gameState.
 */
function updateEnterRoomTriggers(gameState, ctx) {
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
    if (!isEnterRoomTrigger(waveState.trigger)) continue;
    const scriptWave = scriptWaveById.get(waveState.id);
    if (!scriptWave?.room) continue;
    const room = resolveWaveRoom(spawnCtx.layout, scriptWave.room);
    if (!room) continue;

    const playerEntered = Object.values(gameState.players || {}).some(
      (player) => isActivePlayer(player) && isPlayerInRoom(player, room),
    );
    if (!playerEntered) continue;

    spawnWaveEntries(waveState, scriptWave, spawnCtx);
  }
}

module.exports = {
  initQuestScript,
  spawnWaveEntries,
  fireRunStartWaves,
  updateEnterRoomTriggers,
  resolveWaveRoom,
  isPlayerInRoom,
  isRunStartTrigger,
  isEnterRoomTrigger,
};
