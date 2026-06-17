import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import http from 'http';
import express from 'express';
import net from 'net';
import { io as ClientIO } from 'socket.io-client';
import { createRequire } from 'module';
import {
  startServer,
  resetGameState,
  io as serverIo,
  server as httpServer,
  clearAllTimers,
} from '../index.js';
import { ensureTestUserSession } from './helpers.js';

const require = createRequire(import.meta.url);
const { SESSION_COOKIE_NAME } = require('../cookies.js');
const {
  enableRedisForTests,
  disableRedisForTests,
  resetRedisForTests,
} = require('../redis.js');
const {
  getLobbyOwner,
  resetLobbyRegistryForTests,
} = require('../lobbyRegistry.js');
const {
  createLobby,
  resetAllLobbies,
} = require('../lobbies.js');
const {
  getFlyMachineId,
  resolveLobbyRouting,
} = require('../flyReplay.js');
const {
  attachFlyReplayRouting,
  resetFlyReplayHookForTests,
} = require('../flyReplayHook.js');

function readHttpResponse(socket, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    let data = '';
    const timer = setTimeout(() => {
      socket.destroy();
      if (data.length > 0) {
        resolve(data);
        return;
      }
      reject(new Error('readHttpResponse timed out'));
    }, timeoutMs);
    socket.setEncoding('utf8');
    socket.on('data', (chunk) => {
      data += chunk;
    });
    socket.on('end', () => {
      clearTimeout(timer);
      resolve(data);
    });
    socket.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function requestPollingHandshake(server, path) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const socket = net.connect(addr.port, '127.0.0.1', () => {
      socket.write(
        `GET ${path} HTTP/1.1\r\n` +
        'Host: localhost\r\n' +
        'Connection: close\r\n\r\n',
      );
    });
    readHttpResponse(socket).then(resolve).catch(reject);
  });
}

function requestWebSocketHandshake(server, path) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const socket = net.connect(addr.port, '127.0.0.1', () => {
      socket.write(
        `GET ${path} HTTP/1.1\r\n` +
        'Host: localhost\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n' +
        'Sec-WebSocket-Version: 13\r\n\r\n',
      );
    });
    readHttpResponse(socket).then(resolve).catch(reject);
  });
}

async function teardownFullServer() {
  try { serverIo.disconnectSockets(true); } catch (_) {}
  for (const conn of Object.values(serverIo.engine?.clients || {})) {
    try { conn.close(true); } catch (_) {}
  }
  if (!httpServer.listening) {
    return;
  }
  await new Promise((resolve) => {
    const t = setTimeout(resolve, 5000);
    httpServer.close(() => { clearTimeout(t); resolve(); });
    if (typeof httpServer.closeAllConnections === 'function') {
      try { httpServer.closeAllConnections(); } catch (_) {}
    }
  });
}

async function bootMachineServer(flyMachineId, { redisEnabled = true } = {}) {
  await teardownFullServer();
  process.env.FLY_MACHINE_ID = flyMachineId;
  resetFlyReplayHookForTests();

  resetGameState();
  resetAllLobbies();
  serverIo.removeAllListeners('connection');
  clearAllTimers();
  if (redisEnabled) {
    enableRedisForTests();
  } else {
    disableRedisForTests();
  }
  await startServer(0);
  return `http://localhost:${httpServer.address().port}`;
}

async function bootRoutingHookServer(flyMachineId) {
  process.env.FLY_MACHINE_ID = flyMachineId;
  resetFlyReplayHookForTests();

  const app = express();
  const server = http.createServer(app);
  attachFlyReplayRouting(server, app);
  app.use('/socket.io/', (_req, res) => {
    res.status(200).end('socket-io-ok');
  });

  await new Promise((resolve) => server.listen(0, resolve));
  return server;
}

async function shutdownHookServer(server) {
  if (!server || !server.listening) return;
  await new Promise((resolve) => server.close(resolve));
}

async function connectSocketWithLobbyQuery(baseUrl, lobbyId, accountId = 'routing-guest') {
  const { cookieHeader } = await ensureTestUserSession(accountId, 'password123', baseUrl);
  return new Promise((resolve, reject) => {
    const socket = ClientIO(baseUrl, {
      transports: ['websocket'],
      retry: false,
      autoConnect: true,
      timeout: 5000,
      extraHeaders: { cookie: cookieHeader },
      query: { lobbyId },
    });

    const timer = setTimeout(() => {
      try { socket.disconnect(); } catch (_) {}
      reject(new Error('connectSocketWithLobbyQuery timed out'));
    }, 10000);

    socket.once('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });

    socket.once('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

describe('fly replay cross-instance routing integration', () => {
  const originalRedisUrl = process.env.REDIS_URL;
  const originalFlyMachineId = process.env.FLY_MACHINE_ID;
  const originalInstanceId = process.env.INSTANCE_ID;
  let hookServer = null;

  beforeEach(async () => {
    delete process.env.REDIS_URL;
    delete process.env.INSTANCE_ID;
    resetRedisForTests();
    disableRedisForTests();
    resetFlyReplayHookForTests();
    resetAllLobbies();
    await resetLobbyRegistryForTests();
  });

  afterEach(async () => {
    await shutdownHookServer(hookServer);
    hookServer = null;
    await teardownFullServer();
    vi.restoreAllMocks();
    resetRedisForTests();
    disableRedisForTests();
    resetFlyReplayHookForTests();
    resetAllLobbies();
    await resetLobbyRegistryForTests();
    if (originalRedisUrl === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = originalRedisUrl;
    }
    if (originalFlyMachineId === undefined) {
      delete process.env.FLY_MACHINE_ID;
    } else {
      process.env.FLY_MACHINE_ID = originalFlyMachineId;
    }
    if (originalInstanceId === undefined) {
      delete process.env.INSTANCE_ID;
    } else {
      process.env.INSTANCE_ID = originalInstanceId;
    }
  });

  describe('with shared Redis shim and two machine ids', () => {
    beforeEach(() => {
      enableRedisForTests();
    });

    it('registers createLobby ownership under FLY_MACHINE_ID on machine-a', async () => {
      process.env.FLY_MACHINE_ID = 'machine-a';
      const lobby = createLobby('Cross Instance');

      await vi.waitFor(async () => {
        expect(await getLobbyOwner(lobby.id)).toBe('machine-a');
        expect(getFlyMachineId()).toBe('machine-a');
        expect(await getLobbyOwner(lobby.id)).toBe(getFlyMachineId());
      });
    });

    it('replays wrong-machine websocket handshakes to the owner machine', async () => {
      hookServer = await bootRoutingHookServer('machine-a');
      const lobby = createLobby('Replay Target');
      await vi.waitFor(async () => {
        expect(await getLobbyOwner(lobby.id)).toBe('machine-a');
      });

      const handshakePath =
        `/socket.io/?EIO=4&transport=websocket&lobbyId=${encodeURIComponent(lobby.id)}`;

      process.env.FLY_MACHINE_ID = 'machine-b';
      const replayResponse = await requestWebSocketHandshake(hookServer, handshakePath);
      expect(replayResponse.toLowerCase()).toContain('fly-replay: instance=machine-a');

      process.env.FLY_MACHINE_ID = 'machine-a';
      const selfResponse = await requestPollingHandshake(
        hookServer,
        `/socket.io/?EIO=4&transport=polling&lobbyId=${encodeURIComponent(lobby.id)}`,
      );
      expect(selfResponse.toLowerCase()).not.toContain('fly-replay:');
      expect(selfResponse).toContain('socket-io-ok');
    });

    it('connects on the owner machine without a fly-replay header', async () => {
      const baseUrl = await bootMachineServer('machine-a');
      const lobby = createLobby('Owner Connect');
      await vi.waitFor(async () => {
        expect(await getLobbyOwner(lobby.id)).toBe('machine-a');
      });

      const underlyingEmit = serverIo.emit.bind(serverIo);
      const emitSpy = vi.spyOn(serverIo, 'emit').mockImplementation((event, ...args) => {
        if (event === 'lobbyListUpdate') {
          return serverIo;
        }
        return underlyingEmit(event, ...args);
      });

      const selfHandshake = await requestPollingHandshake(
        httpServer,
        `/socket.io/?EIO=4&transport=polling&lobbyId=${encodeURIComponent(lobby.id)}`,
      );
      expect(selfHandshake.toLowerCase()).not.toContain('fly-replay:');

      const socket = await connectSocketWithLobbyQuery(baseUrl, lobby.id);
      expect(socket.connected).toBe(true);
      socket.disconnect();
      emitSpy.mockRestore();
    });

    it('does not replay when the local machine already owns the lobby', async () => {
      hookServer = await bootRoutingHookServer('machine-a');
      const lobby = createLobby('Owned Here');
      await vi.waitFor(async () => {
        expect(await getLobbyOwner(lobby.id)).toBe('machine-a');
      });

      const response = await requestPollingHandshake(
        hookServer,
        `/socket.io/?EIO=4&transport=polling&lobbyId=${encodeURIComponent(lobby.id)}`,
      );

      expect(response.toLowerCase()).not.toContain('fly-replay:');
      expect(response).toContain('socket-io-ok');
    });
  });

  describe('with Redis routing disabled', () => {
    it('does not attach fly replay and resolveLobbyRouting always stays local', async () => {
      delete process.env.REDIS_URL;
      disableRedisForTests();
      process.env.FLY_MACHINE_ID = 'machine-a';
      resetFlyReplayHookForTests();

      await bootMachineServer('machine-a', { redisEnabled: false });

      await expect(resolveLobbyRouting('any-lobby')).resolves.toEqual({ action: 'self' });

      const response = await requestPollingHandshake(
        httpServer,
        '/socket.io/?EIO=4&transport=polling&lobbyId=any-lobby',
      );
      expect(response.toLowerCase()).not.toContain('fly-replay:');
    });

    it('leaves attachFlyReplayRouting as a no-op without force-enabled Redis', () => {
      delete process.env.REDIS_URL;
      disableRedisForTests();
      process.env.FLY_MACHINE_ID = 'machine-a';
      resetFlyReplayHookForTests();

      const prependListener = vi.fn();
      const fakeServer = { prependListener };
      const fakeApp = { use: vi.fn() };
      attachFlyReplayRouting(fakeServer, fakeApp, null);

      expect(prependListener).not.toHaveBeenCalled();
      expect(fakeApp.use).not.toHaveBeenCalled();
    });
  });
});
