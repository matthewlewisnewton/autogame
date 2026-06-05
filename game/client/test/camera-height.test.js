import { describe, it, expect } from 'vitest';
import {
	CAMERA_HEIGHT,
	SUNKEN_CANYON_CAMERA_HEIGHT,
	getCameraFollowHeight,
} from '../config.js';

describe('getCameraFollowHeight', () => {
	it('returns lower follow height for sunken-canyon than default profiles', () => {
		expect(getCameraFollowHeight('sunken-canyon')).toBe(SUNKEN_CANYON_CAMERA_HEIGHT);
		expect(getCameraFollowHeight('sunken-canyon')).toBeLessThan(CAMERA_HEIGHT);
		expect(SUNKEN_CANYON_CAMERA_HEIGHT).toBeGreaterThanOrEqual(CAMERA_HEIGHT - 2.5);
		expect(SUNKEN_CANYON_CAMERA_HEIGHT).toBeLessThanOrEqual(CAMERA_HEIGHT - 1.5);
	});

	it('keeps global CAMERA_HEIGHT for hub, lobby, and other dungeon profiles', () => {
		for (const profile of [
			undefined,
			null,
			'crowded',
			'open',
			'open-plaza',
			'spire-ascent',
			'hub',
		]) {
			expect(getCameraFollowHeight(profile)).toBe(CAMERA_HEIGHT);
		}
	});
});
