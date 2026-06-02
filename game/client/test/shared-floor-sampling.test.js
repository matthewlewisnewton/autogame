import { describe, it, expect } from 'vitest';
import { sampleFloorY, DEFAULT_FLOOR_Y } from '../../shared/floorSampling.esm.js';

describe('ESM floorSampling re-export', () => {
	it('exposes DEFAULT_FLOOR_Y === 0.5', () => {
		expect(DEFAULT_FLOOR_Y).toBe(0.5);
	});

	it('returns null when there are no rooms', () => {
		expect(sampleFloorY({ rooms: [] }, 0, 0)).toBeNull();
	});

	it('returns DEFAULT_FLOOR_Y at the centre of a flat room', () => {
		const layout = { rooms: [{ x: 0, z: 0, width: 10, depth: 10 }] };
		// (0, 0) is the room center; flat room defaults all corners to DEFAULT_FLOOR_Y
		expect(sampleFloorY(layout, 0, 0)).toBe(0.5);
	});

	it('bilinearly interpolates a sloped room centre', () => {
		const layout = {
			rooms: [
				{
					x: 0,
					z: 0,
					width: 10,
					depth: 10,
					floorCorners: { yNW: 0, yNE: 2, ySE: 4, ySW: 2 },
				},
			],
		};
		// Centre of room (0, 0) → u=0.5, v=0.5 → bilinear = 2.0
		expect(sampleFloorY(layout, 0, 0)).toBe(2.0);
	});

	it('samples bilinear Y on a ramp passage with floorCorners', () => {
		const fromRoom = {
			x: 0,
			z: 0,
			width: 12,
			depth: 12,
			floorCorners: { yNW: 0.5, yNE: 0.5, ySE: 0.5, ySW: 0.5 },
		};
		const toRoom = {
			x: 0,
			z: 27,
			width: 12,
			depth: 12,
			floorCorners: { yNW: 3.5, yNE: 3.5, ySE: 3.5, ySW: 3.5 },
		};
		const layout = {
			rooms: [fromRoom, toRoom],
			passages: [
				{
					x1: 0,
					z1: 0,
					x2: 0,
					z2: 27,
					corridorLength: 15,
					floorCorners: { yNW: 0.5, yNE: 0.5, ySE: 3.5, ySW: 3.5 },
				},
			],
			passageWidth: 4,
		};
		const zStart = fromRoom.z + fromRoom.depth / 2;
		const zEnd = toRoom.z - toRoom.depth / 2;
		const midZ = (zStart + zEnd) / 2;
		const y = sampleFloorY(layout, 0, midZ);
		expect(y).not.toBeNull();
		expect(y).toBeGreaterThan(0.5);
		expect(y).toBeLessThan(3.5);
	});
});
