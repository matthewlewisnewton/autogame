import { describe, it, expect } from 'vitest';
import { computeCameraOrbitTarget } from '../renderer.js';
import { CAMERA_HEIGHT } from '../config.js';
import { generateLayout } from '../../server/dungeon.js';
import { sampleFloorY } from '../../shared/floorSampling.esm.js';

describe('computeCameraOrbitTarget', () => {
	it('offsets camera Y by CAMERA_HEIGHT above playerY (not DEFAULT_FLOOR_Y)', () => {
		const layout = generateLayout(42, 'sunken-canyon');
		const plateau = layout.rooms.find((r) => r.band === 'plateau');
		const playerY = sampleFloorY(layout, plateau.x, plateau.z);
		expect(playerY).toBeGreaterThan(4);

		const { targetY } = computeCameraOrbitTarget(plateau.x, playerY, plateau.z);
		expect(targetY).toBeCloseTo(playerY + CAMERA_HEIGHT, 5);
		expect(targetY).toBeGreaterThan(CAMERA_HEIGHT + 4);
	});

	it('tracks descending ramp playerY on sunken-canyon ramps', () => {
		const layout = generateLayout(7, 'sunken-canyon');
		const ramp = layout.rooms.find((r) => r.band === 'ramp');
		const midY = sampleFloorY(layout, ramp.x, ramp.z);
		expect(midY).toBeGreaterThan(1);
		expect(midY).toBeLessThan(10);

		const { targetY } = computeCameraOrbitTarget(ramp.x, midY, ramp.z);
		expect(targetY).toBeCloseTo(midY + CAMERA_HEIGHT, 5);
	});
});
