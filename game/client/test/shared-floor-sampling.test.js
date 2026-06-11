import { describe, it, expect } from 'vitest';
import { sampleFloorY, DEFAULT_FLOOR_Y, resolveFloorY } from '../../shared/floorSampling.esm.js';

describe('resolveFloorY', () => {
	it('returns DEFAULT_FLOOR_Y for null', () => {
		expect(resolveFloorY(null)).toBe(0.5);
	});

	it('returns DEFAULT_FLOOR_Y for NaN', () => {
		expect(resolveFloorY(NaN)).toBe(0.5);
	});

	it('returns DEFAULT_FLOOR_Y for Infinity and -Infinity', () => {
		expect(resolveFloorY(Infinity)).toBe(0.5);
		expect(resolveFloorY(-Infinity)).toBe(0.5);
	});

	it('returns DEFAULT_FLOOR_Y for undefined', () => {
		expect(resolveFloorY(undefined)).toBe(0.5);
	});

	it('returns the input unchanged for finite numbers', () => {
		expect(resolveFloorY(1.25)).toBe(1.25);
		expect(resolveFloorY(0)).toBe(0);
	});
});

describe('ESM floorSampling re-export', () => {
	it('exposes DEFAULT_FLOOR_Y === 0.5', () => {
		expect(DEFAULT_FLOOR_Y).toBe(0.5);
	});

	it('returns DEFAULT_FLOOR_Y for null layout', () => {
		expect(sampleFloorY(null, 0, 0)).toBe(DEFAULT_FLOOR_Y);
		expect(sampleFloorY(null, 12.5, -3.25)).toBe(DEFAULT_FLOOR_Y);
	});

	it('returns DEFAULT_FLOOR_Y for platform lacking floorCorners at platform center', () => {
		const layout = {
			rooms: [],
			platforms: [{ x: 0, z: 0, width: 10, depth: 10 }],
		};
		expect(sampleFloorY(layout, 0, 0)).toBe(DEFAULT_FLOOR_Y);
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
});

describe('sampleFloorY platform sampling (open-plaza)', () => {
	const plazaLayout = {
		rooms: [
			{
				x: 0,
				z: 0,
				width: 32,
				depth: 32,
				floorCorners: { yNW: 0.5, yNE: 0.5, ySE: 0.5, ySW: 0.5 },
			},
		],
		platforms: [
			{ x: 9, z: 9, width: 6, depth: 6, floorCorners: { yNW: 1.0, yNE: 1.2, ySE: 1.4, ySW: 1.2 } },
		],
	};

	it('returns the raised platform height for a point on the platform', () => {
		// Platform centre (9, 9) → u=0.5, v=0.5 → bilinear of the four corners = 1.2
		expect(sampleFloorY(plazaLayout, 9, 9)).toBeCloseTo(1.2, 5);
	});

	it('returns DEFAULT_FLOOR_Y for a plaza point off any platform', () => {
		expect(sampleFloorY(plazaLayout, 0, 0)).toBe(DEFAULT_FLOOR_Y);
	});

	it('falls back to room behavior unchanged when platforms is absent', () => {
		const noPlatforms = { rooms: plazaLayout.rooms };
		expect(sampleFloorY(noPlatforms, 9, 9)).toBe(0.5);
	});
});
