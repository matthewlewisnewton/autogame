import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DEFAULT_COSMETIC } from '../cosmetic.js';
import {
  createEmptyHubPresence,
  buildHubPresenceEntry,
  syncHubPresencePlayer,
  removeHubPresencePlayer,
  buildHubPresencePayload,
} from '../hubPresence.js';
import { runGameLoopTick } from '../index.js';

const {
  createLobby,
  removePlayerFromLobby,
  assignPlayerToLobby,
  resetAllLobbies,
} = require('../lobbies.js');

function makePlayer(overrides = {}) {
  return {
    id: 'p1',
    username: 'alice',
    x: 1,
    y: 0.5,
    z: 2,
    rotation: 0.25,
    cosmetic: { ...DEFAULT_COSMETIC, hatId: 'cap' },
    connected: true,
    ...overrides,
  };
}

describe('hubPresence module', () => {
  beforeEach(() => {
    resetAllLobbies();
  });

  it('createEmptyHubPresence returns revision 0 and empty players', () => {
    expect(createEmptyHubPresence()).toEqual({ revision: 0, players: {} });
  });

  it('createLobby initializes lobby.hubPresence', () => {
    const lobby = createLobby('Presence Room');
    expect(lobby.hubPresence).toEqual({ revision: 0, players: {} });
  });

  it('buildHubPresenceEntry copies position, facing, username, and cosmetic', () => {
    const player = makePlayer();
    expect(buildHubPresenceEntry(player)).toEqual({
      playerId: 'p1',
      x: 1,
      y: 0.5,
      z: 2,
      rotation: 0.25,
      cosmetic: player.cosmetic,
      username: 'alice',
    });
  });

  it('syncHubPresencePlayer upserts and bumps revision only when values change', () => {
    const lobby = createLobby();
    lobby.state.players.p1 = makePlayer();

    expect(syncHubPresencePlayer(lobby, 'p1')).toBe(true);
    expect(lobby.hubPresence.revision).toBe(1);
    expect(lobby.hubPresence.players.p1.username).toBe('alice');

    expect(syncHubPresencePlayer(lobby, 'p1')).toBe(false);
    expect(lobby.hubPresence.revision).toBe(1);

    lobby.state.players.p1.x = 3;
    expect(syncHubPresencePlayer(lobby, 'p1')).toBe(true);
    expect(lobby.hubPresence.revision).toBe(2);
    expect(lobby.hubPresence.players.p1.x).toBe(3);
  });

  it('removeHubPresencePlayer deletes the entry and bumps revision', () => {
    const lobby = createLobby();
    lobby.state.players.p1 = makePlayer();
    syncHubPresencePlayer(lobby, 'p1');

    expect(removeHubPresencePlayer(lobby, 'p1')).toBe(true);
    expect(lobby.hubPresence.players.p1).toBeUndefined();
    expect(lobby.hubPresence.revision).toBe(2);

    expect(removeHubPresencePlayer(lobby, 'p1')).toBe(false);
    expect(lobby.hubPresence.revision).toBe(2);
  });

  it('buildHubPresencePayload includes lobbyId, revision, players, and cosmetic', () => {
    const lobby = createLobby();
    lobby.state.players.p1 = makePlayer();
    lobby.state.players.p2 = makePlayer({
      id: 'p2',
      username: 'bob',
      x: 4,
      z: 5,
      cosmetic: { ...DEFAULT_COSMETIC, hatId: 'wizard' },
    });
    syncHubPresencePlayer(lobby, 'p1');
    syncHubPresencePlayer(lobby, 'p2');

    const payload = buildHubPresencePayload(lobby, 'viewer-1');
    expect(payload).toEqual({
      lobbyId: lobby.id,
      revision: lobby.hubPresence.revision,
      players: {
        p1: lobby.hubPresence.players.p1,
        p2: lobby.hubPresence.players.p2,
      },
    });
    expect(payload.players.p1.cosmetic.hatId).toBe('cap');
    expect(payload.players.p2.cosmetic.hatId).toBe('wizard');
    expect(payload.players).not.toBe(lobby.hubPresence.players);
  });

  it('buildHubPresencePayload accepts a viewer id for future per-viewer culling', () => {
    const lobby = createLobby();
    lobby.state.players.p1 = makePlayer();
    syncHubPresencePlayer(lobby, 'p1');

    const viewerSpy = vi.fn(buildHubPresencePayload);
    const payload = viewerSpy(lobby, 'viewer-abc');
    expect(viewerSpy).toHaveBeenCalledWith(lobby, 'viewer-abc');
    expect(payload.players.p1).toBeDefined();
  });
});

describe('hubPresence lobby lifecycle', () => {
  beforeEach(() => {
    resetAllLobbies();
  });

  it('removePlayerFromLobby removes hub presence for the departing player', () => {
    const lobby = createLobby();
    lobby.state.players.p1 = makePlayer();
    lobby.state.players.p2 = makePlayer({ id: 'p2', username: 'bob' });
    syncHubPresencePlayer(lobby, 'p1');
    syncHubPresencePlayer(lobby, 'p2');
    assignPlayerToLobby('p1', lobby.id);
    assignPlayerToLobby('p2', lobby.id);

    const revisionBefore = lobby.hubPresence.revision;
    removePlayerFromLobby('p2');

    expect(lobby.hubPresence.players.p2).toBeUndefined();
    expect(lobby.hubPresence.players.p1).toBeDefined();
    expect(lobby.hubPresence.revision).toBeGreaterThan(revisionBefore);
  });

  it('runGameLoopTick syncs connected lobby players after lobby movement', () => {
    const lobby = createLobby();
    lobby.state.players.p1 = makePlayer({
      inputDx: 1,
      inputDz: 0,
      inputActive: true,
      lastActivity: Date.now(),
      lastMoveTime: Date.now(),
      lastInputTime: Date.now(),
    });
    lobby.state.players.p2 = makePlayer({
      id: 'p2',
      connected: false,
      inputDx: 1,
      inputDz: 0,
      inputActive: true,
    });

    runGameLoopTick();

    expect(lobby.hubPresence.revision).toBeGreaterThan(0);
    expect(lobby.hubPresence.players.p1).toMatchObject({
      playerId: 'p1',
      x: lobby.state.players.p1.x,
      y: lobby.state.players.p1.y,
      z: lobby.state.players.p1.z,
      rotation: lobby.state.players.p1.rotation,
      username: 'alice',
    });
    expect(lobby.hubPresence.players.p2).toBeUndefined();
  });
});
