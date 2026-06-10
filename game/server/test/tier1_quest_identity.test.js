import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';
import {
  getQuest,
  getScriptedEncounterConfig,
  listQuestVariants,
  formatObjectiveSummary,
  formatRewardSummary,
} from '../quests.js';
import { countAuthoredScriptedEnemies } from '../scriptedEncounters.js';
import { getDialogueBeacons } from '../questDialogue.js';

const require = createRequire(import.meta.url);
const CARD_DEFS = require('../../shared/cardDefs.json');

const TIER1_QUESTS = ['training_caverns', 'crystal_rescue', 'frost_crossing'];

function tier1Quest(questId) {
  return getQuest(questId, 1);
}

describe('tier-1 quest identity wiring', () => {
  it('uses scripted encounters for all three primary tier-1 quests', () => {
    for (const questId of TIER1_QUESTS) {
      const quest = tier1Quest(questId);
      expect(getScriptedEncounterConfig(quest)).not.toBeNull();
      expect(countAuthoredScriptedEnemies(quest)).toBeGreaterThan(0);
    }
  });

  it('assigns distinct objective summaries, reward cards, and briefing NPCs', () => {
    const variants = TIER1_QUESTS.map((questId) => {
      const quest = tier1Quest(questId);
      return {
        questId,
        objectiveSummary: formatObjectiveSummary(quest),
        rewardCardId: quest.rewardCardId,
        rewardSummary: formatRewardSummary(quest),
        clientNpc: quest.clientNpc,
        briefing: quest.briefing,
      };
    });

    const objectiveSummaries = variants.map((v) => v.objectiveSummary);
    const rewardCardIds = variants.map((v) => v.rewardCardId);
    const beaconSets = TIER1_QUESTS.map((questId) => {
      const beacons = getDialogueBeacons(tier1Quest(questId));
      return beacons.map((b) => b.beaconId).sort().join(',');
    });

    expect(new Set(objectiveSummaries).size).toBe(3);
    expect(new Set(rewardCardIds).size).toBe(3);
    expect(new Set(beaconSets).size).toBe(3);

    for (const variant of variants) {
      expect(variant.clientNpc).toBeTruthy();
      expect(variant.briefing).toBeTruthy();
      expect(CARD_DEFS[variant.rewardCardId]).toBeDefined();
      expect(variant.rewardSummary).toContain(CARD_DEFS[variant.rewardCardId].name);
    }

    expect(variants.map((v) => v.clientNpc)).toEqual([
      'Annex Liaison Kade',
      'Lattice Custodian Mira',
      'Ice-Watch Courier Sela',
    ]);
  });

  it('training_caverns tier 1 has passage lock, named rare, and wave-clear dialogue', () => {
    const quest = tier1Quest('training_caverns');
    expect(quest.objectiveType).toBe('defeat_enemies');
    expect(quest.rewardCardId).toBe('saber_of_light');
    expect(quest.scriptedEncounters.passageLocks).toHaveLength(2);

    const startWaves = quest.scriptedEncounters.rooms.find((r) => r.roomIndex === 0).waves;
    const namedSpawn = startWaves[1].spawns.find((s) => s.namedRare);
    expect(namedSpawn.namedRare.displayName).toBe('Vault Stalker');

    const beacons = getDialogueBeacons(quest);
    expect(beacons.some((b) => b.beaconId === 'training_wave0_clear')).toBe(true);
    expect(beacons.some((b) => b.beaconId === 'training_start_room')).toBe(true);
  });

  it('crystal_rescue tier 1 keeps collect_items with guard waves and prism dialogue', () => {
    const quest = tier1Quest('crystal_rescue');
    expect(quest.objectiveType).toBe('collect_items');
    expect(quest.itemCount).toBe(3);
    expect(quest.enemyCount).toBeUndefined();
    expect(quest.rewardCardId).toBe('mana_prism');
    expect(quest.scriptedEncounters.rooms.length).toBeGreaterThanOrEqual(2);

    const prismBeacons = getDialogueBeacons(quest).filter((b) => b.trigger === 'onCrystalCollected');
    expect(prismBeacons).toHaveLength(3);
    expect(formatObjectiveSummary(quest)).toContain('prisms');
    expect(formatObjectiveSummary(quest)).toContain('guards');
  });

  it('frost_crossing tier 1 has ice-band waves, glacial named rare, and room-entry dialogue', () => {
    const quest = tier1Quest('frost_crossing');
    expect(quest.objectiveType).toBe('defeat_enemies');
    expect(quest.rewardCardId).toBe('frost_nova');

    const iceRoom = quest.scriptedEncounters.rooms.find((r) => r.band === 'ice');
    expect(iceRoom).toBeDefined();
    const namedSpawn = iceRoom.waves
      .flatMap((wave) => wave.spawns)
      .find((spawn) => spawn.namedRare);
    expect(namedSpawn.namedRare.displayName).toBe('Rimecast the Slow');
    expect(namedSpawn.namedRare.enemyType).toBe('glacial_thrower');

    const beacons = getDialogueBeacons(quest);
    expect(beacons.some((b) => b.beaconId === 'frost_ice_band_enter' && b.band === 'ice')).toBe(true);
  });

  it('annex_escort tier 1 exercises escort objective in live quest content', () => {
    const quest = tier1Quest('annex_escort');
    expect(quest.objectiveType).toBe('escort');
    expect(quest.escortNpc.name).toBe('Archivist Vale');
    expect(getScriptedEncounterConfig(quest)).not.toBeNull();
  });

  it('exposes distinct board payloads for the three primary quests', () => {
    const boardRows = listQuestVariants().filter((v) => TIER1_QUESTS.includes(v.questId) && v.tier === 1);
    expect(boardRows).toHaveLength(3);

    const summaries = boardRows.map((row) => row.objectiveSummary);
    const rewards = boardRows.map((row) => row.rewardSummary);
    const briefings = boardRows.map((row) => row.briefingSummary);

    expect(new Set(summaries).size).toBe(3);
    expect(new Set(rewards).size).toBe(3);
    expect(new Set(briefings).size).toBe(3);
  });

  it('leaves unrelated tier-2 quests unchanged', () => {
    const trainingTier2 = getQuest('training_caverns', 2);
    const crystalTier2 = getQuest('crystal_rescue', 2);
    expect(trainingTier2.objectiveType).toBe('stage_boss');
    expect(trainingTier2.encounter.bossType).toBe('annex_overseer');
    expect(crystalTier2.objectiveType).toBe('collect_items');
    expect(crystalTier2.enemyCount).toBe(5);
    expect(getScriptedEncounterConfig(trainingTier2)).toBeNull();
    expect(getScriptedEncounterConfig(crystalTier2)).toBeNull();
  });
});
