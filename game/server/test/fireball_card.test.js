import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	clearAllTimers,
	CARD_DEFS,
	isBurning,
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
			damage: 16,
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
});
