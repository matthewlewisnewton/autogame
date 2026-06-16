import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import http from 'http';
import express from 'express';
import net from 'net';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const flyReplay = require('../flyReplay.js');
const lobbyRegistry = require('../lobbyRegistry.js');
const lobbies = require('../lobbies.js');
const {
  attachFlyReplayRouting,
  parseLobbyIdFromUrl,
  sendFlyReplayResponse,
  resetFlyReplayHookForTests,
} = require('../flyReplayHook.js');
const {
  enableRedisForTests,
  disableRedisForTests,
  closeRedis,
} = require('../redis.js');

function readHttpResponse(socket) {
  return new Promise((resolve, reject) => {
    let data = '';
    socket.setEncoding('utf8');
    socket.on('data', (chunk) => {
      data += chunk;
    });
    socket.on('end', () => resolve(data));
    socket.on('error', reject);
  });
}

function requestPolling(server, path) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const socket = net.connect(addr.port, '127.0.0.1', () => {
      socket.write(`GET ${path} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n`);
    });
    readHttpResponse(socket).then(resolve).catch(reject);
  });
}

function requestUpgrade(server, path) {
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

describe('flyReplayHook', () => {
  const originalRedisUrl = process.env.REDIS_URL;
  const originalFlyMachineId = process.env.FLY_MACHINE_ID;

  beforeEach(() => {
    delete process.env.REDIS_URL;
    delete process.env.FLY_MACHINE_ID;
    closeRedis();
    disableRedisForTests();
    resetFlyReplayHookForTests();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    closeRedis();
    disableRedisForTests();
    resetFlyReplayHookForTests();
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
  });

  describe('parseLobbyIdFromUrl', () => {
    it('reads lobbyId and accepts lobby/joinLobby aliases', () => {
      expect(parseLobbyIdFromUrl('/socket.io/?EIO=4&lobbyId=abc123')).toBe('abc123');
      expect(parseLobbyIdFromUrl('/socket.io/?EIO=4&lobby=xyz789')).toBe('xyz789');
      expect(parseLobbyIdFromUrl('/socket.io/?EIO=4&joinLobby=join-me')).toBe('join-me');
      expect(parseLobbyIdFromUrl('/socket.io/?EIO=4&lobbyId=+trimmed+')).toBe('trimmed');
    });

    it('returns null when no lobby id is present', () => {
      expect(parseLobbyIdFromUrl('/socket.io/?EIO=4&transport=polling')).toBeNull();
      expect(parseLobbyIdFromUrl('/healthz')).toBeNull();
    });
  });

  describe('attachFlyReplayRouting', () => {
    let server;
    let app;

    async function bootHookServer() {
      app = express();
      server = http.createServer(app);
      attachFlyReplayRouting(server, app);
      await new Promise((resolve) => server.listen(0, resolve));
    }

    async function shutdownHookServer() {
      if (!server || !server.listening) return;
      await new Promise((resolve) => server.close(resolve));
      server = null;
      app = null;
    }

    afterEach(async () => {
      await shutdownHookServer();
    });

    it('is a no-op when fly replay routing is disabled', async () => {
      const resolveSpy = vi.spyOn(flyReplay, 'resolveLobbyRouting');
      await bootHookServer();
      expect(server.listeners('upgrade').length).toBe(0);
      expect(resolveSpy).not.toHaveBeenCalled();
    });

    it('replays websocket upgrades to the owning machine', async () => {
      enableRedisForTests();
      process.env.FLY_MACHINE_ID = 'fly-machine-1';
      vi.spyOn(flyReplay, 'resolveLobbyRouting').mockResolvedValue({
        action: 'replay',
        machineId: 'fly-machine-2',
      });

      await bootHookServer();
      const response = await requestUpgrade(
        server,
        '/socket.io/?EIO=4&transport=websocket&lobbyId=lobby-1',
      );

      expect(response).toContain('HTTP/1.1 101 Switching Protocols');
      expect(response.toLowerCase()).toContain('fly-replay: instance=fly-machine-2');
    });

    it('replays long-polling requests to the owning machine', async () => {
      enableRedisForTests();
      process.env.FLY_MACHINE_ID = 'fly-machine-1';
      vi.spyOn(flyReplay, 'resolveLobbyRouting').mockResolvedValue({
        action: 'replay',
        machineId: 'fly-machine-2',
      });

      await bootHookServer();
      const response = await requestPolling(
        server,
        '/socket.io/?EIO=4&transport=polling&lobbyId=lobby-1',
      );

      expect(response).toContain('HTTP/1.1 101 Switching Protocols');
      expect(response.toLowerCase()).toContain('fly-replay: instance=fly-machine-2');
    });

    it('passes through same-machine upgrades without a fly-replay header', async () => {
      enableRedisForTests();
      process.env.FLY_MACHINE_ID = 'fly-machine-1';
      vi.spyOn(flyReplay, 'resolveLobbyRouting').mockResolvedValue({ action: 'self' });

      app = express();
      server = http.createServer(app);
      attachFlyReplayRouting(server, app);
      app.use('/socket.io/', (_req, res) => {
        res.status(200).end('socket-io-ok');
      });
      await new Promise((resolve) => server.listen(0, resolve));

      const response = await requestPolling(
        server,
        '/socket.io/?EIO=4&transport=polling&lobbyId=lobby-1',
      );

      expect(response.toLowerCase()).not.toContain('fly-replay:');
      expect(response).toContain('socket-io-ok');
    });

    it('claims ownership when routing is self with a local lobby', async () => {
      enableRedisForTests();
      process.env.FLY_MACHINE_ID = 'fly-machine-1';
      vi.spyOn(flyReplay, 'resolveLobbyRouting').mockResolvedValue({
        action: 'self',
        claimOwner: true,
      });
      vi.spyOn(lobbies, 'getLobbyById').mockReturnValue({ id: 'lobby-1' });
      const registerSpy = vi.spyOn(lobbyRegistry, 'registerLobby').mockResolvedValue('fly-machine-1');

      await bootHookServer();
      await requestPolling(server, '/socket.io/?EIO=4&transport=polling&lobbyId=lobby-1');

      await vi.waitFor(() => {
        expect(registerSpy).toHaveBeenCalledWith('lobby-1');
      });
    });

    it('does not replay requests without a lobby id', async () => {
      enableRedisForTests();
      process.env.FLY_MACHINE_ID = 'fly-machine-1';
      const resolveSpy = vi.spyOn(flyReplay, 'resolveLobbyRouting').mockResolvedValue({
        action: 'replay',
        machineId: 'fly-machine-2',
      });

      await bootHookServer();
      const response = await requestPolling(server, '/socket.io/?EIO=4&transport=polling');

      expect(resolveSpy).not.toHaveBeenCalled();
      expect(response.toLowerCase()).not.toContain('fly-replay:');
    });
  });

  describe('sendFlyReplayResponse', () => {
    it('writes a raw 101 response with fly-replay header', () => {
      const chunks = [];
      const fakeSocket = {
        end(payload) {
          chunks.push(payload);
        },
      };

      sendFlyReplayResponse(fakeSocket, 'machine-abc');
      expect(chunks[0]).toContain('HTTP/1.1 101 Switching Protocols');
      expect(chunks[0].toLowerCase()).toContain('fly-replay: instance=machine-abc');
    });
  });
});
