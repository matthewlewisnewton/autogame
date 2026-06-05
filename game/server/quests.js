const QUEST_DEFS = {
  training_caverns: {
    id: 'training_caverns',
    name: 'Initiate Vault',
    description: 'Purge hostiles from the derelict annex sector.',
    objectiveType: 'defeat_enemies',
    enemyCount: 5,
    rewardCurrency: 10,
    layoutProfile: 'crowded',
    enemyPool: [
      { type: 'grunt', weight: 3 },
      { type: 'skirmisher', weight: 2 },
    ],
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
    enemyPool: [
      { type: 'skirmisher', weight: 3 },
      { type: 'grunt', weight: 2 },
    ],
  },
  arena_trials: {
    id: 'arena_trials',
    name: 'Arena Trials',
    description: 'Survive the open plaza and rout the trial wardens.',
    objectiveType: 'defeat_enemies',
    enemyCount: 6,
    rewardCurrency: 15,
    layoutProfile: 'open-plaza',
    enemyPool: [
      { type: 'grunt', weight: 2 },
      { type: 'skirmisher', weight: 2 },
      { type: 'miniboss', weight: 1 },
    ],
  },
  canyon_descent: {
    id: 'canyon_descent',
    name: 'Canyon Descent',
    description: 'Clear hostiles from the sunken canyon below the plateau overlook.',
    objectiveType: 'defeat_enemies',
    enemyCount: 6,
    rewardCurrency: 14,
    layoutProfile: 'sunken-canyon',
    enemyPool: [
      { type: 'skirmisher', weight: 2 },
      { type: 'grunt', weight: 2 },
      { type: 'miniboss', weight: 1 },
    ],
  },
  spire_ascent: {
    id: 'spire_ascent',
    name: 'Spire Ascent',
    description: 'Fight your way up the tower tiers to claim the summit treasure.',
    objectiveType: 'defeat_enemies',
    enemyCount: 6,
    rewardCurrency: 16,
    layoutProfile: 'spire-ascent',
    enemyPool: [
      { type: 'grunt', weight: 2 },
      { type: 'skirmisher', weight: 1 },
      { type: 'miniboss', weight: 1 },
      { type: 'spawner', weight: 2 },
    ],
  },
  endless_siege: {
    id: 'endless_siege',
    name: 'Endless Siege',
    description: 'Outlast the staggered assault until every attacker has fallen.',
    objectiveType: 'survive',
    totalSpawns: 10,
    minibossCount: 2,
    rewardCurrency: 20,
    layoutProfile: 'open-plaza',
    enemyPool: [
      { type: 'grunt', weight: 2 },
      { type: 'skirmisher', weight: 2 },
    ],
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

// Returns the enemy spawn pool for a quest, falling back to the default quest's
// pool for an unknown/invalid quest id.
function getEnemyPool(questId) {
  const quest = getQuest(questId);
  return (quest && quest.enemyPool) || QUEST_DEFS[DEFAULT_QUEST_ID].enemyPool;
}

// Draws an enemy `type` from a `[{ type, weight }]` pool in proportion to the
// weights. Deterministic for a given `rng` (defaults to Math.random).
function pickWeightedEnemyType(pool, rng = Math.random) {
  const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng() * total;
  for (const entry of pool) {
    roll -= entry.weight;
    if (roll < 0) return entry.type;
  }
  // Floating-point fallback: return the last entry's type.
  return pool[pool.length - 1].type;
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
  buildQuestUpdatePayload,
  getEnemyPool,
  pickWeightedEnemyType
};
