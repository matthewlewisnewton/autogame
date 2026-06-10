/**
 * Mid-run quest dialogue beacons — PSO-style radio lines fired on scripted progress.
 */
const { SERVER_TO_CLIENT } = require('../shared/events.js');

const TRIGGER_TYPES = new Set(['onWaveCleared', 'onCrystalCollected', 'onRoomEntered']);

function ensureDialogueFired(run) {
  if (!run.dialogueFired) {
    run.dialogueFired = new Set();
  } else if (Array.isArray(run.dialogueFired)) {
    run.dialogueFired = new Set(run.dialogueFired);
  }
  return run.dialogueFired;
}

function initDialogueState(run) {
  if (!run) return;
  ensureDialogueFired(run);
  run._dialogueRoomsEntered = run._dialogueRoomsEntered || new Set();
}

function getDialogueBeacons(quest) {
  if (!quest || !Array.isArray(quest.dialogueBeacons)) {
    return [];
  }
  return quest.dialogueBeacons.filter(
    (beacon) => beacon && typeof beacon.beaconId === 'string' && TRIGGER_TYPES.has(beacon.trigger),
  );
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

function findRoomIndexAt(layout, x, z) {
  if (!layout?.rooms) return -1;
  for (let i = 0; i < layout.rooms.length; i++) {
    if (playerInRoom(x, z, layout.rooms[i])) {
      return i;
    }
  }
  return -1;
}

function roomIndexForLandmark(layout, landmarkType) {
  if (!layout?.landmarks || typeof landmarkType !== 'string') return -1;
  const landmark = layout.landmarks.find((lm) => lm.type === landmarkType);
  if (!landmark) return -1;
  return findRoomIndexAt(layout, landmark.x, landmark.z);
}

function roomEnterKey(roomIndex, landmark) {
  if (typeof landmark === 'string' && landmark.length > 0) {
    return `landmark:${landmark}`;
  }
  if (Number.isInteger(roomIndex) && roomIndex >= 0) {
    return `room:${roomIndex}`;
  }
  return null;
}

function matchesWaveCleared(beacon, ctx) {
  if (beacon.trigger !== 'onWaveCleared') return false;
  if (beacon.roomIndex != null && beacon.roomIndex !== ctx.roomIndex) return false;
  if (beacon.waveIndex != null && beacon.waveIndex !== ctx.waveIndex) return false;
  return Number.isInteger(ctx.roomIndex) && Number.isInteger(ctx.waveIndex);
}

function matchesCrystalCollected(beacon, ctx) {
  if (beacon.trigger !== 'onCrystalCollected') return false;
  if (beacon.crystalIndex != null && beacon.crystalIndex !== ctx.collectedCount) return false;
  return Number.isInteger(ctx.collectedCount) && ctx.collectedCount > 0;
}

function matchesRoomEntered(beacon, ctx) {
  if (beacon.trigger !== 'onRoomEntered') return false;
  if (typeof beacon.landmark === 'string' && beacon.landmark.length > 0) {
    return ctx.landmark === beacon.landmark
      || (ctx.roomIndex != null && ctx.roomIndex === roomIndexForLandmark(ctx.layout, beacon.landmark));
  }
  if (beacon.roomIndex != null) {
    return beacon.roomIndex === ctx.roomIndex;
  }
  return false;
}

function matchesTrigger(beacon, trigger, ctx) {
  if (beacon.trigger !== trigger) return false;
  if (trigger === 'onWaveCleared') return matchesWaveCleared(beacon, ctx);
  if (trigger === 'onCrystalCollected') return matchesCrystalCollected(beacon, ctx);
  if (trigger === 'onRoomEntered') return matchesRoomEntered(beacon, ctx);
  return false;
}

/**
 * Evaluate dialogue beacons for a trigger. Each beaconId fires at most once per run.
 * @returns {Array<{ questId: string, tier: number, beaconId: string, speaker: string, line: string }>}
 */
function evaluateDialogueBeacons(run, quest, trigger, ctx = {}) {
  if (!run || !quest || !TRIGGER_TYPES.has(trigger)) return [];

  const fired = ensureDialogueFired(run);
  const beacons = getDialogueBeacons(quest);
  const payloads = [];

  for (const beacon of beacons) {
    if (!matchesTrigger(beacon, trigger, ctx)) continue;
    if (fired.has(beacon.beaconId)) continue;
    if (typeof beacon.line !== 'string' || beacon.line.length === 0) continue;

    fired.add(beacon.beaconId);
    payloads.push({
      questId: run.questId,
      tier: run.questTier ?? 1,
      beaconId: beacon.beaconId,
      speaker: typeof beacon.speaker === 'string' ? beacon.speaker : (quest.clientNpc || ''),
      line: beacon.line,
    });
  }

  return payloads;
}

function emitQuestDialogue(io, lobby, payload) {
  if (!io || !payload) return;
  if (lobby && typeof lobby.id === 'string') {
    io.to(lobby.id).emit(SERVER_TO_CLIENT.QUEST_DIALOGUE, payload);
    return;
  }
  io.emit(SERVER_TO_CLIENT.QUEST_DIALOGUE, payload);
}

function emitQuestDialoguePayloads(io, lobby, payloads) {
  if (!io || !Array.isArray(payloads) || payloads.length === 0) return;
  for (const payload of payloads) {
    emitQuestDialogue(io, lobby, payload);
  }
}

function emitDialogueForRun(_gameState, run, quest, trigger, ctx, io, lobby = null) {
  if (!run || !quest || !io) return [];
  const payloads = evaluateDialogueBeacons(run, quest, trigger, ctx);
  emitQuestDialoguePayloads(io, lobby, payloads);
  return payloads;
}

/**
 * Track player room occupancy and fire onRoomEntered beacons on first entry.
 */
function tickDialogueRoomEntry(gameState, io, getQuest) {
  const run = gameState?.run;
  if (!run || run.status !== 'playing' || !gameState.layout) return;

  initDialogueState(run);
  const quest = getQuest(run.questId, run.questTier);
  if (!quest || getDialogueBeacons(quest).every((b) => b.trigger !== 'onRoomEntered')) return;

  const entered = run._dialogueRoomsEntered;
  const layout = gameState.layout;

  for (const player of Object.values(gameState.players || {})) {
    if (!player || player.dead || player.extracted) continue;

    const roomIndex = findRoomIndexAt(layout, player.x, player.z);
    if (roomIndex < 0) continue;

    const ctxBase = { layout, roomIndex };
    const keys = [`room:${roomIndex}`];
    if (Array.isArray(layout.landmarks)) {
      for (const lm of layout.landmarks) {
        if (findRoomIndexAt(layout, lm.x, lm.z) === roomIndex && lm.type) {
          keys.push(`landmark:${lm.type}`);
        }
      }
    }

    for (const key of keys) {
      if (entered.has(key)) continue;
      entered.add(key);

      const landmark = key.startsWith('landmark:') ? key.slice('landmark:'.length) : undefined;
      const payloads = evaluateDialogueBeacons(
        run,
        quest,
        'onRoomEntered',
        { ...ctxBase, landmark },
      );
      const lobby = null;
      emitQuestDialoguePayloads(io, lobby, payloads);
    }
  }
}

module.exports = {
  TRIGGER_TYPES,
  initDialogueState,
  getDialogueBeacons,
  evaluateDialogueBeacons,
  emitQuestDialogue,
  emitQuestDialoguePayloads,
  emitDialogueForRun,
  tickDialogueRoomEntry,
  findRoomIndexAt,
  playerInRoom,
};
