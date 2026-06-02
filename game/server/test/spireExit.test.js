import { describe, it, expect, beforeEach } from 'vitest';
import { mulberry32, generateLayout } from '../dungeon.js';
import { QUEST_DEFS } from '../quests.js';
import {
  setGameState,
  getGameState,
  spawnEnemies,
  spawnSpireExit,
  createRunState,
  startDungeonRun,
  recordEnemyDefeated,
  recordSpireExitReached,
  isRunObjectiveComplete,
  checkRunTerminalState,
} from '../progression.js';
import { applyLayoutForQuest } from '../index.js';

const SPIRE_SEED = 2;

function tierContainingPosition(layout, x, z) {
  for (const room of layout.rooms) {
    const halfW = room.width / 2;
    const halfD = room.depth / 2;
    if (Math.abs(x - room.x) <= halfW && Math.abs(z - room.z) <= halfD) {
      return room;
    }
  }
  return null;
}

describe('spire_ascent summit exit objective', () => {
  beforeEach(() => {
    const state = {
      selectedQuestId: 'spire_ascent',
      layout: generateLayout(SPIRE_SEED, undefined, { stage: 'spire-ascent' }),
      layoutSeed: SPIRE_SEED,
      enemies: [],
      loot: [],
      players: {},
      minions: [],
      gamePhase: 'playing',
      run: null,
    };
    applyLayoutForQuest(state, 'spire_ascent');
    setGameState(state);
  });

  it('defines defeat_enemies_reach_exit on spire_ascent quest', () => {
    expect(QUEST_DEFS.spire_ascent.objectiveType).toBe('defeat_enemies_reach_exit');
  });

  it('spawnEnemies places exactly one spire_exit on the treasure tier', () => {
    spawnEnemies();
    const exits = getGameState().loot.filter((l) => l.kind === 'spire_exit');
    expect(exits).toHaveLength(1);

    const treasureRoom = getGameState().layout.rooms.find((r) => r.role === 'treasure');
    expect(treasureRoom).toBeDefined();
    const room = tierContainingPosition(getGameState().layout, exits[0].x, exits[0].z);
    expect(room?.role).toBe('treasure');
    expect(Number.isFinite(exits[0].y)).toBe(true);
  });

  it('createRunState tracks reachedExit for spire runs', () => {
    spawnEnemies();
    startDungeonRun();
    const objective = getGameState().run.objective;
    expect(objective.type).toBe('defeat_enemies_reach_exit');
    expect(objective.reachedExit).toBe(false);
    expect(objective.totalEnemies).toBe(QUEST_DEFS.spire_ascent.enemyCount);
  });

  it('isRunObjectiveComplete is false when all enemies are dead but exit not reached', () => {
    spawnEnemies();
    startDungeonRun();
    const objective = getGameState().run.objective;
    recordEnemyDefeated(objective.totalEnemies);
    expect(isRunObjectiveComplete(objective)).toBe(false);
  });

  it('isRunObjectiveComplete is true only after enemies cleared and exit reached', () => {
    spawnEnemies();
    startDungeonRun();
    const objective = getGameState().run.objective;
    recordEnemyDefeated(objective.totalEnemies);
    recordSpireExitReached();
    expect(isRunObjectiveComplete(objective)).toBe(true);
  });

  it('checkRunTerminalState does not award victory until exit is reached', () => {
    spawnEnemies();
    startDungeonRun();
    const objective = getGameState().run.objective;
    recordEnemyDefeated(objective.totalEnemies);
    checkRunTerminalState();
    expect(getGameState().run.status).toBe('playing');

    recordSpireExitReached();
    checkRunTerminalState();
    expect(getGameState().run.status).toBe('victory');
  });

  it('spawnSpireExit is a no-op on non-spire layouts', () => {
    const layout = generateLayout(99);
    setGameState({ ...getGameState(), layout, loot: [] });
    spawnSpireExit(layout, mulberry32(1));
    expect(getGameState().loot.filter((l) => l.kind === 'spire_exit')).toHaveLength(0);
  });
});
