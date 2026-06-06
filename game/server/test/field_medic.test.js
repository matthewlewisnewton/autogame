import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	resetGameState,
	gameState,
	spawnEnemy,
	updateEnemies,
	ENEMY_DEFS,
} from '../index.js';

function setupPlayingRun() {
	gameState.run = { status: 'playing' };
}

describe('field_medic AI', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(2_000_000);
		resetGameState();
		setupPlayingRun();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('retreats from an approaching player within fleeRadius', () => {
		const medic = spawnEnemy(0, 0, 'field_medic');
		medic.wanderTarget = { x: medic.x, z: medic.z };
		gameState.players.p1 = {
			id: 'p1',
			x: 2,
			z: 0,
			hp: 100,
			dead: false,
		};

		const startX = medic.x;
		updateEnemies();

		expect(medic.state).toBe('fleeing');
		expect(medic.x).toBeLessThan(startX);
	});

	it('heals the lowest-HP wounded ally after healCooldownMs', () => {
		const medic = spawnEnemy(0, 0, 'field_medic');
		const grunt = spawnEnemy(3, 0, 'grunt');
		grunt.hp = Math.floor(grunt.maxHp * 0.3);
		medic.lastHealAt = Date.now() - ENEMY_DEFS.field_medic.healCooldownMs - 100;
		medic.wanderTarget = { x: medic.x, z: medic.z };
		grunt.wanderTarget = { x: grunt.x, z: grunt.z };

		const hpBefore = grunt.hp;
		updateEnemies();

		expect(grunt.hp).toBe(
			Math.min(grunt.maxHp, hpBefore + ENEMY_DEFS.field_medic.healAmount),
		);
		expect(medic.lastHealAt).toBe(Date.now());
		expect(gameState._pendingMedicHeals).toHaveLength(1);
		expect(gameState._pendingMedicHeals[0]).toMatchObject({
			medicId: medic.id,
			targetId: grunt.id,
		});
	});

	it('fires an energy bead that damages a player within beadRange', () => {
		const medic = spawnEnemy(0, 0, 'field_medic');
		medic.lastBeadAt = Date.now() - ENEMY_DEFS.field_medic.beadCooldownMs - 100;
		medic.wanderTarget = { x: medic.x, z: medic.z };
		gameState.players.p1 = {
			id: 'p1',
			x: 5,
			z: 0,
			hp: 100,
			dead: false,
		};

		updateEnemies();

		expect(gameState.players.p1.hp).toBe(100 - ENEMY_DEFS.field_medic.attackDamage);
		expect(medic.lastBeadAt).toBe(Date.now());
		expect(gameState._pendingMedicBeads).toHaveLength(1);
	});

	it('does not close distance to a player beyond beadRange (no chase)', () => {
		const medic = spawnEnemy(0, 0, 'field_medic');
		medic.wanderTarget = { x: -10, z: 0 };
		gameState.players.p1 = {
			id: 'p1',
			x: 12,
			z: 0,
			hp: 100,
			dead: false,
		};

		const distBefore = Math.hypot(
			gameState.players.p1.x - medic.x,
			gameState.players.p1.z - medic.z,
		);

		for (let i = 0; i < 30; i++) {
			updateEnemies();
			expect(medic.state).not.toBe('chasing');
			expect(medic.attackState).not.toBe('windup');
		}

		const distAfter = Math.hypot(
			gameState.players.p1.x - medic.x,
			gameState.players.p1.z - medic.z,
		);

		expect(distAfter).toBeGreaterThanOrEqual(distBefore - 0.01);
	});
});
