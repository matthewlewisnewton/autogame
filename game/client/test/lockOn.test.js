import { describe, it, expect, beforeEach } from 'vitest';
import {
	findClosestTargetableEnemy,
	findEnemyById,
	getDirectionToTarget,
	cameraYawBehindFacing,
	cameraYawBehindTarget,
	targetRelativeDirection,
	handleLockOnPress,
	updateLockOn,
	shortestAngleDelta,
	isLockOnActive,
	clearLockOn,
	getLockedEnemyId,
} from '../lockOn.js';

const enemies = [
	{ id: 'a', x: 3, z: 0, hp: 50 },
	{ id: 'b', x: 0, z: 5, hp: 50 },
	{ id: 'c', x: 20, z: 0, hp: 0 },
];

describe('findClosestTargetableEnemy', () => {
	it('returns nearest living enemy within range', () => {
		const result = findClosestTargetableEnemy(enemies, 0, 0, 8);
		expect(result.enemy.id).toBe('a');
		expect(result.dist).toBe(3);
	});

	it('skips dead enemies', () => {
		const onlyDead = [{ id: 'c', x: 1, z: 0, hp: 0 }];
		expect(findClosestTargetableEnemy(onlyDead, 0, 0, 8)).toBeNull();
	});

	it('excludes a specific enemy id', () => {
		const result = findClosestTargetableEnemy(enemies, 0, 0, 8, 'a');
		expect(result.enemy.id).toBe('b');
	});
});

describe('cameraYawBehindFacing', () => {
	it('places camera behind player facing -Z', () => {
		const rotation = Math.atan2(-1, 0);
		expect(cameraYawBehindFacing(rotation)).toBeCloseTo(0, 5);
	});

	it('places camera behind player facing +X', () => {
		const rotation = 0;
		expect(cameraYawBehindFacing(rotation)).toBeCloseTo(-Math.PI / 2, 5);
	});
});

describe('targetRelativeDirection', () => {
	it('maps forward input toward the target', () => {
		const toTarget = { x: 1, z: 0 };
		const dir = targetRelativeDirection(0, 1, toTarget);
		expect(dir.x).toBeCloseTo(1, 5);
		expect(dir.z).toBeCloseTo(0, 5);
	});

	it('maps strafe input perpendicular to the target', () => {
		const toTarget = { x: 1, z: 0 };
		const dir = targetRelativeDirection(-1, 0, toTarget);
		expect(dir.x).toBeCloseTo(0, 5);
		expect(dir.z).toBeCloseTo(1, 5);
	});
});

describe('handleLockOnPress', () => {
	beforeEach(() => clearLockOn());

	it('locks onto the nearest enemy', () => {
		const result = handleLockOnPress(enemies, 0, 0, 'unlock', 0);
		expect(result.action).toBe('locked');
		expect(result.enemy.id).toBe('a');
		expect(isLockOnActive()).toBe(true);
		expect(getLockedEnemyId()).toBe('a');
	});

	it('snaps camera behind facing when no target is in range', () => {
		const farEnemies = [
			{ id: 'a', x: 20, z: 0, hp: 50 },
			{ id: 'b', x: 0, z: 25, hp: 50 },
		];
		const result = handleLockOnPress(farEnemies, 0, 0, 'unlock', Math.PI / 2);
		expect(result.action).toBe('snapBehind');
		expect(result.cameraYaw).toBeCloseTo(cameraYawBehindFacing(Math.PI / 2), 5);
		expect(isLockOnActive()).toBe(false);
	});

	it('unlocks on repeat press in unlock mode', () => {
		handleLockOnPress(enemies, 0, 0, 'unlock', 0);
		const result = handleLockOnPress(enemies, 0, 0, 'unlock', 0);
		expect(result.action).toBe('unlocked');
		expect(isLockOnActive()).toBe(false);
	});

	it('cycles to the next closest enemy', () => {
		handleLockOnPress(enemies, 0, 0, 'unlock', 0);
		const result = handleLockOnPress(enemies, 0, 0, 'cycle', 0);
		expect(result.action).toBe('locked');
		expect(result.enemy.id).toBe('b');
	});

	it('reacquires the nearest enemy while locked', () => {
		handleLockOnPress(enemies, 0, 0, 'unlock', 0);
		const moved = [
			{ id: 'a', x: 7, z: 0, hp: 50 },
			{ id: 'b', x: 0, z: 2, hp: 50 },
		];
		const result = handleLockOnPress(moved, 0, 0, 'reacquire', 0);
		expect(result.action).toBe('locked');
		expect(result.enemy.id).toBe('b');
	});
});

describe('updateLockOn', () => {
	beforeEach(() => clearLockOn());

	it('tracks target facing and camera yaw while locked', () => {
		handleLockOnPress(enemies, 0, 0, 'unlock', 0);
		const state = updateLockOn(enemies, 0, 0, 0.1, 0);
		expect(state.locked).toBe(true);
		expect(state.playerRotation).toBeCloseTo(0, 5);
		expect(state.toTarget.x).toBeCloseTo(1, 5);
	});

	it('auto-unlocks when target dies', () => {
		handleLockOnPress(enemies, 0, 0, 'unlock', 0);
		const dead = [{ id: 'a', x: 3, z: 0, hp: 0 }];
		const state = updateLockOn(dead, 0, 0, 0.1, 0);
		expect(state.locked).toBe(false);
		expect(isLockOnActive()).toBe(false);
	});

	it('auto-unlocks when target exceeds break range', () => {
		handleLockOnPress(enemies, 0, 0, 'unlock', 0);
		const far = [{ id: 'a', x: 15, z: 0, hp: 50 }];
		const state = updateLockOn(far, 0, 0, 0.1, 0);
		expect(state.locked).toBe(false);
	});
});

describe('shortestAngleDelta', () => {
	it('wraps across pi boundary', () => {
		expect(shortestAngleDelta(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(0.2, 5);
	});
});

describe('cameraYawBehindTarget', () => {
	it('aligns player and camera toward the enemy', () => {
		const aim = cameraYawBehindTarget(0, 0, 0, 5);
		expect(aim.playerRotation).toBeCloseTo(Math.atan2(1, 0), 5);
		expect(aim.cameraYaw).toBeCloseTo(cameraYawBehindFacing(aim.playerRotation), 5);
	});
});

describe('getDirectionToTarget', () => {
	it('returns a unit vector toward the enemy', () => {
		const dir = getDirectionToTarget(0, 0, { x: 3, z: 4 });
		expect(dir.x).toBeCloseTo(0.6, 5);
		expect(dir.z).toBeCloseTo(0.8, 5);
	});
});

describe('findEnemyById', () => {
	it('returns null for dead enemies', () => {
		expect(findEnemyById(enemies, 'c')).toBeNull();
		expect(findEnemyById(enemies, 'a').id).toBe('a');
	});
});
