import { describe, it, expect } from 'vitest';
import {
  QUEST_DEFS,
  DEFAULT_QUEST_ID,
  getQuest,
  listQuests,
  listQuestVariants,
  isValidQuestSelection,
  getLayoutProfileForQuest,
  getLayoutGenerationOptions,
} from '../quests.js';
import { questLayoutSeed } from '../dungeon.js';

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

  it('listQuestVariants includes every quest/tier pair with summaries', () => {
    const variants = listQuestVariants();
    const trainingTier2 = variants.find(
      (v) => v.questId === 'training_caverns' && v.tier === 2
    );
    expect(variants.length).toBe(Object.keys(QUEST_DEFS).length + 5);
    expect(trainingTier2).toMatchObject({
      questId: 'training_caverns',
      tier: 2,
      isTier2: true,
      unlockRequires: { questId: 'training_caverns', tier: 1 },
    });
    expect(trainingTier2.objectiveSummary).toContain('5');
    expect(trainingTier2.rewardSummary).toContain('10');
    const arenaTier2 = variants.find(
      (v) => v.questId === 'arena_trials' && v.tier === 2
    );
    expect(arenaTier2).toMatchObject({
      questId: 'arena_trials',
      tier: 2,
      isTier2: true,
      unlockRequires: { questId: 'arena_trials', tier: 1 },
    });
    const spireTier2 = variants.find(
      (v) => v.questId === 'spire_ascent' && v.tier === 2
    );
    expect(spireTier2).toMatchObject({
      questId: 'spire_ascent',
      tier: 2,
      isTier2: true,
      unlockRequires: { questId: 'spire_ascent', tier: 1 },
    });
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
      unlockRequires: { questId: 'canyon_descent', tier: 1 },
    });
    expect(getQuest('canyon_descent', 2).layoutProfile).toBe('sunken-canyon');
    expect(getQuest('canyon_descent', 2).layoutMode).toBe('rigid');
    expect(variants.filter((v) => v.isTier2)).toHaveLength(5);
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
