import { describe, it, expect, beforeEach } from 'vitest';
import {
	gameState,
	updateAreaEffects,
	removeDeadEnemies,
	spawnFireTrailEffect,
	spawnDragonsBreathEffect,
	applyFreezeInRadius,
	spawnVolatileExplosion,
} from '../index.js';

// With no layout in gameState, the floor fallback resolves to DEFAULT_FLOOR_Y.
const FLOOR_Y = 0.5;

function resetState() {
	gameState.players = {};
	gameState.enemies = [];
	gameState.minions = [];
	gameState.loot = [];
	gameState.areaEffects = [];
	gameState.enchantments = [];
	gameState.layout = null;
	gameState.gamePhase = 'playing';
	gameState._pendingVolatileExplosions = [];
	// No run objective so recordEnemyDefeated is a no-op in this harness.
	gameState.run = null;
}

function addPlayer(id) {
	gameState.players[id] = {
		x: 0, y: FLOOR_Y, z: 0, rotation: 0, hp: 100, dead: false,
		xp: 0, level: 1, pendingSummons: new Set(), deck: [],
	};
	return gameState.players[id];
}

function addEnemy(id, overrides = {}) {
	const enemy = { id, type: 'grunt', x: 0, z: 0, hp: 40, maxHp: 30, ...overrides };
	gameState.enemies.push(enemy);
	return enemy;
}

// Spawners stamp lastTickAt = now; rewind it so the next updateAreaEffects
// call resolves a damage tick immediately.
function forceTickDue(effect) {
	effect.lastTickAt = Date.now() - (effect.intervalMs + 1000);
}

// killXpForEnemy floor for a 30-maxHp grunt: max(5, round(30 / 6)) = 5.
const GRUNT_KILL_XP = 5;

describe('kill XP attribution for indirect damage paths', () => {
	beforeEach(resetState);

	it('credits fire_trail DoT tick kills to the effect owner', () => {
		const p1 = addPlayer('p1');
		addEnemy('e1', { x: 2, z: 0, hp: 5 });
		spawnFireTrailEffect(0, 0, 1, 0, {
			attackRange: 5,
			attackConeAngle: Math.PI / 2,
			trailDamagePerTick: 10,
			dotTicks: 1,
		}, 'p1');
		forceTickDue(gameState.areaEffects[0]);

		updateAreaEffects();

		expect(gameState.enemies).toHaveLength(0);
		expect(p1.xp).toBe(GRUNT_KILL_XP);
	});

	it('credits dragons_breath DoT tick kills to the effect owner', () => {
		const p1 = addPlayer('p1');
		addEnemy('e1', { x: 2, z: 0, hp: 5 });
		spawnDragonsBreathEffect(0, 0, 1, 0, {
			attackRange: 7,
			attackConeAngle: Math.PI / 3,
			damage: 10,
			dotTicks: 1,
		}, 'p1');
		forceTickDue(gameState.areaEffects[0]);

		updateAreaEffects();

		expect(gameState.enemies).toHaveLength(0);
		expect(p1.xp).toBe(GRUNT_KILL_XP);
	});

	it('credits frost-nova family kills to the caster via options.attackerId', () => {
		const p1 = addPlayer('p1');
		const enemy = addEnemy('e1', { x: 1, z: 0, hp: 5 });

		applyFreezeInRadius(0, null, 0, 6, 2000, 10, 0, { attackerId: 'p1' });

		expect(enemy.lastDamagedBy).toBe('p1');
		removeDeadEnemies();
		expect(gameState.enemies).toHaveLength(0);
		expect(p1.xp).toBe(GRUNT_KILL_XP);
	});

	it('does not attribute freeze kills when no attackerId is given (legacy callers)', () => {
		const enemy = addEnemy('e1', { x: 1, z: 0, hp: 5 });
		applyFreezeInRadius(0, null, 0, 6, 2000, 10);
		expect(enemy.lastDamagedBy).toBeUndefined();
		expect(() => removeDeadEnemies()).not.toThrow();
	});

	it('credits volatile-explosion chain kills to the player who popped the volatile', () => {
		const p1 = addPlayer('p1');
		// Volatile enemy dies to p1; its blast finishes the adjacent grunt.
		addEnemy('v1', { hp: 0, variant: 'volatile', lastDamagedBy: 'p1' });
		addEnemy('e2', { x: 1, z: 0, hp: 5 });

		removeDeadEnemies();
		expect(p1.xp).toBe(GRUNT_KILL_XP); // volatile kill itself
		expect(gameState.areaEffects).toHaveLength(1);
		expect(gameState.areaEffects[0].ownerId).toBe('p1');

		updateAreaEffects();

		expect(gameState.enemies).toHaveLength(0);
		expect(p1.xp).toBe(GRUNT_KILL_XP * 2); // + chained kill
	});

	it('volatile explosion with no attributable popper awards no chain XP and does not throw', () => {
		const p1 = addPlayer('p1');
		addEnemy('v1', { hp: 0, variant: 'volatile' });
		addEnemy('e2', { x: 1, z: 0, hp: 5 });

		removeDeadEnemies();
		updateAreaEffects();

		expect(gameState.enemies).toHaveLength(0);
		expect(p1.xp).toBe(0);
	});
});
