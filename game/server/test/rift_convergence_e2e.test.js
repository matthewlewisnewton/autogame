import { createRequire } from 'node:module';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { generateLayout } from '../dungeon.js';
import { createGameState } from '../game-state.js';
import {
  ENCOUNTER_PHASES,
  ENCOUNTER_TRIGGER_RADIUS,
  canDamageEnemy,
  tryActivateEncounter,
  isEncounterCleared,
  isEncounterLocked,
} from '../encounters.js';
import {
  setGameState,
  spawnEnemies,
  startDungeonRun,
  removeDeadEnemies,
  cleanupAfterDamage,
  checkRunTerminalState,
  isRunObjectiveComplete,
} from '../progression.js';

// users.js/quests.js/simulation.js are resolved via CJS so the gate, the run
// lifecycle, and the damage pipeline all share the same module instances that
// progression.js reads lazily at call time (see rift_convergence.test.js).
const require = createRequire(import.meta.url);
const users = require('../users.js');
const { QUEST_DEFS, getLayoutProfileForQuest } = require('../quests.js');
const {
  ENEMY_DEFS,
  damageEnemy,
  setGameState: setSimulationGameState,
} = require('../simulation.js');

const QUEST_ID = 'rift_convergence';
const TIER = 1;
const SEED = 38711;
const ADD_COUNT = 4;

function setSoloPlayer(state, accountId, position = { x: -20, z: 0 }) {
  Object.keys(state.players).forEach((k) => delete state.players[k]);
  state.players.p1 = {
    x: position.x,
    y: 0.5,
    z: position.z,
    rotation: 0,
    hp: 100,
    dead: false,
    extracted: false,
    accountId,
  };
}

function deployRiftConvergenceRun(state, accountId, { seed = SEED } = {}) {
  setSoloPlayer(state, accountId);
  state.selectedQuestId = QUEST_ID;
  state.selectedQuestTier = TIER;
  state.layout = generateLayout(seed, getLayoutProfileForQuest(QUEST_ID, TIER));
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

function bossEnemy(state) {
  return state.enemies.find((e) => e.id === state.run.encounter.bossEnemyId);
}

describe('rift_convergence end-to-end unlock → run → defeat lifecycle', () => {
  let tmpFile;
  let accountId;
  let frostOnlyAccountId;
  let emberOnlyAccountId;

  beforeEach(() => {
    tmpFile = path.join(
      os.tmpdir(),
      `rift-e2e-users-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
    );
    users.setTestFilePath(tmpFile);
    users.clearUsers();
    users.createUser('rift_e2e_runner', 'pass');
    users.createUser('rift_e2e_frost_only', 'pass');
    users.createUser('rift_e2e_ember_only', 'pass');
    accountId = users.findUserByUsername('rift_e2e_runner').accountId;
    frostOnlyAccountId = users.findUserByUsername('rift_e2e_frost_only').accountId;
    emberOnlyAccountId = users.findUserByUsername('rift_e2e_ember_only').accountId;
  });

  afterEach(() => {
    try {
      fs.unlinkSync(tmpFile);
    } catch {}
    try {
      fs.unlinkSync(tmpFile + '.tmp');
    } catch {}
  });

  it('admits a qualified account, plays dormant → active → cleared, and records completion', async () => {
    // ── Gate: BOTH ice-2 and fire-2 are required; missing either keeps it locked.
    await users.completeQuestTier(frostOnlyAccountId, 'frost_crossing', 2);
    await users.completeQuestTier(emberOnlyAccountId, 'ember_descent', 2);
    expect(users.isQuestTierUnlocked(frostOnlyAccountId, QUEST_ID, TIER)).toBe(false);
    expect(users.isQuestTierUnlocked(emberOnlyAccountId, QUEST_ID, TIER)).toBe(false);

    await users.completeQuestTier(accountId, 'frost_crossing', 2);
    await users.completeQuestTier(accountId, 'ember_descent', 2);
    expect(users.isQuestTierUnlocked(accountId, QUEST_ID, TIER)).toBe(true);

    // ── Run start: boss-arena layout, stage_boss objective for 5, dormant encounter.
    const state = deployRiftConvergenceRun(createGameState(), accountId);
    expect(getLayoutProfileForQuest(QUEST_ID, TIER)).toBe('boss-arena');
    expect(state.layout.profile).toBe('boss-arena');
    expect(state.run.questId).toBe(QUEST_ID);
    expect(state.run.objective.type).toBe('stage_boss');
    expect(state.run.objective.totalEnemies).toBe(1 + ADD_COUNT);
    expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.DORMANT);
    expect(state.enemies).toHaveLength(1 + ADD_COUNT);

    const boss = bossEnemy(state);
    expect(boss.type).toBe('riftbound_colossus');

    // ── Dormant: the boss is invulnerable; adds are not.
    expect(canDamageEnemy(state, boss)).toBe(false);
    const dormantHp = boss.hp;
    const blocked = damageEnemy(boss, 9999);
    expect(blocked.killed).toBe(false);
    expect(boss.hp).toBe(dormantHp);

    // Activation needs BOTH conditions: with adds alive nothing happens, even
    // though the player starts far from the dais anyway.
    expect(tryActivateEncounter(state)).toBe(false);
    expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.DORMANT);

    const adds = state.enemies.filter((e) => e.id !== boss.id);
    expect(adds).toHaveLength(ADD_COUNT);
    for (const add of adds) {
      expect(canDamageEnemy(state, add)).toBe(true);
      damageEnemy(add, add.hp);
    }
    removeDeadEnemies();
    expect(state.run.objective.defeatedEnemies).toBe(ADD_COUNT);

    // Adds down but player still outside the trigger radius: stays dormant.
    expect(tryActivateEncounter(state)).toBe(false);
    expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.DORMANT);

    // ── Activate: step within ENCOUNTER_TRIGGER_RADIUS of the dais anchor.
    const dais = state.layout.landmarks.find((lm) => lm.type === 'arena_dais');
    const anchor = state.run.encounter.spawnAnchor;
    expect(anchor).toEqual({ x: dais.x, z: dais.z });
    state.players.p1.x = anchor.x + ENCOUNTER_TRIGGER_RADIUS - 1;
    state.players.p1.z = anchor.z;

    expect(tryActivateEncounter(state)).toBe(true);
    expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.ACTIVE);
    expect(isEncounterLocked(state.run)).toBe(true);

    // ── Active: the boss takes damage now; reduce it to 0 to clear.
    expect(canDamageEnemy(state, boss)).toBe(true);
    const chip = damageEnemy(boss, 60);
    expect(chip.hpBefore - boss.hp).toBe(60);

    damageEnemy(boss, boss.hp);
    removeDeadEnemies();

    expect(isEncounterCleared(state.run)).toBe(true);
    expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.CLEARED);
    expect(state.run.objective.bossDefeated).toBe(true);
    expect(isRunObjectiveComplete(state.run.objective)).toBe(true);

    // ── Victory: terminal check records tier-1 completion on the account.
    expect(users.hasCompletedQuestTier(accountId, QUEST_ID, TIER)).toBe(false);
    cleanupAfterDamage();
    await checkRunTerminalState();
    expect(state.run.status).toBe('victory');
    expect(users.hasCompletedQuestTier(accountId, QUEST_ID, TIER)).toBe(true);
  });
});

describe('rift_convergence difficulty validation against live defs', () => {
  // citadel_sovereign (the citadel_assault capstone apex) is deliberately
  // absent: it ties the colossus' 460 HP ceiling and exceeds its attackDamage.
  // Its supremacy is asserted in citadel_capstone_quest.test.js.
  const OTHER_STAGE_BOSS_TYPES = [
    'miniboss',
    'annex_overseer',
    'arena_champion',
    'crucible_sovereign',
    'spire_warden',
    'cinder_warden',
    'magma_colossus',
    'permafrost_warden',
    'glacial_tyrant',
  ];

  // design.md (Stage Bosses): 500 HP could not be brought to 0 within the 180s
  // defeatBoss validation window, so the band tops out at 460.
  const DEFEAT_BOSS_HP_CEILING = 460;

  function bossLevelTiers() {
    const entries = [];
    for (const [questId, questDef] of Object.entries(QUEST_DEFS)) {
      for (const [tier, tierDef] of Object.entries(questDef.tiers ?? {})) {
        if (tierDef.levelKind === 'boss_level') {
          entries.push({ questId, tier: Number(tier), tierDef });
        }
      }
    }
    return entries;
  }

  it('riftbound_colossus out-stats every other non-capstone stage boss but respects the HP ceiling', () => {
    const colossus = ENEMY_DEFS.riftbound_colossus;
    expect(colossus).toBeDefined();
    for (const type of OTHER_STAGE_BOSS_TYPES) {
      const def = ENEMY_DEFS[type];
      expect(def, `missing stage-boss def ${type}`).toBeDefined();
      expect(colossus.hp, `hp must exceed ${type}'s`).toBeGreaterThan(def.hp);
      expect(
        colossus.attackDamage,
        `attackDamage must exceed ${type}'s`,
      ).toBeGreaterThan(def.attackDamage);
    }
    expect(colossus.hp).toBeLessThanOrEqual(DEFEAT_BOSS_HP_CEILING);
  });

  it('fields strictly more encounter adds than every other non-capstone boss level', () => {
    const riftAdds = QUEST_DEFS[QUEST_ID].tiers[TIER].encounter.addCount;
    // citadel_assault is the new apex boss level: it strictly out-adds the
    // rift, so it is excluded here and asserted supreme in
    // citadel_capstone_quest.test.js.
    const others = bossLevelTiers().filter(
      (entry) => entry.questId !== QUEST_ID && entry.questId !== 'citadel_assault',
    );
    expect(others.length).toBeGreaterThan(0);
    for (const { questId, tier, tierDef } of others) {
      expect(
        riftAdds,
        `addCount must exceed ${questId} tier ${tier}'s`,
      ).toBeGreaterThan(tierDef.encounter?.addCount ?? 0);
    }
  });

  it('pays the highest rewardCurrency of any non-capstone boss level', () => {
    const riftPurse = QUEST_DEFS[QUEST_ID].tiers[TIER].rewardCurrency;
    // citadel_assault is the new apex boss level: its 26-stone purse strictly
    // tops the rift's 22, so it is excluded here and asserted supreme in
    // citadel_capstone_quest.test.js.
    const others = bossLevelTiers().filter(
      (entry) => entry.questId !== QUEST_ID && entry.questId !== 'citadel_assault',
    );
    expect(others.length).toBeGreaterThan(0);
    for (const { questId, tier, tierDef } of others) {
      expect(
        riftPurse,
        `rewardCurrency must exceed ${questId} tier ${tier}'s`,
      ).toBeGreaterThan(tierDef.rewardCurrency ?? 0);
    }
  });
});
