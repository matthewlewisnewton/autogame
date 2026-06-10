const { SERVER_TO_CLIENT } = require('../shared/events.js');
const { getQuest } = require('./quests.js');

/**
 * Stable dedupe key for a dialogue trigger value.
 * @param {import('./quests.js').DialogueTrigger} trigger
 */
function dialogueTriggerKey(trigger) {
  if (typeof trigger === 'string') return trigger;
  if (trigger && typeof trigger === 'object') {
    if (Object.prototype.hasOwnProperty.call(trigger, 'itemCollected')) {
      return `itemCollected:${trigger.itemCollected}`;
    }
    if (Object.prototype.hasOwnProperty.call(trigger, 'waveCleared')) {
      return `waveCleared:${trigger.waveCleared}`;
    }
  }
  return JSON.stringify(trigger);
}

/**
 * @param {import('./quests.js').DialogueEntry} entry
 * @param {string | { itemCollected: number } | { waveCleared: number }} event
 */
function matchDialogueTrigger(entry, event) {
  if (!entry || entry.trigger == null || event == null) return false;

  const trigger = entry.trigger;

  if (typeof event === 'string') {
    return trigger === event;
  }

  if (typeof event === 'object') {
    if (Object.prototype.hasOwnProperty.call(event, 'itemCollected')) {
      return (
        typeof trigger === 'object'
        && trigger !== null
        && trigger.itemCollected === event.itemCollected
      );
    }
    if (Object.prototype.hasOwnProperty.call(event, 'waveCleared')) {
      return (
        typeof trigger === 'object'
        && trigger !== null
        && trigger.waveCleared === event.waveCleared
      );
    }
  }

  return false;
}

function ensureDialogueState(run) {
  if (!run._firedDialogueKeys) {
    run._firedDialogueKeys = new Set();
  }
  return run._firedDialogueKeys;
}

function resetDialogueState(run) {
  if (!run) return;
  run._firedDialogueKeys = new Set();
}

/**
 * Evaluate quest dialogue for `event` and emit `questDialogue` once per trigger per run.
 * @returns {Array<{ speaker: string, text: string, questId: string, tier: number, trigger: import('./quests.js').DialogueTrigger }>}
 */
function fireQuestDialogue(io, gameState, event) {
  const run = gameState?.run;
  if (!run || !io || typeof io.emit !== 'function') return [];

  const quest = getQuest(run.questId, run.questTier);
  const dialogue = quest?.dialogue;
  if (!Array.isArray(dialogue) || dialogue.length === 0) return [];

  const fired = ensureDialogueState(run);
  const emitted = [];
  const defaultSpeaker = quest.client?.name ?? quest.clientNpc ?? 'Client';

  for (const entry of dialogue) {
    if (!matchDialogueTrigger(entry, event)) continue;

    const key = dialogueTriggerKey(entry.trigger);
    if (fired.has(key)) continue;

    fired.add(key);

    const payload = {
      speaker: entry.speaker ?? defaultSpeaker,
      text: entry.text,
      questId: run.questId,
      tier: run.questTier,
      trigger: entry.trigger,
    };

    io.emit(SERVER_TO_CLIENT.QUEST_DIALOGUE, payload);
    emitted.push(payload);
  }

  return emitted;
}

/**
 * Mid-run quest dialogue beacons — PSO-style radio lines fired on scripted progress.
 */
const TRIGGER_TYPES = new Set([
  'onWaveCleared',
  'onCrystalCollected',
  'onRoomEntered',
  'onExtractionStart',
  'onExtractionComplete',
]);

function ensureDialogueFired(run) {
  if (!run.dialogueFired) {
    run.dialogueFired = new Set();
  } else if (Array.isArray(run.dialogueFired)) {
    run.dialogueFired = new Set(run.dialogueFired);
  }
  return run.dialogueFired;
}

function ensureDialogueRoomsEntered(run) {
  if (!run._dialogueRoomsEntered) {
    run._dialogueRoomsEntered = new Set();
  } else if (Array.isArray(run._dialogueRoomsEntered)) {
    run._dialogueRoomsEntered = new Set(run._dialogueRoomsEntered);
  }
  return run._dialogueRoomsEntered;
}

function initDialogueState(run) {
  if (!run) return;
  ensureDialogueFired(run);
  ensureDialogueRoomsEntered(run);
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
  if (typeof beacon.band === 'string' && beacon.band.length > 0) {
    const room = ctx.layout?.rooms?.[ctx.roomIndex];
    return room?.band === beacon.band;
  }
  if (typeof beacon.landmark === 'string' && beacon.landmark.length > 0) {
    return ctx.landmark === beacon.landmark
      || (ctx.roomIndex != null && ctx.roomIndex === roomIndexForLandmark(ctx.layout, beacon.landmark));
  }
  if (beacon.roomIndex != null) {
    return beacon.roomIndex === ctx.roomIndex;
  }
  return false;
}

function matchesExtractionBeacon(beacon, trigger) {
  return beacon.trigger === trigger;
}

function matchesTrigger(beacon, trigger, ctx) {
  if (beacon.trigger !== trigger) return false;
  if (trigger === 'onWaveCleared') return matchesWaveCleared(beacon, ctx);
  if (trigger === 'onCrystalCollected') return matchesCrystalCollected(beacon, ctx);
  if (trigger === 'onRoomEntered') return matchesRoomEntered(beacon, ctx);
  if (trigger === 'onExtractionStart' || trigger === 'onExtractionComplete') {
    return matchesExtractionBeacon(beacon, trigger);
  }
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
function tickDialogueRoomEntry(gameState, io, getQuestFn) {
  const run = gameState?.run;
  if (!run || run.status !== 'playing' || !gameState.layout) return;

  initDialogueState(run);
  const quest = getQuestFn(run.questId, run.questTier);
  if (!quest || getDialogueBeacons(quest).every((b) => b.trigger !== 'onRoomEntered')) return;

  const entered = run._dialogueRoomsEntered;
  const layout = gameState.layout;

  for (const player of Object.values(gameState.players || {})) {
    if (!player || player.dead || player.extracted) continue;

    const roomIndex = findRoomIndexAt(layout, player.x, player.z);
    if (roomIndex < 0) continue;

    const ctxBase = { layout, roomIndex };
    const keys = [`room:${roomIndex}`];
    const room = layout.rooms[roomIndex];
    if (room?.band) {
      keys.push(`band:${room.band}`);
    }
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
  dialogueTriggerKey,
  matchDialogueTrigger,
  resetDialogueState,
  fireQuestDialogue,
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
  roomEnterKey,
};
