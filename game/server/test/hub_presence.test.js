import { describe, it, expect, beforeEach } from 'vitest';
import { DEFAULT_COSMETIC } from '../cosmetic.js';
import {
  createLobby,
  resetAllLobbies,
  removePlayerFromLobby,
  assignPlayerToLobby,
  getLobbyById,
  ensureHubPresence,
  syncHubPresencePlayer,
  removeHubPresencePlayer,
  buildHubPresenceUpdate,
} from '../lobbies.js';

function samplePlayer(overrides = {}) {
  return {
    x: 1.5,
    y: 0.5,
    z: -2.25,
    rotation: 1.57,
    username: 'Alice',
    connected: true,
    cosmetic: {
      bodyColor: '#112233',
      accentColor: '#445566',
      bodyShape: 'cylinder',
      hat: 'wizard',
    },
    deck: ['iron_sword'],
    hand: ['flame_blade'],
    ...overrides,
  };
}

describe('hubPresence module', () => {
  beforeEach(() => {
    resetAllLobbies();
  });

  it('createLobby initializes an empty hubPresence.players map on the lobby record', () => {
    const lobby = createLobby('Presence Room');
    expect(lobby.hubPresence).toEqual({ players: {} });
    expect(lobby.hubPresence).not.toBe(lobby.state);
  });

  it('ensureHubPresence is idempotent and only adds players when absent', () => {
    const lobby = createLobby();
    lobby.hubPresence.players.p1 = { x: 0, y: 0, z: 0, rotation: 0, cosmetic: DEFAULT_COSMETIC, username: 'p1' };

    ensureHubPresence(lobby);
    expect(lobby.hubPresence.players.p1.username).toBe('p1');

    delete lobby.hubPresence.players;
    ensureHubPresence(lobby);
    expect(lobby.hubPresence.players).toEqual({});
  });

  it('syncHubPresencePlayer upserts position and cosmetic fields without deck/hand data', () => {
    const lobby = createLobby();
    const record = samplePlayer();

    syncHubPresencePlayer(lobby, 'p1', record);

    expect(lobby.hubPresence.players.p1).toEqual({
      x: 1.5,
      y: 0.5,
      z: -2.25,
      rotation: 1.57,
      username: 'Alice',
      cosmetic: {
        ...DEFAULT_COSMETIC,
        bodyColor: '#112233',
        accentColor: '#445566',
        bodyShape: 'cylinder',
        hat: 'wizard',
      },
    });
    expect(lobby.hubPresence.players.p1).not.toHaveProperty('deck');
    expect(lobby.hubPresence.players.p1).not.toHaveProperty('hand');
  });

  it('syncHubPresencePlayer backfills partial cosmetics via backfillCosmetic', () => {
    const lobby = createLobby();
    syncHubPresencePlayer(lobby, 'p1', samplePlayer({ cosmetic: { hat: 'crown' } }));

    expect(lobby.hubPresence.players.p1.cosmetic).toEqual({
      ...DEFAULT_COSMETIC,
      hat: 'crown',
    });
  });

  it('removeHubPresencePlayer deletes one entry and is no-op safe', () => {
    const lobby = createLobby();
    syncHubPresencePlayer(lobby, 'p1', samplePlayer());
    syncHubPresencePlayer(lobby, 'p2', samplePlayer({ username: 'Bob' }));

    removeHubPresencePlayer(lobby, 'p1');
    expect(lobby.hubPresence.players.p1).toBeUndefined();
    expect(lobby.hubPresence.players.p2.username).toBe('Bob');

    expect(() => removeHubPresencePlayer(null, 'p2')).not.toThrow();
    expect(() => removeHubPresencePlayer(lobby, null)).not.toThrow();
    expect(lobby.hubPresence.players.p2.username).toBe('Bob');
  });

  it('syncHubPresencePlayer is no-op safe when lobby, playerId, or record is missing', () => {
    const lobby = createLobby();
    syncHubPresencePlayer(null, 'p1', samplePlayer());
    syncHubPresencePlayer(lobby, null, samplePlayer());
    syncHubPresencePlayer(lobby, 'p1', null);
    expect(lobby.hubPresence.players).toEqual({});
  });

  it('buildHubPresenceUpdate returns lobby-scoped players and skips connected === false', () => {
    const lobby = createLobby('Scoped');
    syncHubPresencePlayer(lobby, 'p1', samplePlayer());
    syncHubPresencePlayer(lobby, 'p2', samplePlayer({ username: 'Bob', x: 9 }));
    lobby.state.players.p1 = { connected: true };
    lobby.state.players.p2 = { connected: false };

    const update = buildHubPresenceUpdate(lobby, 'viewer-1');
    expect(update).toEqual({
      lobbyId: lobby.id,
      players: {
        p1: lobby.hubPresence.players.p1,
      },
    });
  });

  it('buildHubPresenceUpdate accepts viewerPlayerId without changing all-players output', () => {
    const lobby = createLobby();
    syncHubPresencePlayer(lobby, 'p1', samplePlayer());
    syncHubPresencePlayer(lobby, 'p2', samplePlayer({ username: 'Bob', x: 9 }));
    lobby.state.players.p1 = { connected: true };
    lobby.state.players.p2 = { connected: true };

    const allViewers = buildHubPresenceUpdate(lobby, null);
    const specificViewer = buildHubPresenceUpdate(lobby, 'p1');
    const otherViewer = buildHubPresenceUpdate(lobby, 'p2');

    expect(specificViewer).toEqual(allViewers);
    expect(otherViewer).toEqual(allViewers);
    expect(Object.keys(allViewers.players).sort()).toEqual(['p1', 'p2']);
  });

  it('deleting an empty lobby removes hubPresence with the lobby record', () => {
    const lobby = createLobby();
    syncHubPresencePlayer(lobby, 'solo', samplePlayer());
    lobby.state.players.solo = { id: 'solo' };
    assignPlayerToLobby('solo', lobby.id);

    const result = removePlayerFromLobby('solo');
    expect(result.deleted).toBe(true);
    expect(getLobbyById(lobby.id)).toBeNull();
  });
});
