import { describe, it, expect, afterEach, vi } from 'vitest';
import { localSlowFactor } from '../renderer.js';

// localSlowFactor() drives the client movement-prediction speed: it returns the
// active slow factor while the local player is slowed (so prediction tracks the
// server's reduced speed and does not rubber-band), and 1 otherwise.

describe('localSlowFactor()', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('returns 1 when the snapshot is missing', () => {
		expect(localSlowFactor(null)).toBe(1);
		expect(localSlowFactor(undefined)).toBe(1);
	});

	it('returns 1 when not slowed (no slowedUntil)', () => {
		expect(localSlowFactor({ slowFactor: 0.5 })).toBe(1);
	});

	it('returns 1 when the slow has already expired', () => {
		const now = 10_000;
		vi.useFakeTimers();
		vi.setSystemTime(now);
		expect(localSlowFactor({ slowedUntil: now - 1, slowFactor: 0.5 })).toBe(1);
	});

	it('returns the broadcast slowFactor while slowed', () => {
		const now = 10_000;
		vi.useFakeTimers();
		vi.setSystemTime(now);
		expect(localSlowFactor({ slowedUntil: now + 1000, slowFactor: 0.3 })).toBe(0.3);
	});

	it('falls back to the server default (0.5) when slowed but slowFactor is missing or invalid', () => {
		const now = 10_000;
		vi.useFakeTimers();
		vi.setSystemTime(now);
		expect(localSlowFactor({ slowedUntil: now + 1000 })).toBe(0.5);
		expect(localSlowFactor({ slowedUntil: now + 1000, slowFactor: 0 })).toBe(0.5);
		expect(localSlowFactor({ slowedUntil: now + 1000, slowFactor: 2 })).toBe(0.5);
		expect(localSlowFactor({ slowedUntil: now + 1000, slowFactor: -0.5 })).toBe(0.5);
	});
});
