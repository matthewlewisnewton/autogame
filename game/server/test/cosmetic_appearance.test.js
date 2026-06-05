import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { hasAppearanceFieldChanges, APPEARANCE_FIELD_KEYS } = require('../../shared/cosmeticAppearance.js');

const BASELINE = {
	bodyColor: '#4f9dde',
	accentColor: '#f2c94c',
	bodyShape: 'box',
	hat: 'none',
	modelId: 'player',
	proportions: {
		height: 1.0,
		headSize: 1.0,
		torsoWidth: 1.0,
		armLength: 1.0,
		legLength: 1.0,
		shoulderWidth: 1.0,
	},
};

describe('hasAppearanceFieldChanges (CJS bridge)', () => {
	it('exports the paid appearance field key list', () => {
		expect(APPEARANCE_FIELD_KEYS).toEqual([
			'bodyColor',
			'accentColor',
			'bodyShape',
			'modelId',
			'proportions',
		]);
	});

	it('returns false when nothing changed', () => {
		expect(hasAppearanceFieldChanges(BASELINE, { ...BASELINE })).toBe(false);
		expect(hasAppearanceFieldChanges(BASELINE, BASELINE)).toBe(false);
	});

	it('returns false for hat-only changes', () => {
		expect(hasAppearanceFieldChanges(BASELINE, { ...BASELINE, hat: 'bandana' })).toBe(false);
		expect(hasAppearanceFieldChanges(BASELINE, { ...BASELINE, hat: 'wizard' })).toBe(false);
	});

	it('returns true when bodyColor changes alone', () => {
		expect(hasAppearanceFieldChanges(BASELINE, { ...BASELINE, bodyColor: '#010203' })).toBe(true);
	});

	it('returns true when accentColor changes alone', () => {
		expect(hasAppearanceFieldChanges(BASELINE, { ...BASELINE, accentColor: '#aabbcc' })).toBe(true);
	});

	it('returns true when bodyShape changes alone', () => {
		expect(hasAppearanceFieldChanges(BASELINE, { ...BASELINE, bodyShape: 'cone' })).toBe(true);
	});

	it('returns true when modelId changes alone', () => {
		expect(hasAppearanceFieldChanges(BASELINE, { ...BASELINE, modelId: 'hero' })).toBe(true);
	});

	it('returns true when a single proportion slider changes', () => {
		expect(hasAppearanceFieldChanges(BASELINE, {
			...BASELINE,
			proportions: { ...BASELINE.proportions, height: 1.1 },
		})).toBe(true);
	});

	it('returns true for mixed appearance and hat changes', () => {
		expect(hasAppearanceFieldChanges(BASELINE, {
			...BASELINE,
			bodyShape: 'capsule',
			hat: 'beanie',
		})).toBe(true);
	});

	it('compares proportions key-wise after backfilling missing keys', () => {
		const partial = { bodyColor: '#4f9dde', accentColor: '#f2c94c', bodyShape: 'box', hat: 'none' };
		expect(hasAppearanceFieldChanges(partial, partial)).toBe(false);
		expect(hasAppearanceFieldChanges(partial, {
			...partial,
			proportions: { height: 1.05 },
		})).toBe(true);
	});
});
