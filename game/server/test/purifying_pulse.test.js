import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	CARD_DEFS,
	createGameState,
	gameState,
	applySlow,
	isSlowed,
	applyBurning,
	isBurning,
	clearNegativeStatuses,
	healPlayersInRadius,
} from '../index.js';
import { addDebuff, setGameState } from '../simulation.js';
import {
	startTestServer,
	closeServer,
	connectClient,
	waitForEvent,
	playerForSocket,
} from './helpers.js';

function resetState() {
	Object.assign(gameState, createGameState());
}

function addPlayer(id, overrides = {}) {
	gameState.players[id] = {
		x: 0,
		y: 0.5,
		z: 0,
		rotation: 0,
		hp: 100,
		dead: false,
		extracted: false,
		magicStones: 100,
		hand: [],
		deck: [],
		pendingSummons: new Set(),
		slotCooldowns: [null, null, null, null],
		debuffs: [],
		...overrides,
	};
}

describe('clearNegativeStatuses', () => {
	it('resets slow, burn, freeze, and debuff fields', () => {
		const now = 1_000_000;
		vi.useFakeTimers();
		vi.setSystemTime(now);
		const entity = {
			slowedUntil: now + 5000,
			slowFactor: 0.4,
			burningUntil: now + 5000,
			lastBurnTickAt: now,
			frozenUntil: now + 5000,
			debuffs: [{ type: 'slow', expiresAt: now + 5000 }],
		};

		clearNegativeStatuses(entity);

		expect(entity.slowedUntil).toBe(0);
		expect(entity.slowFactor).toBe(1);
		expect(entity.burningUntil).toBe(0);
		expect(entity.lastBurnTickAt).toBeNull();
		expect(entity.frozenUntil).toBe(0);
		expect(entity.debuffs).toEqual([]);
		vi.useRealTimers();
	});
});

describe('healPlayersInRadius', () => {
	const def = CARD_DEFS.purifying_pulse;

	beforeEach(() => {
		resetState();
		setGameState(gameState, {});
	});

	it('heals two in-range allies and skips an out-of-range third player', () => {
		addPlayer('p1', { x: 0, z: 0, hp: 50 });
		addPlayer('p2', { x: 2, z: 0, hp: 60 });
		addPlayer('p3', { x: 20, z: 0, hp: 40 });

		const healedTargets = healPlayersInRadius(0, null, 0, def.radius, def.healAmount);

		expect(healedTargets).toEqual([
			{ playerId: 'p1', hpGained: def.healAmount, cleansed: true },
			{ playerId: 'p2', hpGained: def.healAmount, cleansed: true },
		]);
		expect(gameState.players.p1.hp).toBe(50 + def.healAmount);
		expect(gameState.players.p2.hp).toBe(60 + def.healAmount);
		expect(gameState.players.p3.hp).toBe(40);
	});

	it('cleanses slow from a healed player', () => {
		const now = 1_000_000;
		vi.useFakeTimers();
		vi.setSystemTime(now);
		addPlayer('p1', { x: 0, z: 0, hp: 50 });
		applySlow(gameState.players.p1, 5000, 0.5);
		expect(isSlowed(gameState.players.p1)).toBe(true);

		healPlayersInRadius(0, null, 0, def.radius, def.healAmount);

		expect(isSlowed(gameState.players.p1)).toBe(false);
		vi.useRealTimers();
	});

	it('cleanses burn from a healed player', () => {
		const now = 1_000_000;
		vi.useFakeTimers();
		vi.setSystemTime(now);
		addPlayer('p1', { x: 0, z: 0, hp: 50 });
		applyBurning(gameState.players.p1, 5000);
		expect(isBurning(gameState.players.p1)).toBe(true);

		healPlayersInRadius(0, null, 0, def.radius, def.healAmount);

		expect(isBurning(gameState.players.p1)).toBe(false);
		vi.useRealTimers();
	});

	it('clears the entire debuffs array from a healed player', () => {
		addPlayer('p1', { x: 0, z: 0, hp: 50 });
		addDebuff(gameState.players.p1, 'slow', Date.now() + 5000);
		addDebuff(gameState.players.p1, 'burn', Date.now() + 5000);
		expect(gameState.players.p1.debuffs).toHaveLength(2);

		healPlayersInRadius(0, null, 0, def.radius, def.healAmount);

		expect(gameState.players.p1.debuffs).toEqual([]);
	});

	it('skips dead and extracted players in radius', () => {
		const now = 1_000_000;
		vi.useFakeTimers();
		vi.setSystemTime(now);
		addPlayer('dead', { x: 0, z: 0, hp: 50, dead: true });
		addPlayer('extracted', { x: 1, z: 0, hp: 50, extracted: true });
		applySlow(gameState.players.dead, 5000, 0.5);
		applySlow(gameState.players.extracted, 5000, 0.5);
		gameState.players.dead.debuffs = [{ type: 'slow', expiresAt: now + 5000 }];
		gameState.players.extracted.debuffs = [{ type: 'slow', expiresAt: now + 5000 }];

		const healedTargets = healPlayersInRadius(0, null, 0, def.radius, def.healAmount);

		expect(healedTargets).toEqual([]);
		expect(gameState.players.dead.hp).toBe(50);
		expect(gameState.players.extracted.hp).toBe(50);
		expect(isSlowed(gameState.players.dead)).toBe(true);
		expect(isSlowed(gameState.players.extracted)).toBe(true);
		expect(gameState.players.dead.debuffs).toHaveLength(1);
		expect(gameState.players.extracted.debuffs).toHaveLength(1);
		vi.useRealTimers();
	});

	it('includes the caster when standing at the cast origin', () => {
		addPlayer('caster', { x: 0, z: 0, hp: 45 });

		const healedTargets = healPlayersInRadius(0, null, 0, def.radius, def.healAmount);

		expect(healedTargets).toEqual([
			{ playerId: 'caster', hpGained: def.healAmount, cleansed: true },
		]);
		expect(gameState.players.caster.hp).toBe(45 + def.healAmount);
	});
});

describe('useCard — purifying_pulse (socket integration)', () => {
	let baseUrl;
	let activeSocket;

	beforeEach(async () => {
		process.env.ALLOW_DEBUG_SCENARIOS = '1';
		baseUrl = await startTestServer();
	}, 20000);

	afterEach(async () => {
		if (activeSocket) {
			try { activeSocket.disconnect(); } catch (_) {}
			activeSocket = null;
		}
		await closeServer();
		delete process.env.ALLOW_DEBUG_SCENARIOS;
	}, 20000);

	it('emits heal_and_cleanse cardUsed with healedTargets and updates player state', async () => {
		const { socket } = await connectClient(baseUrl);
		activeSocket = socket;
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'purifying-pulse-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		const player = playerForSocket(socket);
		const slotIndex = player.hand.findIndex(c => c && c.id === 'purifying_pulse');
		expect(slotIndex).toBeGreaterThanOrEqual(0);
		expect(isSlowed(player)).toBe(false);
		expect(isBurning(player)).toBe(true);
		const hpBefore = player.hp;

		const cardUsedPromise = waitForEvent(socket, 'cardUsed');
		socket.emit('useCard', { cardId: 'purifying_pulse', slotIndex });
		const cardUsed = await cardUsedPromise;

		expect(cardUsed.specialEffect).toBe('heal_and_cleanse');
		expect(cardUsed.radius).toBe(CARD_DEFS.purifying_pulse.radius);
		expect(cardUsed.origin).toEqual({ x: player.x, z: player.z });
		expect(cardUsed.healedTargets).toEqual([
			{ playerId: socket._playerId, hpGained: CARD_DEFS.purifying_pulse.healAmount, cleansed: true },
		]);
		expect(player.hp).toBe(hpBefore + CARD_DEFS.purifying_pulse.healAmount);
		expect(isSlowed(player)).toBe(false);
		expect(isBurning(player)).toBe(false);
		expect(player.debuffs).toEqual([]);
	}, 20000);
});
