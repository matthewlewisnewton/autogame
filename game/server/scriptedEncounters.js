/**
 * Server-side scripted wave encounters: hand-authored enemy groups per room
 * instead of bulk enemyPool placement at deploy.
 */
const { mulberry32 } = require('./dungeon');
const { DEFAULT_QUEST_TIER } = require('./quests');

function syncScriptedDefeatEnemiesActiveCount(run, enemies) {
  if (!run?.scriptedEncounter || run.objective?.type !== 'defeat_enemies') return;
  run.objective.activeEnemyCount = (enemies || []).filter((enemy) => enemy.hp > 0 && !enemy.spawnedBy).length;
}

/**
 * @typedef {Object} ScriptedSpawnDef
 * @property {string} type - Enemy type id.
 * @property {number} [count=1] - How many of this type to spawn.
 * @property {{ x: number, z: number }} [offset] - World offset from the spawn anchor.
 * @property {string} [anchor] - Layout landmark type used as spawn anchor (room center when omitted).
 * @property {{ id: string, displayName: string, variantId?: string, enemyType?: string }} [namedRare]
 *   Quest-exclusive rare spawn metadata (custom label + optional forced variant/type).
 */

/**
 * @typedef {Object} ScriptedWaveDef
 * @property {ScriptedSpawnDef[]} spawns - Ordered spawn entries for this wave.
 */

/**
 * @typedef {Object} ScriptedRoomDef
 * @property {number} [roomIndex] - Index into `layout.rooms`.
 * @property {string} [landmark] - Layout landmark type that resolves the target room.
 * @property {ScriptedWaveDef[]} waves - Ordered waves cleared sequentially in this room.
 */

/**
 * @typedef {Object} ScriptedWaveRef
 * @property {number} roomIndex - Layout room index whose wave clear unlocks the passage.
 * @property {number} waveIndex - Wave index within that room (0-based).
 */

/**
 * @typedef {Object} ScriptedPassageLockDef
 * @property {ScriptedWaveRef} afterWave - Wave that must be cleared before this passage opens.
 * @property {number} passageIndex - Index into `layout.passages` for the gated doorway.
 */

/**
 * @typedef {Object} ScriptedEncounterConfig
 * @property {ScriptedRoomDef[]} rooms - Per-room scripted wave definitions.
 * @property {ScriptedPassageLockDef[]} [passageLocks] - Optional wave-gated passage barriers.
 */

/**
 * @typedef {Object} ScriptedPassageLockState
 * @property {number} passageIndex - Index into `layout.passages`.
 * @property {ScriptedWaveRef} afterWave - Unlock condition copied from quest config.
 * @property {boolean} locked - Whether movement is blocked at this passage.
 */

/**
 * @typedef {Object} ScriptedRoomState
 * @property {string} roomKey - Stable key for this room (`room:N` or `landmark:type`).
 * @property {number} roomIndex - Resolved layout room index.
 * @property {number} waveIndex - Index of the active wave (-1 before first spawn).
 * @property {string[]} enemyIds - Living enemy ids tagged to the active wave.
 * @property {boolean} cleared - True when every wave in this room is defeated.
 * @property {boolean} started - True after wave 0 has been spawned for this room.
 */

/**
 * @typedef {Object} ScriptedEncounterState
 * @property {Record<string, ScriptedRoomState>} rooms - Per-room runtime progress.
 */

function getScriptedEncounterDef(quest) {
  if (!quest || !quest.scriptedEncounters || typeof quest.scriptedEncounters !== 'object') {
    return null;
  }
  const rooms = quest.scriptedEncounters.rooms;
  if (!Array.isArray(rooms) || rooms.length === 0) {
    return null;
  }
  return quest.scriptedEncounters;
}

function isScriptedQuest(quest) {
  return getScriptedEncounterDef(quest) != null;
}

function questHasPassageLocks(quest) {
  const lockDefs = getScriptedEncounterDef(quest)?.passageLocks;
  return Array.isArray(lockDefs) && lockDefs.length > 0;
}

/** True when per-room scripted waves (not questScript) drive runtime spawning. */
function usesScriptedEncounterRuntime(quest) {
  if (!isScriptedQuest(quest)) return false;
  if (questHasPassageLocks(quest)) return true;
  const { getQuestScript } = require('./quests');
  return getQuestScript(quest) == null;
}

function spawnCount(spawnDef) {
  const count = Number.isFinite(spawnDef?.count) ? spawnDef.count : 1;
  return Math.max(1, Math.floor(count));
}

function countAuthoredScriptedEnemies(quest) {
  const config = getScriptedEncounterDef(quest);
  if (!config) return 0;
  let total = 0;
  for (const roomDef of config.rooms) {
    if (!Array.isArray(roomDef.waves)) continue;
    for (const wave of roomDef.waves) {
      if (!Array.isArray(wave.spawns)) continue;
      for (const spawn of wave.spawns) {
        total += spawnCount(spawn);
      }
    }
  }
  return total;
}

function roomKeyForDef(roomDef) {
  if (Number.isInteger(roomDef.roomIndex) && roomDef.roomIndex >= 0) {
    return `room:${roomDef.roomIndex}`;
  }
  if (typeof roomDef.band === 'string' && roomDef.band.length > 0) {
    return `band:${roomDef.band}`;
  }
  if (typeof roomDef.landmark === 'string' && roomDef.landmark.length > 0) {
    return `landmark:${roomDef.landmark}`;
  }
  return null;
}

let _onPassageLocksChanged = () => {};
let _onWaveCleared = () => {};

function setPassageLocksChangedCallback(fn) {
  _onPassageLocksChanged = typeof fn === 'function' ? fn : () => {};
}

function setWaveClearedCallback(fn) {
  _onWaveCleared = typeof fn === 'function' ? fn : () => {};
}

function findPassageIndexFromRoom(layout, roomIndex) {
  if (!layout?.passages || !layout?.rooms) return -1;
  const room = layout.rooms[roomIndex];
  if (!room) return -1;
  return layout.passages.findIndex((passage) => passage.x1 === room.x && passage.z1 === room.z);
}

function getStartRoomIndex(layout) {
  if (!layout || !Array.isArray(layout.rooms) || layout.rooms.length === 0) {
    return 0;
  }
  const idx = layout.rooms.findIndex((room) => room.role === 'start');
  return idx >= 0 ? idx : 0;
}

function resolveRoomDef(roomDef, layout) {
  if (!layout || !Array.isArray(layout.rooms) || layout.rooms.length === 0) {
    return null;
  }

  if (Number.isInteger(roomDef.roomIndex) && layout.rooms[roomDef.roomIndex]) {
    return {
      room: layout.rooms[roomDef.roomIndex],
      roomIndex: roomDef.roomIndex,
    };
  }

  if (typeof roomDef.band === 'string' && roomDef.band.length > 0) {
    const room = layout.rooms.find((candidate) => candidate.band === roomDef.band);
    if (room) {
      return {
        room,
        roomIndex: layout.rooms.indexOf(room),
      };
    }
  }

  if (typeof roomDef.landmark === 'string' && Array.isArray(layout.landmarks)) {
    const landmark = layout.landmarks.find((lm) => lm.type === roomDef.landmark);
    if (landmark && Number.isFinite(landmark.x) && Number.isFinite(landmark.z)) {
      const room = layout.rooms.find((candidate) => {
        const halfW = candidate.width / 2;
        const halfD = candidate.depth / 2;
        return landmark.x >= candidate.x - halfW
          && landmark.x <= candidate.x + halfW
          && landmark.z >= candidate.z - halfD
          && landmark.z <= candidate.z + halfD;
      }) || layout.rooms[0];
      return {
        room,
        roomIndex: layout.rooms.indexOf(room),
        landmark,
      };
    }
  }

  return null;
}

function resolveSpawnAnchor(layout, room, spawnDef) {
  if (spawnDef?.anchor && Array.isArray(layout?.landmarks)) {
    const landmark = layout.landmarks.find((lm) => lm.type === spawnDef.anchor);
    if (landmark && Number.isFinite(landmark.x) && Number.isFinite(landmark.z)) {
      return { x: landmark.x, z: landmark.z };
    }
  }
  if (room && Number.isFinite(room.x) && Number.isFinite(room.z)) {
    return { x: room.x, z: room.z };
  }
  return { x: 0, z: 0 };
}

function resolveSpawnPosition(layout, room, spawnDef, spawnIndex, rng) {
  const anchor = resolveSpawnAnchor(layout, room, spawnDef);
  const offset = spawnDef?.offset || { x: 0, z: 0 };
  const jitterX = spawnIndex > 0 ? (rng() * 2 - 1) * 1.5 : 0;
  const jitterZ = spawnIndex > 0 ? (rng() * 2 - 1) * 1.5 : 0;
  return {
    x: anchor.x + (offset.x || 0) + jitterX,
    z: anchor.z + (offset.z || 0) + jitterZ,
  };
}

function waveRng(layoutSeed, roomKey, waveIndex) {
  let hash = layoutSeed + 9100;
  for (let i = 0; i < roomKey.length; i++) {
    hash = (hash * 31 + roomKey.charCodeAt(i)) | 0;
  }
  return mulberry32(hash + waveIndex * 17);
}

function playerInRoom(x, z, room) {
  if (!room) return false;
  const halfW = room.width / 2;
  const halfD = room.depth / 2;
  return x >= room.x - halfW
    && x <= room.x + halfW
    && z >= room.z - halfD
    && z <= room.z + halfD;
}

function buildRoomStates(quest, layout) {
  const config = getScriptedEncounterDef(quest);
  const rooms = {};
  if (!config) return rooms;

  for (const roomDef of config.rooms) {
    const roomKey = roomKeyForDef(roomDef);
    const resolved = resolveRoomDef(roomDef, layout);
    if (!roomKey || !resolved) continue;
    rooms[roomKey] = {
      roomKey,
      roomIndex: resolved.roomIndex,
      waveIndex: -1,
      enemyIds: [],
      cleared: false,
      started: false,
    };
  }
  return rooms;
}

function spawnScriptedWave(run, gameState, roomKey, waveIndex, ctx) {
  const quest = {
    scriptedEncounters: run._scriptedEncounterConfig,
    tier: run.questTier ?? DEFAULT_QUEST_TIER,
    id: run.questId,
  };
  const config = getScriptedEncounterDef(quest);
  if (!config) return;

  const roomDef = config.rooms.find((candidate) => roomKeyForDef(candidate) === roomKey);
  const roomState = run.scriptedEncounter?.rooms?.[roomKey];
  const layout = gameState.layout;
  const resolved = roomDef ? resolveRoomDef(roomDef, layout) : null;
  if (!roomDef || !roomState || !resolved || !Array.isArray(roomDef.waves)) return;

  const wave = roomDef.waves[waveIndex];
  if (!wave || !Array.isArray(wave.spawns)) return;

  const layoutSeed = gameState.layoutSeed || 42;
  const rng = waveRng(layoutSeed, roomKey, waveIndex);
  const enemyIds = [];
  let spawnIndex = 0;

  for (const spawnDef of wave.spawns) {
    const count = spawnCount(spawnDef);
    for (let i = 0; i < count; i++) {
      const pos = resolveSpawnPosition(layout, resolved.room, spawnDef, spawnIndex, rng);
      const spawnOpts = {
        tier: ctx.roomTierAt(layout, pos.x, pos.z),
        rng,
      };
      const namedRare = spawnDef.namedRare;
      if (namedRare && typeof namedRare === 'object') {
        if (typeof namedRare.displayName === 'string' && namedRare.displayName.trim()) {
          spawnOpts.displayName = namedRare.displayName.trim();
        }
        if (typeof namedRare.id === 'string' && namedRare.id.trim()) {
          spawnOpts.namedRareId = namedRare.id.trim();
        }
        if (typeof namedRare.enemyType === 'string' && namedRare.enemyType.trim()) {
          spawnOpts.enemyType = namedRare.enemyType.trim();
        }
        if (typeof namedRare.variantId === 'string' && namedRare.variantId.trim()) {
          spawnOpts.forceVariant = namedRare.variantId.trim();
          spawnOpts.skipVariantRoll = true;
        }
      }
      const enemy = ctx.spawnEnemy(pos.x, pos.z, spawnDef.type, undefined, spawnOpts);
      enemy.wanderTarget = ctx.randomWanderTarget();
      enemy.scriptedWave = { roomKey, waveIndex };
      enemyIds.push(enemy.id);
      spawnIndex += 1;
    }
  }

  roomState.waveIndex = waveIndex;
  roomState.enemyIds = enemyIds;
  roomState.started = true;
  roomState.cleared = false;
  syncScriptedDefeatEnemiesActiveCount(run, gameState.enemies);
}

function tryAdvanceScriptedWave(run, gameState, roomKey, ctx) {
  const quest = {
    scriptedEncounters: run._scriptedEncounterConfig,
    tier: run.questTier ?? DEFAULT_QUEST_TIER,
    id: run.questId,
  };
  const config = getScriptedEncounterDef(quest);
  const roomState = run.scriptedEncounter?.rooms?.[roomKey];
  if (!config || !roomState || roomState.cleared) return;

  const roomDef = config.rooms.find((candidate) => roomKeyForDef(candidate) === roomKey);
  if (!roomDef || !Array.isArray(roomDef.waves)) return;

  if (roomState.enemyIds.length > 0) return;

  const clearedWaveIndex = roomState.waveIndex;
  if (clearedWaveIndex >= 0) {
    unlockPassagesForWave(run, roomState.roomIndex, clearedWaveIndex);
    _onWaveCleared(run, gameState, {
      roomIndex: roomState.roomIndex,
      waveIndex: clearedWaveIndex,
    });
  }

  const nextWaveIndex = roomState.waveIndex + 1;
  if (nextWaveIndex >= roomDef.waves.length) {
    roomState.cleared = true;
    return;
  }

  spawnScriptedWave(run, gameState, roomKey, nextWaveIndex, ctx);
}

function isWaveRequirementMet(run, afterWave) {
  if (!afterWave || !Number.isInteger(afterWave.roomIndex) || !Number.isInteger(afterWave.waveIndex)) {
    return false;
  }
  const roomKey = `room:${afterWave.roomIndex}`;
  const roomState = run.scriptedEncounter?.rooms?.[roomKey];
  if (!roomState) return false;
  if (roomState.cleared) return true;
  return roomState.waveIndex > afterWave.waveIndex;
}

function initPassageLocks(run, quest, layout) {
  const config = getScriptedEncounterDef(quest);
  const lockDefs = config?.passageLocks;
  if (!Array.isArray(lockDefs) || lockDefs.length === 0) {
    run.passageLocks = [];
    return;
  }

  run.passageLocks = lockDefs.map((lockDef) => {
    let passageIndex = lockDef.passageIndex;
    if (!Number.isInteger(passageIndex) && layout && Number.isInteger(lockDef.fromRoomIndex)) {
      passageIndex = findPassageIndexFromRoom(layout, lockDef.fromRoomIndex);
    }
    if (!Number.isInteger(passageIndex) || passageIndex < 0) {
      return null;
    }
    return {
      passageIndex,
      afterWave: {
        roomIndex: lockDef.afterWave.roomIndex,
        waveIndex: lockDef.afterWave.waveIndex,
      },
      locked: !isWaveRequirementMet(run, lockDef.afterWave),
    };
  }).filter(Boolean);
}

function unlockPassagesForWave(run, roomIndex, waveIndex) {
  if (!Array.isArray(run?.passageLocks) || run.passageLocks.length === 0) return false;

  let changed = false;
  for (const lock of run.passageLocks) {
    if (!lock.locked) continue;
    const afterWave = lock.afterWave;
    if (afterWave?.roomIndex === roomIndex && afterWave?.waveIndex === waveIndex) {
      lock.locked = false;
      changed = true;
    }
  }

  if (changed) {
    _onPassageLocksChanged();
  }
  return changed;
}

function initScriptedEncounter(run, quest, layout, gameState, ctx) {
  if (!isScriptedQuest(quest)) return;

  const config = getScriptedEncounterDef(quest);
  run._scriptedEncounterConfig = config;
  run.scriptedEncounter = {
    rooms: buildRoomStates(quest, layout),
  };
  initPassageLocks(run, quest, layout);

  const startRoomIndex = getStartRoomIndex(layout);
  const startRoomKey = Object.keys(run.scriptedEncounter.rooms).find((key) => {
    return run.scriptedEncounter.rooms[key].roomIndex === startRoomIndex;
  });

  if (startRoomKey) {
    spawnScriptedWave(run, gameState, startRoomKey, 0, ctx);
  }
}

function onScriptedEnemyDefeated(run, enemyId, gameState, ctx) {
  if (!run?.scriptedEncounter) return;

  for (const roomState of Object.values(run.scriptedEncounter.rooms)) {
    const idx = roomState.enemyIds.indexOf(enemyId);
    if (idx < 0) continue;
    roomState.enemyIds.splice(idx, 1);
    tryAdvanceScriptedWave(run, gameState, roomState.roomKey, ctx);
    return;
  }
}

function isPlayerActive(player) {
  return !!(player && !player.dead && !player.extracted);
}

function tickScriptedEncounters(now, gameState, ctx) {
  const run = gameState.run;
  if (!run?.scriptedEncounter || run.status !== 'playing' || gameState.gamePhase !== 'playing') {
    return;
  }

  const config = run._scriptedEncounterConfig;
  if (!config || !Array.isArray(config.rooms)) return;

  const layout = gameState.layout;
  const activePlayers = Object.values(gameState.players || {}).filter(isPlayerActive);
  if (activePlayers.length === 0) return;

  for (const roomDef of config.rooms) {
    const roomKey = roomKeyForDef(roomDef);
    const roomState = run.scriptedEncounter.rooms[roomKey];
    const resolved = resolveRoomDef(roomDef, layout);
    if (!roomKey || !roomState || roomState.started || roomState.cleared || !resolved) {
      continue;
    }

    const occupied = activePlayers.some((player) => playerInRoom(player.x, player.z, resolved.room));
    if (!occupied) continue;

    spawnScriptedWave(run, gameState, roomKey, 0, ctx);
  }
}

function relinkScriptedEncounterEnemyIds(run, enemies) {
  if (!run?.scriptedEncounter) return;
  const aliveIds = new Set((enemies || []).filter((enemy) => enemy.hp > 0).map((enemy) => enemy.id));
  for (const roomState of Object.values(run.scriptedEncounter.rooms)) {
    roomState.enemyIds = roomState.enemyIds.filter((id) => aliveIds.has(id));
  }
}

module.exports = {
  getScriptedEncounterDef,
  isScriptedQuest,
  questHasPassageLocks,
  usesScriptedEncounterRuntime,
  countAuthoredScriptedEnemies,
  initScriptedEncounter,
  initPassageLocks,
  unlockPassagesForWave,
  tickScriptedEncounters,
  onScriptedEnemyDefeated,
  relinkScriptedEncounterEnemyIds,
  setPassageLocksChangedCallback,
  setWaveClearedCallback,
  findPassageIndexFromRoom,
  isWaveRequirementMet,
  roomKeyForDef,
  resolveRoomDef,
};
