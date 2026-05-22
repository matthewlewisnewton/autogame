const QUEST_DEFS = {
  training_caverns: {
    id: 'training_caverns',
    name: 'Training Caverns',
    description: 'Clear a small dungeon of hostile creatures.',
    objectiveType: 'defeat_enemies',
    enemyCount: 5,
    rewardCurrency: 10
  },
  crystal_rescue: {
    id: 'crystal_rescue',
    name: 'Crystal Rescue',
    description: 'Recover lost crystals from a guarded room.',
    objectiveType: 'collect_items',
    itemCount: 3,
    enemyCount: 4,
    rewardCurrency: 12
  }
};

const DEFAULT_QUEST_ID = 'training_caverns';

function isValidQuestId(questId) {
  return typeof questId === 'string' && Object.prototype.hasOwnProperty.call(QUEST_DEFS, questId);
}

function getQuest(questId) {
  return isValidQuestId(questId) ? QUEST_DEFS[questId] : null;
}

function getDefaultQuestId() {
  return DEFAULT_QUEST_ID;
}

function listQuests() {
  return Object.values(QUEST_DEFS);
}

function getSelectedQuest(gameState) {
  const questId = gameState && gameState.selectedQuestId;
  return getQuest(questId) || getQuest(DEFAULT_QUEST_ID);
}

function buildQuestUpdatePayload(gameState) {
  const selectedQuestId = (gameState && gameState.selectedQuestId) || DEFAULT_QUEST_ID;
  return {
    selectedQuestId,
    quests: listQuests()
  };
}

module.exports = {
  QUEST_DEFS,
  DEFAULT_QUEST_ID,
  isValidQuestId,
  getQuest,
  getDefaultQuestId,
  listQuests,
  getSelectedQuest,
  buildQuestUpdatePayload
};
