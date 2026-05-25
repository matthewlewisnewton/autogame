#!/usr/bin/env node
/**
 * CI smoke test: two players register, join the shared lobby, start a run,
 * then player 2 cold-disconnects and reconnects while the run is still active.
 *
 * Matches the current server (global lobby + JWT auth + playerReady/startGame).
 * Does NOT use the legacy createLobby/joinLobby events — those are not implemented.
 */
import { io as ClientIO } from 'socket.io-client';

const SERVER_URL = process.env.SERVER_URL || process.env.BASE_URL || 'http://localhost:3000';

function waitFor(socket, event, ms = 15000) {
	return new Promise((resolve, reject) => {
		const t = setTimeout(() => reject(new Error(`timeout: ${event}`)), ms);
		socket.once(event, (data) => {
			clearTimeout(t);
			resolve(data);
		});
	});
}

/** Register (idempotent) then login; returns JWT. */
async function authToken(username) {
	const password = 'password123';
	const reg = await fetch(`${SERVER_URL}/api/register`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ username, password }),
	});
	// 201 created or 409 already exists — both are fine before login
	if (!reg.ok && reg.status !== 409) {
		const body = await reg.json().catch(() => ({}));
		throw new Error(`register failed (${reg.status}): ${body.error || 'unknown'}`);
	}

	const login = await fetch(`${SERVER_URL}/api/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ identifier: username, password }),
	});
	if (!login.ok) {
		const body = await login.json().catch(() => ({}));
		throw new Error(`login failed (${login.status}): ${body.error || 'unknown'}`);
	}
	const { token } = await login.json();
	if (!token) throw new Error('login response missing token');
	return token;
}

function connect(token) {
	return new Promise((resolve, reject) => {
		const socket = ClientIO(SERVER_URL, {
			transports: ['websocket'],
			retry: false,
			autoConnect: true,
			timeout: 10000,
			auth: { token },
		});
		const t = setTimeout(() => {
			socket.disconnect();
			reject(new Error('connect timeout'));
		}, 15000);
		socket.on('init', (data) => {
			clearTimeout(t);
			resolve({ socket, init: data });
		});
		socket.on('connect_error', (err) => {
			clearTimeout(t);
			reject(err);
		});
	});
}

async function main() {
	const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	const nameA = `dropin-a-${suffix}`;
	const nameB = `dropin-b-${suffix}`;

	const tokenA = await authToken(nameA);
	const tokenB = await authToken(nameB);

	const p1 = await connect(tokenA);
	const p2 = await connect(tokenB);

	console.log('✓ Both players connected');
	expectPhase(p1.init, 'lobby', 'p1 initial');
	expectPhase(p2.init, 'lobby', 'p2 initial');

	const startA = waitFor(p1.socket, 'startGame');
	const startB = waitFor(p2.socket, 'startGame');
	p1.socket.emit('playerReady', true);
	p2.socket.emit('playerReady', true);
	await Promise.all([startA, startB]);
	console.log('✓ Run started (both received startGame)');

	// Brief tick so state settles
	await sleep(200);

	const playerBId = p2.init.playerId || p2.init.id;
	p2.socket.disconnect();
	await sleep(150);
	console.log('✓ Player 2 disconnected (cold)');

	const p2Back = await connect(tokenB);
	console.log('✓ Player 2 reconnected');

	expectPhase(p2Back.init, 'playing', 'p2 after drop-in');
	const hand = p2Back.init.state?.players?.[playerBId]?.hand;
	if (!Array.isArray(hand) || hand.length === 0) {
		throw new Error('Expected hand initialized after active-run reconnect');
	}
	console.log('✓ Player 2 has combat hand after drop-in');

	p1.socket.disconnect();
	p2Back.socket.disconnect();
	console.log('✓ Drop-in smoke test passed');
}

function expectPhase(init, phase, label) {
	const actual = init.state?.gamePhase;
	if (actual !== phase) {
		throw new Error(`${label}: expected gamePhase=${phase}, got ${actual}`);
	}
}

function sleep(ms) {
	return new Promise((r) => setTimeout(r, ms));
}

main().catch((err) => {
	console.error('✗', err.message);
	process.exit(1);
});
