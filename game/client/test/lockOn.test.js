import { describe, it, expect, beforeEach } from 'vitest';
import {
	findClosestTargetableEnemy,
	filterLockOnEnemies,
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
	clearAllLockOnState,
	clearLockOnCameraRelease,
	isLockOnActive,
	isLockOnCameraReleasing,
	updateLockOnCameraRelease,
	getLockedEnemyId,
	resolveLockOnLookAtY,
	LOCK_ON_LOOK_AT_BODY_OFFSET,
} from '../lockOn.js';
import { LOCK_ON_DEATH_RELEASE_DURATION, LOCK_ON_BREAK_RANGE } from '../config.js';
import { DEFAULT_FLOOR_Y } from '../../shared/floorSampling.esm.js';
import { getEntityWorldY } from '../entityWorldY.js';

const LAYOUT = null;
const PY = DEFAULT_FLOOR_Y;

const enemies = [
	{ id: 'a', x: 3, z: 0, hp: 50 },
	{ id: 'b', x: 0, z: 5, hp: 50 },
	{ id: 'c', x: 20, z: 0, hp: 0 },
];

describe('filterLockOnEnemies', () => {
	it('excludes the dormant stage boss from lock-on targets', () => {
		const pool = [
			{ id: 'boss', x: 2, z: 0, hp: 100 },
			{ id: 'add', x: 4, z: 0, hp: 10 },
		];
		const filtered = filterLockOnEnemies(pool, { phase: 'dormant', bossEnemyId: 'boss' });
		expect(filtered.map((e) => e.id)).toEqual(['add']);
	});

	it('keeps the boss targetable once the encounter is active', () => {
		const pool = [
			{ id: 'boss', x: 2, z: 0, hp: 100 },
			{ id: 'add', x: 4, z: 0, hp: 10 },
		];
		const filtered = filterLockOnEnemies(pool, { phase: 'active', bossEnemyId: 'boss' });
		expect(filtered.map((e) => e.id)).toEqual(['boss', 'add']);
	});
});

describe('findClosestTargetableEnemy', () => {
	it('returns nearest living enemy within range', () => {
		const result = findClosestTargetableEnemy(enemies, 0, PY, 0, 8, LAYOUT);
		expect(result.enemy.id).toBe('a');
		expect(result.dist).toBe(3);
	});

	it('skips dead enemies', () => {
		const onlyDead = [{ id: 'c', x: 1, z: 0, hp: 0 }];
		expect(findClosestTargetableEnemy(onlyDead, 0, PY, 0, 8, LAYOUT)).toBeNull();
	});

	it('excludes a specific enemy id', () => {
		const result = findClosestTargetableEnemy(enemies, 0, PY, 0, 8, LAYOUT, 'a');
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
		const left = targetRelativeDirection(-1, 0, toTarget);
		expect(left.x).toBeCloseTo(0, 5);
		expect(left.z).toBeCloseTo(-1, 5);
		const right = targetRelativeDirection(1, 0, toTarget);
		expect(right.x).toBeCloseTo(0, 5);
		expect(right.z).toBeCloseTo(1, 5);
	});
});

describe('handleLockOnPress', () => {
	beforeEach(() => clearAllLockOnState());

	it('locks onto the nearest enemy', () => {
		const result = handleLockOnPress(enemies, 0, PY, 0, 'unlock', 0, LAYOUT);
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
		const result = handleLockOnPress(farEnemies, 0, PY, 0, 'unlock', Math.PI / 2, LAYOUT);
		expect(result.action).toBe('snapBehind');
		expect(result.cameraYaw).toBeCloseTo(cameraYawBehindFacing(Math.PI / 2), 5);
		expect(isLockOnActive()).toBe(false);
	});

	it('unlocks on repeat press in unlock mode', () => {
		handleLockOnPress(enemies, 0, PY, 0, 'unlock', 0, LAYOUT);
		const result = handleLockOnPress(enemies, 0, PY, 0, 'unlock', 0, LAYOUT);
		expect(result.action).toBe('unlocked');
		expect(isLockOnActive()).toBe(false);
	});

	it('cycles to the next closest enemy', () => {
		handleLockOnPress(enemies, 0, PY, 0, 'unlock', 0, LAYOUT);
		const result = handleLockOnPress(enemies, 0, PY, 0, 'cycle', 0, LAYOUT);
		expect(result.action).toBe('locked');
		expect(result.enemy.id).toBe('b');
	});

	it('reacquires the nearest enemy while locked', () => {
		handleLockOnPress(enemies, 0, PY, 0, 'unlock', 0, LAYOUT);
		const moved = [
			{ id: 'a', x: 7, z: 0, hp: 50 },
			{ id: 'b', x: 0, z: 2, hp: 50 },
		];
		const result = handleLockOnPress(moved, 0, PY, 0, 'reacquire', 0, LAYOUT);
		expect(result.action).toBe('locked');
		expect(result.enemy.id).toBe('b');
	});
});

describe('updateLockOn', () => {
	beforeEach(() => clearAllLockOnState());

	it('tracks target facing and camera yaw while locked', () => {
		handleLockOnPress(enemies, 0, PY, 0, 'unlock', 0, LAYOUT);
		const state = updateLockOn(enemies, 0, PY, 0, 0.1, 0, 0, LAYOUT);
		expect(state.locked).toBe(true);
		expect(state.playerRotation).toBeCloseTo(0, 5);
		expect(state.toTarget.x).toBeCloseTo(1, 5);
	});

	it('auto-unlocks when target dies and starts a camera release', () => {
		handleLockOnPress(enemies, 0, PY, 0, 'unlock', 0, LAYOUT);
		updateLockOn(enemies, 0, PY, 0, 0.1, 0, 0, LAYOUT);
		const dead = [{ id: 'a', x: 3, z: 0, hp: 0 }];
		const state = updateLockOn(dead, 0, PY, 0, 0.1, 0, 0, LAYOUT);
		expect(state.locked).toBe(false);
		expect(state.releasing).toBe(true);
		expect(isLockOnCameraReleasing()).toBe(true);
	});

	it('eases camera out after target death', () => {
		handleLockOnPress(enemies, 0, PY, 0, 'unlock', 0, LAYOUT);
		updateLockOn(enemies, 0, PY, 0, 0.1, 0, 0, LAYOUT);
		updateLockOn([{ id: 'a', x: 3, z: 0, hp: 0 }], 0, PY, 0, 0.1, 0, 0, LAYOUT);
		expect(isLockOnCameraReleasing()).toBe(true);

		const mid = updateLockOnCameraRelease(
			LOCK_ON_DEATH_RELEASE_DURATION * 0.5,
			0,
			PY,
			0,
		);
		expect(mid).not.toBeNull();
		expect(mid.done).toBe(false);
		expect(mid.lookAtX).toBeCloseTo(0.75, 2);
		expect(mid.lookAtY).toBeCloseTo(PY + LOCK_ON_LOOK_AT_BODY_OFFSET, 5);
		expect(Math.abs(shortestAngleDelta(0, mid.cameraYaw))).toBeGreaterThan(0.01);

		const end = updateLockOnCameraRelease(
			LOCK_ON_DEATH_RELEASE_DURATION * 0.5,
			0,
			PY,
			0,
		);
		expect(end?.done).toBe(true);
		expect(isLockOnCameraReleasing()).toBe(false);
	});

	it('eases post-death look-at Y from elevated enemy world Y toward the player', () => {
		const elevated = [{ id: 'a', x: 3, z: 0, y: PY + 4, hp: 50 }];
		handleLockOnPress(elevated, 0, PY, 0, 'unlock', 0, LAYOUT);
		updateLockOn(elevated, 0, PY, 0, 0.1, 0, 0, LAYOUT);
		updateLockOn([{ id: 'a', x: 3, z: 0, y: PY + 4, hp: 0 }], 0, PY, 0, 0.1, 0, 0, LAYOUT);

		const startY = resolveLockOnLookAtY({ y: PY + 4 }, LAYOUT);
		const first = updateLockOnCameraRelease(0, 0, PY, 0);
		expect(first?.lookAtY).toBeCloseTo(startY, 5);

		const mid = updateLockOnCameraRelease(
			LOCK_ON_DEATH_RELEASE_DURATION * 0.5,
			0,
			PY,
			0,
		);
		expect(mid?.lookAtY).toBeGreaterThan(PY + LOCK_ON_LOOK_AT_BODY_OFFSET);
		expect(mid?.lookAtY).toBeLessThan(startY);
	});

	it('auto-unlocks when target exceeds break range', () => {
		handleLockOnPress(enemies, 0, PY, 0, 'unlock', 0, LAYOUT);
		const far = [{ id: 'a', x: 15, z: 0, hp: 50 }];
		const state = updateLockOn(far, 0, PY, 0, 0.1, 0, 0, LAYOUT);
		expect(state.locked).toBe(false);
	});

	it('keeps live movement bearing when close-range camera aim is frozen', () => {
		handleLockOnPress(
			[{ id: 'a', x: 3, z: 0, hp: 50 }],
			0,
			PY,
			0,
			'unlock',
			0,
			LAYOUT,
		);
		updateLockOn(
			[{ id: 'a', x: 3, z: 0, hp: 50 }],
			0,
			PY,
			0,
			1 / 60,
			0,
			0,
			LAYOUT,
		);
		const close = updateLockOn(
			[{ id: 'a', x: 0.2, z: 0.05, hp: 50 }],
			0,
			PY,
			0,
			1 / 60,
			0,
			0,
			LAYOUT,
		);
		expect(close.locked).toBe(true);
		expect(Math.hypot(close.liveToTarget.x, close.liveToTarget.z)).toBeCloseTo(1, 5);
		expect(close.liveToTarget.x).toBeCloseTo(0.97, 2);
		expect(close.liveToTarget.z).toBeCloseTo(0.24, 2);
		const forward = targetRelativeDirection(0, 1, close.liveToTarget);
		expect(forward.x).toBeGreaterThan(0.9);
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
	beforeEach(() => clearAllLockOnState());

	it('does not spin when bearing crosses the atan2 branch cut', () => {
		handleLockOnPress(
			[{ id: 'a', x: -3, z: 0.001, hp: 50 }],
			0,
			PY,
			0,
			'unlock',
			0,
			LAYOUT,
		);
		let yaw = 0;
		let rot = 0;
		const first = updateLockOn(
			[{ id: 'a', x: -3, z: 0.001, hp: 50 }],
			0,
			PY,
			0,
			1 / 60,
			yaw,
			rot,
			LAYOUT,
		);
		yaw = first.cameraYaw;
		rot = first.playerRotation;
		for (let i = 0; i < 30; i++) {
			const z = i < 15 ? 0.001 : -0.001;
			const state = updateLockOn(
				[{ id: 'a', x: -3, z, hp: 50 }],
				0,
				PY,
				0,
				1 / 60,
				yaw,
				rot,
				LAYOUT,
			);
			expect(state.locked).toBe(true);
			const step = Math.abs(shortestAngleDelta(yaw, state.cameraYaw));
			expect(step).toBeLessThan(0.25);
			yaw = state.cameraYaw;
			rot = state.playerRotation;
		}
	});

	it('tracks live player bearing when hugging the target', () => {
		handleLockOnPress(
			[{ id: 'a', x: 3, z: 0, hp: 50 }],
			0,
			PY,
			0,
			'unlock',
			0,
			LAYOUT,
		);
		updateLockOn(
			[{ id: 'a', x: 3, z: 0, hp: 50 }],
			0,
			PY,
			0,
			1 / 60,
			0,
			0,
			LAYOUT,
		);
		const close = updateLockOn(
			[{ id: 'a', x: 0.2, z: 0.05, hp: 50 }],
			0,
			PY,
			0,
			1 / 60,
			0,
			0,
			LAYOUT,
		);
		expect(close.locked).toBe(true);
		expect(close.toTarget.x).toBeCloseTo(close.liveToTarget.x, 5);
		expect(close.toTarget.z).toBeCloseTo(close.liveToTarget.z, 5);
		const desiredFacing = Math.atan2(close.liveToTarget.z, close.liveToTarget.x);
		expect(Math.abs(shortestAngleDelta(close.playerRotation, desiredFacing))).toBeLessThan(0.15);
	});

	it('tracks camera yaw from live bearing while hugging the target', () => {
		handleLockOnPress(
			[{ id: 'a', x: 3, z: 0, hp: 50 }],
			0,
			PY,
			0,
			'unlock',
			0,
			LAYOUT,
		);
		updateLockOn(
			[{ id: 'a', x: 3, z: 0, hp: 50 }],
			0,
			PY,
			0,
			1 / 60,
			0,
			0,
			LAYOUT,
		);
		const hug = updateLockOn(
			[{ id: 'a', x: 0.2, z: 0.05, hp: 50 }],
			0,
			PY,
			0,
			1 / 60,
			0,
			0,
			LAYOUT,
		);
		const firstOrbit = updateLockOn(
			[{ id: 'a', x: 0, z: 0.2, hp: 50 }],
			0.2,
			PY,
			0,
			1 / 60,
			hug.cameraYaw,
			hug.playerRotation,
			LAYOUT,
		);
		expect(firstOrbit.locked).toBe(true);
		expect(Math.abs(shortestAngleDelta(hug.cameraYaw, firstOrbit.cameraYaw))).toBeGreaterThan(0.01);

		let yaw = hug.cameraYaw;
		let rot = hug.playerRotation;
		const targetYaw = cameraYawFromToTarget(firstOrbit.liveToTarget);
		for (let i = 0; i < 60; i++) {
			const state = updateLockOn(
				[{ id: 'a', x: 0, z: 0.2, hp: 50 }],
				0.2,
				PY,
				0,
				1 / 60,
				yaw,
				rot,
				LAYOUT,
			);
			yaw = state.cameraYaw;
			rot = state.playerRotation;
		}
		expect(Math.abs(shortestAngleDelta(yaw, targetYaw))).toBeLessThan(0.15);
	});

	it('limits per-frame yaw change during a tight orbit', () => {
		handleLockOnPress(
			[{ id: 'a', x: 2, z: 0, hp: 50 }],
			0,
			PY,
			0,
			'unlock',
			0,
			LAYOUT,
		);
		let px = 2;
		let pz = 0;
		let yaw = 0;
		let rot = 0;
		const first = updateLockOn(
			[{ id: 'a', x: 0, z: 0, hp: 50 }],
			2,
			PY,
			0,
			1 / 60,
			yaw,
			rot,
			LAYOUT,
		);
		yaw = first.cameraYaw;
		rot = first.playerRotation;
		let maxStep = 0;
		let maxFacingStep = 0;
		for (let i = 1; i < 120; i++) {
			const angle = (i / 120) * Math.PI * 2;
			px = Math.cos(angle) * 1.2;
			pz = Math.sin(angle) * 1.2;
			const state = updateLockOn(
				[{ id: 'a', x: 0, z: 0, hp: 50 }],
				px,
				PY,
				pz,
				1 / 60,
				yaw,
				rot,
				LAYOUT,
			);
			maxStep = Math.max(maxStep, Math.abs(shortestAngleDelta(yaw, state.cameraYaw)));
			maxFacingStep = Math.max(
				maxFacingStep,
				Math.abs(shortestAngleDelta(rot, state.playerRotation)),
			);
			const desiredFacing = Math.atan2(state.liveToTarget.z, state.liveToTarget.x);
			expect(Math.abs(shortestAngleDelta(state.playerRotation, desiredFacing))).toBeLessThan(0.35);
			yaw = state.cameraYaw;
			rot = state.playerRotation;
		}
		expect(maxStep).toBeLessThan(0.2);
		expect(maxFacingStep).toBeLessThan(0.2);
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

describe('3D lock-on target selection', () => {
	beforeEach(() => clearAllLockOnState());

	it('prefers an elevated enemy with explicit y by 3D distance', () => {
		const pool = [
			{ id: 'flat', x: 6, z: 0, hp: 50 },
			{ id: 'raised', x: 3, z: 0, y: PY + 2, hp: 50 },
		];
		const result = findClosestTargetableEnemy(pool, 0, PY, 0, 8, LAYOUT);
		expect(result.enemy.id).toBe('raised');
	});

	it('prefers a flying enemy with altitude over a high ground enemy at the same x,z', () => {
		const stackX = 5;
		const pool = [
			{ id: 'ground', x: stackX, z: 0, y: PY + 10, hp: 50 },
			{ id: 'fly', x: stackX, z: 0, flying: true, altitude: 1, hp: 50 },
		];
		const result = handleLockOnPress(pool, 0, PY, 0, 'unlock', 0, LAYOUT);
		expect(result.enemy.id).toBe('fly');
		expect(getEntityWorldY(pool[1], LAYOUT)).toBeCloseTo(PY + 1, 5);
	});

	it('breaks lock when 3D distance exceeds break range despite XZ still inside', () => {
		handleLockOnPress(
			[{ id: 'a', x: 6, z: 0, y: PY, hp: 50 }],
			0,
			PY,
			0,
			'unlock',
			0,
			LAYOUT,
		);
		const elevated = [{ id: 'a', x: 6, z: 0, y: PY + 12, hp: 50 }];
		expect(Math.hypot(6, 12)).toBeGreaterThan(LOCK_ON_BREAK_RANGE);
		const state = updateLockOn(elevated, 0, PY, 0, 0.1, 0, 0, LAYOUT);
		expect(state.locked).toBe(false);
	});

	it('cycles to the next closest target by 3D distance, skipping a farther elevated one', () => {
		const pool = [
			{ id: 'near', x: 4, z: 0, hp: 50 },
			{ id: 'high', x: 0, z: 4, y: PY + 6, hp: 50 },
		];
		handleLockOnPress(pool, 0, PY, 0, 'unlock', 0, LAYOUT);
		expect(getLockedEnemyId()).toBe('near');
		const cycled = handleLockOnPress(pool, 0, PY, 0, 'cycle', 0, LAYOUT);
		expect(cycled.enemy.id).toBe('high');
	});
});

describe('resolveLockOnLookAtY', () => {
	it('offsets grounded enemy world Y by the body-center constant', () => {
		const enemy = { x: 0, z: 0, y: PY + 2 };
		expect(resolveLockOnLookAtY(enemy, LAYOUT)).toBeCloseTo(PY + 2 + LOCK_ON_LOOK_AT_BODY_OFFSET, 5);
	});

	it('uses flying altitude for airborne lock-on look-at height', () => {
		const flying = { x: 0, z: 0, flying: true, altitude: 3 };
		expect(resolveLockOnLookAtY(flying, LAYOUT)).toBeCloseTo(
			getEntityWorldY(flying, LAYOUT) + LOCK_ON_LOOK_AT_BODY_OFFSET,
			5,
		);
	});
});

describe('findEnemyById', () => {
	it('returns null for dead enemies', () => {
		expect(findEnemyById(enemies, 'c')).toBeNull();
		expect(findEnemyById(enemies, 'a').id).toBe('a');
	});
});
