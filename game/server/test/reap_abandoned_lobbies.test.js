import { describe, it, expect, beforeEach } from 'vitest';
import { reapAbandonedLobbies } from '../index.js';

// index.js operates on the CommonJS `require('./lobbies')` / `require('./config')`
// instances. Under vitest the ESM import of these modules can resolve to a
// *different* instance than the one index.js closes over, so we must reach the
// registry through require() to share state with reapAbandonedLobbies().
const { createLobby, listLobbySummaries, resetAllLobbies, _lobbies } = require('../lobbies.js');
const { EMPTY_LOBBY_TTL_MS } = require('../config.js');

// Add a player record to a lobby's state.
function addPlayer(lobby, id, { connected = true } = {}) {
  lobby.state.players[id] = {
    id,
    username: id,
    connected,
    disconnectedAt: connected ? null : Date.now(),
    lastActivity: Date.now(),
  };
}

describe('reapAbandonedLobbies', () => {
  beforeEach(() => {
    resetAllLobbies();
  });

  it('reaps an orphan lobby with zero player records immediately', () => {
    const lobby = createLobby('Orphan');
    expect(_lobbies.has(lobby.id)).toBe(true);

    reapAbandonedLobbies();

    expect(_lobbies.has(lobby.id)).toBe(false);
    expect(listLobbySummaries()).toHaveLength(0);
  });

  it('reaps an empty (all-disconnected) lobby only after EMPTY_LOBBY_TTL_MS', () => {
    const lobby = createLobby('Ghost');
    addPlayer(lobby, 'p1', { connected: false });

    // First sweep stamps emptySince but keeps the lobby for the grace window.
    reapAbandonedLobbies();
    expect(_lobbies.has(lobby.id)).toBe(true);
    expect(typeof lobby.emptySince).toBe('number');

    // Still within the TTL — not reaped.
    reapAbandonedLobbies();
    expect(_lobbies.has(lobby.id)).toBe(true);

    // Past the TTL — disconnected records evicted and the lobby deleted.
    lobby.emptySince = Date.now() - EMPTY_LOBBY_TTL_MS - 1;
    reapAbandonedLobbies();
    expect(_lobbies.has(lobby.id)).toBe(false);
    expect(listLobbySummaries()).toHaveLength(0);
  });

  it('does not reap a lobby with a connected player and clears its emptySince', () => {
    const lobby = createLobby('Live');
    addPlayer(lobby, 'p1', { connected: false });

    reapAbandonedLobbies();
    expect(lobby.emptySince).toBeTruthy();

    // A player reconnects: mark connected, then sweep again.
    lobby.state.players.p1.connected = true;
    reapAbandonedLobbies();

    expect(_lobbies.has(lobby.id)).toBe(true);
    expect(lobby.emptySince).toBeUndefined();
  });

  it('does not reap a briefly-disconnected lobby still within the TTL', () => {
    const lobby = createLobby('Reconnecting');
    addPlayer(lobby, 'p1', { connected: false });

    reapAbandonedLobbies(); // stamps emptySince = now
    reapAbandonedLobbies(); // still within TTL

    expect(_lobbies.has(lobby.id)).toBe(true);
  });
});
