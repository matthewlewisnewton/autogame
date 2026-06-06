import { describe, it, expect, vi, afterEach } from 'vitest';
import { applyBurning, isBurning } from '../index.js';

describe('BURNING status helpers', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('applyBurning sets burningUntil', () => {
		const now = 1_000_000;
		vi.useFakeTimers();
		vi.setSystemTime(now);
		const entity = {};
		applyBurning(entity, 2000);
		expect(entity.burningUntil).toBe(now + 2000);
	});

	it('isBurning is true while active and false after expiry', () => {
		const now = 1_000_000;
		vi.useFakeTimers();
		vi.setSystemTime(now);
		const entity = {};
		expect(isBurning(entity)).toBe(false); // never applied
		applyBurning(entity, 1000);
		expect(isBurning(entity)).toBe(true);
		vi.setSystemTime(now + 999);
		expect(isBurning(entity)).toBe(true);
		vi.setSystemTime(now + 1000);
		expect(isBurning(entity)).toBe(false); // expired (now == burningUntil)
		vi.setSystemTime(now + 5000);
		expect(isBurning(entity)).toBe(false);
	});

	it('re-application extends to the later expiry and never shortens', () => {
		const now = 1_000_000;
		vi.useFakeTimers();
		vi.setSystemTime(now);
		const entity = {};
		applyBurning(entity, 5000);
		const longExpiry = entity.burningUntil;

		// A shorter burn must NOT shorten the existing longer window.
		applyBurning(entity, 1000);
		expect(entity.burningUntil).toBe(longExpiry);

		// A longer burn extends the window (no additive stacking).
		vi.setSystemTime(now + 100);
		applyBurning(entity, 9000);
		expect(entity.burningUntil).toBe(now + 100 + 9000);
	});

	it('works identically for player-shaped and enemy-shaped entities', () => {
		const player = { id: 'p1', hp: 100 };
		const enemy = { id: 'e1', type: 'grunt', hp: 50 };
		applyBurning(player, 1000);
		applyBurning(enemy, 1000);
		expect(isBurning(player)).toBe(true);
		expect(isBurning(enemy)).toBe(true);
	});

	it('tolerates a null entity without throwing', () => {
		expect(() => applyBurning(null, 1000)).not.toThrow();
		expect(isBurning(null)).toBe(false);
		expect(isBurning(undefined)).toBe(false);
	});
});
