import { describe, it, expect } from 'vitest';
import { BODY_MODELS, getAvailableModelKeys } from '../cosmetic.js';

describe('BODY_MODELS registry', () => {
	it('has at least two entries', () => {
		expect(Object.keys(BODY_MODELS).length).toBeGreaterThanOrEqual(2);
	});

	it('includes a "default" entry with primitive fallback', () => {
		const entry = BODY_MODELS.default;
		expect(entry).toBeDefined();
		expect(entry.key).toBe('default');
		expect(entry.displayName).toBe('Default');
		expect(entry.glbPath).toBeNull();
	});

	it('includes a "player" entry referencing player.glb', () => {
		const entry = BODY_MODELS.player;
		expect(entry).toBeDefined();
		expect(entry.key).toBe('player');
		expect(entry.displayName).toBe('Player');
		expect(entry.glbPath).toBe('models/player.glb');
	});

	it('has required fields on every entry', () => {
		for (const entry of Object.values(BODY_MODELS)) {
			expect(typeof entry.key).toBe('string');
			expect(entry.key.length).toBeGreaterThan(0);
			expect(typeof entry.displayName).toBe('string');
			expect(entry.displayName.length).toBeGreaterThan(0);
			// glbPath is optional but must be string or null
			expect(entry.glbPath === null || typeof entry.glbPath === 'string').toBe(true);
		}
	});

	it('entry keys match the object property keys', () => {
		for (const [propKey, entry] of Object.entries(BODY_MODELS)) {
			expect(entry.key).toBe(propKey);
		}
	});
});

describe('getAvailableModelKeys', () => {
	it('returns an array of valid model keys', () => {
		const keys = getAvailableModelKeys();
		expect(Array.isArray(keys)).toBe(true);
		expect(keys).toContain('default');
		expect(keys).toContain('player');
	});

	it('returns the same keys as BODY_MODELS property keys', () => {
		expect(getAvailableModelKeys().sort()).toEqual(Object.keys(BODY_MODELS).sort());
	});

	it('returns at least two keys', () => {
		expect(getAvailableModelKeys().length).toBeGreaterThanOrEqual(2);
	});
});
