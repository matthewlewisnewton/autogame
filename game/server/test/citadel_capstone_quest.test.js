import { createRequire } from 'node:module';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import CARD_DEFS from '../../shared/cardDefs.json';

// users.js/quests.js are resolved via CJS so the gating/graph assertions share
// the same in-memory store instance that quests.js reads lazily at call time.
// See rift_convergence.test.js for the pattern.
const require = createRequire(import.meta.url);
const users = require('../users.js');
const {
  QUEST_DEFS,
  getQuest,
  getEncounterConfig,
  getEnemyPool,
  getLayoutProfileForQuest,
  isBossLevelQuest,
  buildLevelUnlockGraph,
  listQuestVariants,
} = require('../quests.js');

const QUEST_ID = 'citadel_assault';
const TIER = 1;
const PREREQS = [
  { questId: 'canyon_descent', tier: 2 },
  { questId: 'spire_ascent', tier: 2 },
  { questId: 'arena_trials', tier: 2 },
];

// Every {questId, tier} pair registered with levelKind 'boss_level', except
// the citadel capstone itself.
function otherBossLevelTiers() {
  const entries = [];
  for (const [questId, questDef] of Object.entries(QUEST_DEFS)) {
    if (questId === QUEST_ID) continue;
    for (const [tier, tierDef] of Object.entries(questDef.tiers ?? {})) {
      if (tierDef.levelKind === 'boss_level') {
        entries.push({ questId, tier: Number(tier), tierDef });
      }
    }
  }
  return entries;
}

describe('citadel_assault quest definition', () => {
  it('registers the capstone boss-level tier 1 with boss-arena layout', () => {
    expect(QUEST_DEFS[QUEST_ID]).toBeDefined();
    const quest = getQuest(QUEST_ID, TIER);
    expect(quest).toBeTruthy();
    expect(quest.name).toBe('The Citadel');
    expect(quest.objectiveType).toBe('stage_boss');
    expect(quest.levelKind).toBe('boss_level');
    expect(quest.layoutProfile).toBe('boss-arena');
    expect(isBossLevelQuest(quest)).toBe(true);
    expect(getLayoutProfileForQuest(QUEST_ID, TIER)).toBe('boss-arena');
  });

  it('declares an unlockRequires ARRAY with exactly the three tier-2 prereqs', () => {
    const raw = QUEST_DEFS[QUEST_ID].tiers[TIER].unlockRequires;
    expect(Array.isArray(raw)).toBe(true);
    expect(raw).toHaveLength(3);
    expect(raw).toEqual(PREREQS);
  });

  it('stages the citadel_sovereign on the arena dais with five adds', () => {
    const encounter = getEncounterConfig(getQuest(QUEST_ID, TIER));
    expect(encounter).toMatchObject({
      bossType: 'citadel_sovereign',
      landmark: 'arena_dais',
      addCount: 5,
    });
    expect(getQuest(QUEST_ID, TIER).encounter.bossDisplayName).toBe('Citadel Sovereign');
  });

  it('fields strictly more encounter adds than every other boss level', () => {
    const citadelAdds = QUEST_DEFS[QUEST_ID].tiers[TIER].encounter.addCount;
    const others = otherBossLevelTiers();
    expect(others.length).toBeGreaterThan(0);
    for (const { questId, tier, tierDef } of others) {
      expect(
        citadelAdds,
        `addCount must exceed ${questId} tier ${tier}'s`,
      ).toBeGreaterThan(tierDef.encounter?.addCount ?? 0);
    }
  });

  it('pays a 26-stone purse strictly above every other boss level', () => {
    const citadelPurse = QUEST_DEFS[QUEST_ID].tiers[TIER].rewardCurrency;
    expect(citadelPurse).toBe(26);
    const others = otherBossLevelTiers();
    expect(others.length).toBeGreaterThan(0);
    for (const { questId, tier, tierDef } of others) {
      expect(
        citadelPurse,
        `rewardCurrency must exceed ${questId} tier ${tier}'s`,
      ).toBeGreaterThan(tierDef.rewardCurrency ?? 0);
    }
  });

  it('pools ONLY foes drawn from the three prerequisite stages', () => {
    const allowed = new Set();
    for (const { questId } of PREREQS) {
      for (const entry of QUEST_DEFS[questId].enemyPool) {
        allowed.add(entry.type);
      }
      for (const entry of QUEST_DEFS[questId].tier2EnemyPool ?? []) {
        allowed.add(entry.type);
      }
    }
    const pool = getEnemyPool(QUEST_ID, TIER);
    expect(pool.length).toBeGreaterThan(0);
    for (const entry of pool) {
      expect(
        allowed.has(entry.type),
        `${entry.type} is not pooled by any prerequisite stage`,
      ).toBe(true);
    }
  });

  it('offers reward cards that exist in the card catalog', () => {
    const quest = getQuest(QUEST_ID, TIER);
    expect(quest.signatureCardId).toBe('event_horizon');
    expect(quest.rewardCards).toEqual(['event_horizon', 'excalibur_photon']);
    for (const cardId of quest.rewardCards) {
      expect(CARD_DEFS[cardId], `${cardId} missing from cardDefs.json`).toBeDefined();
    }
  });

  it('carries a client briefing and run_start/waveCleared/objective_complete dialogue', () => {
    const quest = getQuest(QUEST_ID, TIER);
    expect(quest.client?.name).toBeTruthy();
    expect(quest.client?.briefing).toBeTruthy();
    expect(quest.dialogue.some((entry) => entry.trigger === 'run_start')).toBe(true);
    expect(
      quest.dialogue.some((entry) => Number.isInteger(entry.trigger?.waveCleared)),
    ).toBe(true);
    expect(quest.dialogue.some((entry) => entry.trigger === 'objective_complete')).toBe(true);
    const texts = quest.dialogue.map((entry) => entry.text);
    expect(new Set(texts).size).toBe(texts.length);
  });
});

describe('citadel_assault three-way AND-gated unlock', () => {
  let tmpFile;
  let accountId;

  beforeEach(() => {
    tmpFile = path.join(
      os.tmpdir(),
      `citadel-capstone-users-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
    );
    users.setTestFilePath(tmpFile);
    users.clearUsers();
    users.createUser('citadel_runner', 'pass');
    accountId = users.findUserByUsername('citadel_runner').accountId;
  });

  afterEach(() => {
    try {
      fs.unlinkSync(tmpFile);
    } catch {}
    try {
      fs.unlinkSync(tmpFile + '.tmp');
    } catch {}
  });

  it('stays locked with no prerequisites completed', () => {
    expect(users.isQuestTierUnlocked(accountId, QUEST_ID, TIER)).toBe(false);
  });

  // Each 2-of-3 combination must stay locked: the gate is a strict AND.
  for (let skip = 0; skip < PREREQS.length; skip++) {
    const cleared = PREREQS.filter((_, i) => i !== skip);
    const missing = PREREQS[skip];
    it(`stays locked with only ${cleared.map((p) => p.questId).join(' + ')} tier 2 completed`, () => {
      for (const prereq of cleared) {
        users.completeQuestTier(accountId, prereq.questId, prereq.tier);
        expect(users.hasCompletedQuestTier(accountId, prereq.questId, prereq.tier)).toBe(true);
      }
      expect(users.hasCompletedQuestTier(accountId, missing.questId, missing.tier)).toBe(false);
      expect(users.isQuestTierUnlocked(accountId, QUEST_ID, TIER)).toBe(false);
    });
  }

  it('unlocks once ALL THREE tier-2 prerequisites are completed', () => {
    for (const prereq of PREREQS) {
      users.completeQuestTier(accountId, prereq.questId, prereq.tier);
    }
    expect(users.isQuestTierUnlocked(accountId, QUEST_ID, TIER)).toBe(true);
  });
});

describe('citadel_assault quest-list and level-map payloads', () => {
  let tmpFile;
  let accountId;

  function citadelNode(graph) {
    return graph.nodes.find((n) => n.questId === QUEST_ID && n.tier === TIER);
  }

  beforeEach(() => {
    tmpFile = path.join(
      os.tmpdir(),
      `citadel-capstone-graph-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
    );
    users.setTestFilePath(tmpFile);
    users.clearUsers();
    users.createUser('citadel_graph_player', 'pass');
    accountId = users.findUserByUsername('citadel_graph_player').accountId;
  });

  afterEach(() => {
    try {
      fs.unlinkSync(tmpFile);
    } catch {}
    try {
      fs.unlinkSync(tmpFile + '.tmp');
    } catch {}
  });

  it('lists a citadel quest variant carrying all three prerequisites', () => {
    const variant = listQuestVariants().find(
      (v) => v.questId === QUEST_ID && v.tier === TIER,
    );
    expect(variant).toBeDefined();
    expect(variant.name).toBe('The Citadel');
    expect(variant.objectiveType).toBe('stage_boss');
    expect(variant.unlockRequires).toEqual(PREREQS);
  });

  it('emits an isBoss graph node with the three normalized prerequisite edges', () => {
    const node = citadelNode(buildLevelUnlockGraph(accountId));
    expect(node).toBeDefined();
    expect(node.isBoss).toBe(true);
    expect(node.objectiveType).toBe('stage_boss');
    expect(node.unlockRequires).toEqual(PREREQS);
  });

  it("flips state from 'locked' to 'unlocked' only when the third prereq completes", () => {
    expect(citadelNode(buildLevelUnlockGraph(accountId)).state).toBe('locked');

    users.completeQuestTier(accountId, 'canyon_descent', 2);
    expect(citadelNode(buildLevelUnlockGraph(accountId)).state).toBe('locked');

    users.completeQuestTier(accountId, 'spire_ascent', 2);
    expect(citadelNode(buildLevelUnlockGraph(accountId)).state).toBe('locked');

    users.completeQuestTier(accountId, 'arena_trials', 2);
    expect(citadelNode(buildLevelUnlockGraph(accountId)).state).toBe('unlocked');
  });
});
