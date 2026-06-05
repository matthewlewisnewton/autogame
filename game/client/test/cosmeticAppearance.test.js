import { describe, it, expect } from 'vitest';
import { hasAppearanceFieldChanges, APPEARANCE_FIELD_KEYS } from '../../shared/cosmeticAppearance.esm.js';
import { APPEARANCE_CHANGE_COST } from '../config.js';

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

describe('hasAppearanceFieldChanges (ESM)', () => {
	it('exports the paid appearance field key list', () => {
		expect(APPEARANCE_FIELD_KEYS).toContain('bodyColor');
		expect(APPEARANCE_FIELD_KEYS).toContain('proportions');
		expect(APPEARANCE_FIELD_KEYS).not.toContain('hat');
	});

	it('returns false when nothing changed', () => {
		expect(hasAppearanceFieldChanges(BASELINE, { ...BASELINE })).toBe(false);
	});

	it('returns false for hat-only changes', () => {
		expect(hasAppearanceFieldChanges(BASELINE, { ...BASELINE, hat: 'cap' })).toBe(false);
	});

	it('returns true when each appearance field changes alone', () => {
		expect(hasAppearanceFieldChanges(BASELINE, { ...BASELINE, bodyColor: '#112233' })).toBe(true);
		expect(hasAppearanceFieldChanges(BASELINE, { ...BASELINE, accentColor: '#445566' })).toBe(true);
		expect(hasAppearanceFieldChanges(BASELINE, { ...BASELINE, bodyShape: 'cylinder' })).toBe(true);
		expect(hasAppearanceFieldChanges(BASELINE, { ...BASELINE, modelId: 'alt' })).toBe(true);
		expect(hasAppearanceFieldChanges(BASELINE, {
			...BASELINE,
			proportions: { ...BASELINE.proportions, shoulderWidth: 1.1 },
		})).toBe(true);
	});

	it('returns true for mixed appearance and hat changes', () => {
		expect(hasAppearanceFieldChanges(BASELINE, {
			...BASELINE,
			accentColor: '#ffffff',
			hat: 'wizard',
		})).toBe(true);
	});
});

describe('APPEARANCE_CHANGE_COST config', () => {
	it('is a positive integer mirrored from server config', () => {
		expect(APPEARANCE_CHANGE_COST).toBe(25);
		expect(Number.isInteger(APPEARANCE_CHANGE_COST)).toBe(true);
		expect(APPEARANCE_CHANGE_COST).toBeGreaterThan(0);
	});
});
