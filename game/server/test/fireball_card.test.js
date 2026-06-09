import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	clearAllTimers,
	CARD_DEFS,
	isBurning,
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

describe('Fireball definitions', () => {
	it('defines a piercing fire projectile that ignites on hit', () => {
		expect(CARD_DEFS.fireball).toMatchObject({
			id: 'fireball',
			name: 'Fireball',
			type: 'weapon',
			charges: 4,
			damage: 18,
			attackRange: 9,
			effect: 'fireball',
			acquisition: 'reward',
			projectile: { pierces: true },
		});
		expect(CARD_DEFS.fireball.burningDurationMs).toBeGreaterThan(0);
		expect(typeof CARD_DEFS.fireball.rewardOrder).toBe('number');
	});

	it('is obtainable as a victory reward and has a sell value', () => {
		expect(VICTORY_REWARD_ROTATION).toContain('fireball');
		expect(CARD_SELL_VALUES.fireball).toBeGreaterThan(0);
	});
});

describe('Fireball gameplay', () => {
	let baseUrl, socket;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		({ socket } = await connectAndJoinLobby(baseUrl));
	});

	afterEach(async () => {
		if (socket && socket.connected) socket.disconnect();
		clearAllTimers();
		await closeServer();
	});

	it('casts a fireball that deals impact damage and ignites every enemy hit', async () => {
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'fireball-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		const state = lobbyGameState(socket._lobbyId);
		expect(state).toBeDefined();
		const player = state.players[socket._playerId];
		expect(player).toBeDefined();

		// Two grunts lined up in front along +X (scenario layout).
		expect(state.enemies.length).toBeGreaterThanOrEqual(2);
		const hpBefore = new Map(state.enemies.map(e => [e.id, e.hp]));

		const slotIndex = player.hand.findIndex(c => c && c.id === 'fireball');
		expect(slotIndex).toBeGreaterThanOrEqual(0);

		const cardUsedPromise = waitForEvent(socket, 'cardUsed');
		socket.emit('useCard', { cardId: 'fireball', slotIndex });
		const cardUsed = await cardUsedPromise;

		// (a) Emits a fireball CARD_USED with render fields and applied hits.
		expect(cardUsed.effect).toBe('fireball');
		expect(cardUsed.origin).toBeDefined();
		expect(cardUsed.direction).toBeDefined();
		expect(cardUsed.attackRange).toBe(CARD_DEFS.fireball.attackRange);
		expect(cardUsed.hits.length).toBeGreaterThanOrEqual(1);

		// Impact damage landed on each struck enemy.
		const now = Date.now();
		for (const hit of cardUsed.hits) {
			const enemy = state.enemies.find(e => e.id === hit.enemyId);
			expect(enemy).toBeDefined();
			expect(enemy.hp).toBeLessThan(hpBefore.get(hit.enemyId));

			// (b) Every enemy struck becomes burning, in addition to impact damage.
			expect(isBurning(enemy)).toBe(true);
			expect(enemy.burningUntil).toBeGreaterThan(now);
		}
	});

	it('fireball-hand-ready swaps Fireball into hand without resetting enemies', async () => {
		const icePromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'ice-ball-ready' });
		await icePromise;
		await waitForEvent(socket, 'stateUpdate');

		const before = lobbyGameState(socket._lobbyId);
		const targetId = before.enemies[0].id;
		const statusNow = Date.now();
		before.enemies[0].slowedUntil = statusNow + 5000;
		before.enemies[0].slowFactor = 0.4;

		const handPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'fireball-hand-ready' });
		await handPromise;
		await waitForEvent(socket, 'stateUpdate');

		const after = lobbyGameState(socket._lobbyId);
		const player = after.players[socket._playerId];
		const target = after.enemies.find((e) => e.id === targetId);

		expect(target).toBeDefined();
		expect(target.slowedUntil).toBe(statusNow + 5000);
		expect(player.hand.some((c) => c && c.id === 'fireball')).toBe(true);
	});

	it('fireball on a slowed enemy clears slow and applies burn (ticket 301)', async () => {
		const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.1);

		const icePromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'ice-ball-ready' });
		await icePromise;
		await waitForEvent(socket, 'stateUpdate');

		const beforeIce = lobbyGameState(socket._lobbyId);
		const player = beforeIce.players[socket._playerId];
		const targetId = beforeIce.enemies[0].id;
		const iceSlot = player.hand.findIndex((c) => c && c.id === 'ice_ball');

		const iceUsedPromise = waitForEvent(socket, 'cardUsed');
		socket.emit('useCard', { cardId: 'ice_ball', slotIndex: iceSlot });
		await iceUsedPromise;
		await waitForEvent(socket, 'stateUpdate');

		const afterIce = lobbyGameState(socket._lobbyId);
		const slowedTarget = afterIce.enemies.find((e) => e.id === targetId);
		expect(isSlowed(slowedTarget)).toBe(true);

		const handPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'fireball-hand-ready' });
		await handPromise;
		await waitForEvent(socket, 'stateUpdate');

		const beforeFire = lobbyGameState(socket._lobbyId);
		const firePlayer = beforeFire.players[socket._playerId];
		const fireSlot = firePlayer.hand.findIndex((c) => c && c.id === 'fireball');

		const fireUsedPromise = waitForEvent(socket, 'cardUsed');
		socket.emit('useCard', { cardId: 'fireball', slotIndex: fireSlot });
		await fireUsedPromise;
		await waitForEvent(socket, 'stateUpdate');

		const afterFire = lobbyGameState(socket._lobbyId);
		const burnedTarget = afterFire.enemies.find((e) => e.id === targetId);
		const now = Date.now();

		expect(isBurning(burnedTarget)).toBe(true);
		expect(burnedTarget.burningUntil).toBeGreaterThan(now);
		expect(isSlowed(burnedTarget)).toBe(false);
		expect(burnedTarget.slowedUntil).toBe(0);
		expect(isBurning(burnedTarget) && isSlowed(burnedTarget)).toBe(false);

		randomSpy.mockRestore();
	});
});
