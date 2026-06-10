import { describe, it, expect } from 'vitest';
import {
  QUEST_DEFS,
  DEFAULT_QUEST_ID,
  getQuest,
  listQuests,
  listQuestVariants,
  formatRewardSummary,
  isValidQuestSelection,
  getLayoutProfileForQuest,
  getLayoutGenerationOptions,
  buildSharedQuestUpdatePayload,
  buildQuestUpdatePayload,
} from '../quests.js';
import { questLayoutSeed } from '../dungeon.js';

const TIER_1_QUEST_IDS = [
  'training_caverns',
  'crystal_rescue',
  'arena_trials',
  'frost_crossing',
  'canyon_descent',
  'ember_descent',
  'spire_ascent',
  'endless_siege',
];

const TIER_2_QUEST_IDS = [
  'training_caverns',
  'crystal_rescue',
  'arena_trials',
  'canyon_descent',
  'spire_ascent',
];

function assertTier1QuestContent(questId) {
  const quest = getQuest(questId, 1);
  expect(quest).not.toBeNull();
  expect(quest.client?.name).toBeTruthy();
  expect(quest.client?.briefing).toBeTruthy();
  expect(quest.dialogue.length).toBeGreaterThanOrEqual(2);

  const texts = quest.dialogue.map((entry) => entry.text);
  expect(new Set(texts).size).toBe(texts.length);

  if (quest.objectiveType === 'collect_items') {
    expect(quest.dialogue.some((entry) => entry.trigger === 'run_start')).toBe(true);
    expect(quest.dialogue.some((entry) => entry.trigger === 'objective_complete')).toBe(true);
    for (let i = 1; i <= quest.itemCount; i += 1) {
      expect(
        quest.dialogue.some(
          (entry) =>
            entry.trigger
            && typeof entry.trigger === 'object'
            && entry.trigger.itemCollected === i,
        ),
      ).toBe(true);
    }
  } else {
    expect(quest.dialogue.some((entry) => entry.trigger === 'run_start')).toBe(true);
    expect(quest.dialogue.some((entry) => entry.trigger === 'objective_complete')).toBe(true);
  }
}

function assertTier2QuestContent(questId) {
  const quest = getQuest(questId, 2);
  expect(quest).not.toBeNull();
  expect(quest.client?.name).toBeTruthy();
  expect(quest.client?.briefing).toBeTruthy();
  expect(quest.dialogue.length).toBeGreaterThanOrEqual(2);

  const texts = quest.dialogue.map((entry) => entry.text);
  expect(new Set(texts).size).toBe(texts.length);

  if (quest.objectiveType === 'collect_items') {
    expect(quest.dialogue.some((entry) => entry.trigger === 'run_start')).toBe(true);
    expect(quest.dialogue.some((entry) => entry.trigger === 'objective_complete')).toBe(true);
    for (let i = 1; i <= quest.itemCount; i += 1) {
      expect(
        quest.dialogue.some(
          (entry) =>
            entry.trigger
            && typeof entry.trigger === 'object'
            && entry.trigger.itemCollected === i,
        ),
      ).toBe(true);
    }
  } else if (quest.objectiveType === 'stage_boss') {
    expect(quest.dialogue.some((entry) => entry.trigger === 'run_start')).toBe(true);
    expect(quest.dialogue.some((entry) => entry.trigger === 'objective_complete')).toBe(true);
    expect(
      quest.dialogue.some(
        (entry) =>
          entry.trigger
          && typeof entry.trigger === 'object'
          && Object.prototype.hasOwnProperty.call(entry.trigger, 'waveCleared'),
      ),
    ).toBe(true);
  } else {
    expect(quest.dialogue.some((entry) => entry.trigger === 'run_start')).toBe(true);
    expect(quest.dialogue.some((entry) => entry.trigger === 'objective_complete')).toBe(true);
  }
}

describe('quest tier catalog', () => {
  it('resolves tier 1 by default when tier is omitted', () => {
    const implicit = getQuest('training_caverns');
    const explicit = getQuest('training_caverns', 1);
    expect(implicit).toEqual(explicit);
    expect(implicit.tier).toBe(1);
    expect(implicit.questId).toBe('training_caverns');
    expect(implicit.name).toBe('Initiate Vault');
  });

  it('returns null for invalid quest or tier pairs', () => {
    expect(getQuest('missing_quest')).toBeNull();
    expect(getQuest('training_caverns', 3)).toBeNull();
    expect(getQuest('endless_siege', 2)).toBeNull();
  });

  it('exposes training_caverns tier 2 with rigid crowded layout and unlock metadata', () => {
    const tier2 = getQuest('training_caverns', 2);
    expect(tier2).not.toBeNull();
    expect(tier2.tier).toBe(2);
    expect(tier2.layoutMode).toBe('rigid');
    expect(tier2.unlockRequires).toEqual({ questId: 'training_caverns', tier: 1 });
    expect(QUEST_DEFS.training_caverns.tiers[2].layoutMode).toBe('rigid');
  });

  it('exposes crystal_rescue tier 2 with rigid open layout and unlock metadata', () => {
    const tier2 = getQuest('crystal_rescue', 2);
    expect(tier2).not.toBeNull();
    expect(tier2.tier).toBe(2);
    expect(tier2.layoutProfile).toBe('open');
    expect(tier2.layoutMode).toBe('rigid');
    expect(tier2.objectiveType).toBe('collect_items');
    expect(tier2.unlockRequires).toEqual({ questId: 'crystal_rescue', tier: 1 });
    expect(QUEST_DEFS.crystal_rescue.tiers[2].layoutMode).toBe('rigid');
  });

  it('validates catalog membership via isValidQuestSelection', () => {
    expect(isValidQuestSelection('training_caverns')).toBe(true);
    expect(isValidQuestSelection('training_caverns', 1)).toBe(true);
    expect(isValidQuestSelection('training_caverns', 2)).toBe(true);
    expect(isValidQuestSelection('crystal_rescue', 1)).toBe(true);
    expect(isValidQuestSelection('crystal_rescue', 2)).toBe(true);
    expect(isValidQuestSelection('unknown', 1)).toBe(false);
  });

  it('listQuests returns tier-1 board entries only', () => {
    const quests = listQuests();
    expect(quests.every((q) => q.tier === 1)).toBe(true);
    expect(quests.find((q) => q.id === DEFAULT_QUEST_ID).name).toBe('Initiate Vault');
  });

  it('exposes client and dialogue on training_caverns tier 1', () => {
    const quest = getQuest('training_caverns', 1);
    expect(quest.client).toEqual({
      name: 'Rewa',
      briefing: expect.stringContaining('Annex clearance'),
    });
    expect(quest.client.name).toBeTruthy();
    expect(quest.client.briefing).toBeTruthy();
    expect(quest.dialogue).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          trigger: 'run_start',
          text: expect.stringContaining('Rewa'),
        }),
        expect.objectContaining({
          trigger: 'objective_complete',
          text: expect.any(String),
        }),
      ]),
    );
    expect(quest.dialogue.length).toBeGreaterThanOrEqual(2);
  });

  it('every tier-1 quest has client briefing and dialogue beats', () => {
    for (const questId of TIER_1_QUEST_IDS) {
      assertTier1QuestContent(questId);
    }
  });

  it('every tier-2 quest has client briefing and dialogue beats', () => {
    for (const questId of TIER_2_QUEST_IDS) {
      assertTier2QuestContent(questId);
    }
  });

  it('crystal_rescue tier 2 has distinct itemCollected beats through itemCount', () => {
    const quest = getQuest('crystal_rescue', 2);
    expect(quest.client?.name).toBe('Lysa');
    const itemLines = [1, 2, 3, 4, 5].map((index) =>
      quest.dialogue.find(
        (entry) =>
          entry.trigger
          && typeof entry.trigger === 'object'
          && entry.trigger.itemCollected === index,
      )?.text,
    );
    const completeLine = quest.dialogue.find(
      (entry) => entry.trigger === 'objective_complete',
    )?.text;
    expect(itemLines.every(Boolean)).toBe(true);
    expect(completeLine).toBeTruthy();
    expect(new Set([...itemLines, completeLine]).size).toBe(6);
  });

  it('crystal_rescue tier 1 has distinct itemCollected and objective_complete lines', () => {
    const quest = getQuest('crystal_rescue', 1);
    expect(quest.client?.name).toBe('Lysa');
    const itemLines = [1, 2, 3].map((index) =>
      quest.dialogue.find(
        (entry) =>
          entry.trigger
          && typeof entry.trigger === 'object'
          && entry.trigger.itemCollected === index,
      )?.text,
    );
    const completeLine = quest.dialogue.find(
      (entry) => entry.trigger === 'objective_complete',
    )?.text;
    expect(itemLines.every(Boolean)).toBe(true);
    expect(completeLine).toBeTruthy();
    expect(new Set([...itemLines, completeLine]).size).toBe(4);
  });

  it('includes client and dialogue on every listQuests tier-1 row', () => {
    for (const questId of TIER_1_QUEST_IDS) {
      const row = listQuests().find((q) => q.id === questId);
      expect(row.client?.name).toBeTruthy();
      expect(row.client?.briefing).toBeTruthy();
      expect(row.dialogue.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('spreads client and dialogue through listQuestVariants tier-1 rows', () => {
    for (const questId of TIER_1_QUEST_IDS) {
      const variant = listQuestVariants().find((v) => v.questId === questId && v.tier === 1);
      expect(variant.client?.name).toBe(getQuest(questId, 1).client.name);
      expect(variant.dialogue).toEqual(getQuest(questId, 1).dialogue);
    }
  });

  it('spreads client and dialogue through listQuestVariants tier-2 rows', () => {
    for (const questId of TIER_2_QUEST_IDS) {
      const variant = listQuestVariants().find((v) => v.questId === questId && v.tier === 2);
      expect(variant.client?.name).toBe(getQuest(questId, 2).client.name);
      expect(variant.client?.briefing).toBe(getQuest(questId, 2).client.briefing);
      expect(variant.dialogue).toEqual(getQuest(questId, 2).dialogue);
    }
  });

  it('carries client through buildSharedQuestUpdatePayload and buildQuestUpdatePayload', () => {
    const shared = buildSharedQuestUpdatePayload({});
    const trainingRow = shared.quests.find((q) => q.id === 'training_caverns');
    expect(trainingRow.client).toEqual(getQuest('training_caverns', 1).client);
    expect(trainingRow.dialogue).toEqual(getQuest('training_caverns', 1).dialogue);

    const trainingVariant = shared.questVariants.find(
      (v) => v.questId === 'training_caverns' && v.tier === 1,
    );
    expect(trainingVariant.client?.name).toBe('Rewa');

    const playerPayload = buildQuestUpdatePayload({});
    expect(playerPayload.quests.find((q) => q.id === 'training_caverns').client.name).toBe('Rewa');
  });

  it('listQuestVariants includes every quest/tier pair with summaries', () => {
    const variants = listQuestVariants();
    const trainingTier2 = variants.find(
      (v) => v.questId === 'training_caverns' && v.tier === 2
    );
    expect(variants.length).toBe(Object.keys(QUEST_DEFS).length + 6);
    expect(trainingTier2).toMatchObject({
      questId: 'training_caverns',
      tier: 2,
      isTier2: true,
      objectiveType: 'stage_boss',
      unlockRequires: { questId: 'training_caverns', tier: 1 },
    });
    expect(trainingTier2.objectiveSummary).toContain('annex overseer');
    expect(trainingTier2.rewardSummary).toContain('10');
    const arenaTier2 = variants.find(
      (v) => v.questId === 'arena_trials' && v.tier === 2
    );
    expect(arenaTier2).toMatchObject({
      questId: 'arena_trials',
      tier: 2,
      isTier2: true,
      objectiveType: 'stage_boss',
      unlockRequires: { questId: 'arena_trials', tier: 1 },
    });
    expect(arenaTier2.objectiveSummary).toContain('trial warden');
    const spireTier2 = variants.find(
      (v) => v.questId === 'spire_ascent' && v.tier === 2
    );
    expect(spireTier2).toMatchObject({
      questId: 'spire_ascent',
      tier: 2,
      isTier2: true,
      objectiveType: 'stage_boss',
      unlockRequires: { questId: 'spire_ascent', tier: 1 },
    });
    expect(spireTier2.objectiveSummary).toContain('summit warden');
    const crystalTier2 = variants.find(
      (v) => v.questId === 'crystal_rescue' && v.tier === 2
    );
    expect(crystalTier2).toMatchObject({
      questId: 'crystal_rescue',
      tier: 2,
      isTier2: true,
      unlockRequires: { questId: 'crystal_rescue', tier: 1 },
    });
    expect(crystalTier2.objectiveSummary).toContain('5');
    expect(crystalTier2.rewardSummary).toContain('18');
    const canyonTier2 = variants.find(
      (v) => v.questId === 'canyon_descent' && v.tier === 2
    );
    expect(canyonTier2).toMatchObject({
      questId: 'canyon_descent',
      tier: 2,
      isTier2: true,
      objectiveType: 'stage_boss',
      unlockRequires: { questId: 'canyon_descent', tier: 1 },
    });
    expect(canyonTier2.objectiveSummary).toContain('canyon warden');
    expect(getQuest('canyon_descent', 2).layoutProfile).toBe('sunken-canyon');
    expect(getQuest('canyon_descent', 2).layoutMode).toBe('rigid');
    const frostTier1 = variants.find((v) => v.questId === 'frost_crossing' && v.tier === 1);
    expect(frostTier1).toMatchObject({
      questId: 'frost_crossing',
      tier: 1,
      objectiveType: 'stage_boss',
    });
    expect(frostTier1.objectiveSummary.toLowerCase()).toContain('permafrost warden');
    expect(getLayoutProfileForQuest('frost_crossing')).toBe('ice-cavern');
    const emberTier1 = variants.find(
      (v) => v.questId === 'ember_descent' && v.tier === 1
    );
    expect(emberTier1).toMatchObject({
      questId: 'ember_descent',
      tier: 1,
      isTier2: false,
      objectiveType: 'defeat_enemies',
    });
    expect(emberTier1.objectiveSummary).toContain('6');
    expect(variants.filter((v) => v.isTier2)).toHaveLength(6);
  });

  it('exposes signature reward id and resolved name on quest payloads', () => {
    const quests = listQuests();
    const frost = quests.find((q) => q.id === 'frost_crossing');
    expect(frost.signatureCardId).toBe('ice_ball');
    expect(frost.signatureCardName).toBe('Glacial Orb');
    const training = quests.find((q) => q.id === 'training_caverns');
    expect(training.signatureCardId).toBeNull();
    expect(training.signatureCardName).toBeNull();
  });

  it('formatRewardSummary appends the signature card name only when present', () => {
    expect(formatRewardSummary(getQuest('frost_crossing', 1))).toBe(
      'Reward: Cryo Burst + 14 stones',
    );
    expect(formatRewardSummary(getQuest('training_caverns', 1))).toBe(
      'Reward: Saber of Light + 10 stones',
    );
    expect(formatRewardSummary(null)).toBe('Reward: —');
    const spireTier2 = listQuestVariants().find(
      (v) => v.questId === 'spire_ascent' && v.tier === 2
    );
    expect(spireTier2.rewardSummary).toBe('Reward: 16 stones + Gravity Well');
  });

  it('layout profile and seed accept tier for future divergence', () => {
    expect(getLayoutProfileForQuest('training_caverns')).toBe('crowded');
    expect(getLayoutProfileForQuest('training_caverns', 2)).toBe('crowded');
    expect(questLayoutSeed('training_caverns', 1)).not.toBe(
      questLayoutSeed('training_caverns', 2)
    );
    expect(questLayoutSeed('training_caverns')).toBe(questLayoutSeed('training_caverns', 1));
  });

  it('getLayoutGenerationOptions returns slopes and layoutMode from tier def', () => {
    expect(getLayoutGenerationOptions('training_caverns', 1)).toEqual({
      slopes: true,
      layoutMode: 'default',
    });
    expect(getLayoutGenerationOptions('training_caverns', 2)).toEqual({
      slopes: true,
      layoutMode: 'rigid',
    });
    expect(getLayoutGenerationOptions('arena_trials', 1)).toEqual({
      slopes: true,
      layoutMode: 'default',
    });
    expect(getLayoutGenerationOptions('arena_trials', 2)).toEqual({
      slopes: true,
      layoutMode: 'rigid',
    });
    expect(getLayoutGenerationOptions('spire_ascent', 1)).toEqual({
      slopes: true,
      layoutMode: 'default',
    });
    expect(getLayoutGenerationOptions('spire_ascent', 2)).toEqual({
      slopes: true,
      layoutMode: 'rigid',
    });
    expect(getLayoutGenerationOptions('crystal_rescue', 1)).toEqual({
      slopes: true,
      layoutMode: 'default',
    });
    expect(getLayoutGenerationOptions('crystal_rescue', 2)).toEqual({
      slopes: true,
      layoutMode: 'rigid',
    });
    expect(getLayoutGenerationOptions('canyon_descent', 1)).toEqual({
      slopes: true,
      layoutMode: 'default',
    });
    expect(getLayoutGenerationOptions('canyon_descent', 2)).toEqual({
      slopes: true,
      layoutMode: 'rigid',
    });
    expect(getLayoutGenerationOptions('frost_crossing', 1)).toEqual({
      slopes: true,
      layoutMode: 'default',
    });
    expect(getLayoutProfileForQuest('ember_descent')).toBe('fire-cavern');
    expect(getLayoutProfileForQuest('ember_descent', 1)).toBe('fire-cavern');
    expect(getQuest('ember_descent', 1).layoutProfile).toBe('fire-cavern');
    expect(getLayoutGenerationOptions('ember_descent', 1)).toEqual({
      slopes: true,
      layoutMode: 'default',
    });
    expect(isValidQuestSelection('ember_descent', 1)).toBe(true);
    expect(isValidQuestSelection('ember_descent', 2)).toBe(true);
    expect(isValidQuestSelection('canyon_descent', 2)).toBe(true);
    expect(isValidQuestSelection('arena_trials', 2)).toBe(true);
    expect(isValidQuestSelection('spire_ascent', 2)).toBe(true);
    expect(isValidQuestSelection('crystal_rescue', 2)).toBe(true);
    expect(getLayoutGenerationOptions('missing_quest', 1)).toEqual({
      slopes: true,
      layoutMode: 'default',
    });
  });
});
