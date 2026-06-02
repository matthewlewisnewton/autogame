import { describe, it, expect } from 'vitest';
import { computeFollowCameraTarget } from '../camera.js';
import { CAMERA_DISTANCE, CAMERA_HEIGHT } from '../config.js';
import { generateLayout } from '../../server/dungeon.js';
import { sampleFloorY } from '../../shared/floorSampling.esm.js';

const SUNKEN_OPTS = { stage: 'sunken-canyon', slopes: true };

function sunkenLayout(seed) {
	return generateLayout(seed, undefined, SUNKEN_OPTS);
}

describe('computeFollowCameraTarget', () => {
	it('offsets camera Y by player floor height plus camera height', () => {
		const playerY = 10;
		const result = computeFollowCameraTarget(0, playerY, 0, 0);
		expect(result.targetY).toBe(playerY + CAMERA_HEIGHT);
		expect(result.lookAtY).toBe(playerY);
	});

	it('tracks bilinear floor Y along a sunken-canyon ramp fixture', () => {
		const layout = sunkenLayout(42);
		const ramp = layout.rooms.find(r => r.elevationBand === 'ramp');
		expect(ramp).toBeDefined();

		const halfW = ramp.width / 2;
		const halfD = ramp.depth / 2;
		const samples = [
			{ x: ramp.x - halfW * 0.5, z: ramp.z - halfD * 0.5 },
			{ x: ramp.x, z: ramp.z },
			{ x: ramp.x + halfW * 0.5, z: ramp.z + halfD * 0.5 },
		];

		for (const { x, z } of samples) {
			const floorY = sampleFloorY(layout, x, z);
			expect(floorY).not.toBeNull();
			const follow = computeFollowCameraTarget(x, floorY, z, Math.PI / 4);
			expect(follow.targetY).toBeCloseTo(floorY + CAMERA_HEIGHT, 5);
			expect(follow.lookAtY).toBeCloseTo(floorY, 5);
			expect(follow.targetX).toBeCloseTo(
				x + Math.sin(Math.PI / 4) * CAMERA_DISTANCE,
				5,
			);
			expect(follow.targetZ).toBeCloseTo(
				z + Math.cos(Math.PI / 4) * CAMERA_DISTANCE,
				5,
			);
		}
	});
});
