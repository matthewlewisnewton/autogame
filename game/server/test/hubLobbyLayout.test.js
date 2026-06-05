import { describe, it, expect, beforeEach } from 'vitest';
import {
  applyHubLayout,
  applyLayoutForQuest,
  HUB_LAYOUT_SEED,
  checkAllReady,
  gameState,
  resetGameState,
} from '../index.js';
import { createLobby, resetAllLobbies } from '../lobbies.js';
import { getLayoutProfileForQuest } from '../quests.js';
import { questLayoutSeed } from '../dungeon.js';
import { setGameState } from '../progression.js';

const VALID_DECK = ['iron_sword', 'flame_blade', 'battle_familiar', 'dungeon_drake'];

describe('hub lobby layout', () => {
  beforeEach(() => {
    resetAllLobbies();
    resetGameState();
    setGameState(gameState);
  });

  it('applyHubLayout sets hub profile, seed, bounds, and walkable AABBs', () => {
    applyHubLayout(gameState);
    expect(gameState.layout.profile).toBe('hub');
    expect(gameState.layoutSeed).toBe(HUB_LAYOUT_SEED);
    expect(gameState.dungeonBounds).toBeDefined();
    expect(Array.isArray(gameState.walkableAABBs)).toBe(true);
    expect(gameState.walkableAABBs.length).toBeGreaterThan(0);
  });

  it('lobby creation path uses hub layout', () => {
    const lobby = createLobby('Hub Room');
    applyHubLayout(lobby.state);
    expect(lobby.state.layout.profile).toBe('hub');
    expect(lobby.state.layoutSeed).toBe(HUB_LAYOUT_SEED);
  });

  it('selectQuest metadata does not change layoutSeed while in lobby', () => {
    applyHubLayout(gameState);
    const seedBefore = gameState.layoutSeed;
    const profileBefore = gameState.layout.profile;

    gameState.selectedQuestId = 'crystal_rescue';
    gameState.selectedQuestTier = 2;

    expect(gameState.layoutSeed).toBe(seedBefore);
    expect(gameState.layout.profile).toBe(profileBefore);
    expect(gameState.layout.profile).toBe('hub');
    expect(questLayoutSeed('crystal_rescue', 2)).not.toBe(seedBefore);
  });

  it('checkAllReady fresh deploy applies quest dungeon layout', () => {
    applyHubLayout(gameState);
    gameState._lobbyId = 'hub-layout-test';
    gameState.selectedQuestId = 'crystal_rescue';
    gameState.selectedQuestTier = 1;
    gameState.players.p1 = {
      ready: true,
      connected: true,
      selectedDeck: VALID_DECK,
      pendingSummons: new Set(),
      hand: [],
      deck: [],
    };

    checkAllReady();

    expect(gameState.gamePhase).toBe('playing');
    expect(gameState.layout.profile).toBe(getLayoutProfileForQuest('crystal_rescue', 1));
    expect(gameState.layout.profile).not.toBe('hub');
    expect(gameState.layoutSeed).toBe(questLayoutSeed('crystal_rescue', 1));
  });

  it('applyLayoutForQuest still sets quest profile for direct deploy setup', () => {
    applyLayoutForQuest(gameState, 'crystal_rescue', 1);
    expect(gameState.layout.profile).toBe(getLayoutProfileForQuest('crystal_rescue', 1));
    expect(gameState.layout.profile).not.toBe('hub');
  });
});
