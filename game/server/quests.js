/**
 * Optional stage-boss encounter metadata on a quest tier (wired in sub-ticket 05).
 * @typedef {Object} EncounterConfig
 * @property {string} [bossType] - Enemy type for the stage boss (default `miniboss`).
 * @property {string} [landmark] - Layout landmark type for boss spawn (e.g. `arena_dais`).
 * @property {number} [addCount] - Regular adds spawned from the quest enemy pool (boss excluded).
 * @property {{ x: number, z: number }} [spawnAnchor] - Encounter state anchor override.
 */

/**
 * Guild-counter client copy shown on the quest board before deploy.
 * @typedef {Object} QuestClientConfig
 * @property {string} name - Named client NPC for this contract.
 * @property {string} briefing - Short mission briefing shown before ready-up.
 */

/**
 * Optional signature-card reward on a quest tier (card id string).
 * @typedef {Object} QuestTierDef
 * @property {string} [rewardSignatureCard] - Card id granted as a named reward line on the board.
 */

/**
 * Dialogue trigger for mid-run radio lines (fired server-side in a later sub-ticket).
 * @typedef {'run_start' | 'objective_complete' | { itemCollected: number } | { waveCleared: number }} DialogueTrigger
 */

/**
 * Scripted dialogue beat keyed by trigger.
 * @typedef {Object} DialogueEntry
 * @property {DialogueTrigger} trigger
 * @property {string} text
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
        client: {
          name: 'Rewa',
          briefing:
            'Annex clearance contract. Five hostiles remain in the vault sector — neutralize them and I will release your reward stones.',
        },
        dialogue: [
          {
            trigger: 'run_start',
            text: 'Rewa here. Radio check — sweep the annex and report when the sector is clear.',
          },
          {
            trigger: 'objective_complete',
            text: 'Annex sector is clear. Your reward stones are transferring — solid work out there.',
          },
        ],
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
        client: {
          name: 'Lysa',
          briefing:
            'Prism salvage contract. Three resonance prisms remain in the collapsed lattice — recover them intact and your twelve reward stones are already earmarked.',
        },
        dialogue: [
          {
            trigger: 'run_start',
            text: 'Lysa on salvage channel. Three prisms still resonate in the lattice — bring them back intact.',
          },
          {
            trigger: { itemCollected: 1 },
            text: 'First prism reads stable. Two more signatures on my scope.',
          },
          {
            trigger: { itemCollected: 2 },
            text: 'Second prism locked. One resonance left — stay sharp, hostiles will press.',
          },
          {
            trigger: { itemCollected: 3 },
            text: 'Final prism secured. All signatures accounted for.',
          },
          {
            trigger: 'objective_complete',
            text: 'Lattice harmonics stabilizing. Telepipe is hot — extract now.',
          },
        ],
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
        client: {
          name: 'Venn',
          briefing:
            'Arena trial contract. Six wardens hold the open plaza — rout them and claim the fifteen stones posted to this listing.',
        },
        dialogue: [
          {
            trigger: 'run_start',
            text: 'Venn monitoring the trials. Six wardens in the plaza — show them why you took this contract.',
          },
          {
            trigger: 'objective_complete',
            text: 'Plaza clear. Trial passed — your stones are released.',
          },
        ],
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
        client: {
          name: 'Cairn',
          briefing:
            'Frost crossing escort. Six hostiles block the ice field — clear them and I release fourteen stones from the research fund.',
        },
        dialogue: [
          {
            trigger: 'run_start',
            text: 'Cairn here. Hostiles are clustered on the ice field — clear a path so my survey team can follow.',
          },
          {
            trigger: 'objective_complete',
            text: 'Crossing is secure. Research fund transfer pending — well done.',
          },
        ],
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
        client: {
          name: 'Torvek',
          briefing:
            'Canyon descent sweep. Hostiles infest the sunken canyon below the plateau — purge six of them for fourteen reward stones.',
        },
        dialogue: [
          {
            trigger: 'run_start',
            text: 'Torvek on overwatch. Hostiles are thick on the canyon floor — sweep them before they flank the plateau.',
          },
          {
            trigger: 'objective_complete',
            text: 'Canyon floor is quiet. Fourteen stones are yours — extract when ready.',
          },
        ],
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
        client: {
          name: 'Ashvelle',
          briefing:
            'Ember rim clearance. Six hostiles patrol the volcanic overlook — neutralize them and collect fourteen stones from my basin survey account.',
        },
        dialogue: [
          {
            trigger: 'run_start',
            text: 'Ashvelle on the rim feed. Hostiles are circling the basin edge — keep them off my survey lines.',
          },
          {
            trigger: 'objective_complete',
            text: 'Rim is clear. Basin survey proceeds — your stones are transferring now.',
          },
        ],
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
        client: {
          name: 'Sela',
          briefing:
            'Spire ascent contract. Fight through six hostiles on the tower tiers — summit treasure aside, sixteen stones are queued for you.',
        },
        dialogue: [
          {
            trigger: 'run_start',
            text: 'Sela tracking your ascent. Six hostiles between you and the upper tiers — push through.',
          },
          {
            trigger: 'objective_complete',
            text: 'Upper tiers are clear. Sixteen stones released — good climbing.',
          },
        ],
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
        client: {
          name: 'Marshal Koss',
          briefing:
            'Endless siege hold. Outlast ten staggered attackers including two wardens — hold the line and twenty stones are already on the manifest.',
        },
        dialogue: [
          {
            trigger: 'run_start',
            text: 'Marshal Koss on command. Waves are inbound — hold your ground until every attacker falls.',
          },
          {
            trigger: { waveCleared: 5 },
            text: 'Half the assault spent. Keep the line — wardens are still in the rotation.',
          },
          {
            trigger: 'objective_complete',
            text: 'Siege broken. All hostiles down — twenty stones to the victors.',
          },
        ],
      },
    },
  },
};

const { THEME } = require('./theme');

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
    dialogue: tierDef.dialogue ?? [],
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
        rewardCurrency: resolved.rewardCurrency,
        isTier2: tier === 2,
        unlockRequires: resolved.unlockRequires || null,
        ...(resolved.client ? { client: resolved.client } : {}),
        ...(resolved.rewardSignatureCard ? { rewardSignatureCard: resolved.rewardSignatureCard } : {}),
        dialogue: resolved.dialogue ?? [],
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
  getEnemyPool,
  getGuaranteedEnemyType,
  pickWeightedEnemyType,
};
