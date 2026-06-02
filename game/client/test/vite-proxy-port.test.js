import { describe, it, expect } from 'vitest';
import { resolveGamePort } from '../vite.config.js';

describe('resolveGamePort()', () => {
	it('defaults to 3000 when port env vars are unset', () => {
		expect(resolveGamePort({})).toBe(3000);
	});

	it('uses PORT when set', () => {
		expect(resolveGamePort({ PORT: '3004' })).toBe(3004);
	});

	it('uses HARNESS_GAME_PORT when set', () => {
		expect(resolveGamePort({ HARNESS_GAME_PORT: '3010' })).toBe(3010);
	});

	it('prefers HARNESS_GAME_PORT over PORT', () => {
		expect(
			resolveGamePort({ PORT: '3004', HARNESS_GAME_PORT: '3010' })
		).toBe(3010);
	});

	it('falls back to 3000 for non-finite or non-positive values', () => {
		expect(resolveGamePort({ PORT: 'abc' })).toBe(3000);
		expect(resolveGamePort({ PORT: '0' })).toBe(3000);
		expect(resolveGamePort({ PORT: '-1' })).toBe(3000);
		expect(resolveGamePort({ HARNESS_GAME_PORT: 'NaN' })).toBe(3000);
	});
});
