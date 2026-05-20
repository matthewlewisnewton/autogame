import { describe, it, expect } from 'vitest';
import { clampDelta } from '../delta.js';

describe('clampDelta()', () => {
	it('passes through normal delta values unchanged', () => {
		expect(clampDelta(0.016)).toBe(0.016); // ~60 fps
		expect(clampDelta(0.033)).toBe(0.033); // ~30 fps
		expect(clampDelta(0.05)).toBe(0.05);
	});

	it('clamps delta at maximum of 0.1s (100ms)', () => {
		expect(clampDelta(0.1)).toBe(0.1);
		expect(clampDelta(0.15)).toBe(0.1);
		expect(clampDelta(1.0)).toBe(0.1);
		expect(clampDelta(10.0)).toBe(0.1);
	});

	it('returns 0 for zero delta', () => {
		expect(clampDelta(0)).toBe(0);
	});

	it('returns 0 for negative delta', () => {
		expect(clampDelta(-0.01)).toBe(0);
		expect(clampDelta(-1.0)).toBe(0);
	});
});
