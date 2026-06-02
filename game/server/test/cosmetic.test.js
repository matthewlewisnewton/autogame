import { describe, it, expect } from 'vitest';
import {
	BODY_SHAPES,
	MODEL_IDS,
	PROPORTION_KEYS,
	PROPORTION_RANGES,
	DEFAULT_COSMETIC,
	validateCosmetic,
	backfillCosmetic
} from '../cosmetic.js';

describe('DEFAULT_COSMETIC', () => {
	it('has the cosmetic fields with valid defaults', () => {
		expect(Object.keys(DEFAULT_COSMETIC).sort()).toEqual(['accentColor', 'bodyColor', 'bodyShape', 'hat', 'modelId', 'proportions']);
		expect(DEFAULT_COSMETIC.bodyColor).toMatch(/^#[0-9a-f]{6}$/i);
		expect(DEFAULT_COSMETIC.accentColor).toMatch(/^#[0-9a-f]{6}$/i);
		expect(BODY_SHAPES).toContain(DEFAULT_COSMETIC.bodyShape);
		expect(DEFAULT_COSMETIC.hat).toBe('none');
		expect(DEFAULT_COSMETIC.modelId).toBe('player');
		expect(DEFAULT_COSMETIC.proportions).toEqual({
			height: 1.0,
			headSize: 1.0,
			torsoWidth: 1.0,
			armLength: 1.0,
			legLength: 1.0,
			shoulderWidth: 1.0
		});
	});

	it('exposes the expected body shapes', () => {
		expect(BODY_SHAPES).toEqual(['box', 'cylinder', 'cone', 'capsule']);
	});
});

describe('MODEL_IDS', () => {
	it('contains the initial player model', () => {
		expect(MODEL_IDS).toEqual(['player']);
	});
});

describe('PROPORTION_KEYS', () => {
	it('lists the six canonical keys', () => {
		expect(PROPORTION_KEYS).toEqual(['height', 'headSize', 'torsoWidth', 'armLength', 'legLength', 'shoulderWidth']);
	});
});

describe('PROPORTION_RANGES', () => {
	it('provides min/max bounds for each proportion key', () => {
		for (const key of PROPORTION_KEYS) {
			const range = PROPORTION_RANGES[key];
			expect(range).toBeDefined();
			expect(typeof range.min).toBe('number');
			expect(typeof range.max).toBe('number');
			expect(range.min).toBeLessThanOrEqual(range.max);
		}
	});

	it('has the expected numeric bounds', () => {
		expect(PROPORTION_RANGES.height).toEqual({ min: 0.8, max: 1.2 });
		expect(PROPORTION_RANGES.headSize).toEqual({ min: 0.7, max: 1.3 });
		expect(PROPORTION_RANGES.torsoWidth).toEqual({ min: 0.7, max: 1.3 });
		expect(PROPORTION_RANGES.armLength).toEqual({ min: 0.8, max: 1.2 });
		expect(PROPORTION_RANGES.legLength).toEqual({ min: 0.8, max: 1.2 });
		expect(PROPORTION_RANGES.shoulderWidth).toEqual({ min: 0.7, max: 1.3 });
	});
});

describe('validateCosmetic', () => {
	it('accepts a full valid cosmetic', () => {
		const result = validateCosmetic({ bodyColor: '#112233', accentColor: '#ABCDEF', bodyShape: 'cone' });
		expect(result.ok).toBe(true);
		expect(result.value).toEqual({ bodyColor: '#112233', accentColor: '#ABCDEF', bodyShape: 'cone' });
	});

	it('accepts a partial update with only the provided field', () => {
		const result = validateCosmetic({ bodyShape: 'capsule' });
		expect(result.ok).toBe(true);
		expect(result.value).toEqual({ bodyShape: 'capsule' });
	});

	it('accepts case-insensitive hex colors', () => {
		expect(validateCosmetic({ bodyColor: '#aAbBcC' }).ok).toBe(true);
	});

	it('rejects an invalid bodyShape', () => {
		const result = validateCosmetic({ bodyShape: 'pyramid' });
		expect(result.ok).toBe(false);
		expect(result.reason).toMatch(/bodyShape/);
	});

	it('rejects a malformed bodyColor', () => {
		expect(validateCosmetic({ bodyColor: 'red' }).ok).toBe(false);
		expect(validateCosmetic({ bodyColor: '#fff' }).ok).toBe(false);
		expect(validateCosmetic({ bodyColor: '112233' }).ok).toBe(false);
		expect(validateCosmetic({ bodyColor: '#11223g' }).ok).toBe(false);
	});

	it('rejects a malformed accentColor', () => {
		expect(validateCosmetic({ accentColor: '#12345' }).ok).toBe(false);
	});

	it('rejects non-object input', () => {
		expect(validateCosmetic(null).ok).toBe(false);
		expect(validateCosmetic('box').ok).toBe(false);
		expect(validateCosmetic([]).ok).toBe(false);
	});
});

describe('backfillCosmetic', () => {
	it('returns defaults for undefined input', () => {
		expect(backfillCosmetic(undefined)).toEqual(DEFAULT_COSMETIC);
	});

	it('fills only the missing fields', () => {
		const result = backfillCosmetic({ bodyShape: 'cylinder' });
		expect(result.bodyShape).toBe('cylinder');
		expect(result.bodyColor).toBe(DEFAULT_COSMETIC.bodyColor);
		expect(result.accentColor).toBe(DEFAULT_COSMETIC.accentColor);
	});

	it('replaces invalid stored fields with defaults', () => {
		const result = backfillCosmetic({ bodyColor: 'nope', accentColor: '#00ff00', bodyShape: 'blob' });
		expect(result.bodyColor).toBe(DEFAULT_COSMETIC.bodyColor);
		expect(result.accentColor).toBe('#00ff00');
		expect(result.bodyShape).toBe(DEFAULT_COSMETIC.bodyShape);
	});
});
