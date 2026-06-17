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
  tryActivateEncounter,
  isEncounterCleared,
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
import {
  getQuest,
  getEncounterConfig,
  formatObjectiveSummary,
  listQuests,
  getLayoutProfileForQuest,
  isBossLevelQuest,
} from '../quests.js';
import {
  startTestServer,
  closeServer,
  connectClient,
  waitForEvent,
  testGameState,
} from './helpers.js';
import { setTestProvider } from '../index.js';
import { InMemoryProvider } from '../providers.js';

const require = createRequire(import.meta.url);
const users = require('../users.js');
const { enemyDefFor } = require('../simulation.js');
const { ENEMY_MS_DROPS, ENEMY_CARD_DROPS } = require('../config.js');

const QUEST_ID = 'crucible_duel';
const TIER = 1;
const SEED = 38503;

function bossArenaLayout(seed = SEED) {
  return generateLayout(seed, 'boss-arena');
}

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

function deployCrucibleDuelRun(state, { seed = SEED, partySize = 1, playerPosition } = {}) {
  setPartySize(state, partySize, playerPosition ?? { x: -20, z: 0 });
  state.selectedQuestId = QUEST_ID;
  state.selectedQuestTier = TIER;
  state.layout = bossArenaLayout(seed);
  state.layoutSeed = seed;
  state.enemies = [];
  state.loot = [];
  state.gamePhase = 'playing';
  setGameState(state);
  const { setGameState: setSimulationGameState } = require('../simulation.js');
  setSimulationGameState(state);
  spawnEnemies();
  startDungeonRun();
  return state;
}

function bossEnemy(state) {
  return state.enemies.find((e) => e.id === state.run.encounter.bossEnemyId);
}

function activateEncounterForTest(state) {
  const bossId = state.run.encounter.bossEnemyId;
  for (const enemy of state.enemies) {
    if (enemy.id !== bossId) enemy.hp = 0;
  }
  state.enemies = state.enemies.filter((e) => e.hp > 0);
  const anchor = state.run.encounter.spawnAnchor;
  if (anchor && state.players.p1) {
    state.players.p1.x = anchor.x + ENCOUNTER_TRIGGER_RADIUS - 1;
    state.players.p1.z = anchor.z;
  }
  tryActivateEncounter(state);
}

describe('crucible_sovereign boss type', () => {
  it('registers distinct stage-boss stats in the HP band with a signature drop', () => {
    const sovereign = enemyDefFor('crucible_sovereign');
    const miniboss = enemyDefFor('miniboss');
    expect(sovereign.name).toBe('Crucible Sovereign');
    expect(sovereign.description.length).toBeGreaterThan(0);
    expect(sovereign.hp).toBeGreaterThanOrEqual(300);
    expect(sovereign.hp).toBeLessThanOrEqual(420);
    expect(sovereign.hp).toBeGreaterThan(miniboss.hp);
    expect(ENEMY_MS_DROPS.crucible_sovereign).toBeGreaterThan(ENEMY_MS_DROPS.miniboss);
    expect(ENEMY_CARD_DROPS.crucible_sovereign).toBeDefined();
  });
});

describe('crucible_duel catalog', () => {
  it('exposes boss-level metadata on listQuests and formatObjectiveSummary', () => {
    const quest = getQuest(QUEST_ID, TIER);
    expect(quest.levelKind).toBe('boss_level');
    expect(quest.layoutProfile).toBe('boss-arena');
    expect(quest.objectiveType).toBe('stage_boss');
    expect(isBossLevelQuest(quest)).toBe(true);
    expect(getLayoutProfileForQuest(QUEST_ID, TIER)).toBe('boss-arena');
    expect(getEncounterConfig(quest)).toMatchObject({
      bossType: 'crucible_sovereign',
      landmark: 'arena_dais',
      addCount: 0,
    });
    expect(quest.unlockRequires).toEqual({ questId: 'arena_trials', tier: 2 });

    const summary = formatObjectiveSummary(quest);
    expect(summary).toBe('Defeat Crucible Sovereign');
    expect(summary).not.toContain('hostiles');

    const boardRow = listQuests().find((entry) => entry.id === QUEST_ID);
    expect(boardRow?.objectiveSummary).toBe(summary);
    expect(boardRow?.signatureCardId).toBe('sacrificial_altar');
  });
});

describe('crucible_duel deploy and encounter flow', () => {
  let state;

  beforeEach(() => {
    state = createGameState();
  });

  it('spawns a lone dormant crucible_sovereign wired to the arena dais', () => {
    deployCrucibleDuelRun(state);
    const dais = state.layout.landmarks.find((lm) => lm.type === 'arena_dais');
    const boss = bossEnemy(state);

    expect(state.run.objective.type).toBe('stage_boss');
    expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.DORMANT);
    expect(state.run.encounter.bossEnemyId).toBeTruthy();
    expect(state.enemies).toHaveLength(1);
    expect(boss.type).toBe('crucible_sovereign');
    expect(boss.x).toBe(dais.x);
    expect(boss.z).toBe(dais.z);
  });

  it('activates the encounter when a player enters the trigger radius', () => {
    deployCrucibleDuelRun(state);
    activateEncounterForTest(state);
    expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.ACTIVE);
    expect(state.run.encounter.locked).toBe(true);
  });

  it('completes with victory when the active boss is defeated', () => {
    deployCrucibleDuelRun(state);
    activateEncounterForTest(state);
    bossEnemy(state).hp = 0;
    removeDeadEnemies();

    expect(isEncounterCleared(state.run)).toBe(true);
    expect(state.run.objective.bossDefeated).toBe(true);
    expect(isRunObjectiveComplete(state.run.objective)).toBe(true);

    cleanupAfterDamage();
    checkRunTerminalState();
    expect(state.run.status).toBe('victory');
  });
});

describe('crucible_duel unlock gating', () => {
  let tmpFile;
  let baseUrl;
  let socket;
  let accountId;

  beforeEach(async () => {
    tmpFile = path.join(
      os.tmpdir(),
      `crucible-duel-unlock-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
    );
    users.setTestFilePath(tmpFile);
    users.clearUsers();
    baseUrl = await startTestServer();
    setTestProvider(new InMemoryProvider());

    users.createUser('crucible_runner', 'testpass');
    accountId = users.findUserByUsername('crucible_runner').accountId;
    const connected = await connectClient(baseUrl, accountId, { name: 'Crucible Room' });
    socket = connected.socket;
  });

  afterEach(async () => {
    if (socket && socket.connected) socket.disconnect();
    await closeServer();
    setTestProvider(null);
    try {
      fs.unlinkSync(tmpFile);
    } catch {}
    try {
      fs.unlinkSync(tmpFile + '.tmp');
    } catch {}
  });

  it('rejects selectQuest until arena_trials Tier 2 is completed', async () => {
    expect(users.isQuestTierUnlocked(accountId, QUEST_ID, TIER)).toBe(false);

    const errorPromise = waitForEvent(socket, 'questError');
    socket.emit('selectQuest', { questId: QUEST_ID, tier: TIER });
    const err = await errorPromise;
    expect(err.reason).toBe('tier_locked');
    expect(testGameState().selectedQuestId).not.toBe(QUEST_ID);
  });

  it('allows selectQuest after arena_trials Tier 2 is completed', async () => {
    await users.completeQuestTier(accountId, 'arena_trials', 2);
    expect(users.isQuestTierUnlocked(accountId, QUEST_ID, TIER)).toBe(true);

    const updatePromise = waitForEvent(socket, 'questUpdate');
    socket.emit('selectQuest', { questId: QUEST_ID, tier: TIER });
    const update = await updatePromise;
    expect(update.selectedQuestId).toBe(QUEST_ID);
    expect(update.selectedQuestTier).toBe(TIER);
    expect(testGameState().selectedQuestId).toBe(QUEST_ID);
  });
});
