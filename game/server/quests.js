const QUEST_DEFS = {
  training_caverns: {
    id: 'training_caverns',
    name: 'Initiate Vault',
    description: 'Purge hostiles from the derelict annex sector.',
    objectiveType: 'defeat_enemies',
    enemyCount: 5,
    rewardCurrency: 10,
    layoutProfile: 'crowded',
  },
  crystal_rescue: {
    id: 'crystal_rescue',
    name: 'Prism Salvage',
    description: 'Recover resonance prisms from the collapsed lattice.',
    objectiveType: 'collect_items',
    itemCount: 3,
    enemyCount: 4,
    rewardCurrency: 12,
    layoutProfile: 'open',
  },
  spire_ascent: {
    id: 'spire_ascent',
    name: 'Spire Ascent',
    description: 'Ascend the fractured spire, purge hostiles tier by tier, and reach the summit exit.',
    objectiveType: 'defeat_enemies_reach_exit',
    enemyCount: 8,
    rewardCurrency: 15,
    layoutProfile: 'crowded',
    layoutStage: 'spire-ascent',
  },
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

function getLayoutProfileForQuest(questId) {
  const quest = getQuest(questId);
  return (quest && quest.layoutProfile) || QUEST_DEFS.training_caverns.layoutProfile;
}

/** Options passed to generateLayout for a quest (spire stage vs default sloped grid). */
function buildLayoutGenerateOptions(questId) {
  const quest = getQuest(questId);
  if (quest && quest.layoutStage) {
    return { stage: quest.layoutStage };
  }
  return { slopes: true };
}

module.exports = {
  QUEST_DEFS,
  DEFAULT_QUEST_ID,
  isValidQuestId,
  getQuest,
  getDefaultQuestId,
  listQuests,
  getSelectedQuest,
  getLayoutProfileForQuest,
  buildLayoutGenerateOptions,
  buildQuestUpdatePayload
};
