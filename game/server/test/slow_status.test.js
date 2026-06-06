import { describe, it, expect, vi, afterEach } from 'vitest';
import { applySlow, isSlowed } from '../index.js';

describe('SLOW status helpers', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('applySlow sets slowedUntil and slowFactor', () => {
		const now = 1_000_000;
		vi.useFakeTimers();
		vi.setSystemTime(now);
		const entity = {};
		applySlow(entity, 2000, 0.4);
		expect(entity.slowedUntil).toBe(now + 2000);
		expect(entity.slowFactor).toBe(0.4);
	});

	it('defaults slowFactor to 0.5 when omitted or invalid', () => {
		const a = {};
		applySlow(a, 1000);
		expect(a.slowFactor).toBe(0.5);

		const b = {};
		applySlow(b, 1000, 0); // out of (0, 1] range
		expect(b.slowFactor).toBe(0.5);

		const c = {};
		applySlow(c, 1000, 2); // > 1
		expect(c.slowFactor).toBe(0.5);

		const d = {};
		applySlow(d, 1000, 'nope');
		expect(d.slowFactor).toBe(0.5);
	});

	it('isSlowed is true while active and false after expiry', () => {
		const now = 1_000_000;
		vi.useFakeTimers();
		vi.setSystemTime(now);
		const entity = {};
		expect(isSlowed(entity)).toBe(false); // never applied
		applySlow(entity, 1000, 0.5);
		expect(isSlowed(entity)).toBe(true);
		vi.setSystemTime(now + 999);
		expect(isSlowed(entity)).toBe(true);
		vi.setSystemTime(now + 1000);
		expect(isSlowed(entity)).toBe(false); // expired (now == slowedUntil)
		vi.setSystemTime(now + 5000);
		expect(isSlowed(entity)).toBe(false);
	});

	it('re-application refreshes to the later expiry and never shortens', () => {
		const now = 1_000_000;
		vi.useFakeTimers();
		vi.setSystemTime(now);
		const entity = {};
		applySlow(entity, 5000, 0.5);
		const longExpiry = entity.slowedUntil;

		// A shorter slow must NOT shorten the existing longer window.
		applySlow(entity, 1000, 0.3);
		expect(entity.slowedUntil).toBe(longExpiry);
		// ...but the active factor reflects the most recent application.
		expect(entity.slowFactor).toBe(0.3);

		// A longer slow extends the window.
		vi.setSystemTime(now + 100);
		applySlow(entity, 9000, 0.6);
		expect(entity.slowedUntil).toBe(now + 100 + 9000);
		expect(entity.slowFactor).toBe(0.6);
	});

	it('works identically for player-shaped and enemy-shaped entities', () => {
		const player = { id: 'p1', hp: 100 };
		const enemy = { id: 'e1', type: 'grunt', hp: 50 };
		applySlow(player, 1000, 0.5);
		applySlow(enemy, 1000, 0.5);
		expect(isSlowed(player)).toBe(true);
		expect(isSlowed(enemy)).toBe(true);
	});

	it('tolerates a null entity without throwing', () => {
		expect(() => applySlow(null, 1000, 0.5)).not.toThrow();
		expect(isSlowed(null)).toBe(false);
		expect(isSlowed(undefined)).toBe(false);
	});
});
