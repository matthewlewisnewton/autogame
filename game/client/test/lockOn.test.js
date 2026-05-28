import { describe, it, expect, beforeEach } from 'vitest';
import {
	findClosestTargetableEnemy,
	findEnemyById,
	getDirectionToTarget,
	cameraYawBehindFacing,
	cameraYawBehindTarget,
	cameraYawFromToTarget,
	targetRelativeDirection,
	handleLockOnPress,
	updateLockOn,
	shortestAngleDelta,
	unwrapAngle,
	normalizeAngle,
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

describe('unwrapAngle', () => {
	it('keeps continuity when raw angle jumps across pi', () => {
		const first = Math.PI - 0.05;
		const second = -Math.PI + 0.05;
		const unwrapped = unwrapAngle(first, second);
		expect(unwrapped).toBeCloseTo(first + 0.1, 5);
	});
});

describe('updateLockOn camera tracking', () => {
	beforeEach(() => clearLockOn());

	it('does not spin when bearing crosses the atan2 branch cut', () => {
		handleLockOnPress(
			[{ id: 'a', x: -3, z: 0.001, hp: 50 }],
			0,
			0,
			'unlock',
			0,
		);
		let yaw = 0;
		const first = updateLockOn(
			[{ id: 'a', x: -3, z: 0.001, hp: 50 }],
			0,
			0,
			1 / 60,
			yaw,
		);
		yaw = first.cameraYaw;
		for (let i = 0; i < 30; i++) {
			const z = i < 15 ? 0.001 : -0.001;
			const state = updateLockOn(
				[{ id: 'a', x: -3, z, hp: 50 }],
				0,
				0,
				1 / 60,
				yaw,
			);
			expect(state.locked).toBe(true);
			const step = Math.abs(shortestAngleDelta(yaw, state.cameraYaw));
			expect(step).toBeLessThan(0.25);
			yaw = state.cameraYaw;
		}
	});

	it('holds stable bearing when hugging the target', () => {
		handleLockOnPress(
			[{ id: 'a', x: 3, z: 0, hp: 50 }],
			0,
			0,
			'unlock',
			0,
		);
		updateLockOn(
			[{ id: 'a', x: 3, z: 0, hp: 50 }],
			0,
			0,
			1 / 60,
			0,
		);
		const close = updateLockOn(
			[{ id: 'a', x: 0.2, z: 0.05, hp: 50 }],
			0,
			0,
			1 / 60,
			0,
		);
		expect(close.locked).toBe(true);
		expect(Math.hypot(close.toTarget.x, close.toTarget.z)).toBeCloseTo(1, 5);
		expect(Math.hypot(
			close.toTarget.x - Math.cos(0),
			close.toTarget.z - Math.sin(0),
		)).toBeLessThan(0.01);
	});

	it('limits per-frame yaw change during a tight orbit', () => {
		handleLockOnPress(
			[{ id: 'a', x: 2, z: 0, hp: 50 }],
			0,
			0,
			'unlock',
			0,
		);
		let px = 2;
		let pz = 0;
		let yaw = 0;
		const first = updateLockOn(
			[{ id: 'a', x: 0, z: 0, hp: 50 }],
			2,
			0,
			1 / 60,
			yaw,
		);
		yaw = first.cameraYaw;
		let maxStep = 0;
		for (let i = 1; i < 120; i++) {
			const angle = (i / 120) * Math.PI * 2;
			px = Math.cos(angle) * 1.2;
			pz = Math.sin(angle) * 1.2;
			const state = updateLockOn(
				[{ id: 'a', x: 0, z: 0, hp: 50 }],
				px,
				pz,
				1 / 60,
				yaw,
			);
			maxStep = Math.max(maxStep, Math.abs(shortestAngleDelta(yaw, state.cameraYaw)));
			yaw = state.cameraYaw;
		}
		expect(maxStep).toBeLessThan(0.2);
	});
});

describe('cameraYawBehindTarget', () => {
	it('aligns player and camera toward the enemy', () => {
		const aim = cameraYawBehindTarget(0, 0, 0, 5);
		expect(aim.playerRotation).toBeCloseTo(Math.atan2(1, 0), 5);
		expect(aim.cameraYaw).toBeCloseTo(cameraYawFromToTarget(aim.toTarget), 5);
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
