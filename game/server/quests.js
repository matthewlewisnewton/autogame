// Quest tier defs may optionally include `stageBossEncounter`:
//   { bossType, trigger, roomRole?, rewardCurrencyBonus?, unlockOnClear? }
// See game/server/bossEncounter.js for the documented config shape. No tier is
// wired with a stage boss in this sub-ticket; later sub-tickets attach encounters
// to specific quest tiers (e.g. arena_trials tier 2).
const QUEST_DEFS = {
  training_caverns: {
    id: 'training_caverns',
    enemyPool: [
      { type: 'grunt', weight: 3 },
      { type: 'skirmisher', weight: 2 },
    ],
    tiers: {
      1: {
        name: 'Initiate Vault',
        description: 'Purge hostiles from the derelict annex sector.',
        objectiveType: 'defeat_enemies',
        enemyCount: 5,
        rewardCurrency: 10,
        layoutProfile: 'crowded',
      },
      2: {
        tier: 2,
        name: 'Initiate Vault — Tier II',
        description: 'Advanced clearance of the derelict annex sector.',
        objectiveType: 'defeat_enemies',
        enemyCount: 5,
        rewardCurrency: 10,
        layoutProfile: 'crowded',
        unlockRequires: { questId: 'training_caverns', tier: 1 },
      },
    },
  },
  crystal_rescue: {
    id: 'crystal_rescue',
    enemyPool: [
      { type: 'skirmisher', weight: 3 },
      { type: 'grunt', weight: 2 },
    ],
    tiers: {
      1: {
        name: 'Prism Salvage',
        description: 'Recover resonance prisms from the collapsed lattice.',
        objectiveType: 'collect_items',
        itemCount: 3,
        enemyCount: 4,
        rewardCurrency: 12,
        layoutProfile: 'open',
      },
    },
  },
  arena_trials: {
    id: 'arena_trials',
    enemyPool: [
      { type: 'grunt', weight: 2 },
      { type: 'skirmisher', weight: 2 },
      { type: 'miniboss', weight: 1 },
    ],
    tiers: {
      1: {
        name: 'Arena Trials',
        description: 'Survive the open plaza and rout the trial wardens.',
        objectiveType: 'defeat_enemies',
        enemyCount: 6,
        rewardCurrency: 15,
        layoutProfile: 'open-plaza',
      },
      2: {
        tier: 2,
        name: 'Arena Trials — Tier II',
        description: 'Face the rigid trial grounds where every warden bears a twisted mark.',
        objectiveType: 'defeat_enemies',
        enemyCount: 6,
        rewardCurrency: 15,
        layoutProfile: 'open-plaza',
        layoutMode: 'rigid',
        unlockRequires: { questId: 'arena_trials', tier: 1 },
      },
    },
  },
  canyon_descent: {
    id: 'canyon_descent',
    enemyPool: [
      { type: 'skirmisher', weight: 2 },
      { type: 'grunt', weight: 2 },
      { type: 'miniboss', weight: 1 },
    ],
    tiers: {
      1: {
        name: 'Canyon Descent',
        description: 'Clear hostiles from the sunken canyon below the plateau overlook.',
        objectiveType: 'defeat_enemies',
        enemyCount: 6,
        rewardCurrency: 14,
        layoutProfile: 'sunken-canyon',
      },
    },
  },
  spire_ascent: {
    id: 'spire_ascent',
    enemyPool: [
      { type: 'grunt', weight: 2 },
      { type: 'skirmisher', weight: 1 },
      { type: 'miniboss', weight: 1 },
      { type: 'spawner', weight: 2 },
    ],
    tiers: {
      1: {
        name: 'Spire Ascent',
        description: 'Fight your way up the tower tiers to claim the summit treasure.',
        objectiveType: 'defeat_enemies',
        enemyCount: 6,
        rewardCurrency: 16,
        layoutProfile: 'spire-ascent',
      },
    },
  },
  endless_siege: {
    id: 'endless_siege',
    enemyPool: [
      { type: 'grunt', weight: 2 },
      { type: 'skirmisher', weight: 2 },
    ],
    tiers: {
      1: {
        name: 'Endless Siege',
        description: 'Outlast the staggered assault until every attacker has fallen.',
        objectiveType: 'survive',
        totalSpawns: 10,
        minibossCount: 2,
        rewardCurrency: 20,
        layoutProfile: 'open-plaza',
      },
    },
  },
};

const DEFAULT_QUEST_ID = 'training_caverns';
const DEFAULT_QUEST_TIER = 1;

function normalizeQuestTier(tier) {
  if (tier === undefined || tier === null) {
    return DEFAULT_QUEST_TIER;
  }
  const n = Number(tier);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_QUEST_TIER;
}

function getQuestTierDef(questId, tier) {
  const quest = QUEST_DEFS[questId];
  if (!quest || !quest.tiers) {
    return null;
  }
  return quest.tiers[tier] || null;
}

function isValidQuestId(questId) {
  return typeof questId === 'string' && Object.prototype.hasOwnProperty.call(QUEST_DEFS, questId);
}

function isValidQuestSelection(questId, tier) {
  if (!isValidQuestId(questId)) {
    return false;
  }
  const normalizedTier = normalizeQuestTier(tier);
  return getQuestTierDef(questId, normalizedTier) != null;
}

function getQuest(questId, tier) {
  if (!isValidQuestId(questId)) {
    return null;
  }
  const normalizedTier = normalizeQuestTier(tier);
  const tierDef = getQuestTierDef(questId, normalizedTier);
  if (!tierDef) {
    return null;
  }
  return {
    id: questId,
    questId,
    tier: normalizedTier,
    ...tierDef,
  };
}

function getDefaultQuestId() {
  return DEFAULT_QUEST_ID;
}

function listQuests() {
  return Object.keys(QUEST_DEFS)
    .map((questId) => getQuest(questId, DEFAULT_QUEST_TIER))
    .filter(Boolean);
}

function formatObjectiveSummary(quest) {
  if (!quest) {
    return '';
  }
  if (quest.objectiveType === 'collect_items') {
    return `Recover ${quest.itemCount ?? 0} prisms`;
  }
  if (quest.objectiveType === 'defeat_enemies') {
    return `Neutralize ${quest.enemyCount ?? 0} hostiles`;
  }
  if (quest.objectiveType === 'survive') {
    const totalSpawns = quest.totalSpawns ?? 0;
    const minibossCount = quest.minibossCount ?? 0;
    return `Survive ${totalSpawns} hostiles (${minibossCount} wardens)`;
  }
  return quest.description || '';
}

function formatRewardSummary(quest) {
  if (!quest || quest.rewardCurrency == null) {
    return 'Reward: —';
  }
  return `Reward: ${quest.rewardCurrency} stones`;
}

function listQuestVariants() {
  const variants = [];
  for (const questId of Object.keys(QUEST_DEFS)) {
    const quest = QUEST_DEFS[questId];
    const tierKeys = Object.keys(quest.tiers)
      .map(Number)
      .sort((a, b) => a - b);
    for (const tier of tierKeys) {
      const resolved = getQuest(questId, tier);
      if (!resolved) {
        continue;
      }
      variants.push({
        questId,
        tier,
        id: questId,
        name: resolved.name,
        description: resolved.description,
        objectiveType: resolved.objectiveType,
        objectiveSummary: formatObjectiveSummary(resolved),
        rewardSummary: formatRewardSummary(resolved),
        isTier2: tier === 2,
        unlockRequires: resolved.unlockRequires || null,
      });
    }
  }
  return variants;
}

function getSelectedQuest(gameState) {
  const questId = gameState && gameState.selectedQuestId;
  const tier = gameState && gameState.selectedQuestTier;
  return getQuest(questId, tier) || getQuest(DEFAULT_QUEST_ID, DEFAULT_QUEST_TIER);
}

function buildSharedQuestUpdatePayload(gameState) {
  const selectedQuestId = (gameState && gameState.selectedQuestId) || DEFAULT_QUEST_ID;
  const selectedQuestTier = (gameState && gameState.selectedQuestTier) ?? DEFAULT_QUEST_TIER;
  return {
    selectedQuestId,
    selectedQuestTier,
    quests: listQuests(),
    questVariants: listQuestVariants(),
  };
}

function buildQuestUpdatePayload(gameState, playerAccountId) {
  const payload = buildSharedQuestUpdatePayload(gameState);
  if (playerAccountId) {
    const { getUnlockedQuestTiers } = require('./users');
    payload.unlockedQuestTiers = getUnlockedQuestTiers(playerAccountId) || {};
  }
  return payload;
}

function getLayoutProfileForQuest(questId, tier) {
  const quest = getQuest(questId, tier);
  const fallback = getQuest(DEFAULT_QUEST_ID, DEFAULT_QUEST_TIER);
  return (quest && quest.layoutProfile) || (fallback && fallback.layoutProfile) || 'crowded';
}

/**
 * Layout generation options for a quest tier: slopes always enabled for quest
 * layouts; optional `layoutMode` on the tier def (defaults to 'default').
 */
function getLayoutGenerationOptions(questId, tier) {
  const quest = getQuest(questId, tier);
  const rawMode = quest && quest.layoutMode;
  const layoutMode = rawMode === 'rigid' ? 'rigid' : 'default';
  return { slopes: true, layoutMode };
}

// Returns the enemy spawn pool for a quest, falling back to the default quest's
// pool for an unknown/invalid quest id.
function getEnemyPool(questId) {
  const def = isValidQuestId(questId) ? QUEST_DEFS[questId] : null;
  if (def && def.enemyPool) {
    return def.enemyPool;
  }
  return QUEST_DEFS[DEFAULT_QUEST_ID].enemyPool;
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
  DEFAULT_QUEST_TIER,
  isValidQuestId,
  isValidQuestSelection,
  normalizeQuestTier,
  getQuest,
  getDefaultQuestId,
  listQuests,
  listQuestVariants,
  getSelectedQuest,
  getLayoutProfileForQuest,
  getLayoutGenerationOptions,
  buildSharedQuestUpdatePayload,
  buildQuestUpdatePayload,
  formatObjectiveSummary,
  formatRewardSummary,
  getEnemyPool,
  pickWeightedEnemyType,
};
