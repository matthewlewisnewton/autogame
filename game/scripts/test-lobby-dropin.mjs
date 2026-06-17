#!/usr/bin/env node
/**
 * Manual smoke test: two players create/join a lobby, start a run,
 * player 2 leaves and rejoins while the run persists.
 */
import { io as ClientIO } from 'socket.io-client';
import { loginSessionCookie } from '../client/scripts/session-auth.mjs';

const SERVER_URL = process.env.SERVER_URL || process.env.BASE_URL || 'http://localhost:3000';

function waitFor(socket, event, ms = 8000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout: ${event}`)), ms);
    socket.once(event, (data) => {
      clearTimeout(t);
      resolve(data);
    });
  });
}

function connect(cookieHeader) {
  return new Promise((resolve, reject) => {
    const socket = ClientIO(SERVER_URL, {
      transports: ['websocket'],
      extraHeaders: { cookie: cookieHeader },
    });
    const t = setTimeout(() => reject(new Error('connect timeout')), 10000);
    socket.on('init', (data) => {
      clearTimeout(t);
      resolve({ socket, init: data });
    });
    socket.on('connect_error', reject);
  });
}

async function joinLobby(socket, lobbyId) {
  socket.emit('joinLobby', { lobbyId });
  return waitFor(socket, 'lobbyJoined');
}

async function createLobby(socket, name) {
  socket.emit('createLobby', { name });
  return waitFor(socket, 'lobbyJoined');
}

async function main() {
  const suffix = Date.now();
  const { cookieHeader: cookie1 } = await loginSessionCookie(SERVER_URL, `dropin-a-${suffix}`);
  const { cookieHeader: cookie2 } = await loginSessionCookie(SERVER_URL, `dropin-b-${suffix}`);

  const p1 = await connect(cookie1);
  const p2 = await connect(cookie2);

  console.log('✓ Both players connected (session init, not in lobby yet)');
  console.log('  p1 inLobby:', p1.init.inLobby === false);
  console.log('  p2 inLobby:', p2.init.inLobby === false);

  const created = await createLobby(p1.socket, 'Drop-In Smoke Test');
  console.log('✓ Player 1 created lobby', created.lobbyId, created.lobbyName);

  const joined = await joinLobby(p2.socket, created.lobbyId);
  console.log('✓ Player 2 joined lobby', joined.lobbyId);

  p1.socket.emit('playerReady', true);
  p2.socket.emit('playerReady', true);
  await Promise.all([
    waitFor(p1.socket, 'startGame'),
    waitFor(p2.socket, 'startGame'),
  ]);
  console.log('✓ Run started');

  await new Promise((r) => setTimeout(r, 300));

  p2.socket.emit('leaveLobby');
  await waitFor(p2.socket, 'lobbyLeft');
  console.log('✓ Player 2 left lobby (browser view)');

  await new Promise((r) => setTimeout(r, 300));

  const rejoined = await joinLobby(p2.socket, created.lobbyId);
  console.log('✓ Player 2 dropped back in');
  console.log('  gamePhase:', rejoined.state.gamePhase);
  console.log('  player in state:', !!rejoined.state.players[rejoined.id]);

  if (rejoined.state.gamePhase !== 'playing') {
    throw new Error(`Expected playing phase after drop-in, got ${rejoined.state.gamePhase}`);
  }

  p1.socket.disconnect();
  p2.socket.disconnect();
  console.log('✓ Drop-in/out smoke test passed');
}

main().catch((err) => {
  console.error('✗', err.message);
  process.exit(1);
});
