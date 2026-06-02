import { describe, it, expect } from 'vitest';
import { CAMERA_HEIGHT } from '../config.js';

/**
 * Mirrors updateCameraOrbit target Y in renderer.js (playerY + CAMERA_HEIGHT).
 */
function cameraOrbitTargetY(playerY) {
	return playerY + CAMERA_HEIGHT;
}

describe('updateCameraOrbit target height', () => {
	it('raises camera target Y when playerY increases (spire climb)', () => {
		const yBottom = cameraOrbitTargetY(0);
		const ySummit = cameraOrbitTargetY(12);
		expect(ySummit).toBeGreaterThan(yBottom);
		expect(ySummit - yBottom).toBe(12);
	});

	it('uses CAMERA_HEIGHT offset above the player', () => {
		expect(cameraOrbitTargetY(5)).toBe(5 + CAMERA_HEIGHT);
	});
});
