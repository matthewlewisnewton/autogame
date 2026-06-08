import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	clearAllTimers,
	CARD_DEFS,
	isSlowed,
} from '../index.js';
import { VICTORY_REWARD_ROTATION } from '../config.js';
import { CARD_SELL_VALUES } from '../progression.js';
import {
	connectAndJoinLobby,
	startTestServer,
	closeServer,
	waitForEvent,
	lobbyGameState,
} from './helpers.js';

describe('Ice Ball definitions', () => {
	it('defines a slow ice projectile spell with probabilistic slow', () => {
		expect(CARD_DEFS.ice_ball).toMatchObject({
			id: 'ice_ball',
			name: 'Glacial Orb',
			type: 'spell',
			charges: 1,
			magicStoneCost: 32,
			damage: 12,
			attackRange: 9,
			effect: 'ice_ball',
			acquisition: 'reward',
			specialEffect: 'slow',
			slowDurationMs: 3000,
			slowChance: 0.65,
			projectileTravelMs: 1200,
		});
		expect(typeof CARD_DEFS.ice_ball.rewardOrder).toBe('number');
	});

	it('is obtainable as a victory reward and has a sell value', () => {
		expect(VICTORY_REWARD_ROTATION).toContain('ice_ball');
		expect(CARD_SELL_VALUES.ice_ball).toBeGreaterThan(0);
	});
});

describe('Ice Ball gameplay', () => {
	let baseUrl, socket;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		({ socket } = await connectAndJoinLobby(baseUrl));
	});

	afterEach(async () => {
		vi.restoreAllMocks();
		if (socket && socket.connected) socket.disconnect();
		clearAllTimers();
		await closeServer();
	});

	async function setupIceBallScenario() {
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'ice-ball-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');
		return lobbyGameState(socket._lobbyId);
	}

	it('casts an ice ball that emits CARD_USED with hits and impact damage', async () => {
		const state = await setupIceBallScenario();
		const player = state.players[socket._playerId];
		expect(player).toBeDefined();
		expect(state.enemies.length).toBeGreaterThanOrEqual(1);

		const hpBefore = new Map(state.enemies.map(e => [e.id, e.hp]));
		const slotIndex = player.hand.findIndex(c => c && c.id === 'ice_ball');
		expect(slotIndex).toBeGreaterThanOrEqual(0);

		const cardUsedPromise = waitForEvent(socket, 'cardUsed');
		socket.emit('useCard', { cardId: 'ice_ball', slotIndex });
		const cardUsed = await cardUsedPromise;

		expect(cardUsed.effect).toBe('ice_ball');
		expect(cardUsed.origin).toBeDefined();
		expect(cardUsed.direction).toBeDefined();
		expect(cardUsed.attackRange).toBe(CARD_DEFS.ice_ball.attackRange);
		expect(cardUsed.projectileTravelMs).toBe(CARD_DEFS.ice_ball.projectileTravelMs);
		expect(cardUsed.hits.length).toBeGreaterThanOrEqual(1);

		for (const hit of cardUsed.hits) {
			const enemy = state.enemies.find(e => e.id === hit.enemyId);
			expect(enemy).toBeDefined();
			expect(enemy.hp).toBeLessThan(hpBefore.get(hit.enemyId));
		}
	});

	it('slows struck enemies when the slow roll succeeds', async () => {
		const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.1);
		const state = await setupIceBallScenario();
		const player = state.players[socket._playerId];
		const slotIndex = player.hand.findIndex(c => c && c.id === 'ice_ball');

		const cardUsedPromise = waitForEvent(socket, 'cardUsed');
		socket.emit('useCard', { cardId: 'ice_ball', slotIndex });
		const cardUsed = await cardUsedPromise;

		const now = Date.now();
		for (const hit of cardUsed.hits) {
			const enemy = state.enemies.find(e => e.id === hit.enemyId);
			expect(enemy).toBeDefined();
			expect(isSlowed(enemy)).toBe(true);
			expect(enemy.slowedUntil).toBeGreaterThan(now);
		}
		randomSpy.mockRestore();
	});

	it('deals impact damage without slowing when the slow roll fails', async () => {
		const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.9);
		const state = await setupIceBallScenario();
		const player = state.players[socket._playerId];
		const hpBefore = new Map(state.enemies.map(e => [e.id, e.hp]));
		const slotIndex = player.hand.findIndex(c => c && c.id === 'ice_ball');

		const cardUsedPromise = waitForEvent(socket, 'cardUsed');
		socket.emit('useCard', { cardId: 'ice_ball', slotIndex });
		const cardUsed = await cardUsedPromise;

		for (const hit of cardUsed.hits) {
			const enemy = state.enemies.find(e => e.id === hit.enemyId);
			expect(enemy).toBeDefined();
			expect(enemy.hp).toBeLessThan(hpBefore.get(hit.enemyId));
			expect(isSlowed(enemy)).toBe(false);
		}
		randomSpy.mockRestore();
	});
});
