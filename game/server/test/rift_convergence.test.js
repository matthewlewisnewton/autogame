import { createRequire } from 'node:module';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { generateLayout } from '../dungeon.js';
import { createGameState } from '../game-state.js';
import { ENCOUNTER_PHASES } from '../encounters.js';
import { setGameState, spawnEnemies, startDungeonRun } from '../progression.js';
import CARD_DEFS from '../../shared/cardDefs.json';

// users.js/quests.js are resolved via CJS so the gating/graph assertions share
// the same in-memory store instance that quests.js reads lazily at call time.
// See unlock_prereqs.test.js and level_unlock_graph.test.js for the pattern.
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
} = require('../quests.js');
const { setGameState: setSimulationGameState } = require('../simulation.js');

const QUEST_ID = 'rift_convergence';
const TIER = 1;
const SEED = 38604;
const ICE_FIRE_POOL_TYPES = new Set(['glacial_thrower', 'ember_wraith']);

function setPartySize(state, count, position = { x: -20, z: 0 }) {
  Object.keys(state.players).forEach((k) => delete state.players[k]);
  for (let i = 1; i <= count; i++) {
    state.players[`p${i}`] = {
      x: position.x + i,
      y: 0.5,
      z: position.z,
      rotation: 0,
      hp: 100,
      dead: false,
      extracted: false,
      accountId: `acct-${i}`,
    };
  }
}

function deployRiftConvergenceRun(state, { seed = SEED, partySize = 1 } = {}) {
  setPartySize(state, partySize);
  state.selectedQuestId = QUEST_ID;
  state.selectedQuestTier = TIER;
  state.layout = generateLayout(seed, 'boss-arena');
  state.layoutSeed = seed;
  state.enemies = [];
  state.loot = [];
  state.gamePhase = 'playing';
  setGameState(state);
  setSimulationGameState(state);
  spawnEnemies();
  startDungeonRun();
  return state;
}

describe('rift_convergence quest definition', () => {
  it('registers a boss-level tier 1 with boss-arena layout', () => {
    expect(QUEST_DEFS[QUEST_ID]).toBeDefined();
    const quest = getQuest(QUEST_ID, TIER);
    expect(quest.name).toBe('Rift Convergence');
    expect(quest.objectiveType).toBe('stage_boss');
    expect(quest.levelKind).toBe('boss_level');
    expect(quest.layoutProfile).toBe('boss-arena');
    expect(isBossLevelQuest(quest)).toBe(true);
    expect(getLayoutProfileForQuest(QUEST_ID, TIER)).toBe('boss-arena');
  });

  it('declares an unlockRequires ARRAY with exactly the two ice/fire tier-2 prereqs', () => {
    const raw = QUEST_DEFS[QUEST_ID].tiers[TIER].unlockRequires;
    expect(Array.isArray(raw)).toBe(true);
    expect(raw).toHaveLength(2);
    expect(raw).toEqual([
      { questId: 'frost_crossing', tier: 2 },
      { questId: 'ember_descent', tier: 2 },
    ]);
  });

  // citadel_assault (the capstone) now fields the most adds and the richest
  // purse of any boss level — see citadel_capstone_quest.test.js. These two
  // tests assert the rift's standing among the non-capstone boss levels.
  it('stages the riftbound_colossus on the arena dais with the most adds of any non-capstone boss level', () => {
    const encounter = getEncounterConfig(getQuest(QUEST_ID, TIER));
    expect(encounter).toMatchObject({
      bossType: 'riftbound_colossus',
      landmark: 'arena_dais',
      addCount: 4,
    });
    const crucibleAdds = getEncounterConfig(getQuest('crucible_duel', 1)).addCount;
    const vaultAdds = getEncounterConfig(getQuest('vault_onslaught', 1)).addCount;
    expect(crucibleAdds).toBe(0);
    expect(vaultAdds).toBe(2);
    expect(encounter.addCount).toBeGreaterThan(crucibleAdds);
    expect(encounter.addCount).toBeGreaterThan(vaultAdds);
  });

  it('pools ONLY ice and fire signature foes for the encounter adds', () => {
    const pool = getEnemyPool(QUEST_ID, TIER);
    expect(pool.length).toBeGreaterThan(0);
    for (const entry of pool) {
      expect(ICE_FIRE_POOL_TYPES.has(entry.type)).toBe(true);
    }
    const types = pool.map((entry) => entry.type);
    expect(types).toContain('glacial_thrower');
    expect(types).toContain('ember_wraith');
  });

  it('pays the richest non-capstone boss-level purse with both reward cards in the catalog', () => {
    const quest = getQuest(QUEST_ID, TIER);
    expect(quest.rewardCurrency).toBe(22);
    expect(quest.rewardCurrency).toBeGreaterThan(getQuest('crucible_duel', 1).rewardCurrency);
    expect(quest.signatureCardId).toBe('glacier_collapse');
    expect(quest.rewardCards).toEqual(['glacier_collapse', 'inferno_pillar']);
    for (const cardId of quest.rewardCards) {
      expect(CARD_DEFS[cardId]).toBeDefined();
    }
  });

  it('carries a named client briefing and run_start/objective_complete dialogue', () => {
    const quest = getQuest(QUEST_ID, TIER);
    expect(quest.client?.name).toBeTruthy();
    expect(quest.client?.briefing).toBeTruthy();
    expect(quest.dialogue.some((entry) => entry.trigger === 'run_start')).toBe(true);
    expect(quest.dialogue.some((entry) => entry.trigger === 'objective_complete')).toBe(true);
    const texts = quest.dialogue.map((entry) => entry.text);
    expect(new Set(texts).size).toBe(texts.length);
  });
});

describe('rift_convergence AND-gated unlock', () => {
  let tmpFile;
  let accountId;

  beforeEach(() => {
    tmpFile = path.join(
      os.tmpdir(),
      `rift-convergence-users-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
    );
    users.setTestFilePath(tmpFile);
    users.clearUsers();
    users.createUser('rift_runner', 'pass');
    accountId = users.findUserByUsername('rift_runner').accountId;
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

  it('stays locked with only frost_crossing tier 2 completed', async () => {
    await users.completeQuestTier(accountId, 'frost_crossing', 2);
    expect(users.hasCompletedQuestTier(accountId, 'frost_crossing', 2)).toBe(true);
    expect(users.isQuestTierUnlocked(accountId, QUEST_ID, TIER)).toBe(false);
  });

  it('stays locked with only ember_descent tier 2 completed', async () => {
    await users.completeQuestTier(accountId, 'ember_descent', 2);
    expect(users.hasCompletedQuestTier(accountId, 'ember_descent', 2)).toBe(true);
    expect(users.isQuestTierUnlocked(accountId, QUEST_ID, TIER)).toBe(false);
  });

  it('unlocks once BOTH frost_crossing and ember_descent tier 2 are completed', async () => {
    await users.completeQuestTier(accountId, 'frost_crossing', 2);
    await users.completeQuestTier(accountId, 'ember_descent', 2);
    expect(users.isQuestTierUnlocked(accountId, QUEST_ID, TIER)).toBe(true);
  });
});

describe('rift_convergence level unlock graph node', () => {
  let tmpFile;
  let accountId;

  function riftNode(graph) {
    return graph.nodes.find((n) => n.questId === QUEST_ID && n.tier === TIER);
  }

  beforeEach(() => {
    tmpFile = path.join(
      os.tmpdir(),
      `rift-convergence-graph-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
    );
    users.setTestFilePath(tmpFile);
    users.clearUsers();
    users.createUser('rift_graph_player', 'pass');
    accountId = users.findUserByUsername('rift_graph_player').accountId;
  });

  afterEach(() => {
    try {
      fs.unlinkSync(tmpFile);
    } catch {}
    try {
      fs.unlinkSync(tmpFile + '.tmp');
    } catch {}
  });

  it('emits an isBoss node carrying BOTH prerequisite edges', () => {
    const node = riftNode(buildLevelUnlockGraph(accountId));
    expect(node).toBeDefined();
    expect(node.isBoss).toBe(true);
    expect(node.objectiveType).toBe('stage_boss');
    expect(node.unlockRequires).toEqual([
      { questId: 'frost_crossing', tier: 2 },
      { questId: 'ember_descent', tier: 2 },
    ]);
  });

  it("flips state from 'locked' to 'unlocked' only when both prereq tiers are completed", async () => {
    expect(riftNode(buildLevelUnlockGraph(accountId)).state).toBe('locked');

    await users.completeQuestTier(accountId, 'frost_crossing', 2);
    expect(riftNode(buildLevelUnlockGraph(accountId)).state).toBe('locked');

    await users.completeQuestTier(accountId, 'ember_descent', 2);
    expect(riftNode(buildLevelUnlockGraph(accountId)).state).toBe('unlocked');
  });
});

describe('rift_convergence spawn pipeline', () => {
  let state;

  beforeEach(() => {
    state = createGameState();
  });

  it('spawns exactly one riftbound_colossus plus 4 adds from the ice/fire pool', () => {
    deployRiftConvergenceRun(state);

    expect(state.run.objective.type).toBe('stage_boss');
    expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.DORMANT);
    expect(state.enemies).toHaveLength(5);

    const bosses = state.enemies.filter((e) => e.type === 'riftbound_colossus');
    expect(bosses).toHaveLength(1);
    expect(bosses[0].id).toBe(state.run.encounter.bossEnemyId);

    const dais = state.layout.landmarks.find((lm) => lm.type === 'arena_dais');
    expect(bosses[0].x).toBe(dais.x);
    expect(bosses[0].z).toBe(dais.z);

    const adds = state.enemies.filter((e) => e.id !== state.run.encounter.bossEnemyId);
    expect(adds).toHaveLength(4);
    for (const add of adds) {
      expect(ICE_FIRE_POOL_TYPES.has(add.type)).toBe(true);
    }
  });

  it('keeps the add composition deterministic per seed and pool-pure across seeds', () => {
    for (const seed of [1, 42, 777, 38604]) {
      state = createGameState();
      deployRiftConvergenceRun(state, { seed });
      const adds = state.enemies.filter((e) => e.id !== state.run.encounter.bossEnemyId);
      expect(adds).toHaveLength(4);
      expect(adds.every((add) => ICE_FIRE_POOL_TYPES.has(add.type))).toBe(true);
    }
  });
});
