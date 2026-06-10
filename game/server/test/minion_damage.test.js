import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	resetGameState,
	gameState,
	updateEnemies,
	updateMinions,
	damageMinion,
	ENEMY_DEFS,
	ENEMY_ATTACK_RECOVERY_MS,
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
		expect(minion.ttl).toBeCloseTo(28.5);
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

		// First tick: enemy transitions from idle to windup targeting the taunt minion
		updateEnemies();
		expect(enemy.attackState).toBe('windup');
		expect(enemy.windupTargetType).toBe('minion');
		expect(enemy.windupTargetId).toBe('knight');

		// Advance windup past its duration so the strike fires on the next tick
		enemy.windupStartTime = Date.now() - ENEMY_DEFS.grunt.attackWindupMs - 50;
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
		expect(gameState.minions[0].ttl).toBeCloseTo(30 - (ENEMY_DEFS.grunt.attackDamage * 30 / 50) * 0.25);
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

	it('taunt minion takes at most one strike per attack cycle (windup + recovery)', () => {
		vi.useFakeTimers();
		try {
			addPlayer('p1', { x: 10, z: 0 });
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
			const minion = {
				id: 'sentinel',
				ownerId: 'p1',
				type: 'aegis_sentinel',
				x: 2,
				z: 0,
				hp: 160,
				maxHp: 160,
				attackDamage: 0,
				taunt: true,
				ttl: 60,
				maxTtl: 60,
			};
			gameState.minions = [minion];

			const cycleMs = ENEMY_DEFS.grunt.attackWindupMs + ENEMY_ATTACK_RECOVERY_MS;
			const numCycles = 10;
			let strikes = 0;
			let hpBefore = minion.hp;

			// Each cycle requires 2 ticks: tick 1 starts windup, tick 2 (after
			// windup elapsed) fires the strike.  Advance by cycleMs each tick so
			// recovery always expires before the next cycle begins.
			for (let c = 0; c < numCycles; c++) {
				vi.setSystemTime(Date.now() + cycleMs);
				updateEnemies(); // tick 1: enter windup (or windup from prev recovery)

				vi.setSystemTime(Date.now() + ENEMY_DEFS.grunt.attackWindupMs);
				updateEnemies(); // tick 2: windup expires -> strike -> recovery

				if (minion.hp < hpBefore) {
					strikes++;
					hpBefore = minion.hp;
				}
			}

			// Exactly one strike per cycle
			expect(strikes).toBe(numCycles);
			expect(minion.hp).toBe(160 - numCycles * ENEMY_DEFS.grunt.attackDamage);
		} finally {
			vi.useRealTimers();
		}
	});
});
