// Z-targeting (lock-on) — camera and facing relative to nearest enemy.

import {
	LOCK_ON_RANGE,
	LOCK_ON_BREAK_RANGE,
	LOCK_ON_CAMERA_LERP,
} from './config.js';

/** @typedef {'unlock' | 'cycle' | 'reacquire'} LockOnRepeatAction */

let lockedEnemyId = null;

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
export function getDirectionToTarget(playerX, playerZ, enemy) {
	const dx = enemy.x - playerX;
	const dz = enemy.z - playerZ;
	const dist = Math.hypot(dx, dz);
	if (dist <= 1e-8) return { x: 1, z: 0 };
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
 * Player rotation and camera yaw for facing a target.
 * @param {number} playerX
 * @param {number} playerZ
 * @param {number} enemyX
 * @param {number} enemyZ
 * @returns {{ playerRotation: number, cameraYaw: number, toTarget: { x: number, z: number } }}
 */
export function cameraYawBehindTarget(playerX, playerZ, enemyX, enemyZ) {
	const toTarget = getDirectionToTarget(playerX, playerZ, { x: enemyX, z: enemyZ });
	const playerRotation = Math.atan2(toTarget.z, toTarget.x);
	return {
		playerRotation,
		cameraYaw: cameraYawBehindFacing(playerRotation),
		toTarget,
	};
}

/**
 * Map stick input to world movement relative to the locked target.
 * @param {number} inputX
 * @param {number} inputZ
 * @param {{ x: number, z: number }} toTarget
 * @returns {{ x: number, z: number }}
 */
export function targetRelativeDirection(inputX, inputZ, toTarget) {
	const rightX = toTarget.z;
	const rightZ = -toTarget.x;
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
}

function lockOnto(enemyId) {
	lockedEnemyId = enemyId;
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
 * @returns {{ locked: boolean, playerRotation?: number, cameraYaw?: number, toTarget?: { x: number, z: number }, targetCameraYaw?: number } | null}
 */
export function updateLockOn(enemies, playerX, playerZ, delta, currentCameraYaw) {
	if (!lockedEnemyId) return { locked: false };

	const enemy = findEnemyById(enemies, lockedEnemyId);
	if (!enemy) {
		clearLockOn();
		return { locked: false };
	}

	const dist = Math.hypot(enemy.x - playerX, enemy.z - playerZ);
	if (dist > LOCK_ON_BREAK_RANGE) {
		clearLockOn();
		return { locked: false };
	}

	const aim = cameraYawBehindTarget(playerX, playerZ, enemy.x, enemy.z);
	const lerpFactor = Math.min(1, LOCK_ON_CAMERA_LERP * delta);
	let cameraYaw = currentCameraYaw;
	const deltaYaw = shortestAngleDelta(currentCameraYaw, aim.cameraYaw);
	cameraYaw += deltaYaw * lerpFactor;

	return {
		locked: true,
		playerRotation: aim.playerRotation,
		cameraYaw,
		targetCameraYaw: aim.cameraYaw,
		toTarget: aim.toTarget,
	};
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
