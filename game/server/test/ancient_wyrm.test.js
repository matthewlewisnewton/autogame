import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	resetGameState,
	gameState,
	clearAllTimers,
	CARD_DEFS,
	EVOLUTION_TRANSFORMS,
	EVOLUTION_GRIND_REQUIRED,
	createCardInstance,
	evolveCard,
	updateMinions,
} from '../index.js';
import { ATTACK_CONE_ANGLE } from '../config.js';
import {
	connectAndJoinLobby,
	startTestServer,
	closeServer,
	waitForEvent,
	lobbyGameState,
} from './helpers.js';

function resetState() {
	resetGameState();
	gameState.gamePhase = 'playing';
	gameState.players.p1 = {
		id: 'p1',
		x: 0,
		z: 0,
		hp: 100,
		dead: false,
		lastActivity: Date.now(),
	};
}

describe('Ancient Wyrm definitions', () => {
	it('defines evolved stats and fire breath parameters', () => {
		expect(EVOLUTION_TRANSFORMS.dungeon_drake).toBe('ancient_wyrm');
		expect(CARD_DEFS.ancient_wyrm).toMatchObject({
			id: 'ancient_wyrm',
			type: 'creature',
			minionHp: 90,
			isEvolved: true,
			specialEffect: 'fire_breath',
			effect: 'ancient_wyrm',
		});
	});

	it('evolves Vault Wyrm at +10 grind', () => {
		const player = {
			inventory: [
				createCardInstance('dungeon_drake', {
					instanceId: 'drake-1',
					grind: EVOLUTION_GRIND_REQUIRED,
				}),
			],
			ownedCards: { dungeon_drake: 1 },
			selectedDeck: ['drake-1'],
		};

		const result = evolveCard(player, 'drake-1');

		expect(result.ok).toBe(true);
		expect(result.toCardId).toBe('ancient_wyrm');
		expect(player.inventory[0].cardId).toBe('ancient_wyrm');
		expect(player.inventory[0].isEvolved).toBe(true);
	});
});

describe('Ancient Wyrm gameplay', () => {
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

	it('spawns a minion with higher HP than base Vault Wyrm', async () => {
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		const state = lobbyGameState(socket._lobbyId);
		expect(state).toBeDefined();
		const player = state.players[socket._playerId];
		expect(player).toBeDefined();

		player.deck = [];
		player.hand = [{
			id: 'ancient_wyrm',
			name: 'Ancient Wyrm',
			type: 'creature',
			charges: 1,
			remainingCharges: 1,
		}];

		socket.emit('useCard', { cardId: 'ancient_wyrm', slotIndex: 0 });
		await waitForEvent(socket, 'cardUsed');

		const wyrm = state.minions.find(m => m.ownerId === socket._playerId && m.type === 'ancient_wyrm');
		expect(wyrm).toMatchObject({ hp: 90, maxHp: 90, lastBreathAt: expect.any(Number) });
	});
});

describe('Ancient Wyrm fire breath', () => {
	beforeEach(() => {
		resetState();
	});

	it('damages enemies in a forward cone every ~3s', () => {
		const now = Date.now();
		gameState.minions.push({
			id: 'wyrm-1',
			ownerId: 'p1',
			type: 'ancient_wyrm',
			x: 0,
			z: 0,
			hp: 90,
			ttl: 30,
			lastBreathAt: now - 3100,
			breathIntervalMs: 3000,
			breathRange: 8,
			breathDamage: 15,
			breathConeAngle: ATTACK_CONE_ANGLE,
		});
		gameState.enemies.push({
			id: 'e1',
			x: 4,
			z: 0,
			hp: 50,
			state: 'idle',
			wanderTarget: { x: 4, z: 0 },
		});

		updateMinions();

		expect(gameState.enemies[0].hp).toBe(35);
		expect(gameState.minions[0].lastBreathAt).toBeGreaterThanOrEqual(now);
		expect(gameState._pendingMinionBreaths).toHaveLength(1);
		expect(gameState._pendingMinionBreaths[0]).toMatchObject({
			cardId: 'ancient_wyrm',
			specialEffect: 'fire_breath',
			hits: [{ enemyId: 'e1', hp: 35 }],
		});
	});

	it('melee swipe routes through collectConeHits and queues cardUsed payload', () => {
		gameState.enemies.push({
			id: 'e1',
			x: 2,
			z: 0,
			hp: 50,
			state: 'idle',
			wanderTarget: { x: 2, z: 0 },
		});
		gameState.minions.push({
			id: 'wyrm-1',
			ownerId: 'p1',
			type: 'ancient_wyrm',
			x: 0,
			z: 0,
			hp: 90,
			ttl: 30,
			lastBreathAt: Date.now(),
			breathIntervalMs: 3000,
		});

		updateMinions();

		expect(gameState.enemies[0].hp).toBe(45);
		expect(gameState._pendingMinionBreaths).toHaveLength(1);
		expect(gameState._pendingMinionBreaths[0]).toMatchObject({
			cardId: 'ancient_wyrm',
			hits: [{ enemyId: 'e1', hp: 45 }],
		});
		expect(gameState._pendingMinionBreaths[0].specialEffect).toBeUndefined();
	});
});
