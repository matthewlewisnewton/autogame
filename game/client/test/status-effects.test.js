import { describe, it, expect } from 'vitest';
import { computeActiveStatusEffects } from '../vanguard-hud.js';

const NOW = 10_000;

describe('computeActiveStatusEffects()', () => {
	it('returns a burn entry when burningUntil is in the future', () => {
		const effects = computeActiveStatusEffects({ burningUntil: NOW + 3_000 }, NOW);
		expect(effects).toEqual([
			{ id: 'burning', label: 'Burning', icon: '🔥', remainingMs: 3_000 },
		]);
	});

	it('returns a slow entry when slowedUntil is in the future', () => {
		const effects = computeActiveStatusEffects({ slowedUntil: NOW + 1_500 }, NOW);
		expect(effects).toEqual([
			{ id: 'slowed', label: 'Slowed', icon: '🐌', remainingMs: 1_500 },
		]);
	});

	it('returns both entries in a stable order when both are active', () => {
		const effects = computeActiveStatusEffects(
			{ burningUntil: NOW + 2_000, slowedUntil: NOW + 4_000 },
			NOW,
		);
		expect(effects.map((e) => e.id)).toEqual(['burning', 'slowed']);
		expect(effects).toEqual([
			{ id: 'burning', label: 'Burning', icon: '🔥', remainingMs: 2_000 },
			{ id: 'slowed', label: 'Slowed', icon: '🐌', remainingMs: 4_000 },
		]);
	});

	it('excludes effects that are expired, zero, missing, or null', () => {
		expect(computeActiveStatusEffects({ burningUntil: NOW - 1 }, NOW)).toEqual([]);
		expect(computeActiveStatusEffects({ burningUntil: NOW }, NOW)).toEqual([]);
		expect(computeActiveStatusEffects({ burningUntil: 0 }, NOW)).toEqual([]);
		expect(computeActiveStatusEffects({ slowedUntil: null }, NOW)).toEqual([]);
		expect(computeActiveStatusEffects({}, NOW)).toEqual([]);
	});

	it('returns an empty array for a null/undefined player', () => {
		expect(computeActiveStatusEffects(null, NOW)).toEqual([]);
		expect(computeActiveStatusEffects(undefined, NOW)).toEqual([]);
	});
});
