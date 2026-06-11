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
  connectedPlayerCount,
  getPrimaryLobbyStateForTests,
  resetAllLobbies,
  createLobbyGameState,
} from '../lobbies.js';

describe('lobbies module', () => {
  beforeEach(() => {
    resetAllLobbies();
  });

  it('createLobby returns a lobby with lobby phase and default quest', () => {
    const lobby = createLobby('Test Room');
    expect(lobby.id).toMatch(/^[a-f0-9]{8}$/);
    expect(lobby.name).toBe('Test Room');
    expect(lobby.state.gamePhase).toBe(PHASES.LOBBY);
    expect(lobby.state.selectedQuestId).toBe('training_caverns');
    expect(lobby.state.selectedQuestTier).toBe(1);
    expect(lobby.state._lobbyId).toBe(lobby.id);
  });

  it('listLobbySummaries includes player count and dungeon selection', () => {
    const lobby = createLobby('Alpha');
    lobby.state.players.p1 = { id: 'p1', username: 'Alice', ready: true };
    lobby.state.players.p2 = { id: 'p2', username: 'Bob', ready: false };
    lobby.state.selectedQuestId = 'crystal_rescue';
    lobby.state.gamePhase = 'playing';

    const summaries = listLobbySummaries();
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      id: lobby.id,
      name: 'Alpha',
      gamePhase: 'playing',
      selectedQuestId: 'crystal_rescue',
      playerCount: 2,
    });
    expect(summaries[0].players).toEqual([
      { id: 'p1', username: 'Alice', ready: true },
      { id: 'p2', username: 'Bob', ready: false },
    ]);
  });

  it('connectedPlayerCount and playerCount ignore disconnected records', () => {
    const lobby = createLobby('Mixed');
    lobby.state.players.p1 = { id: 'p1', username: 'Alice', connected: true };
    lobby.state.players.p2 = { id: 'p2', username: 'Bob', connected: false };
    // Missing `connected` field is treated as connected (legacy records).
    lobby.state.players.p3 = { id: 'p3', username: 'Carol' };

    expect(connectedPlayerCount(lobby)).toBe(2);
    expect(lobbySummary(lobby).playerCount).toBe(2);
  });

  it('listLobbySummaries excludes lobbies with zero connected players', () => {
    const ghost = createLobby('Ghost');
    ghost.state.players.p1 = { id: 'p1', username: 'Gone', connected: false };
    ghost.state.gamePhase = 'playing';

    const live = createLobby('Live');
    live.state.players.p2 = { id: 'p2', username: 'Here', connected: true };

    const summaries = listLobbySummaries();
    expect(summaries).toHaveLength(1);
    expect(summaries[0].id).toBe(live.id);
  });

  it('getPrimaryLobbyStateForTests prefers a live lobby over a ghost lobby', () => {
    const ghost = createLobby('Ghost');
    ghost.state.players.p1 = { id: 'p1', username: 'Gone', connected: false };

    const live = createLobby('Live');
    live.state.players.p2 = { id: 'p2', username: 'Here', connected: true };

    expect(getPrimaryLobbyStateForTests()).toBe(live.state);
  });

  it('assignPlayerToLobby and getLobbyForPlayer track membership', () => {
    const lobby = createLobby();
    assignPlayerToLobby('host-1', lobby.id);
    expect(getLobbyForPlayer('host-1')).toBe(lobby);
    expect(getLobbyById(lobby.id)).toBe(lobby);
  });

  it('removePlayerFromLobby deletes empty lobbies', () => {
    const lobby = createLobby();
    lobby.state.players['host-1'] = { id: 'host-1' };
    assignPlayerToLobby('host-1', lobby.id);

    const result = removePlayerFromLobby('host-1');
    expect(result.deleted).toBe(true);
    expect(getLobbyById(lobby.id)).toBeNull();
  });

  it('removePlayerFromLobby keeps lobby when non-host leaves with others present', () => {
    const lobby = createLobby();
    lobby.state.players['host-1'] = { id: 'host-1' };
    lobby.state.players.p2 = { id: 'p2' };
    assignPlayerToLobby('host-1', lobby.id);
    assignPlayerToLobby('p2', lobby.id);

    const result = removePlayerFromLobby('p2');
    expect(result.deleted).toBe(false);
    expect(lobby.state.players.p2).toBeUndefined();
    expect(getLobbyById(lobby.id)).toBe(lobby);
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
      const lobby = createLobby();
      expect(lobby.state.gamePhase).toBe(PHASES.LOBBY);

      setPhase(lobby, PHASES.PLAYING);
      expect(lobby.state.gamePhase).toBe(PHASES.PLAYING);

      setPhase(lobby, PHASES.PLAYING);
      expect(lobby.state.gamePhase).toBe(PHASES.PLAYING);

      setPhase(lobby, PHASES.LOBBY);
      expect(lobby.state.gamePhase).toBe(PHASES.LOBBY);
    });

    it('setPhase throws for unknown phase strings', () => {
      const lobby = createLobby();
      expect(() => setPhase(lobby, 'suspended')).toThrow(/unknown phase/);
      expect(lobby.state.gamePhase).toBe(PHASES.LOBBY);
    });

    it('setPhase throws when current phase is unknown', () => {
      const lobby = createLobby();
      lobby.state.gamePhase = 'broken';
      expect(() => setPhase(lobby, PHASES.LOBBY)).toThrow(/illegal transition/);
      expect(lobby.state.gamePhase).toBe('broken');
    });
  });

  it('lobbySummary reflects current lobby metadata', () => {
    const lobby = createLobby('Beta');
    lobby.state.selectedQuestId = 'crystal_rescue';
    expect(lobbySummary(lobby).selectedQuestId).toBe('crystal_rescue');
  });
});
