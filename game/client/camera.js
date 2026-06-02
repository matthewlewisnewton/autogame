import { CAMERA_DISTANCE, CAMERA_HEIGHT } from './config.js';

/**
 * Orbit follow-camera target and look-at for a player on sampled floor height.
 * @param {number} playerX
 * @param {number} playerY - walkable floor Y (sampled floor height)
 * @param {number} playerZ
 * @param {number} cameraYaw
 * @param {{ cameraDistance?: number, cameraHeight?: number }} [opts]
 */
export function computeFollowCameraTarget(
	playerX,
	playerY,
	playerZ,
	cameraYaw,
	opts = {},
) {
	const distance = opts.cameraDistance ?? CAMERA_DISTANCE;
	const height = opts.cameraHeight ?? CAMERA_HEIGHT;
	return {
		targetX: playerX + Math.sin(cameraYaw) * distance,
		targetY: playerY + height,
		targetZ: playerZ + Math.cos(cameraYaw) * distance,
		lookAtX: playerX,
		lookAtY: playerY,
		lookAtZ: playerZ,
	};
}
