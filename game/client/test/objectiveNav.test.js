import { describe, it, expect } from 'vitest';
import {
	isQuestCriticalLoot,
	findNearestQuestCriticalLoot,
	computeWorldBearing,
	computeArrowRotation,
} from '../objectiveNav.js';
import { shortestAngleDelta } from '../lockOn.js';

describe('isQuestCriticalLoot', () => {
	it('returns true for quest-critical crystals', () => {
		expect(isQuestCriticalLoot({ kind: 'crystal', questCritical: true })).toBe(true);
	});

	it('returns false for non-crystal loot', () => {
		expect(isQuestCriticalLoot({ kind: 'gold', questCritical: true })).toBe(false);
	});

	it('returns false for crystals without questCritical', () => {
		expect(isQuestCriticalLoot({ kind: 'crystal', questCritical: false })).toBe(false);
		expect(isQuestCriticalLoot({ kind: 'crystal' })).toBe(false);
	});

	it('returns false for nullish items', () => {
		expect(isQuestCriticalLoot(null)).toBe(false);
		expect(isQuestCriticalLoot(undefined)).toBe(false);
	});
});

describe('findNearestQuestCriticalLoot', () => {
	it('returns null for empty loot', () => {
		expect(findNearestQuestCriticalLoot([], 0, 0)).toBeNull();
		expect(findNearestQuestCriticalLoot(null, 0, 0)).toBeNull();
	});

	it('ignores non-crystal and non-quest-critical loot', () => {
		const loot = [
			{ id: 'gold', kind: 'gold', x: 1, z: 0 },
			{ id: 'crystal', kind: 'crystal', questCritical: false, x: 2, z: 0 },
		];
		expect(findNearestQuestCriticalLoot(loot, 0, 0)).toBeNull();
	});

	it('picks the nearest of three quest-critical crystals', () => {
		const loot = [
			{ id: 'far', kind: 'crystal', questCritical: true, x: 20, z: 0 },
			{ id: 'mid', kind: 'crystal', questCritical: true, x: 0, z: 8 },
			{ id: 'near', kind: 'crystal', questCritical: true, x: 3, z: 4 },
		];
		const nearest = findNearestQuestCriticalLoot(loot, 0, 0);
		expect(nearest).toEqual({ x: 3, z: 4, distance: 5 });
	});
});

describe('computeWorldBearing', () => {
	it('returns 0 when the target is directly along +X', () => {
		expect(computeWorldBearing(0, 0, 10, 0)).toBeCloseTo(0, 5);
	});

	it('returns π/2 when the target is directly along +Z', () => {
		expect(computeWorldBearing(0, 0, 0, 10)).toBeCloseTo(Math.PI / 2, 5);
	});

	it('returns π when the target is behind the player along -X', () => {
		expect(computeWorldBearing(0, 0, -10, 0)).toBeCloseTo(Math.PI, 5);
	});
});

describe('computeArrowRotation', () => {
	it('returns 0 when camera yaw matches world bearing', () => {
		expect(computeArrowRotation(0, 0)).toBeCloseTo(0, 5);
		expect(computeArrowRotation(Math.PI / 2, Math.PI / 2)).toBeCloseTo(0, 5);
	});

	it('returns π/2 when the target is 90° to the right of camera forward', () => {
		expect(computeArrowRotation(Math.PI / 2, 0)).toBeCloseTo(Math.PI / 2, 5);
	});

	it('uses shortest arc across the ±π boundary', () => {
		const worldBearing = Math.PI - 0.1;
		const cameraYaw = -Math.PI + 0.1;
		const rotation = computeArrowRotation(worldBearing, cameraYaw);
		expect(rotation).toBeCloseTo(-0.2, 5);
		expect(Math.abs(rotation)).toBeLessThan(Math.PI);
		expect(rotation).toBeCloseTo(shortestAngleDelta(cameraYaw, worldBearing), 5);
	});

	it('points behind the player when the target is opposite camera yaw', () => {
		const rotation = computeArrowRotation(Math.PI, 0);
		expect(Math.abs(rotation)).toBeCloseTo(Math.PI, 5);
	});
});
