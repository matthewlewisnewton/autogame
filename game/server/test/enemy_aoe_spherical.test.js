import { describe, it, expect, beforeEach } from 'vitest';
import {
	createGameState,
	gameState,
	resetGameState,
	spawnEnemy,
	isEntityInEnemyAttack,
	isPlayerInEnemyAttack,
	healFieldMedicAlly,
	ENEMY_DEFS,
} from '../index.js';

// With no layout in gameState, entities without an explicit `y` resolve to
// the DEFAULT_FLOOR_Y fallback (see getEntityWorldY).
const FLOOR_Y = 0.5;

function resetState() {
	Object.assign(gameState, createGameState());
}

function makePlayer(overrides = {}) {
	return { id: 'p1', x: 0, y: FLOOR_Y, z: 0, hp: 100, dead: false, ...overrides };
}

describe('isEntityInEnemyAttack — radial style is a pure 3D sphere', () => {
	beforeEach(resetState);

	// Room-guardian shockwave stats (annex_overseer): radial, attackRange 3.5.
	function makeRadialEnemy(overrides = {}) {
		return {
			id: 'e-radial',
			type: 'annex_overseer',
			x: 0,
			y: FLOOR_Y,
			z: 0,
			attackStyle: 'radial',
			attackRange: 4,
			...overrides,
		};
	}

	it('misses a target XZ-inside attackRange but 3D-outside (ledge above)', () => {
		const enemy = makeRadialEnemy();
		// XZ distance 3 < 4, but 3D distance hypot(3, 4) = 5 > 4.
		const target = makePlayer({ x: 3, z: 0, y: FLOOR_Y + 4 });
		expect(isEntityInEnemyAttack(enemy, target)).toBe(false);
	});

	it('hits a target at moderate height whose 3D distance is within range', () => {
		const enemy = makeRadialEnemy();
		// 3D distance hypot(2, 2) ≈ 2.83 < 4.
		const target = makePlayer({ x: 2, z: 0, y: FLOOR_Y + 2 });
		expect(isEntityInEnemyAttack(enemy, target)).toBe(true);
	});

	it('hits a target directly overhead inside the sphere — no angle gate', () => {
		const enemy = makeRadialEnemy();
		const target = makePlayer({ x: 0, z: 0, y: FLOOR_Y + 3.5 });
		expect(isEntityInEnemyAttack(enemy, target)).toBe(true);
	});

	it('still hits a grounded target within range (dy = 0 keeps 2D behavior)', () => {
		const enemy = makeRadialEnemy();
		const target = makePlayer({ x: 3, z: 0 });
		expect(isEntityInEnemyAttack(enemy, target)).toBe(true);
	});

	it('isPlayerInEnemyAttack inherits the spherical range gate', () => {
		const enemy = makeRadialEnemy();
		const ledged = makePlayer({ x: 3, z: 0, y: FLOOR_Y + 4 });
		const elevated = makePlayer({ x: 2, z: 0, y: FLOOR_Y + 2 });
		expect(isPlayerInEnemyAttack(enemy, ledged)).toBe(false);
		expect(isPlayerInEnemyAttack(enemy, elevated)).toBe(true);
	});
});

describe('isEntityInEnemyAttack — cone style uses 3D range and 3D dot product', () => {
	beforeEach(resetState);

	// Flat forward wind-up (+X), 90° cone, range 5 — vault-warden-like stats.
	function makeConeEnemy(overrides = {}) {
		return {
			id: 'e-cone',
			type: 'miniboss',
			x: 0,
			y: FLOOR_Y,
			z: 0,
			attackStyle: 'cone',
			attackConeAngle: Math.PI / 2,
			attackRange: 5,
			windupDirX: 1,
			windupDirY: 0,
			windupDirZ: 0,
			...overrides,
		};
	}

	it('hits a grounded target straight ahead within range', () => {
		const enemy = makeConeEnemy();
		const target = makePlayer({ x: 4, z: 0 });
		expect(isEntityInEnemyAttack(enemy, target)).toBe(true);
	});

	it('misses a target XZ-inside range whose 3D distance exceeds it', () => {
		const enemy = makeConeEnemy();
		// XZ distance 4 < 5, but 3D distance hypot(4, 4) ≈ 5.66 > 5.
		const target = makePlayer({ x: 4, z: 0, y: FLOOR_Y + 4 });
		expect(isEntityInEnemyAttack(enemy, target)).toBe(false);
	});

	it('flat wind-up rejects an in-range target steeply above the cone axis', () => {
		const enemy = makeConeEnemy();
		// 3D distance hypot(1.5, 3) ≈ 3.35 ≤ 5, but the 3D dot with the flat
		// axis is 1.5 / 3.35 ≈ 0.45 < cos(45°) ≈ 0.71 — outside the cone.
		const target = makePlayer({ x: 1.5, z: 0, y: FLOOR_Y + 3 });
		expect(isEntityInEnemyAttack(enemy, target)).toBe(false);
	});

	it('a tilted wind-up direction (windupDirY) hits that same elevated target', () => {
		// Aim straight at (1.5, +3, 0): normalized (0.447, 0.894, 0).
		const len = Math.hypot(1.5, 3);
		const enemy = makeConeEnemy({
			windupDirX: 1.5 / len,
			windupDirY: 3 / len,
			windupDirZ: 0,
		});
		const target = makePlayer({ x: 1.5, z: 0, y: FLOOR_Y + 3 });
		expect(isEntityInEnemyAttack(enemy, target)).toBe(true);
	});
});

describe('healFieldMedicAlly — heal radius is a 3D sphere', () => {
	beforeEach(() => {
		resetGameState();
		gameState.run = { status: 'playing' };
	});

	it('heals an elevated wounded ally inside the 3D sphere', () => {
		const medic = spawnEnemy(0, 0, 'field_medic');
		medic.y = FLOOR_Y;
		const grunt = spawnEnemy(3, 0, 'grunt');
		// 3D distance hypot(3, 4) = 5 ≤ healRadius 6.
		grunt.y = FLOOR_Y + 4;
		grunt.hp = Math.floor(grunt.maxHp * 0.3);
		const hpBefore = grunt.hp;

		expect(healFieldMedicAlly(medic, Date.now())).toBe(true);
		expect(grunt.hp).toBe(
			Math.min(grunt.maxHp, hpBefore + ENEMY_DEFS.field_medic.healAmount),
		);
		expect(gameState._pendingMedicHeals).toHaveLength(1);
		expect(gameState._pendingMedicHeals[0]).toMatchObject({
			medicId: medic.id,
			targetId: grunt.id,
		});
	});

	it('does not heal an XZ-close ally whose 3D distance exceeds healRadius', () => {
		const medic = spawnEnemy(0, 0, 'field_medic');
		medic.y = FLOOR_Y;
		const grunt = spawnEnemy(2, 0, 'grunt');
		// XZ distance 2 ≤ 6, but 3D distance hypot(2, 6.5) ≈ 6.8 > 6.
		grunt.y = FLOOR_Y + 6.5;
		grunt.hp = Math.floor(grunt.maxHp * 0.3);
		const hpBefore = grunt.hp;

		expect(healFieldMedicAlly(medic, Date.now())).toBe(false);
		expect(grunt.hp).toBe(hpBefore);
		expect(gameState._pendingMedicHeals ?? []).toHaveLength(0);
	});

	it('skips a more-wounded ally outside the sphere in favor of one inside', () => {
		const medic = spawnEnemy(0, 0, 'field_medic');
		medic.y = FLOOR_Y;
		const outOfSphere = spawnEnemy(1, 0, 'grunt');
		// XZ-closest and lowest HP, but 3D distance hypot(1, 7) ≈ 7.07 > 6.
		outOfSphere.y = FLOOR_Y + 7;
		outOfSphere.hp = Math.floor(outOfSphere.maxHp * 0.1);
		const inSphere = spawnEnemy(3, 0, 'grunt');
		// 3D distance hypot(3, 4) = 5 ≤ 6.
		inSphere.y = FLOOR_Y + 4;
		inSphere.hp = Math.floor(inSphere.maxHp * 0.5);
		const outHpBefore = outOfSphere.hp;

		expect(healFieldMedicAlly(medic, Date.now())).toBe(true);
		expect(outOfSphere.hp).toBe(outHpBefore);
		expect(gameState._pendingMedicHeals[0].targetId).toBe(inSphere.id);
	});
});
