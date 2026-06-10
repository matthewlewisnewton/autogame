import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { SERVER_TO_CLIENT } from '../../shared/events.js';
import { getQuest } from '../quests.js';
import {
  matchDialogueTrigger,
  fireQuestDialogue,
  resetDialogueState,
  dialogueTriggerKey,
} from '../questDialogue.js';
import {
  resetGameState,
  gameState,
  startDungeonRun,
  checkAllReady,
  checkRunTerminalState,
  recordEnemyDefeated,
  isRunObjectiveComplete,
} from '../index.js';

const require = createRequire(import.meta.url);
const progression = require('../progression');

function createMockIo() {
  const emitted = [];
  return {
    emitted,
    emit(event, payload) {
      emitted.push({ event, payload });
    },
  };
}

function progressionInitWithIo(io) {
  progression.initProgression({
    gameState,
    getIo: () => io,
  });
}

describe('matchDialogueTrigger', () => {
  it('matches string triggers', () => {
    const entry = { trigger: 'run_start', text: 'hello' };
    expect(matchDialogueTrigger(entry, 'run_start')).toBe(true);
    expect(matchDialogueTrigger(entry, 'objective_complete')).toBe(false);
  });

  it('matches itemCollected object triggers', () => {
    const entry = { trigger: { itemCollected: 2 }, text: 'second prism' };
    expect(matchDialogueTrigger(entry, { itemCollected: 2 })).toBe(true);
    expect(matchDialogueTrigger(entry, { itemCollected: 1 })).toBe(false);
    expect(matchDialogueTrigger(entry, 'run_start')).toBe(false);
  });

  it('matches waveCleared object triggers without firing gameplay hooks', () => {
    const entry = { trigger: { waveCleared: 3 }, text: 'wave down' };
    expect(matchDialogueTrigger(entry, { waveCleared: 3 })).toBe(true);
    expect(matchDialogueTrigger(entry, { waveCleared: 2 })).toBe(false);
    expect(matchDialogueTrigger(entry, { itemCollected: 3 })).toBe(false);
  });
});

describe('fireQuestDialogue', () => {
  it('dedupes triggers within a run', () => {
    const io = createMockIo();
    const run = {
      questId: 'training_caverns',
      questTier: 1,
    };
    resetDialogueState(run);

    const first = fireQuestDialogue(io, { run }, 'run_start');
    const second = fireQuestDialogue(io, { run }, 'run_start');

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(0);
    expect(io.emitted).toHaveLength(1);
    expect(dialogueTriggerKey('run_start')).toBe('run_start');
  });

  it('emits questDialogue with speaker defaulting to client.name', () => {
    const io = createMockIo();
    const run = {
      questId: 'training_caverns',
      questTier: 1,
    };
    resetDialogueState(run);

    const [payload] = fireQuestDialogue(io, { run }, 'run_start');

    expect(io.emitted[0].event).toBe(SERVER_TO_CLIENT.QUEST_DIALOGUE);
    expect(payload).toEqual({
      speaker: 'Rewa',
      text: expect.stringContaining('Rewa'),
      questId: 'training_caverns',
      tier: 1,
      trigger: 'run_start',
    });
  });
});

describe('quest dialogue progression hooks', () => {
  beforeEach(() => {
    resetGameState();
  });

  it('does not emit run_start from startDungeonRun alone', () => {
    const io = createMockIo();
    progressionInitWithIo(io);

    startDungeonRun();

    const dialogueEvents = io.emitted.filter((e) => e.event === SERVER_TO_CLIENT.QUEST_DIALOGUE);
    expect(dialogueEvents).toHaveLength(0);
  });

  it('emits run_start after START_GAME and playing STATE_UPDATE on checkAllReady deploy', () => {
    const io = createMockIo();
    progressionInitWithIo(io);

    gameState.gamePhase = 'lobby';
    gameState.selectedQuestId = 'training_caverns';
    gameState.selectedQuestTier = 1;
    gameState.players = {
      p1: {
        id: 'p1',
        ready: true,
        connected: true,
        selectedDeck: ['iron_sword', 'flame_blade', 'battle_familiar', 'dungeon_drake'],
      },
    };

    checkAllReady();

    const startIdx = io.emitted.findIndex((e) => e.event === SERVER_TO_CLIENT.START_GAME);
    const stateIdx = io.emitted.findIndex((e) => e.event === SERVER_TO_CLIENT.STATE_UPDATE);
    const dialogueIdx = io.emitted.findIndex((e) => e.event === SERVER_TO_CLIENT.QUEST_DIALOGUE);

    expect(startIdx).toBeGreaterThanOrEqual(0);
    expect(stateIdx).toBeGreaterThan(startIdx);
    expect(dialogueIdx).toBeGreaterThan(stateIdx);
    expect(io.emitted[stateIdx].payload.gamePhase).toBe('playing');
    expect(io.emitted[dialogueIdx].payload.trigger).toBe('run_start');
    expect(io.emitted[dialogueIdx].payload.speaker).toBe('Rewa');

    const dialogueEvents = io.emitted.filter((e) => e.event === SERVER_TO_CLIENT.QUEST_DIALOGUE);
    expect(dialogueEvents).toHaveLength(1);
  });

  describe('crystal_rescue itemCollected dialogue', () => {
    beforeEach(() => {
      gameState.selectedQuestId = 'crystal_rescue';
    });

    it('emits sequential itemCollected beats via recordCrystalCollected', () => {
      const io = createMockIo();
      progressionInitWithIo(io);
      const quest = getQuest('crystal_rescue', 1);
      const runStart = quest.dialogue.find((entry) => entry.trigger === 'run_start')?.text;
      const itemTexts = [1, 2, 3].map(
        (index) =>
          quest.dialogue.find(
            (entry) =>
              entry.trigger
              && typeof entry.trigger === 'object'
              && entry.trigger.itemCollected === index,
          )?.text,
      );

      startDungeonRun();
      progression.emitRunStartDialogue(io);
      progression.recordCrystalCollected(1);
      progression.recordCrystalCollected(1);
      progression.recordCrystalCollected(1);

      const payloads = io.emitted
        .filter((e) => e.event === SERVER_TO_CLIENT.QUEST_DIALOGUE)
        .map((e) => e.payload)
        .filter((p) => typeof p.text === 'string');

      expect(payloads.map((p) => p.text)).toEqual([runStart, ...itemTexts]);
      expect(new Set(payloads.map((p) => p.text)).size).toBe(4);
      expect(payloads.every((p) => p.questId === 'crystal_rescue')).toBe(true);
      expect(payloads.every((p) => p.speaker === 'Lysa')).toBe(true);
    });

    it('emits objective_complete once when the run objective completes', () => {
      const io = createMockIo();
      progressionInitWithIo(io);
      const completeText = getQuest('crystal_rescue', 1).dialogue.find(
        (entry) => entry.trigger === 'objective_complete',
      )?.text;

      startDungeonRun();
      progression.emitRunStartDialogue(io);
      const quest = getQuest('crystal_rescue', 1);
      const total = quest.itemCount;
      for (let i = 0; i < total; i += 1) {
        progression.recordCrystalCollected(1);
      }
      const guardCount = gameState.run.objective.totalEnemies ?? 0;
      for (let i = 0; i < guardCount; i += 1) {
        progression.recordEnemyDefeated(1);
      }

      checkRunTerminalState();

      const completePayloads = io.emitted
        .filter((e) => e.event === SERVER_TO_CLIENT.QUEST_DIALOGUE)
        .map((e) => e.payload)
        .filter((p) => p.trigger === 'objective_complete');

      expect(completePayloads).toHaveLength(1);
      expect(completePayloads[0].text).toBe(completeText);

      checkRunTerminalState();
      const afterRepeat = io.emitted
        .filter((e) => e.event === SERVER_TO_CLIENT.QUEST_DIALOGUE)
        .map((e) => e.payload)
        .filter((p) => p.trigger === 'objective_complete');
      expect(afterRepeat).toHaveLength(1);
    });
  });

  describe('endless_siege waveCleared dialogue', () => {
    beforeEach(() => {
      gameState.selectedQuestId = 'endless_siege';
      gameState.selectedQuestTier = 1;
    });

    it('emits waveCleared:5 after five recordEnemyDefeated calls', () => {
      const io = createMockIo();
      progressionInitWithIo(io);
      const quest = getQuest('endless_siege', 1);
      const waveText = quest.dialogue.find(
        (entry) =>
          entry.trigger
          && typeof entry.trigger === 'object'
          && entry.trigger.waveCleared === 5,
      )?.text;

      startDungeonRun();
      progression.emitRunStartDialogue(io);

      for (let i = 0; i < 5; i += 1) {
        recordEnemyDefeated(1);
      }

      const wavePayloads = io.emitted
        .filter((e) => e.event === SERVER_TO_CLIENT.QUEST_DIALOGUE)
        .map((e) => e.payload)
        .filter(
          (p) =>
            p.trigger
            && typeof p.trigger === 'object'
            && p.trigger.waveCleared === 5,
        );

      expect(wavePayloads).toHaveLength(1);
      expect(wavePayloads[0].text).toBe(waveText);
      expect(wavePayloads[0].speaker).toBe('Marshal Koss');
      expect(wavePayloads[0].trigger.waveCleared).toBe(5);

      recordEnemyDefeated(1);
      const afterSixth = io.emitted
        .filter((e) => e.event === SERVER_TO_CLIENT.QUEST_DIALOGUE)
        .map((e) => e.payload)
        .filter(
          (p) =>
            p.trigger
            && typeof p.trigger === 'object'
            && p.trigger.waveCleared === 5,
        );
      expect(afterSixth).toHaveLength(1);
    });

    it('does not emit waveCleared before the configured threshold', () => {
      const io = createMockIo();
      progressionInitWithIo(io);

      startDungeonRun();
      progression.emitRunStartDialogue(io);

      for (let i = 0; i < 4; i += 1) {
        recordEnemyDefeated(1);
      }

      const wavePayloads = io.emitted
        .filter((e) => e.event === SERVER_TO_CLIENT.QUEST_DIALOGUE)
        .map((e) => e.payload)
        .filter(
          (p) =>
            p.trigger
            && typeof p.trigger === 'object'
            && Object.prototype.hasOwnProperty.call(p.trigger, 'waveCleared'),
        );
      expect(wavePayloads).toHaveLength(0);
    });

    it('emits objective_complete only when all attackers are defeated', () => {
      const io = createMockIo();
      progressionInitWithIo(io);
      const completeText = getQuest('endless_siege', 1).dialogue.find(
        (entry) => entry.trigger === 'objective_complete',
      )?.text;

      startDungeonRun();
      progression.emitRunStartDialogue(io);
      const total = getQuest('endless_siege', 1).totalSpawns;
      for (let i = 0; i < total; i += 1) {
        recordEnemyDefeated(1);
      }

      checkRunTerminalState();

      const completePayloads = io.emitted
        .filter((e) => e.event === SERVER_TO_CLIENT.QUEST_DIALOGUE)
        .map((e) => e.payload)
        .filter((p) => p.trigger === 'objective_complete');

      expect(completePayloads).toHaveLength(1);
      expect(completePayloads[0].text).toBe(completeText);
      expect(completePayloads[0].speaker).toBe('Marshal Koss');

      checkRunTerminalState();
      const afterRepeat = io.emitted
        .filter((e) => e.event === SERVER_TO_CLIENT.QUEST_DIALOGUE)
        .map((e) => e.payload)
        .filter((p) => p.trigger === 'objective_complete');
      expect(afterRepeat).toHaveLength(1);
    });
  });

  it('fires objective_complete for defeat_enemies quests', () => {
    const io = createMockIo();
    progressionInitWithIo(io);
    gameState.selectedQuestId = 'training_caverns';

    gameState.enemies = [
      { id: 'e1', x: 0, z: 0, hp: 50, state: 'idle', wanderTarget: { x: 0, z: 0 } },
      { id: 'e2', x: 5, z: 5, hp: 50, state: 'idle', wanderTarget: { x: 5, z: 5 } },
    ];
    startDungeonRun();
    const total = gameState.run.objective.totalEnemies;
    for (let i = 0; i < total; i += 1) {
      recordEnemyDefeated(1);
    }
    expect(isRunObjectiveComplete(gameState.run.objective)).toBe(true);

    checkRunTerminalState();

    const completePayloads = io.emitted
      .filter((e) => e.event === SERVER_TO_CLIENT.QUEST_DIALOGUE)
      .map((e) => e.payload)
      .filter((p) => p.trigger === 'objective_complete');

    expect(completePayloads).toHaveLength(1);
    expect(completePayloads[0].speaker).toBe('Rewa');
    expect(completePayloads[0].text).toBe(
      getQuest('training_caverns', 1).dialogue.find(
        (entry) => entry.trigger === 'objective_complete',
      )?.text,
    );
  });
});
