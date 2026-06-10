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
  const defaultSpeaker = quest.client?.name ?? 'Client';

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

module.exports = {
  dialogueTriggerKey,
  matchDialogueTrigger,
  resetDialogueState,
  fireQuestDialogue,
};
