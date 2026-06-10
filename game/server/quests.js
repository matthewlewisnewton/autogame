/**
 * Optional stage-boss encounter metadata on a quest tier (wired in sub-ticket 05).
 * @typedef {Object} EncounterConfig
 * @property {string} [bossType] - Enemy type for the stage boss (default `miniboss`).
 * @property {string} [landmark] - Layout landmark type for boss spawn (e.g. `arena_dais`).
 * @property {number} [addCount] - Regular adds spawned from the quest enemy pool (boss excluded).
 * @property {{ x: number, z: number }} [spawnAnchor] - Encounter state anchor override.
 */

/**
 * Hand-placed spawn entry for a scripted quest wave.
 * @typedef {Object} QuestScriptSpawn
 * @property {string} type - Enemy type id.
 * @property {number} x - World X coordinate.
 * @property {number} z - World Z coordinate.
 */

/**
 * Room binding for a scripted wave trigger (center coords or layout landmark).
 * @typedef {{ x: number, z: number } | { landmark: string }} QuestScriptRoom
 */

/**
 * One authored wave in a quest script.
 * @typedef {Object} QuestScriptWave
 * @property {string} id - Stable wave id for chaining (`waveCleared` triggers).
 * @property {QuestScriptRoom} [room] - Room the wave is bound to.
 * @property {'run_start' | 'enter_room' | { waveCleared: string }} trigger
 * @property {QuestScriptSpawn[]} spawns - Hand-placed enemies for this wave.
 */

/**
 * Normalized quest script returned by `getQuestScript`.
 * @typedef {Object} QuestScript
 * @property {QuestScriptWave[]} waves
 */

const QUEST_DEFS = {
  training_caverns: {
    id: 'training_caverns',
    enemyPool: [
      { type: 'grunt', weight: 3 },
      { type: 'skirmisher', weight: 2 },
    ],
    tier2EnemyPool: [{ type: 'field_medic', weight: 1 }],
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
        objectiveType: 'stage_boss',
        rewardCurrency: 10,
        layoutProfile: 'crowded',
        layoutMode: 'rigid',
        unlockRequires: { questId: 'training_caverns', tier: 1 },
        encounter: {
          bossType: 'annex_overseer',
          landmark: 'vault_dais',
          addCount: 4,
        },
      },
    },
  },
  crystal_rescue: {
    id: 'crystal_rescue',
    enemyPool: [
      { type: 'skirmisher', weight: 3 },
      { type: 'grunt', weight: 2 },
    ],
    tier2EnemyPool: [{ type: 'field_medic', weight: 1 }],
    tiers: {
      1: {
        name: 'Prism Salvage',
        description: 'Recover resonance prisms from the collapsed lattice.',
        objectiveType: 'collect_items',
        itemCount: 3,
        enemyCount: 4,
        rewardCurrency: 12,
        layoutProfile: 'open',
        // Utility-theme signature rewards (see frost_crossing tier 1 for field docs).
        signatureCardId: 'mana_prism',
        rewardCards: ['mana_prism', 'harvesting_scythe'],
      },
      2: {
        tier: 2,
        name: 'Prism Salvage — Tier II',
        description: 'Recover resonance prisms from the rigid collapsed lattice.',
        objectiveType: 'collect_items',
        itemCount: 5,
        enemyCount: 5,
        rewardCurrency: 18,
        layoutProfile: 'open',
        layoutMode: 'rigid',
        unlockRequires: { questId: 'crystal_rescue', tier: 1 },
        signatureCardId: 'mana_prism',
        rewardCards: ['mana_prism', 'harvesting_scythe'],
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
        objectiveType: 'stage_boss',
        rewardCurrency: 15,
        layoutProfile: 'open-plaza',
        layoutMode: 'rigid',
        unlockRequires: { questId: 'arena_trials', tier: 1 },
        encounter: {
          bossType: 'arena_champion',
          landmark: 'arena_dais',
          addCount: 4,
        },
      },
    },
  },
  frost_crossing: {
    id: 'frost_crossing',
    // Signature foe that must always appear in this level's combat spawn set.
    // Level-scoped: only quests that declare this force a guaranteed type.
    guaranteedEnemyType: 'glacial_thrower',
    enemyPool: [
      { type: 'grunt', weight: 3 },
      { type: 'skirmisher', weight: 2 },
      // Ice-level signature foe — a ranged thrower that lobs slow ice balls.
      // Level-exclusive: do not add to non-ice quests.
      { type: 'glacial_thrower', weight: 2 },
    ],
    tiers: {
      1: {
        name: 'Frost Crossing',
        description: 'Cross the frozen cavern and purge hostiles from the ice field.',
        objectiveType: 'defeat_enemies',
        enemyCount: 6,
        rewardCurrency: 14,
        layoutProfile: 'ice-cavern',
        // Signature reward card: always offered as the first post-victory card
        // choice. rewardCards is the quest's pool for the empty-choices victory
        // fallback (replaces the global VICTORY_REWARD_ROTATION). Both fields are
        // optional and tier-scoped; quests without them keep global behavior.
        // Ids must be acquisition: 'reward' cards in shared/cardDefs.json.
        signatureCardId: 'ice_ball',
        rewardCards: ['ice_ball', 'frost_nova', 'permafrost_lance'],
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
    tier2EnemyPool: [{ type: 'field_medic', weight: 1 }],
    tiers: {
      1: {
        name: 'Canyon Descent',
        description: 'Clear hostiles from the sunken canyon below the plateau overlook.',
        objectiveType: 'defeat_enemies',
        enemyCount: 6,
        rewardCurrency: 14,
        layoutProfile: 'sunken-canyon',
      },
      2: {
        tier: 2,
        name: 'Canyon Descent — Tier II',
        description:
          'Purge the fixed canyon descent where marked hostiles lurk on plateau and floor alike.',
        objectiveType: 'stage_boss',
        rewardCurrency: 14,
        layoutProfile: 'sunken-canyon',
        layoutMode: 'rigid',
        unlockRequires: { questId: 'canyon_descent', tier: 1 },
        encounter: {
          bossType: 'miniboss',
          landmark: 'canyon_monolith',
          addCount: 4,
        },
      },
    },
  },
  ember_descent: {
    id: 'ember_descent',
    enemyPool: [
      { type: 'grunt', weight: 3 },
      { type: 'skirmisher', weight: 2 },
      { type: 'ember_wraith', weight: 2 },
    ],
    tiers: {
      1: {
        name: 'Ember Descent',
        description: 'Purge hostiles from the volcanic rim overlooking the molten basin.',
        objectiveType: 'defeat_enemies',
        enemyCount: 6,
        rewardCurrency: 14,
        layoutProfile: 'fire-cavern',
        // Burn-theme signature rewards (see frost_crossing tier 1 for field docs).
        signatureCardId: 'fireball',
        rewardCards: ['fireball', 'dragons_breath'],
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
        // Pull/edge-control signature rewards (see frost_crossing tier 1 for field docs).
        signatureCardId: 'gravity_well',
        rewardCards: ['gravity_well'],
      },
      2: {
        tier: 2,
        name: 'Spire Ascent — Tier II',
        description: 'Ascend the fixed spire where marked hostiles bear twisted power on every tier.',
        objectiveType: 'stage_boss',
        rewardCurrency: 16,
        layoutProfile: 'spire-ascent',
        layoutMode: 'rigid',
        unlockRequires: { questId: 'spire_ascent', tier: 1 },
        signatureCardId: 'gravity_well',
        rewardCards: ['gravity_well'],
        encounter: {
          bossType: 'spire_warden',
          landmark: 'spire_summit',
          addCount: 5,
        },
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

const { THEME } = require('./theme');
const CARD_DEFS = require('../shared/cardDefs.json');

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
  const signatureCardId = getSignatureCardId(questId, normalizedTier);
  return {
    id: questId,
    questId,
    tier: normalizedTier,
    ...tierDef,
    signatureCardId,
    signatureCardName: signatureCardId ? CARD_DEFS[signatureCardId]?.name ?? null : null,
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
  if (quest.objectiveType === 'stage_boss') {
    const encounter = getEncounterConfig(quest);
    const addCount = encounter?.addCount ?? 0;
    const questId = quest.questId || quest.id;
    if (questId === 'spire_ascent') {
      if (addCount > 0) {
        return THEME.objectives.defeatSummitWardenWithSupports.replace(
          '{addCount}',
          String(addCount),
        );
      }
      return THEME.objectives.defeatSummitWarden;
    }
    if (questId === 'canyon_descent') {
      if (addCount > 0) {
        return THEME.objectives.defeatCanyonWardenWithSupports.replace(
          '{addCount}',
          String(addCount),
        );
      }
      return THEME.objectives.defeatCanyonWarden;
    }
    const annexOverseer = encounter?.bossType === 'annex_overseer';
    if (addCount > 0) {
      const template = annexOverseer
        ? THEME.objectives.defeatAnnexOverseerWithSupports
        : THEME.objectives.defeatTrialWardenWithSupports;
      return template.replace('{addCount}', String(addCount));
    }
    return annexOverseer
      ? THEME.objectives.defeatAnnexOverseer
      : THEME.objectives.defeatTrialWarden;
  }
  return quest.description || '';
}

function getEncounterConfig(quest) {
  if (!quest || !quest.encounter || typeof quest.encounter !== 'object') {
    return null;
  }
  return quest.encounter;
}

function normalizeQuestScriptSpawn(spawn) {
  if (!spawn || typeof spawn !== 'object') {
    return null;
  }
  if (typeof spawn.type !== 'string' || !spawn.type) {
    return null;
  }
  if (!Number.isFinite(spawn.x) || !Number.isFinite(spawn.z)) {
    return null;
  }
  return { type: spawn.type, x: spawn.x, z: spawn.z };
}

function normalizeQuestScriptWave(wave) {
  if (!wave || typeof wave !== 'object') {
    return null;
  }
  if (typeof wave.id !== 'string' || !wave.id) {
    return null;
  }
  if (!Array.isArray(wave.spawns)) {
    return null;
  }
  const spawns = wave.spawns
    .map(normalizeQuestScriptSpawn)
    .filter(Boolean);
  const normalized = {
    id: wave.id,
    trigger: wave.trigger,
    spawns,
  };
  if (wave.room != null && typeof wave.room === 'object') {
    normalized.room = wave.room;
  }
  return normalized;
}

/**
 * Returns normalized `script.waves` for a quest tier, or `null` when absent.
 * @param {ReturnType<typeof getQuest> | null | undefined} quest
 * @returns {QuestScript | null}
 */
function getQuestScript(quest) {
  if (!quest || !quest.script || typeof quest.script !== 'object') {
    return null;
  }
  if (!Array.isArray(quest.script.waves) || quest.script.waves.length === 0) {
    return null;
  }
  const waves = quest.script.waves
    .map(normalizeQuestScriptWave)
    .filter(Boolean);
  if (waves.length === 0) {
    return null;
  }
  return { waves };
}

/**
 * Sums authored spawn entries across all scripted waves (objective total).
 * @param {QuestScript | null | undefined} script
 * @returns {number}
 */
function countScriptedEnemies(script) {
  if (!script || !Array.isArray(script.waves)) {
    return 0;
  }
  return script.waves.reduce(
    (sum, wave) => sum + (Array.isArray(wave.spawns) ? wave.spawns.length : 0),
    0,
  );
}

function formatRewardSummary(quest) {
  if (!quest || quest.rewardCurrency == null) {
    return 'Reward: —';
  }
  const signatureCardName = quest.signatureCardName
    ?? (quest.signatureCardId ? CARD_DEFS[quest.signatureCardId]?.name ?? null : null);
  if (signatureCardName) {
    return `Reward: ${quest.rewardCurrency} stones + ${signatureCardName}`;
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
// pool for an unknown/invalid quest id. Tier 2 merges the base pool with an
// optional quest-level tier2EnemyPool (weights add to the draw).
function getEnemyPool(questId, tier = DEFAULT_QUEST_TIER) {
  const def = isValidQuestId(questId) ? QUEST_DEFS[questId] : null;
  if (!def || !def.enemyPool) {
    return QUEST_DEFS[DEFAULT_QUEST_ID].enemyPool;
  }
  const normalizedTier = normalizeQuestTier(tier);
  if (
    normalizedTier === 2
    && Array.isArray(def.tier2EnemyPool)
    && def.tier2EnemyPool.length > 0
  ) {
    return [...def.enemyPool, ...def.tier2EnemyPool];
  }
  return def.enemyPool;
}

// Returns the quest's guaranteed/signature enemy type (the foe that must always
// appear in its combat spawn set), or null when the quest declares none. Quests
// without a declared type are unaffected — no enemy is forced.
function getGuaranteedEnemyType(questId) {
  const def = isValidQuestId(questId) ? QUEST_DEFS[questId] : null;
  return def && typeof def.guaranteedEnemyType === 'string' ? def.guaranteedEnemyType : null;
}

// Returns the tier's signature reward card id (the card always offered as the
// first post-victory choice), falling back to the first entry of the tier's
// rewardCards pool. Unknown quests/tiers and quests without either field return
// null — no signature card is injected for them.
function getSignatureCardId(questId, tier) {
  const tierDef = isValidQuestId(questId)
    ? getQuestTierDef(questId, normalizeQuestTier(tier))
    : null;
  if (!tierDef) {
    return null;
  }
  if (typeof tierDef.signatureCardId === 'string') {
    return tierDef.signatureCardId;
  }
  if (Array.isArray(tierDef.rewardCards) && tierDef.rewardCards.length > 0) {
    return tierDef.rewardCards[0];
  }
  return null;
}

// Returns the tier's reward card pool for the empty-choices victory fallback,
// falling back to [signatureCardId] when only that is set. Unknown quests/tiers
// and quests without either field return null so callers use the global
// VICTORY_REWARD_ROTATION.
function getQuestRewardCards(questId, tier) {
  const tierDef = isValidQuestId(questId)
    ? getQuestTierDef(questId, normalizeQuestTier(tier))
    : null;
  if (!tierDef) {
    return null;
  }
  if (Array.isArray(tierDef.rewardCards) && tierDef.rewardCards.length > 0) {
    return tierDef.rewardCards;
  }
  if (typeof tierDef.signatureCardId === 'string') {
    return [tierDef.signatureCardId];
  }
  return null;
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
  getEncounterConfig,
  getQuestScript,
  countScriptedEnemies,
  getEnemyPool,
  getGuaranteedEnemyType,
  getSignatureCardId,
  getQuestRewardCards,
  pickWeightedEnemyType,
};
