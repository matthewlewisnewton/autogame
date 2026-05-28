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
	damagePlayer,
	spawnEnemy,
	updateMinions,
} from '../index.js';
import { ATTACK_RANGE, DETECTION_RADIUS, TICK_RATE } from '../config.js';
import {
	connectAndJoinLobby,
	startTestServer,
	closeServer,
	waitForEvent,
	lobbyGameState,
} from './helpers.js';

describe('Astral Guardian definitions', () => {
	it('defines evolved stats and shield parameters', () => {
		expect(EVOLUTION_TRANSFORMS.battle_familiar).toBe('astral_guardian');
		expect(CARD_DEFS.astral_guardian).toMatchObject({
			id: 'astral_guardian',
			type: 'spell',
			damage: 66,
			magicStoneCost: 65,
			isEvolved: true,
			specialEffect: 'astral_shield',
			effect: 'astral_guardian',
			shieldHp: 15,
			shieldDurationMs: 8000,
		});
	});

	it('evolves Signal Familiar at +10 grind', () => {
		const player = {
			inventory: [
				createCardInstance('battle_familiar', {
					instanceId: 'bf-1',
					grind: EVOLUTION_GRIND_REQUIRED,
				}),
			],
			ownedCards: { battle_familiar: 1 },
			selectedDeck: ['bf-1'],
		};

		const result = evolveCard(player, 'bf-1');

		expect(result.ok).toBe(true);
		expect(result.toCardId).toBe('astral_guardian');
		expect(player.inventory[0].cardId).toBe('astral_guardian');
		expect(player.inventory[0].isEvolved).toBe(true);
	});
});

describe('Astral Guardian shield', () => {
	beforeEach(() => {
		resetGameState();
		gameState.players.p1 = {
			id: 'p1',
			hp: 100,
			dead: false,
			x: 0,
			z: 0,
		};
	});

	it('absorbs damage before HP and clears when depleted', () => {
		const player = gameState.players.p1;
		player.shieldHp = 15;
		player.shieldExpiresAt = Date.now() + 8000;

		damagePlayer('p1', 10);
		expect(player.shieldHp).toBe(5);
		expect(player.hp).toBe(100);

		damagePlayer('p1', 8);
		expect(player.shieldHp).toBe(0);
		expect(player.hp).toBe(97);
	});

	it('expires shield after shieldExpiresAt', () => {
		const player = gameState.players.p1;
		player.shieldHp = 15;
		player.shieldExpiresAt = Date.now() - 1;

		damagePlayer('p1', 10);
		expect(player.shieldHp).toBe(0);
		expect(player.hp).toBe(90);
	});
});

describe('Astral Guardian gameplay', () => {
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

	it('radial AoE, shield, and astral guardian minion spawn when played', async () => {
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		const state = lobbyGameState(socket._lobbyId);
		expect(state).toBeDefined();
		const player = state.players[socket._playerId];
		expect(player).toBeDefined();

		state.enemies.push({
			id: 'e1',
			x: player.x + 2,
			z: player.z,
			hp: 50,
			state: 'idle',
			wanderTarget: { x: player.x + 2, z: player.z },
		});
		player.deck = [];
		player.hand = [{
			id: 'astral_guardian',
			name: 'Astral Guardian',
			type: 'spell',
			charges: 1,
			remainingCharges: 1,
			magicStoneCost: 65,
			damage: 66,
		}];
		player.magicStones = 65;

		const cardUsedPromise = waitForEvent(socket, 'cardUsed');
		socket.emit('useCard', { cardId: 'astral_guardian', slotIndex: 0 });
		const cardUsed = await cardUsedPromise;

		expect(player.shieldHp).toBe(15);
		expect(player.shieldExpiresAt).toBeGreaterThan(Date.now());
		expect(cardUsed.shieldGranted).toBe(15);
		expect(cardUsed.hits.length).toBeGreaterThan(0);

		const ownerMinions = state.minions.filter(m => m.ownerId === socket._playerId);
		expect(ownerMinions).toHaveLength(1);
		expect(ownerMinions[0]).toMatchObject({
			type: 'astral_guardian',
			hp: 60,
			maxHp: 60,
			attackDamage: 11,
			attackIntervalMs: Math.floor(1000 / TICK_RATE),
		});
		expect(cardUsed.minionId).toBe(ownerMinions[0].id);
	});

	it('astral guardian minion deals more damage per tick than default minions', () => {
		resetGameState();
		gameState.players.p1 = { id: 'p1', hp: 100, dead: false, x: 0, z: 0 };
		const enemy = spawnEnemy(2, 0, 'grunt');
		enemy.hp = 100;

		gameState.minions.push({
			id: 'ag-1',
			ownerId: 'p1',
			type: 'astral_guardian',
			x: 0,
			z: 0,
			hp: 60,
			maxHp: 60,
			ttl: 30,
			attackDamage: 11,
			attackIntervalMs: Math.floor(1000 / TICK_RATE),
			lastAttackAt: 0,
		});

		const dist = Math.hypot(enemy.x, enemy.z);
		expect(dist).toBeLessThanOrEqual(ATTACK_RANGE);
		expect(dist).toBeLessThan(DETECTION_RADIUS);

		const hpBefore = enemy.hp;
		updateMinions();
		expect(enemy.hp).toBe(hpBefore - 11);

		const defaultMinion = {
			id: 'default-1',
			ownerId: 'p1',
			type: 'dungeon_drake',
			x: 0,
			z: 0,
			hp: 50,
			maxHp: 50,
			ttl: 30,
		};
		gameState.minions = [defaultMinion];
		enemy.hp = 100;
		updateMinions();
		expect(enemy.hp).toBe(97);
	});
});
