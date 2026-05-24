import { describe, it, expect, beforeEach } from 'vitest';
import {
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
    expect(lobby.state.gamePhase).toBe('lobby');
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
    expect(state.gamePhase).toBe('lobby');
    expect(state.enemies).toEqual([]);
  });

  it('lobbySummary reflects current lobby metadata', () => {
    const lobby = createLobby('host-1', 'Beta');
    lobby.state.selectedQuestId = 'crystal_rescue';
    expect(lobbySummary(lobby).selectedQuestId).toBe('crystal_rescue');
  });
});
