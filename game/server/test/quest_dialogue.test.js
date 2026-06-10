import { createRequire } from 'node:module';
import { describe, it, expect, beforeEach } from 'vitest';
import { generateLayout } from '../dungeon.js';
import {
  spawnEnemies,
  startDungeonRun,
  removeDeadEnemies,
  gameState,
  resetGameState,
  setGameState,
} from '../index.js';
import { setGameState as setSimulationGameState } from '../simulation.js';

const require = createRequire(import.meta.url);
const {
  QUEST_DEFS,
  SCRIPTED_ENCOUNTER_FIXTURE_DEF,
  getQuest,
  getLayoutProfileForQuest,
  formatBriefingSummary,
  formatBriefingRewardLine,
  listQuestVariants,
} = require('../quests.js');
const {
  evaluateDialogueBeacons,
  emitQuestDialogue,
  initDialogueState,
} = require('../questDialogue.js');
const { SERVER_TO_CLIENT } = require('../../shared/events.js');

const FIXTURE_QUEST_ID = 'scripted_encounter_fixture';
const SEED = 5151;

function registerFixtureQuest() {
  QUEST_DEFS[FIXTURE_QUEST_ID] = SCRIPTED_ENCOUNTER_FIXTURE_DEF;
}

function deployScriptedFixture(seed = SEED) {
  gameState.selectedQuestId = FIXTURE_QUEST_ID;
  gameState.selectedQuestTier = 1;
  gameState.layout = generateLayout(seed, getLayoutProfileForQuest(FIXTURE_QUEST_ID, 1));
  gameState.layoutSeed = seed;
  gameState.enemies = [];
  gameState.loot = [];
  gameState.gamePhase = 'playing';
  gameState.players = {
    p1: {
      id: 'p1',
      x: gameState.layout.rooms[0].x,
      y: 0.5,
      z: gameState.layout.rooms[0].z,
      rotation: 0,
      hp: 100,
      dead: false,
      extracted: false,
      ready: true,
      connected: true,
    },
  };
  setGameState(gameState);
  setSimulationGameState(gameState);
  spawnEnemies();
  startDungeonRun();
  return gameState;
}

describe('quest briefing helpers', () => {
  it('formatBriefingSummary prefixes client NPC when briefing is present', () => {
    const quest = getQuest('training_caverns', 1);
    expect(formatBriefingSummary(quest)).toContain('Annex Liaison Kade');
    expect(formatBriefingSummary(quest)).toContain('holding pens');
  });

  it('formatBriefingRewardLine falls back to currency reward summary', () => {
    const quest = getQuest('crystal_rescue', 1);
    expect(formatBriefingRewardLine(quest)).toContain('12');
  });

  it('listQuestVariants includes briefing fields', () => {
    const variant = listQuestVariants().find((v) => v.questId === 'crystal_rescue' && v.tier === 1);
    expect(variant.clientNpc).toBe('Lattice Custodian Mira');
    expect(variant.briefingSummary).toContain('Lattice Custodian Mira');
    expect(variant.briefingRewardText).toContain('12');
  });
});

describe('evaluateDialogueBeacons()', () => {
  let run;
  let quest;

  beforeEach(() => {
    registerFixtureQuest();
    quest = getQuest(FIXTURE_QUEST_ID, 1);
    run = { questId: FIXTURE_QUEST_ID, questTier: 1 };
    initDialogueState(run);
  });

  it('fires onWaveCleared once per beaconId', () => {
    const first = evaluateDialogueBeacons(run, quest, 'onWaveCleared', {
      roomIndex: 0,
      waveIndex: 0,
    });
    const second = evaluateDialogueBeacons(run, quest, 'onWaveCleared', {
      roomIndex: 0,
      waveIndex: 0,
    });

    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({
      questId: FIXTURE_QUEST_ID,
      tier: 1,
      beaconId: 'fixture_wave0_clear',
      speaker: 'Test Handler',
      line: expect.stringContaining('Wave zero cleared'),
    });
    expect(second).toHaveLength(0);
  });

  it('fires prism collection beacons in order', () => {
    const prismQuest = getQuest('crystal_rescue', 1);
    const prismRun = { questId: 'crystal_rescue', questTier: 1 };
    initDialogueState(prismRun);

    const first = evaluateDialogueBeacons(prismRun, prismQuest, 'onCrystalCollected', {
      collectedCount: 1,
    });
    const second = evaluateDialogueBeacons(prismRun, prismQuest, 'onCrystalCollected', {
      collectedCount: 2,
    });

    expect(first[0].beaconId).toBe('prism_first');
    expect(second[0].beaconId).toBe('prism_second');
  });

  it('fires onRoomEntered for roomIndex beacons', () => {
    const trainingQuest = getQuest('training_caverns', 1);
    const trainingRun = { questId: 'training_caverns', questTier: 1 };
    initDialogueState(trainingRun);

    const payloads = evaluateDialogueBeacons(trainingRun, trainingQuest, 'onRoomEntered', {
      roomIndex: 0,
    });

    expect(payloads).toHaveLength(1);
    expect(payloads[0].beaconId).toBe('training_start_room');
  });
});

describe('emitQuestDialogue()', () => {
  it('emits questDialogue on the lobby room', () => {
    const emitted = [];
    const io = {
      to(roomId) {
        expect(roomId).toBe('lobby-1');
        return {
          emit(event, payload) {
            emitted.push({ event, payload });
          },
        };
      },
    };
    const lobby = { id: 'lobby-1' };
    const payload = {
      questId: 'training_caverns',
      tier: 1,
      beaconId: 'training_start_room',
      speaker: 'Annex Liaison Kade',
      line: 'Test line',
    };

    emitQuestDialogue(io, lobby, payload);
    expect(emitted).toEqual([{ event: SERVER_TO_CLIENT.QUEST_DIALOGUE, payload }]);
  });

  it('emits on a lobby-scoped broadcast target', () => {
    const emitted = [];
    const io = {
      emit(event, payload) {
        emitted.push({ event, payload });
      },
    };

    emitQuestDialogue(io, null, { beaconId: 'x', line: 'hello' });
    expect(emitted[0].event).toBe(SERVER_TO_CLIENT.QUEST_DIALOGUE);
  });
});

describe('scripted wave clear integration', () => {
  beforeEach(() => {
    registerFixtureQuest();
    resetGameState();
    setSimulationGameState(gameState);
  });

  it('records wave-clear beacon state after scripted wave 0 is defeated', () => {
    deployScriptedFixture();
    initDialogueState(gameState.run);

    for (const enemy of [...gameState.enemies]) {
      enemy.hp = 0;
    }
    removeDeadEnemies();

    expect(gameState.run.dialogueFired.has('fixture_wave0_clear')).toBe(true);
  });
});
