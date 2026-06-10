/**
 * Optional stage-boss encounter metadata on a quest tier (wired in sub-ticket 05).
 * @typedef {Object} EncounterConfig
 * @property {string} [bossType] - Enemy type for the stage boss (default `miniboss`).
 * @property {string} [landmark] - Layout landmark type for boss spawn (e.g. `arena_dais`).
 * @property {number} [addCount] - Regular adds spawned from the quest enemy pool (boss excluded).
 * @property {{ x: number, z: number }} [spawnAnchor] - Encounter state anchor override.
 */

/**
 * Hand-authored scripted wave encounter metadata on a quest tier.
 * @typedef {import('./scriptedEncounters').ScriptedEncounterConfig} ScriptedEncounterConfig
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
        clientNpc: 'Annex Liaison Kade',
        briefing:
          'The annex sector is crawling with salvage crews turned hostile. '
          + 'Clear every wave and hold the vault mouth until extraction arrives.',
        objectiveType: 'defeat_enemies',
        enemyCount: 5,
        rewardCurrency: 10,
        layoutProfile: 'crowded',
        dialogueBeacons: [
          {
            beaconId: 'training_start_room',
            trigger: 'onRoomEntered',
            roomIndex: 0,
            speaker: 'Annex Liaison Kade',
            line: 'Contract accepted. Sweep the annex — I will mark your progress on the channel.',
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
        clientNpc: 'Lattice Custodian Mira',
        briefing:
          'Resonance prisms are still singing in the collapsed lattice. '
          + 'Recover every prism while the guard swarms keep the sector locked down.',
        objectiveType: 'collect_items',
        itemCount: 3,
        enemyCount: 4,
        rewardCurrency: 12,
        layoutProfile: 'open',
        dialogueBeacons: [
          {
            beaconId: 'prism_first',
            trigger: 'onCrystalCollected',
            crystalIndex: 1,
            speaker: 'Lattice Custodian Mira',
            line: 'First prism secured — the lattice hum is stabilizing.',
          },
          {
            beaconId: 'prism_second',
            trigger: 'onCrystalCollected',
            crystalIndex: 2,
            speaker: 'Lattice Custodian Mira',
            line: 'Two down. One more resonance knot and we can seal the breach.',
          },
          {
            beaconId: 'prism_third',
            trigger: 'onCrystalCollected',
            crystalIndex: 3,
            speaker: 'Lattice Custodian Mira',
            line: 'All prisms accounted for. Extraction channel is open.',
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
  };
}

function getDefaultQuestId() {
  return DEFAULT_QUEST_ID;
}

function listQuests() {
  return Object.keys(QUEST_DEFS)
    .map((questId) => {
      const resolved = getQuest(questId, DEFAULT_QUEST_TIER);
      if (!resolved) return null;
      return {
        ...resolved,
        objectiveSummary: formatObjectiveSummary(resolved),
        rewardSummary: formatRewardSummary(resolved),
        ...questBriefingFields(resolved),
      };
    })
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

/** Test/debug fixture quest def — not registered in QUEST_DEFS. */
const SCRIPTED_ENCOUNTER_FIXTURE_DEF = {
  id: 'scripted_encounter_fixture',
  enemyPool: [{ type: 'grunt', weight: 1 }],
  tiers: {
    1: {
      name: 'Scripted Encounter Fixture',
      description: 'Test-only scripted wave sequencing.',
      clientNpc: 'Test Handler',
      briefing: 'Fixture contract for scripted wave and dialogue beacon QA.',
      objectiveType: 'defeat_enemies',
      rewardCurrency: 1,
      layoutProfile: 'crowded',
      scriptedEncounters: {
        rooms: [
          {
            roomIndex: 0,
            waves: [
              { spawns: [{ type: 'grunt', count: 2 }] },
              { spawns: [{ type: 'skirmisher', count: 1 }] },
            ],
          },
        ],
      },
      dialogueBeacons: [
        {
          beaconId: 'fixture_wave0_clear',
          trigger: 'onWaveCleared',
          roomIndex: 0,
          waveIndex: 0,
          speaker: 'Test Handler',
          line: 'Wave zero cleared — advance to the next group.',
        },
      ],
    },
  },
};

function getScriptedEncounterConfig(quest) {
  if (!quest || !quest.scriptedEncounters || typeof quest.scriptedEncounters !== 'object') {
    return null;
  }
  const rooms = quest.scriptedEncounters.rooms;
  if (!Array.isArray(rooms) || rooms.length === 0) {
    return null;
  }
  return quest.scriptedEncounters;
}

function formatRewardSummary(quest) {
  if (!quest || quest.rewardCurrency == null) {
    return 'Reward: —';
  }
  return `Reward: ${quest.rewardCurrency} stones`;
}

function formatBriefingSummary(quest) {
  if (!quest) return '';
  const body = typeof quest.briefing === 'string' ? quest.briefing.trim() : '';
  if (!body) return quest.description || '';
  const npc = typeof quest.clientNpc === 'string' ? quest.clientNpc.trim() : '';
  if (npc) return `${npc}: ${body}`;
  return body;
}

function formatBriefingRewardLine(quest) {
  if (!quest) return formatRewardSummary(quest);
  if (typeof quest.briefingRewardLine === 'string' && quest.briefingRewardLine.trim()) {
    return quest.briefingRewardLine.trim();
  }
  return formatRewardSummary(quest);
}

function questBriefingFields(quest) {
  if (!quest) return {};
  return {
    clientNpc: quest.clientNpc || null,
    briefing: quest.briefing || null,
    briefingSummary: formatBriefingSummary(quest),
    briefingRewardLine: quest.briefingRewardLine || null,
    briefingRewardText: formatBriefingRewardLine(quest),
  };
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
        ...questBriefingFields(resolved),
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
  SCRIPTED_ENCOUNTER_FIXTURE_DEF,
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
  formatBriefingSummary,
  formatBriefingRewardLine,
  questBriefingFields,
  getEncounterConfig,
  getScriptedEncounterConfig,
  getEnemyPool,
  getGuaranteedEnemyType,
  pickWeightedEnemyType,
};
