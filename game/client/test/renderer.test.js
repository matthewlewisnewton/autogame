import { describe, it, expect } from 'vitest';
import { generateLayout } from '../../server/dungeon.js';
import { sampleFloorY, DEFAULT_FLOOR_Y } from '../../shared/floorSampling.esm.js';
import {
	enemyFloorY,
	enemyMeshWorldY,
	enemyMeshHalfHeight,
} from '../renderer.js';

describe('elevated enemy combat visuals', () => {
	it('places summit spire-ascent enemies at Y >= 8 above flat default floor', () => {
		const layout = generateLayout(42, 'crowded', { stage: 'spire-ascent' });
		const summit = layout.rooms[layout.rooms.length - 1];
		expect(summit.role).toBe('treasure');

		const floorY = sampleFloorY(layout, summit.x, summit.z);
		expect(floorY).not.toBeNull();
		expect(floorY - DEFAULT_FLOOR_Y).toBeGreaterThanOrEqual(8);

		const enemyY = enemyMeshWorldY(layout, summit.x, summit.z, 'grunt');
		expect(enemyY).toBeGreaterThanOrEqual(8);
		expect(enemyY).toBeCloseTo(floorY + enemyMeshHalfHeight('grunt'), 5);
	});

	it('keeps DEFAULT_FLOOR_Y sampling on flat default-grid layouts', () => {
		const layout = generateLayout(42, 'default');
		const room = layout.rooms[0];
		expect(enemyFloorY(layout, room.x, room.z)).toBe(DEFAULT_FLOOR_Y);
		expect(enemyMeshWorldY(layout, room.x, room.z, 'grunt')).toBeCloseTo(
			DEFAULT_FLOOR_Y + enemyMeshHalfHeight('grunt'),
			5,
		);
	});
});
