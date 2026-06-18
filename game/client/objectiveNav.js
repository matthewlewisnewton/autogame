// Quest-critical loot navigation — bearing and nearest-crystal helpers for objective guidance.

import { normalizeAngle, shortestAngleDelta } from './lockOn.js';

/**
 * @param {object | null | undefined} item
 * @returns {boolean}
 */
export function isQuestCriticalLoot(item) {
	return item?.kind === 'crystal' && item?.questCritical === true;
}

/**
 * @param {Array<{ x: number, z: number, kind?: string, questCritical?: boolean }> | null | undefined} loot
 * @param {number} playerX
 * @param {number} playerZ
 * @returns {{ x: number, z: number, distance: number } | null}
 */
export function findNearestQuestCriticalLoot(loot, playerX, playerZ) {
	let nearest = null;
	let nearestDist = Infinity;

	for (const item of loot || []) {
		if (!isQuestCriticalLoot(item)) continue;
		const distance = Math.hypot(item.x - playerX, item.z - playerZ);
		if (distance >= nearestDist) continue;
		nearestDist = distance;
		nearest = { x: item.x, z: item.z, distance };
	}

	return nearest;
}

/**
 * Horizontal world bearing from player to target on the XZ plane.
 * Matches lock-on / movement: atan2(dz, dx).
 * @param {number} playerX
 * @param {number} playerZ
 * @param {number} targetX
 * @param {number} targetZ
 * @returns {number}
 */
export function computeWorldBearing(playerX, playerZ, targetX, targetZ) {
	const dx = targetX - playerX;
	const dz = targetZ - playerZ;
	return Math.atan2(dz, dx);
}

/**
 * Screen-relative compass arrow rotation (radians).
 * World bearing minus camera yaw via shortest arc so the arrow does not flip at ±π.
 * @param {number} worldBearing
 * @param {number} cameraYaw
 * @returns {number}
 */
export function computeArrowRotation(worldBearing, cameraYaw) {
	return normalizeAngle(shortestAngleDelta(cameraYaw, worldBearing));
}
