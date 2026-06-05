import { describe, it, expect, beforeEach } from 'vitest';
import {
  createLobby,
  resetAllLobbies,
  PHASES,
} from '../lobbies.js';
import {
  createEmptyHubPresence,
  buildHubPresenceEntry,
  syncHubPresenceFromLobby,
  getHubPresenceSnapshot,
} from '../hubPresence.js';
import { DEFAULT_COSMETIC } from '../cosmetic.js';
import {
  applyPlayerMovement,
  buildHubMovementContext,
  hubSpawnPosition,
} from '../simulation.js';
import { HUB_LAYOUT } from '../index.js';

function makeLobbyPlayer(id, overrides = {}) {
  const spawn = hubSpawnPosition(HUB_LAYOUT);
  return {
    id,
    username: overrides.username ?? id,
    x: spawn.x,
    y: 0.5,
    z: spawn.z,
    rotation: 0,
    connected: true,
    inputDx: 0,
    inputDz: 0,
    inputActive: false,
    lastInputTime: 0,
    ...overrides,
  };
}

// End-to-end broadcast/join/leave contracts with live sockets live in
// hub_presence_integration.test.js (and hub_presence_broadcast.test.js).

describe('hub presence', () => {
  beforeEach(() => {
    resetAllLobbies();
  });

  it('createLobby owns hubPresence with empty entries', () => {
    const lobby = createLobby('Hub');
    expect(lobby.hubPresence).toEqual(createEmptyHubPresence());
    expect(lobby.hubPresence.entries).toEqual({});
  });

  it('syncHubPresenceFromLobby leaves entries empty for an empty lobby', () => {
    const lobby = createLobby();
    syncHubPresenceFromLobby(lobby);
    expect(lobby.hubPresence.entries).toEqual({});
    expect(getHubPresenceSnapshot(lobby)).toEqual({
      schemaVersion: 1,
      entries: {},
      revision: 0,
    });
  });

  it('syncHubPresenceFromLobby includes two connected lobby players', () => {
    const lobby = createLobby();
    lobby.state.players.p1 = makeLobbyPlayer('p1', { username: 'Alice' });
    lobby.state.players.p2 = makeLobbyPlayer('p2', { username: 'Bob', x: 3, z: 4, rotation: 1.5 });

    syncHubPresenceFromLobby(lobby);

    expect(Object.keys(lobby.hubPresence.entries)).toEqual(['p1', 'p2']);
    expect(lobby.hubPresence.entries.p1).toMatchObject({
      id: 'p1',
      username: 'Alice',
      connected: true,
    });
    expect(lobby.hubPresence.entries.p2).toMatchObject({
      id: 'p2',
      username: 'Bob',
      x: 3,
      z: 4,
      rotation: 1.5,
      connected: true,
    });
  });

  it('buildHubPresenceEntry backfills missing cosmetic from defaults', () => {
    const entry = buildHubPresenceEntry(makeLobbyPlayer('p1', { cosmetic: undefined }));
    expect(entry.cosmetic).toEqual(DEFAULT_COSMETIC);
    expect(entry.cosmetic.proportions).toEqual(DEFAULT_COSMETIC.proportions);
  });

  it('syncHubPresenceFromLobby skips disconnected players', () => {
    const lobby = createLobby();
    lobby.state.players.p1 = makeLobbyPlayer('p1');
    lobby.state.players.ghost = makeLobbyPlayer('ghost', { connected: false });

    syncHubPresenceFromLobby(lobby);

    expect(lobby.hubPresence.entries.p1).toBeDefined();
    expect(lobby.hubPresence.entries.ghost).toBeUndefined();
  });

  it('syncHubPresenceFromLobby updates coordinates after lobby movement', () => {
    const lobby = createLobby();
    const player = makeLobbyPlayer('p1');
    player.inputDx = 1;
    player.inputDz = 0;
    player.inputActive = true;
    player.inputRotation = 0.75;
    player.lastInputTime = Date.now();
    lobby.state.players.p1 = player;

    syncHubPresenceFromLobby(lobby);
    const xBefore = lobby.hubPresence.entries.p1.x;

    applyPlayerMovement(lobby.state, buildHubMovementContext(HUB_LAYOUT));
    syncHubPresenceFromLobby(lobby);

    expect(lobby.hubPresence.entries.p1.x).toBeGreaterThan(xBefore);
    expect(lobby.hubPresence.entries.p1.rotation).toBe(0.75);
    expect(player.x).toBe(lobby.hubPresence.entries.p1.x);
  });

  it('syncHubPresenceFromLobby clears entries when not in lobby phase', () => {
    const lobby = createLobby();
    lobby.state.players.p1 = makeLobbyPlayer('p1');
    syncHubPresenceFromLobby(lobby);
    expect(lobby.hubPresence.entries.p1).toBeDefined();

    lobby.state.gamePhase = PHASES.PLAYING;
    syncHubPresenceFromLobby(lobby);
    expect(lobby.hubPresence.entries).toEqual({});
  });
});
