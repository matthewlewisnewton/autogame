import { createRequire } from 'node:module';
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  grantRunRewards,
  previewReturnRewards,
  gameState,
  resetGameState,
  setGameState,
  startDungeonRun,
} from '../index.js';
import { setGameState as setSimulationGameState } from '../simulation.js';
import { PHASES } from '../lobbies.js';

const require = createRequire(import.meta.url);
const {
  QUEST_DEFS,
  formatRewardSummary,
  getQuest,
  listQuests,
} = require('../quests.js');
const { VICTORY_REWARD_ROTATION } = require('../config.js');

const SIGNATURE_FIXTURE_ID = 'signature_reward_fixture';

const SIGNATURE_FIXTURE_DEF = {
  id: SIGNATURE_FIXTURE_ID,
  enemyPool: [{ type: 'grunt', weight: 1 }],
  tiers: {
    1: {
      name: 'Signature Reward Fixture',
      description: 'Test-only signature reward wiring.',
      objectiveType: 'defeat_enemies',
      enemyCount: 1,
      rewardCurrency: 12,
      rewardCardId: 'saber_of_light',
      signatureCardId: 'saber_of_light',
      rewardCards: ['saber_of_light'],
      layoutProfile: 'crowded',
    },
  },
};

function resetState() {
  resetGameState();
  setSimulationGameState(gameState);
  delete gameState._victoryCounters;
}

function addPlayer(id, overrides = {}) {
  gameState.players[id] = {
    id,
    currency: 0,
    ownedCards: {},
    runCardDropIds: [],
    ...overrides,
  };
}

function startSignatureRun() {
  gameState.selectedQuestId = SIGNATURE_FIXTURE_ID;
  gameState.selectedQuestTier = 1;
  gameState.gamePhase = PHASES.PLAYING;
  gameState.players.p1.ready = true;
  gameState.players.p1.connected = true;
  startDungeonRun();
}

beforeEach(() => {
  QUEST_DEFS[SIGNATURE_FIXTURE_ID] = SIGNATURE_FIXTURE_DEF;
  resetState();
});

afterAll(() => {
  delete QUEST_DEFS[SIGNATURE_FIXTURE_ID];
});

describe('formatRewardSummary()', () => {
  it('shows signature card name plus currency stones', () => {
    const quest = getQuest(SIGNATURE_FIXTURE_ID, 1);
    expect(formatRewardSummary(quest)).toBe('Reward: Saber of Light + 12 stones');
  });

  it('includes signature card in quest board payload', () => {
    const row = listQuests().find((quest) => quest.id === SIGNATURE_FIXTURE_ID);
    expect(row.rewardSummary).toBe('Reward: Saber of Light + 12 stones');
  });
});

describe('grantRunRewards() signature card path', () => {
  beforeEach(() => {
    addPlayer('p1');
    startSignatureRun();
  });

  it('offers the signature card in pending choices before global rotation when no run drops', () => {
    grantRunRewards('p1', { status: 'victory' });
    expect(gameState.players.p1.pendingCardChoices.map((c) => c.id)).toEqual(['saber_of_light']);
    expect(gameState.players.p1.ownedCards.saber_of_light).toBeUndefined();
    expect(gameState.players.p1.ownedCards[VICTORY_REWARD_ROTATION[0]]).toBeUndefined();
    expect(gameState.players.p1.runRewards.cards).toEqual([]);
    expect(gameState.players.p1.currency).toBe(12);
  });

  it('does not advance VICTORY_REWARD_ROTATION counter when signature choices are offered', () => {
    grantRunRewards('p1', { status: 'victory' });
    grantRunRewards('p1', { status: 'victory' });
    expect(gameState.players.p1.pendingCardChoices.map((c) => c.id)).toEqual(['saber_of_light']);
    expect(gameState.players.p1.ownedCards.saber_of_light).toBeUndefined();
    expect(gameState.players.p1.ownedCards.flame_blade).toBeUndefined();
    expect(gameState._victoryCounters).toBeUndefined();
  });
});

describe('previewReturnRewards() signature card path', () => {
  beforeEach(() => {
    addPlayer('p1');
    startSignatureRun();
    gameState.run.objective.defeatedEnemies = gameState.run.objective.totalEnemies;
  });

  it('previews the signature card in pending choices instead of a generic bonus card', () => {
    const preview = previewReturnRewards('p1');
    expect(preview.objectiveComplete).toBe(true);
    expect(preview.cardChoices).toEqual([{ id: 'saber_of_light', name: 'Saber of Light' }]);
    expect(preview.cards).toEqual([]);
    expect(preview.currency).toBe(12);
  });
});
