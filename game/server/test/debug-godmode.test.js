import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { damagePlayer, setGameState } from '../simulation.js';
import { MAX_HP } from '../config.js';
import {
	damagePlayer as damagePlayerFromIndex,
	gameState,
	createGameState,
	hotStateSnapshot,
	stateSnapshot,
	findSocketByPlayerId,
} from '../index.js';
import {
	startTestServer,
	closeServer,
	connectClient,
	waitForEvent,
	playerForSocket,
	lobbyStateForSocket,
} from './helpers.js';

function makePlayer(id, overrides = {}) {
	return {
		id,
		x: 0,
		y: 0.5,
		z: 0,
		rotation: 0,
		hp: MAX_HP,
		dead: false,
		invulnerableUntil: 0,
		debugGodmode: false,
		...overrides,
	};
}

function setupState(players) {
	const state = { players, enemies: {}, minions: {} };
	setGameState(state, []);
	return state;
}

describe('damagePlayer — debugGodmode', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(1_000_000);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('returns null and leaves HP/dead unchanged under lethal damage when godmode is on', () => {
		const state = setupState({ p1: makePlayer('p1', { debugGodmode: true, hp: 50 }) });
		const result = damagePlayer('p1', 9999);
		expect(result).toBeNull();
		expect(state.players.p1.hp).toBe(50);
		expect(state.players.p1.dead).toBe(false);
		vi.advanceTimersByTime(10_000);
		expect(state.players.p1.dead).toBe(false);
		expect(state.players.p1.hp).toBe(50);
	});

	it('applies lethal damage normally when godmode is off', () => {
		const state = setupState({ p1: makePlayer('p1', { hp: 30, debugGodmode: false }) });
		damagePlayer('p1', 30);
		expect(state.players.p1.hp).toBe(0);
		expect(state.players.p1.dead).toBe(true);
	});

	it('applies lethal damage normally when debugGodmode is unset', () => {
		const player = makePlayer('p1', { hp: 40 });
		delete player.debugGodmode;
		const state = setupState({ p1: player });
		damagePlayer('p1', 40);
		expect(state.players.p1.hp).toBe(0);
		expect(state.players.p1.dead).toBe(true);
	});

	it('ignores damage regardless of attack options (melee, ranged, enemy, minion)', () => {
		const state = setupState({ p1: makePlayer('p1', { debugGodmode: true }) });
		const optionsList = [
			{},
			{ ranged: true, attackerEnemyId: 'e1' },
			{ projectile: true, attackerEnemyId: 'e1' },
			{ attackerEnemyId: 'e1' },
			{ attackerId: 'm1' },
		];
		for (const options of optionsList) {
			expect(damagePlayer('p1', 500, options)).toBeNull();
		}
		expect(state.players.p1.hp).toBe(MAX_HP);
		expect(state.players.p1.dead).toBe(false);
	});

	it('does not consume shield or blocking when godmode is on', () => {
		const state = setupState({
			p1: makePlayer('p1', {
				debugGodmode: true,
				shieldHitsRemaining: 1,
				shieldHp: 50,
				shieldExpiresAt: Date.now() + 60_000,
				blockingUntil: Date.now() + 60_000,
				blockingYaw: 0,
			}),
		});
		damagePlayer('p1', 100, { attackerEnemyId: 'e1' });
		expect(state.players.p1.hp).toBe(MAX_HP);
		expect(state.players.p1.shieldHitsRemaining).toBe(1);
		expect(state.players.p1.shieldHp).toBe(50);
	});
});

describe('debugGodmode — client snapshots', () => {
	beforeEach(() => {
		Object.assign(gameState, createGameState());
		if (!gameState.layout) {
			gameState.layout = { rooms: [{ x: 0, z: 0, width: 10, depth: 10 }] };
		}
		if (!gameState.dungeonBounds) {
			gameState.dungeonBounds = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
		}
	});

	it('is omitted from hotStateSnapshot and stateSnapshot', () => {
		gameState.players.p1 = makePlayer('p1', { debugGodmode: true });
		const hot = hotStateSnapshot();
		const full = stateSnapshot();
		expect(hot.players.p1.debugGodmode).toBeUndefined();
		expect(full.players.p1.debugGodmode).toBeUndefined();
	});
});

describe('damagePlayer — debugGodmode (index export)', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		Object.assign(gameState, createGameState());
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('control: index damagePlayer reduces HP when godmode is off', () => {
		gameState.players.p1 = makePlayer('p1', { debugGodmode: false, hp: 80 });
		damagePlayerFromIndex('p1', 30);
		expect(gameState.players.p1.hp).toBe(50);
	});
});

describe('toggleDebugGodmode — socket integration', () => {
	let baseUrl;
	let prevAllowDebug;

	beforeEach(async () => {
		prevAllowDebug = process.env.ALLOW_DEBUG_SCENARIOS;
		process.env.ALLOW_DEBUG_SCENARIOS = '1';
		baseUrl = await startTestServer();
	});

	afterEach(async () => {
		await closeServer();
		if (prevAllowDebug === undefined) {
			delete process.env.ALLOW_DEBUG_SCENARIOS;
		} else {
			process.env.ALLOW_DEBUG_SCENARIOS = prevAllowDebug;
		}
	});

	it('toggles debugGodmode and leaves HP unchanged under damagePlayer when enabled', async () => {
		const { socket } = await connectClient(baseUrl);

		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;

		let godmodePromise = waitForEvent(socket, 'debugGodmodeResult');
		socket.emit('toggleDebugGodmode');
		let result = await godmodePromise;
		expect(result).toEqual({ ok: true, enabled: true });

		const player = playerForSocket(socket);
		expect(player.debugGodmode).toBe(true);
		const hpBefore = player.hp;

		const state = lobbyStateForSocket(socket);
		setGameState(state, []);
		expect(damagePlayer(socket._playerId, 9999)).toBeNull();
		expect(player.hp).toBe(hpBefore);
		expect(player.dead).toBe(false);

		godmodePromise = waitForEvent(socket, 'debugGodmodeResult');
		socket.emit('toggleDebugGodmode');
		result = await godmodePromise;
		expect(result).toEqual({ ok: true, enabled: false });
		expect(player.debugGodmode).toBe(false);
	});
});

describe('toggleDebugGodmode — gate', () => {
	let baseUrl;
	let prevAllowDebug;
	let prevNodeEnv;

	beforeEach(async () => {
		prevAllowDebug = process.env.ALLOW_DEBUG_SCENARIOS;
		prevNodeEnv = process.env.NODE_ENV;
		delete process.env.ALLOW_DEBUG_SCENARIOS;
		process.env.NODE_ENV = 'production';
		baseUrl = await startTestServer();
	});

	afterEach(async () => {
		await closeServer();
		if (prevAllowDebug === undefined) {
			delete process.env.ALLOW_DEBUG_SCENARIOS;
		} else {
			process.env.ALLOW_DEBUG_SCENARIOS = prevAllowDebug;
		}
		if (prevNodeEnv === undefined) {
			delete process.env.NODE_ENV;
		} else {
			process.env.NODE_ENV = prevNodeEnv;
		}
	});

	it('rejects non-loopback peer in production without ALLOW_DEBUG_SCENARIOS', async () => {
		const { socket } = await connectClient(baseUrl);
		const serverSocket = findSocketByPlayerId(socket._playerId);
		expect(serverSocket).toBeTruthy();
		serverSocket.handshake.address = '1.2.3.4';

		const resultPromise = waitForEvent(socket, 'debugGodmodeResult');
		socket.emit('toggleDebugGodmode');
		const result = await resultPromise;

		expect(result).toEqual({ ok: false, reason: 'Debug godmode is disabled' });
		const player = playerForSocket(socket);
		expect(player.debugGodmode).toBe(false);
	});
});
