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

	it('interpolates height on a sloped passage corridor slab', () => {
		const layout = {
			rooms: [],
			passages: [
				{
					x1: 0,
					z1: 0,
					x2: 0,
					z2: 20,
					floorX: 0,
					floorZ: 10,
					floorWidth: 4,
					floorDepth: 8,
					floorCorners: { yNW: 0.5, yNE: 0.5, ySE: 2.5, ySW: 2.5 },
				},
			],
		};
		// Centre of passage slab: v=0.5 → Y = (0.5 + 2.5) / 2 = 1.5
		expect(sampleFloorY(layout, 0, 10)).toBeCloseTo(1.5, 5);
		// Low-Z edge (v=0)
		expect(sampleFloorY(layout, 0, 6)).toBeCloseTo(0.5, 5);
	});
});
