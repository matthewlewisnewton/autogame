import { describe, it, expect, beforeEach } from 'vitest';
import {
	resetGameState,
	gameState,
	updateEnemies,
	updateMinions,
	damageMinion,
	ENEMY_DEFS,
} from '../index.js';

function resetState() {
	resetGameState();
	gameState.gamePhase = 'playing';
	gameState.run = { status: 'playing' };
}

function addPlayer(id, overrides = {}) {
	gameState.players[id] = {
		x: 0,
		y: 0.5,
		z: 0,
		rotation: 0,
		hp: 100,
		dead: false,
		magicStones: 100,
		hand: [],
		deck: [],
		pendingSummons: new Set(),
		slotCooldowns: [null, null, null, null],
		...overrides,
	};
}

describe('damageMinion()', () => {
	beforeEach(resetState);

	it('reduces HP and burns summon duration proportionally', () => {
		const minion = {
			id: 'm1',
			ownerId: 'p1',
			hp: 50,
			maxHp: 50,
			ttl: 30,
			maxTtl: 30,
		};

		damageMinion(minion, 10);

		expect(minion.hp).toBe(40);
		expect(minion.ttl).toBeCloseTo(24);
	});

	it('can expire a minion through duration burn alone', () => {
		const minion = {
			id: 'm1',
			ownerId: 'p1',
			hp: 20,
			maxHp: 20,
			ttl: 4,
			maxTtl: 20,
		};

		damageMinion(minion, 20);

		expect(minion.hp).toBe(0);
		expect(minion.ttl).toBe(0);
	});
});

describe('enemy attacks on summons', () => {
	beforeEach(resetState);

	it('Necroframe Knight taunt damage burns HP and TTL', () => {
		addPlayer('p1', { x: 10, z: 0 });
		gameState.enemies = [{
			id: 'e1',
			type: 'grunt',
			x: 0,
			z: 0,
			hp: 50,
			state: 'idle',
			attackState: 'idle',
			wanderTarget: { x: 0, z: 0 },
		}];
		gameState.minions = [{
			id: 'knight',
			ownerId: 'p1',
			type: 'skeleton_knight',
			x: 2,
			z: 0,
			hp: 120,
			maxHp: 120,
			taunt: true,
			ttl: 30,
			maxTtl: 30,
		}];

		updateEnemies();

		expect(gameState.minions[0].hp).toBeLessThan(120);
		expect(gameState.minions[0].ttl).toBeLessThan(30);
	});

	it('non-taunt summons take windup damage when they are the closest target', () => {
		addPlayer('p1');
		gameState.enemies = [{
			id: 'e1',
			type: 'grunt',
			x: 0,
			z: 0,
			hp: 50,
			state: 'chasing',
			attackState: 'windup',
			windupTargetType: 'minion',
			windupTargetId: 'drake-1',
			windupStartTime: Date.now() - ENEMY_DEFS.grunt.attackWindupMs - 50,
			windupDirX: 1,
			windupDirZ: 0,
			wanderTarget: { x: 0, z: 0 },
		}];
		gameState.minions = [{
			id: 'drake-1',
			ownerId: 'p1',
			type: 'dungeon_drake',
			x: 2,
			z: 0,
			hp: 50,
			maxHp: 50,
			ttl: 30,
			maxTtl: 30,
		}];

		updateEnemies();

		expect(gameState.minions[0].hp).toBe(50 - ENEMY_DEFS.grunt.attackDamage);
		expect(gameState.minions[0].ttl).toBeCloseTo(30 - (ENEMY_DEFS.grunt.attackDamage * 30 / 50));
	});

	it('prefers a closer summon over a farther player when choosing targets', () => {
		addPlayer('p1', { x: 10, z: 0 });
		gameState.enemies = [{
			id: 'e1',
			type: 'grunt',
			x: 0,
			z: 0,
			hp: 50,
			state: 'idle',
			attackState: 'idle',
			wanderTarget: { x: 0, z: 0 },
		}];
		gameState.minions = [{
			id: 'drake-1',
			ownerId: 'p1',
			type: 'dungeon_drake',
			x: 3,
			z: 0,
			hp: 50,
			maxHp: 50,
			ttl: 30,
			maxTtl: 30,
		}];

		updateEnemies();

		expect(gameState.enemies[0].windupTargetType).toBe('minion');
		expect(gameState.enemies[0].windupTargetId).toBe('drake-1');
		expect(gameState.enemies[0].attackState).toBe('windup');
		expect(gameState.players.p1.hp).toBe(100);
	});

	it('removes a summon when damage burns its remaining duration to zero', () => {
		addPlayer('p1');
		gameState.minions = [{
			id: 'drake-1',
			ownerId: 'p1',
			type: 'dungeon_drake',
			x: 2,
			z: 0,
			hp: 5,
			maxHp: 50,
			ttl: 1,
			maxTtl: 30,
		}];

		damageMinion(gameState.minions[0], 5);
		updateMinions();

		expect(gameState.minions).toHaveLength(0);
	});
});
