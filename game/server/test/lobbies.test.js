import { describe, it, expect, beforeEach } from 'vitest';
import {
  PHASES,
  canTransition,
  setPhase,
  createLobby,
  assignPlayerToLobby,
  removePlayerFromLobby,
  getLobbyForPlayer,
  getLobbyById,
  listLobbySummaries,
  lobbySummary,
  resetAllLobbies,
  createLobbyGameState,
} from '../lobbies.js';

describe('lobbies module', () => {
  beforeEach(() => {
    resetAllLobbies();
  });

  it('createLobby returns a lobby with lobby phase and default quest', () => {
    const lobby = createLobby('host-1', 'Test Room');
    expect(lobby.id).toMatch(/^[a-f0-9]{8}$/);
    expect(lobby.name).toBe('Test Room');
    expect(lobby.hostId).toBe('host-1');
    expect(lobby.state.gamePhase).toBe(PHASES.LOBBY);
    expect(lobby.state.selectedQuestId).toBe('training_caverns');
    expect(lobby.state._lobbyId).toBe(lobby.id);
  });

  it('listLobbySummaries includes player count and dungeon selection', () => {
    const lobby = createLobby('host-1', 'Alpha');
    lobby.state.players.p1 = { id: 'p1', username: 'Alice', ready: true };
    lobby.state.players.p2 = { id: 'p2', username: 'Bob', ready: false };
    lobby.state.selectedQuestId = 'crystal_rescue';
    lobby.state.gamePhase = 'playing';

    const summaries = listLobbySummaries();
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      id: lobby.id,
      name: 'Alpha',
      hostId: 'host-1',
      gamePhase: 'playing',
      selectedQuestId: 'crystal_rescue',
      playerCount: 2,
    });
    expect(summaries[0].players).toEqual([
      { id: 'p1', username: 'Alice', ready: true },
      { id: 'p2', username: 'Bob', ready: false },
    ]);
  });

  it('assignPlayerToLobby and getLobbyForPlayer track membership', () => {
    const lobby = createLobby('host-1');
    assignPlayerToLobby('host-1', lobby.id);
    expect(getLobbyForPlayer('host-1')).toBe(lobby);
    expect(getLobbyById(lobby.id)).toBe(lobby);
  });

  it('removePlayerFromLobby deletes empty lobbies', () => {
    const lobby = createLobby('host-1');
    lobby.state.players['host-1'] = { id: 'host-1' };
    assignPlayerToLobby('host-1', lobby.id);

    const result = removePlayerFromLobby('host-1');
    expect(result.deleted).toBe(true);
    expect(getLobbyById(lobby.id)).toBeNull();
  });

  it('removePlayerFromLobby reassigns host when host leaves with others present', () => {
    const lobby = createLobby('host-1');
    lobby.state.players['host-1'] = { id: 'host-1' };
    lobby.state.players.p2 = { id: 'p2' };
    assignPlayerToLobby('host-1', lobby.id);
    assignPlayerToLobby('p2', lobby.id);

    const result = removePlayerFromLobby('host-1');
    expect(result.deleted).toBe(false);
    expect(lobby.hostId).toBe('p2');
    expect(lobby.state.players['host-1']).toBeUndefined();
  });

  it('createLobbyGameState starts with empty players and lobby phase', () => {
    const state = createLobbyGameState();
    expect(state.players).toEqual({});
    expect(state.gamePhase).toBe(PHASES.LOBBY);
    expect(state.enemies).toEqual([]);
  });

  describe('phase API', () => {
    it('PHASES exposes lobby and playing string values', () => {
      expect(PHASES.LOBBY).toBe('lobby');
      expect(PHASES.PLAYING).toBe('playing');
    });

    it('canTransition allows lobby↔playing and idempotent same-phase sets', () => {
      expect(canTransition(PHASES.LOBBY, PHASES.LOBBY)).toBe(true);
      expect(canTransition(PHASES.PLAYING, PHASES.PLAYING)).toBe(true);
      expect(canTransition(PHASES.LOBBY, PHASES.PLAYING)).toBe(true);
      expect(canTransition(PHASES.PLAYING, PHASES.LOBBY)).toBe(true);
    });

    it('canTransition rejects unknown phase strings', () => {
      expect(canTransition('lobby', 'suspended')).toBe(false);
      expect(canTransition('suspended', 'lobby')).toBe(false);
      expect(canTransition('waiting', PHASES.LOBBY)).toBe(false);
      expect(canTransition(PHASES.PLAYING, '')).toBe(false);
    });

    it('setPhase updates lobby.state.gamePhase for legal transitions', () => {
      const lobby = createLobby('host-1');
      expect(lobby.state.gamePhase).toBe(PHASES.LOBBY);

      setPhase(lobby, PHASES.PLAYING);
      expect(lobby.state.gamePhase).toBe(PHASES.PLAYING);

      setPhase(lobby, PHASES.PLAYING);
      expect(lobby.state.gamePhase).toBe(PHASES.PLAYING);

      setPhase(lobby, PHASES.LOBBY);
      expect(lobby.state.gamePhase).toBe(PHASES.LOBBY);
    });

    it('setPhase throws for unknown phase strings', () => {
      const lobby = createLobby('host-1');
      expect(() => setPhase(lobby, 'suspended')).toThrow(/unknown phase/);
      expect(lobby.state.gamePhase).toBe(PHASES.LOBBY);
    });

    it('setPhase throws when current phase is unknown', () => {
      const lobby = createLobby('host-1');
      lobby.state.gamePhase = 'broken';
      expect(() => setPhase(lobby, PHASES.LOBBY)).toThrow(/illegal transition/);
      expect(lobby.state.gamePhase).toBe('broken');
    });
  });

  it('lobbySummary reflects current lobby metadata', () => {
    const lobby = createLobby('host-1', 'Beta');
    lobby.state.selectedQuestId = 'crystal_rescue';
    expect(lobbySummary(lobby).selectedQuestId).toBe('crystal_rescue');
  });
});
