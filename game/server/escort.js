/**
 * Escort objective runtime: friendly NPC minion spawn, follow AI hooks, destination
 * checks, and fail-on-death handling for `objectiveType: 'escort'` quests.
 */
const crypto = require('crypto');
const { roomsByRole } = require('./dungeon');
const { simNow } = require('./simulation');

const ESCORT_DESTINATION_RADIUS = 4;
const ESCORT_STALL_FAIL_MS = 45_000;
const ESCORT_STALL_PROGRESS_EPSILON = 0.5;

let _escortStallFailMs = ESCORT_STALL_FAIL_MS;

let _checkRunTerminalState = () => {};

function setEscortCallbacks(deps) {
  _checkRunTerminalState = typeof deps?.checkRunTerminalState === 'function'
    ? deps.checkRunTerminalState
    : () => {};
}

function setEscortStallFailMsForTests(ms) {
  _escortStallFailMs = typeof ms === 'number' && ms > 0 ? ms : ESCORT_STALL_FAIL_MS;
}

function distToEscortDestination(minion, destination) {
  return Math.hypot(minion.x - destination.x, minion.z - destination.z);
}

function hasSquadMemberAtEscortDestination(gameState, destination) {
  if (!destination) return false;
  for (const player of Object.values(gameState.players || {})) {
    if (!player || player.dead || player.extracted) continue;
    if (distToEscortDestination(player, destination) <= ESCORT_DESTINATION_RADIUS) {
      return true;
    }
  }
  return false;
}

function getStartSpawn(layout) {
  const startRoom = layout?.rooms?.find((room) => room.role === 'start') || layout?.rooms?.[0];
  if (startRoom && Number.isFinite(startRoom.x) && Number.isFinite(startRoom.z)) {
    return { x: startRoom.x, z: startRoom.z };
  }
  return { x: 0, z: 0 };
}

function resolveEscortDestination(quest, layout) {
  const dest = quest?.escortDestination;
  if (!dest || !layout) return null;

  if (typeof dest.landmark === 'string' && Array.isArray(layout.landmarks)) {
    const landmark = layout.landmarks.find((lm) => lm.type === dest.landmark);
    if (landmark && Number.isFinite(landmark.x) && Number.isFinite(landmark.z)) {
      return {
        x: landmark.x,
        z: landmark.z,
        label: dest.landmark,
      };
    }
  }

  if (typeof dest.roomRole === 'string') {
    const rooms = roomsByRole(layout, dest.roomRole);
    if (rooms.length > 0) {
      const room = rooms[rooms.length - 1];
      return {
        x: room.x,
        z: room.z,
        label: dest.roomRole,
      };
    }
  }

  return null;
}

function formatEscortDestinationLabel(quest) {
  const dest = quest?.escortDestination;
  if (!dest) return 'extraction';
  if (typeof dest.landmark === 'string' && dest.landmark.length > 0) {
    return dest.landmark.replace(/_/g, ' ');
  }
  if (typeof dest.roomRole === 'string' && dest.roomRole.length > 0) {
    return dest.roomRole;
  }
  return 'extraction';
}

function getEscortMinion(gameState) {
  const minionId = gameState?.run?.escort?.minionId;
  if (!minionId || !Array.isArray(gameState.minions)) return null;
  return gameState.minions.find((minion) => minion.id === minionId) || null;
}

function isEscortAtDestination(run, layout, minionOrGameState) {
  const minion = minionOrGameState?.run ? getEscortMinion(minionOrGameState) : minionOrGameState;
  const destination = run?.escort?.destination;
  if (!minion || !destination) return false;
  const dist = Math.hypot(minion.x - destination.x, minion.z - destination.z);
  return dist <= ESCORT_DESTINATION_RADIUS;
}

function failEscortRun(gameState, label) {
  const run = gameState?.run;
  if (!run?.escort || run.escort.failed || run.status !== 'playing') return;

  run.escort.failed = true;
  if (run.objective) {
    run.objective.label = label;
    run.objective.escortFailed = true;
  }
  _checkRunTerminalState();
}

function spawnEscortNpc(gameState, quest, layout) {
  const run = gameState?.run;
  if (!run || run.escort) return null;

  const npcConfig = quest?.escortNpc;
  if (!npcConfig || typeof npcConfig.name !== 'string' || !npcConfig.name.trim()) {
    return null;
  }

  const destination = resolveEscortDestination(quest, layout);
  if (!destination) return null;

  const failOnDeath = quest.escortFailOnDeath !== false;
  const maxHp = Number.isFinite(npcConfig.maxHp) ? npcConfig.maxHp : 80;

  const activePlayers = Object.values(gameState.players || {}).filter(
    (player) => player && !player.dead && !player.extracted,
  );
  const anchorPlayer = activePlayers[0] || null;
  const startPos = getStartSpawn(layout);
  const spawnX = anchorPlayer ? anchorPlayer.x - 1.5 : startPos.x;
  const spawnZ = anchorPlayer ? anchorPlayer.z : startPos.z;

  const minion = {
    id: crypto.randomUUID(),
    ownerId: anchorPlayer ? Object.keys(gameState.players).find(
      (id) => gameState.players[id] === anchorPlayer,
    ) : 'escort',
    type: 'escort_npc',
    displayName: npcConfig.name.trim(),
    isEscort: true,
    x: spawnX,
    z: spawnZ,
    hp: maxHp,
    maxHp,
    ttl: Number.MAX_SAFE_INTEGER,
    maxTtl: Number.MAX_SAFE_INTEGER,
    createdAt: Date.now(),
    attackDamage: 0,
  };

  if (!Array.isArray(gameState.minions)) {
    gameState.minions = [];
  }
  gameState.minions.push(minion);

  run.escort = {
    minionId: minion.id,
    npcName: npcConfig.name.trim(),
    destination,
    failOnDeath,
    atDestination: false,
    failed: false,
    stallWaitStartedAt: null,
    lastDistToDestination: null,
  };

  if (run.objective) {
    run.objective.reachedDestination = false;
  }

  return minion;
}

function onEscortDamaged(minion, gameState) {
  if (!minion?.isEscort || !gameState?.run?.escort) return;
  if (gameState.run.escort.minionId !== minion.id) return;
  if (minion.hp > 0) return;
  onEscortDeath(minion, gameState);
}

function onEscortDeath(minion, gameState) {
  const run = gameState?.run;
  if (!run?.escort || run.escort.minionId !== minion.id) return;
  if (!run.escort.failOnDeath) return;
  const npcName = run.escort.npcName || 'Escort';
  failEscortRun(gameState, `${npcName} was lost — escort failed`);
}

function tickEscort(gameState) {
  const run = gameState?.run;
  if (!run?.escort || run.status !== 'playing' || gameState.gamePhase !== 'playing') {
    return;
  }
  if (run.escort.failed) return;

  const minion = getEscortMinion(gameState);
  if (!minion) {
    if (run.escort.failOnDeath) {
      const npcName = run.escort.npcName || 'Escort';
      failEscortRun(gameState, `${npcName} was lost — escort failed`);
    }
    return;
  }

  const atDestination = isEscortAtDestination(run, gameState.layout, minion);
  if (atDestination !== run.escort.atDestination) {
    run.escort.atDestination = atDestination;
    if (run.objective) {
      run.objective.reachedDestination = atDestination;
    }
  }

  if (atDestination) {
    run.escort.stallWaitStartedAt = null;
    _checkRunTerminalState();
    return;
  }

  const { destination } = run.escort;
  const dist = distToEscortDestination(minion, destination);
  const squadWaiting = hasSquadMemberAtEscortDestination(gameState, destination);

  if (!squadWaiting) {
    run.escort.stallWaitStartedAt = null;
    run.escort.lastDistToDestination = dist;
    return;
  }

  const lastDist = run.escort.lastDistToDestination;
  if (lastDist != null && lastDist - dist >= ESCORT_STALL_PROGRESS_EPSILON) {
    run.escort.stallWaitStartedAt = null;
  }
  run.escort.lastDistToDestination = dist;

  if (run.escort.stallWaitStartedAt == null) {
    run.escort.stallWaitStartedAt = simNow();
    return;
  }

  if (simNow() - run.escort.stallWaitStartedAt >= _escortStallFailMs) {
    const npcName = run.escort.npcName || 'Escort';
    failEscortRun(gameState, `${npcName} failed to reach extraction — escort stalled`);
  }
}

module.exports = {
  ESCORT_DESTINATION_RADIUS,
  ESCORT_STALL_FAIL_MS,
  ESCORT_STALL_PROGRESS_EPSILON,
  setEscortCallbacks,
  setEscortStallFailMsForTests,
  resolveEscortDestination,
  formatEscortDestinationLabel,
  getEscortMinion,
  isEscortAtDestination,
  spawnEscortNpc,
  tickEscort,
  onEscortDamaged,
  onEscortDeath,
  failEscortRun,
};
