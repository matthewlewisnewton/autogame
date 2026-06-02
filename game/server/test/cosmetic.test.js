import { describe, it, expect } from 'vitest';
import {
	BODY_SHAPES,
	DEFAULT_COSMETIC,
	validateCosmetic,
	backfillCosmetic
} from '../cosmetic.js';

describe('DEFAULT_COSMETIC', () => {
	it('has the three cosmetic fields with valid defaults', () => {
		expect(Object.keys(DEFAULT_COSMETIC).sort()).toEqual(['accentColor', 'bodyColor', 'bodyShape']);
		expect(DEFAULT_COSMETIC.bodyColor).toMatch(/^#[0-9a-f]{6}$/i);
		expect(DEFAULT_COSMETIC.accentColor).toMatch(/^#[0-9a-f]{6}$/i);
		expect(BODY_SHAPES).toContain(DEFAULT_COSMETIC.bodyShape);
	});

	it('exposes the expected body shapes', () => {
		expect(BODY_SHAPES).toEqual(['box', 'cylinder', 'cone', 'capsule']);
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
