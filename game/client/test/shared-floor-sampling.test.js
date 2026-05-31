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
		// (5, 5) is inside the room; flat room defaults all corners to DEFAULT_FLOOR_Y
		expect(sampleFloorY(layout, 5, 5)).toBe(0.5);
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
});
