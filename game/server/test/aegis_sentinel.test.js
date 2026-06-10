import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	resetGameState,
	gameState,
	clearAllTimers,
	CARD_DEFS,
	updateEnemies,
	ENEMY_DEFS,
} from '../index.js';
import { SHOP_CARD_POOL } from '../config.js';
import {
	connectAndJoinLobby,
	startTestServer,
	closeServer,
	waitForEvent,
	lobbyGameState,
} from './helpers.js';

describe('Aegis Sentinel definitions', () => {
	it('defines evolved creature stats and shield parameters', () => {
		expect(CARD_DEFS.aegis_sentinel).toMatchObject({
			id: 'aegis_sentinel',
			type: 'creature',
			magicStoneCost: 45,
			damage: 0,
			shieldHp: 30,
			shieldDurationMs: 8000,
			minionHp: 160,
			minionTtl: 30,
			attackDamage: 0,
			taunt: true,
			isEvolved: true,
		});
	});

	it('is available in the shop card pool', () => {
		expect(SHOP_CARD_POOL).toContain('aegis_sentinel');
	});
});

describe('Aegis Sentinel gameplay', () => {
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

	it('applies shield, spawns taunt minion, and deals zero burst damage when played', async () => {
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'aegis-sentinel-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		const state = lobbyGameState(socket._lobbyId);
		expect(state).toBeDefined();
		const player = state.players[socket._playerId];
		expect(player).toBeDefined();

		const enemyHpBefore = 50;
		state.enemies = [{
			id: 'e1',
			x: player.x + 2,
			z: player.z,
			hp: enemyHpBefore,
			state: 'idle',
			wanderTarget: { x: player.x + 2, z: player.z },
		}];

		const slotIndex = player.hand.findIndex(c => c && c.id === 'aegis_sentinel');
		expect(slotIndex).toBeGreaterThanOrEqual(0);

		const cardUsedPromise = waitForEvent(socket, 'cardUsed');
		socket.emit('useCard', { cardId: 'aegis_sentinel', slotIndex });
		const cardUsed = await cardUsedPromise;

		expect(player.shieldHp).toBe(30);
		expect(player.shieldExpiresAt).toBeGreaterThan(Date.now());
		expect(cardUsed.shieldGranted).toBe(30);
		expect(state.enemies[0].hp).toBe(enemyHpBefore);
		for (const hit of cardUsed.hits) {
			expect(hit.hp).toBe(enemyHpBefore);
		}

		const ownerMinions = state.minions.filter(m => m.ownerId === socket._playerId);
		expect(ownerMinions).toHaveLength(1);
		expect(ownerMinions[0]).toMatchObject({
			type: 'aegis_sentinel',
			hp: 160,
			maxHp: 160,
			attackDamage: 0,
			taunt: true,
		});
		expect(cardUsed.minionId).toBe(ownerMinions[0].id);
	});

	it('taunt minion draws enemy attacks away from the caster', () => {
		resetGameState();
		gameState.players.p1 = { id: 'p1', hp: 100, dead: false, x: 10, z: 0 };
		const enemy = {
			id: 'e1',
			type: 'grunt',
			x: 0,
			z: 0,
			hp: 50,
			state: 'idle',
			attackState: 'idle',
			wanderTarget: { x: 0, z: 0 },
		};
		gameState.enemies = [enemy];
		gameState.minions = [{
			id: 'sentinel',
			ownerId: 'p1',
			type: 'aegis_sentinel',
			x: 2,
			z: 0,
			hp: 160,
			maxHp: 160,
			attackDamage: 0,
			taunt: true,
			ttl: 30,
		}];
		gameState.run = { status: 'playing' };

		// First tick: enemy transitions from idle to windup targeting the taunt minion
		updateEnemies();
		expect(enemy.attackState).toBe('windup');
		expect(enemy.windupTargetType).toBe('minion');
		expect(enemy.windupTargetId).toBe('sentinel');

		// Advance windup past its duration so the strike fires on the next tick
		enemy.windupStartTime = Date.now() - ENEMY_DEFS.grunt.attackWindupMs - 50;
		updateEnemies();

		expect(gameState.minions[0].hp).toBeLessThan(160);
		expect(gameState.minions[0].ttl).toBeLessThan(30);
		expect(gameState.players.p1.hp).toBe(100);
	});
});
