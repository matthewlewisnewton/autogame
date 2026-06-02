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

	it('accepts a valid modelId', () => {
		const result = validateCosmetic({ modelId: 'player' });
		expect(result.ok).toBe(true);
		expect(result.value.modelId).toBe('player');
	});

	it('rejects an unknown modelId', () => {
		const result = validateCosmetic({ modelId: 'unknown_model' });
		expect(result.ok).toBe(false);
		expect(result.reason).toMatch(/modelId/);
	});

	it('rejects a non-string modelId', () => {
		expect(validateCosmetic({ modelId: 42 }).ok).toBe(false);
		expect(validateCosmetic({ modelId: null }).ok).toBe(false);
	});

	it('accepts valid proportions', () => {
		const result = validateCosmetic({ proportions: { height: 1.0, headSize: 0.9 } });
		expect(result.ok).toBe(true);
		expect(result.value.proportions).toEqual({ height: 1.0, headSize: 0.9 });
	});

	it('accepts proportions at range boundaries', () => {
		const result = validateCosmetic({ proportions: { height: 0.8, headSize: 1.3 } });
		expect(result.ok).toBe(true);
	});

	it('rejects proportions that is not a plain object', () => {
		expect(validateCosmetic({ proportions: null }).ok).toBe(false);
		expect(validateCosmetic({ proportions: 'height' }).ok).toBe(false);
		expect(validateCosmetic({ proportions: [] }).ok).toBe(false);
		expect(validateCosmetic({ proportions: 42 }).ok).toBe(false);
	});

	it('rejects proportions with unknown keys', () => {
		const result = validateCosmetic({ proportions: { height: 1.0, wingSpan: 2.0 } });
		expect(result.ok).toBe(false);
		expect(result.reason).toMatch(/Unknown proportion key/);
	});

	it('rejects proportions with out-of-range values', () => {
		const result = validateCosmetic({ proportions: { height: 0.5 } });
		expect(result.ok).toBe(false);
		expect(result.reason).toMatch(/height.*between/);

		const result2 = validateCosmetic({ proportions: { height: 1.5 } });
		expect(result2.ok).toBe(false);
	});

	it('rejects proportions with non-finite values', () => {
		expect(validateCosmetic({ proportions: { height: NaN } }).ok).toBe(false);
		expect(validateCosmetic({ proportions: { height: Infinity } }).ok).toBe(false);
		expect(validateCosmetic({ proportions: { height: -Infinity } }).ok).toBe(false);
	});

	it('rejects proportions with string values instead of numbers', () => {
		expect(validateCosmetic({ proportions: { height: '1.0' } }).ok).toBe(false);
	});

	it('accepts combined fields including modelId and proportions', () => {
		const result = validateCosmetic({
			bodyColor: '#aabbcc',
			modelId: 'player',
			proportions: { height: 1.1, shoulderWidth: 0.8 }
		});
		expect(result.ok).toBe(true);
		expect(result.value.bodyColor).toBe('#aabbcc');
		expect(result.value.modelId).toBe('player');
		expect(result.value.proportions).toEqual({ height: 1.1, shoulderWidth: 0.8 });
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

	it('fills missing modelId with default', () => {
		const result = backfillCosmetic({});
		expect(result.modelId).toBe(DEFAULT_COSMETIC.modelId);
	});

	it('replaces invalid modelId with default', () => {
		const result = backfillCosmetic({ modelId: 'nonexistent' });
		expect(result.modelId).toBe(DEFAULT_COSMETIC.modelId);
	});

	it('keeps valid modelId', () => {
		const result = backfillCosmetic({ modelId: 'player' });
		expect(result.modelId).toBe('player');
	});

	it('fills missing proportions with defaults', () => {
		const result = backfillCosmetic({});
		expect(result.proportions).toEqual(DEFAULT_COSMETIC.proportions);
	});

	it('keeps valid proportion values and replaces missing keys', () => {
		const result = backfillCosmetic({ proportions: { height: 1.1 } });
		expect(result.proportions.height).toBe(1.1);
		expect(result.proportions.headSize).toBe(DEFAULT_COSMETIC.proportions.headSize);
	});

	it('replaces out-of-range proportion values with defaults', () => {
		const result = backfillCosmetic({ proportions: { height: 0.1, headSize: 2.0, torsoWidth: 1.0 } });
		expect(result.proportions.height).toBe(DEFAULT_COSMETIC.proportions.height);
		expect(result.proportions.headSize).toBe(DEFAULT_COSMETIC.proportions.headSize);
		expect(result.proportions.torsoWidth).toBe(1.0);
	});

	it('replaces NaN and Infinity proportion values with defaults', () => {
		const result = backfillCosmetic({ proportions: { height: NaN, headSize: Infinity } });
		expect(result.proportions.height).toBe(DEFAULT_COSMETIC.proportions.height);
		expect(result.proportions.headSize).toBe(DEFAULT_COSMETIC.proportions.headSize);
	});

	it('handles null or non-object proportions input', () => {
		expect(backfillCosmetic({ proportions: null }).proportions).toEqual(DEFAULT_COSMETIC.proportions);
		expect(backfillCosmetic({ proportions: 'bad' }).proportions).toEqual(DEFAULT_COSMETIC.proportions);
		expect(backfillCosmetic({ proportions: [] }).proportions).toEqual(DEFAULT_COSMETIC.proportions);
	});
});
