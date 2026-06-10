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
  checkRunTerminalState,
  recordEnemyDefeated,
  isRunObjectiveComplete,
} from '../index.js';

const require = createRequire(import.meta.url);
const progression = require('../progression');
const { QUEST_DEFS } = require('../quests');

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

  it('fires run_start once when startDungeonRun deploys training_caverns', () => {
    const io = createMockIo();
    progressionInitWithIo(io);

    startDungeonRun();

    const dialogueEvents = io.emitted.filter((e) => e.event === SERVER_TO_CLIENT.QUEST_DIALOGUE);
    expect(dialogueEvents).toHaveLength(1);
    expect(dialogueEvents[0].payload.trigger).toBe('run_start');
    expect(dialogueEvents[0].payload.speaker).toBe('Rewa');
  });

  describe('crystal_rescue itemCollected stub dialogue', () => {
    let originalDialogue;

    beforeEach(() => {
      originalDialogue = QUEST_DEFS.crystal_rescue.tiers[1].dialogue;
      QUEST_DEFS.crystal_rescue.tiers[1].dialogue = [
        { trigger: 'run_start', text: 'Salvage channel open.' },
        { trigger: { itemCollected: 1 }, text: 'First prism secured.' },
        { trigger: { itemCollected: 2 }, text: 'Second prism locked.' },
        { trigger: { itemCollected: 3 }, text: 'Final prism in hand.' },
        { trigger: 'objective_complete', text: 'Lattice stable — extract.' },
      ];
      gameState.selectedQuestId = 'crystal_rescue';
    });

    afterEach(() => {
      QUEST_DEFS.crystal_rescue.tiers[1].dialogue = originalDialogue;
    });

    it('emits sequential itemCollected beats via recordCrystalCollected', () => {
      const io = createMockIo();
      progressionInitWithIo(io);

      startDungeonRun();
      progression.recordCrystalCollected(1);
      progression.recordCrystalCollected(1);
      progression.recordCrystalCollected(1);

      const payloads = io.emitted
        .filter((e) => e.event === SERVER_TO_CLIENT.QUEST_DIALOGUE)
        .map((e) => e.payload);

      expect(payloads.map((p) => p.text)).toEqual([
        'Salvage channel open.',
        'First prism secured.',
        'Second prism locked.',
        'Final prism in hand.',
      ]);
      expect(payloads.every((p) => p.questId === 'crystal_rescue')).toBe(true);
    });

    it('emits objective_complete once when the run objective completes', () => {
      const io = createMockIo();
      progressionInitWithIo(io);

      startDungeonRun();
      const total = getQuest('crystal_rescue', 1).itemCount;
      for (let i = 0; i < total; i += 1) {
        progression.recordCrystalCollected(1);
      }

      checkRunTerminalState();

      const completePayloads = io.emitted
        .filter((e) => e.event === SERVER_TO_CLIENT.QUEST_DIALOGUE)
        .map((e) => e.payload)
        .filter((p) => p.trigger === 'objective_complete');

      expect(completePayloads).toHaveLength(1);
      expect(completePayloads[0].text).toBe('Lattice stable — extract.');

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

    const originalTrainingDialogue = QUEST_DEFS.training_caverns.tiers[1].dialogue;
    QUEST_DEFS.training_caverns.tiers[1].dialogue = [
      ...(originalTrainingDialogue ?? []),
      { trigger: 'objective_complete', text: 'Annex clear — good work.' },
    ];

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

    QUEST_DEFS.training_caverns.tiers[1].dialogue = originalTrainingDialogue;
  });
});
