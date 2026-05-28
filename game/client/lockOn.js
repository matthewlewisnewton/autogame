// Z-targeting (lock-on) — camera and facing relative to nearest enemy.

import {
	LOCK_ON_RANGE,
	LOCK_ON_BREAK_RANGE,
	LOCK_ON_MIN_BEARING_DIST,
	LOCK_ON_MAX_YAW_SPEED,
	LOCK_ON_MAX_FACING_SPEED,
	LOCK_ON_DEATH_RELEASE_DURATION,
} from './config.js';

/** @typedef {'unlock' | 'cycle' | 'reacquire'} LockOnRepeatAction */

let lockedEnemyId = null;
/** Continuous camera yaw while locked — avoids π-boundary spins. */
let lockOnCameraYawUnwrapped = null;
/** Continuous player facing while locked — smooth strafe without snap/spin. */
let lockOnPlayerRotationUnwrapped = null;
/** Previous raw camera yaw sample for incremental tracking. */
let lastRawCameraYaw = null;
/** Last stable aim when the target is too close for reliable bearing. */
let lastStableAim = null;
/** Last known locked enemy position for death-release camera. */
let lastLockedEnemyPosition = null;
/** Last player rotation while locked — used when the target dies. */
let lastLockedPlayerRotation = 0;

/** @type {{
 *   elapsed: number,
 *   duration: number,
 *   lookAtX: number,
 *   lookAtZ: number,
 *   startCameraYaw: number,
 *   targetCameraYaw: number,
 * } | null} */
let lockOnCameraRelease = null;

/**
 * @param {number} angle
 * @returns {number}
 */
export function normalizeAngle(angle) {
	let a = angle;
	while (a > Math.PI) a -= Math.PI * 2;
	while (a < -Math.PI) a += Math.PI * 2;
	return a;
}

/**
 * @param {number} from
 * @param {number} to
 * @returns {number}
 */
export function shortestAngleDelta(from, to) {
	let delta = to - from;
	while (delta > Math.PI) delta -= Math.PI * 2;
	while (delta < -Math.PI) delta += Math.PI * 2;
	return delta;
}

/**
 * Keep a continuous angle by unwrapping each new sample against the previous value.
 * @param {number | null} previous
 * @param {number} next
 * @param {number} [fallback]
 * @returns {number}
 */
export function unwrapAngle(previous, next, fallback = 0) {
	if (previous == null) return next;
	return previous + shortestAngleDelta(previous, next);
}

/**
 * @param {Array<{ id: string, x: number, z: number, hp?: number }>} enemies
 * @param {number} playerX
 * @param {number} playerZ
 * @param {number} maxRange
 * @param {string | null} [excludeId]
 * @returns {{ enemy: object, dist: number } | null}
 */
export function findClosestTargetableEnemy(enemies, playerX, playerZ, maxRange, excludeId = null) {
	let nearest = null;
	let nearestDist = Infinity;
	for (const enemy of enemies || []) {
		if (!enemy || enemy.hp <= 0) continue;
		if (excludeId && enemy.id === excludeId) continue;
		const dist = Math.hypot(enemy.x - playerX, enemy.z - playerZ);
		if (dist > maxRange || dist >= nearestDist) continue;
		nearestDist = dist;
		nearest = enemy;
	}
	return nearest ? { enemy: nearest, dist: nearestDist } : null;
}

/**
 * @param {Array<{ id: string, x: number, z: number, hp?: number }>} enemies
 * @param {string | null} enemyId
 * @returns {object | null}
 */
export function findEnemyById(enemies, enemyId) {
	if (!enemyId) return null;
	const enemy = (enemies || []).find((e) => e && e.id === enemyId);
	return enemy && enemy.hp > 0 ? enemy : null;
}

/**
 * @param {number} playerX
 * @param {number} playerZ
 * @param {{ x: number, z: number }} enemy
 * @returns {{ x: number, z: number }}
 */
export function getDirectionToTarget(playerX, playerZ, enemy, fallback = null) {
	const dx = enemy.x - playerX;
	const dz = enemy.z - playerZ;
	const dist = Math.hypot(dx, dz);
	if (dist <= LOCK_ON_MIN_BEARING_DIST) {
		if (fallback) return fallback;
		if (lastStableAim?.toTarget) return lastStableAim.toTarget;
	}
	if (dist <= 1e-8) {
		return fallback ?? lastStableAim?.toTarget ?? { x: 1, z: 0 };
	}
	return { x: dx / dist, z: dz / dist };
}

/**
 * Camera yaw that places the orbit camera behind the player's facing angle.
 * @param {number} rotation - player rotation (atan2(z, x))
 * @returns {number}
 */
export function cameraYawBehindFacing(rotation) {
	return Math.atan2(-Math.cos(rotation), -Math.sin(rotation));
}

/**
 * Camera yaw with the orbit offset behind a world-space direction.
 * @param {{ x: number, z: number }} toTarget
 * @returns {number}
 */
export function cameraYawFromToTarget(toTarget) {
	return Math.atan2(-toTarget.x, -toTarget.z);
}

/**
 * Player rotation and camera yaw for facing a target.
 * @param {number} playerX
 * @param {number} playerZ
 * @param {number} enemyX
 * @param {number} enemyZ
 * @returns {{ playerRotation: number, cameraYaw: number, toTarget: { x: number, z: number } }}
 */
export function cameraYawBehindTarget(playerX, playerZ, enemyX, enemyZ) {
	const dx = enemyX - playerX;
	const dz = enemyZ - playerZ;
	const dist = Math.hypot(dx, dz);
	if (dist <= LOCK_ON_MIN_BEARING_DIST && lastStableAim) {
		return lastStableAim;
	}

	const toTarget = getDirectionToTarget(playerX, playerZ, { x: enemyX, z: enemyZ });
	const playerRotation = Math.atan2(toTarget.z, toTarget.x);
	const aim = {
		playerRotation,
		cameraYaw: cameraYawFromToTarget(toTarget),
		toTarget,
	};
	if (dist >= LOCK_ON_MIN_BEARING_DIST) {
		lastStableAim = aim;
	}
	return aim;
}

/**
 * Map stick input to world movement relative to the locked target.
 * @param {number} inputX
 * @param {number} inputZ
 * @param {{ x: number, z: number }} toTarget
 * @returns {{ x: number, z: number }}
 */
export function targetRelativeDirection(inputX, inputZ, toTarget) {
	// Right = up × forward in XZ (Y-up): (-toTarget.z, toTarget.x)
	const rightX = -toTarget.z;
	const rightZ = toTarget.x;
	return {
		x: rightX * inputX + toTarget.x * inputZ,
		z: rightZ * inputX + toTarget.z * inputZ,
	};
}

/**
 * @returns {boolean}
 */
export function isLockOnActive() {
	return lockedEnemyId != null;
}

/**
 * @returns {string | null}
 */
export function getLockedEnemyId() {
	return lockedEnemyId;
}

export function clearLockOn() {
	lockedEnemyId = null;
	lockOnCameraYawUnwrapped = null;
	lockOnPlayerRotationUnwrapped = null;
	lastRawCameraYaw = null;
	lastStableAim = null;
	lastLockedEnemyPosition = null;
	lastLockedPlayerRotation = 0;
}

export function clearLockOnCameraRelease() {
	lockOnCameraRelease = null;
}

export function clearAllLockOnState() {
	clearLockOn();
	clearLockOnCameraRelease();
}

export function isLockOnCameraReleasing() {
	return lockOnCameraRelease != null;
}

function startLockOnDeathRelease(enemyX, enemyZ, playerRotation, cameraYaw) {
	lockOnCameraRelease = {
		elapsed: 0,
		duration: LOCK_ON_DEATH_RELEASE_DURATION,
		lookAtX: enemyX,
		lookAtZ: enemyZ,
		startCameraYaw: cameraYaw,
		targetCameraYaw: cameraYawBehindFacing(playerRotation),
	};
}

/**
 * Advance the post-death camera release blend.
 * @param {number} delta
 * @param {number} playerX
 * @param {number} playerY
 * @param {number} playerZ
 * @returns {{ done: boolean, cameraYaw: number, lookAtX: number, lookAtY: number, lookAtZ: number } | null}
 */
export function updateLockOnCameraRelease(delta, playerX, playerY, playerZ) {
	if (!lockOnCameraRelease) return null;

	lockOnCameraRelease.elapsed += delta;
	const release = lockOnCameraRelease;
	const t = Math.min(1, release.elapsed / release.duration);
	const eased = 1 - (1 - t) * (1 - t);
	const lookAtY = playerY + 0.5;
	const cameraYaw = normalizeAngle(
		release.startCameraYaw
		+ shortestAngleDelta(release.startCameraYaw, release.targetCameraYaw) * eased,
	);
	const frame = {
		done: t >= 1,
		cameraYaw,
		lookAtX: release.lookAtX + (playerX - release.lookAtX) * eased,
		lookAtY,
		lookAtZ: release.lookAtZ + (playerZ - release.lookAtZ) * eased,
	};

	if (frame.done) {
		lockOnCameraRelease = null;
	}

	return frame;
}

function lockOnto(enemyId) {
	lockedEnemyId = enemyId;
	lockOnCameraYawUnwrapped = null;
	lockOnPlayerRotationUnwrapped = null;
	lastRawCameraYaw = null;
	lastStableAim = null;
}

function advanceLockOnPlayerRotation(currentPlayerRotation, liveToTarget, delta) {
	const desired = Math.atan2(liveToTarget.z, liveToTarget.x);
	if (lockOnPlayerRotationUnwrapped === null) {
		lockOnPlayerRotationUnwrapped = currentPlayerRotation
			+ shortestAngleDelta(currentPlayerRotation, desired);
		return normalizeAngle(lockOnPlayerRotationUnwrapped);
	}

	const bearingDelta = shortestAngleDelta(
		normalizeAngle(lockOnPlayerRotationUnwrapped),
		desired,
	);
	const maxStep = LOCK_ON_MAX_FACING_SPEED * delta;
	const cappedDelta = Math.max(-maxStep, Math.min(maxStep, bearingDelta));
	lockOnPlayerRotationUnwrapped += cappedDelta;
	return normalizeAngle(lockOnPlayerRotationUnwrapped);
}

function advanceLockOnCameraYaw(currentCameraYaw, rawCameraYaw, delta) {
	if (lockOnCameraYawUnwrapped === null) {
		lockOnCameraYawUnwrapped = currentCameraYaw + shortestAngleDelta(currentCameraYaw, rawCameraYaw);
		lastRawCameraYaw = rawCameraYaw;
		return normalizeAngle(lockOnCameraYawUnwrapped);
	}

	const bearingDelta = shortestAngleDelta(normalizeAngle(lockOnCameraYawUnwrapped), rawCameraYaw);
	const maxStep = LOCK_ON_MAX_YAW_SPEED * delta;
	const cappedDelta = Math.max(-maxStep, Math.min(maxStep, bearingDelta));
	lockOnCameraYawUnwrapped += cappedDelta;
	lastRawCameraYaw = rawCameraYaw;
	return normalizeAngle(lockOnCameraYawUnwrapped);
}

/**
 * @param {Array<{ id: string, x: number, z: number, hp?: number }>} enemies
 * @param {number} playerX
 * @param {number} playerZ
 * @param {LockOnRepeatAction} repeatAction
 * @param {number} playerRotation
 * @returns {{ action: 'locked' | 'unlocked' | 'snapBehind', enemy?: object, cameraYaw?: number }}
 */
export function handleLockOnPress(enemies, playerX, playerZ, repeatAction, playerRotation) {
	const currentlyLocked = lockedEnemyId != null;

	if (currentlyLocked && repeatAction === 'unlock') {
		clearLockOn();
		return { action: 'unlocked' };
	}

	if (currentlyLocked && repeatAction === 'cycle') {
		const next = findClosestTargetableEnemy(enemies, playerX, playerZ, LOCK_ON_RANGE, lockedEnemyId);
		if (next) {
			lockOnto(next.enemy.id);
			const aim = cameraYawBehindTarget(playerX, playerZ, next.enemy.x, next.enemy.z);
			return { action: 'locked', enemy: next.enemy, cameraYaw: aim.cameraYaw };
		}
		clearLockOn();
		return { action: 'snapBehind', cameraYaw: cameraYawBehindFacing(playerRotation) };
	}

	if (currentlyLocked && repeatAction === 'reacquire') {
		const nearest = findClosestTargetableEnemy(enemies, playerX, playerZ, LOCK_ON_RANGE);
		if (nearest) {
			lockOnto(nearest.enemy.id);
			const aim = cameraYawBehindTarget(playerX, playerZ, nearest.enemy.x, nearest.enemy.z);
			return { action: 'locked', enemy: nearest.enemy, cameraYaw: aim.cameraYaw };
		}
		clearLockOn();
		return { action: 'snapBehind', cameraYaw: cameraYawBehindFacing(playerRotation) };
	}

	const nearest = findClosestTargetableEnemy(enemies, playerX, playerZ, LOCK_ON_RANGE);
	if (nearest) {
		lockOnto(nearest.enemy.id);
		const aim = cameraYawBehindTarget(playerX, playerZ, nearest.enemy.x, nearest.enemy.z);
		return { action: 'locked', enemy: nearest.enemy, cameraYaw: aim.cameraYaw };
	}

	return { action: 'snapBehind', cameraYaw: cameraYawBehindFacing(playerRotation) };
}

/**
 * Per-frame lock-on update: validate target, compute facing/camera/movement basis.
 * @param {Array<{ id: string, x: number, z: number, hp?: number }>} enemies
 * @param {number} playerX
 * @param {number} playerZ
 * @param {number} delta
 * @param {number} currentCameraYaw
 * @param {number} currentPlayerRotation
 * @returns {{ locked: boolean, playerRotation?: number, cameraYaw?: number, toTarget?: { x: number, z: number }, targetCameraYaw?: number } | null}
 */
export function updateLockOn(enemies, playerX, playerZ, delta, currentCameraYaw, currentPlayerRotation) {
	if (!lockedEnemyId) return { locked: false };

	const enemy = findEnemyById(enemies, lockedEnemyId);
	if (!enemy) {
		const deathPos = lastLockedEnemyPosition;
		const deathRotation = lastLockedPlayerRotation;
		clearLockOn();
		if (deathPos) {
			startLockOnDeathRelease(deathPos.x, deathPos.z, deathRotation, currentCameraYaw);
		}
		return { locked: false, releasing: isLockOnCameraReleasing() };
	}

	const dist = Math.hypot(enemy.x - playerX, enemy.z - playerZ);
	if (dist > LOCK_ON_BREAK_RANGE) {
		clearLockOn();
		return { locked: false };
	}

	const liveToTarget = dist <= 1e-8
		? (lastStableAim?.toTarget ?? { x: 1, z: 0 })
		: {
			x: (enemy.x - playerX) / dist,
			z: (enemy.z - playerZ) / dist,
		};

	const playerRotation = advanceLockOnPlayerRotation(
		currentPlayerRotation,
		liveToTarget,
		delta,
	);

	const rawCameraYaw = cameraYawFromToTarget(liveToTarget);
	const cameraYaw = advanceLockOnCameraYaw(currentCameraYaw, rawCameraYaw, delta);

	lastLockedEnemyPosition = { x: enemy.x, z: enemy.z };
	lastLockedPlayerRotation = playerRotation;

	return {
		locked: true,
		playerRotation,
		cameraYaw,
		targetCameraYaw: lockOnCameraYawUnwrapped,
		toTarget: liveToTarget,
		liveToTarget,
	};
}

export function resetLockOnCameraTracking() {
	lockOnCameraYawUnwrapped = null;
	lastRawCameraYaw = null;
}

export function resetLockOnPlayerRotationTracking() {
	lockOnPlayerRotationUnwrapped = null;
}

export function resetLockOnTracking() {
	resetLockOnCameraTracking();
	resetLockOnPlayerRotationTracking();
}
