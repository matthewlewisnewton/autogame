import { describe, it, expect, vi } from 'vitest';
import {
	resolveGameServerProxyTarget,
	isHarnessCapture,
	probeGameServerHealthz,
	waitForGameServerReady,
} from '../vite.config.js';

const emptyLoaded = {};

describe('resolveGameServerProxyTarget', () => {
	it('prefers HARNESS_GAME_PORT over PORT and default 3000', () => {
		expect(
			resolveGameServerProxyTarget(
				{ HARNESS_GAME_PORT: '3007', PORT: '3000' },
				'development',
				emptyLoaded
			)
		).toBe('http://127.0.0.1:3007');
	});

	it('falls back to PORT when HARNESS_GAME_PORT is unset', () => {
		expect(
			resolveGameServerProxyTarget({ PORT: '3001' }, 'development', emptyLoaded)
		).toBe('http://127.0.0.1:3001');
	});

	it('prefers subprocess env over .env file values', () => {
		expect(
			resolveGameServerProxyTarget(
				{ HARNESS_GAME_PORT: '3007' },
				'development',
				{ HARNESS_GAME_PORT: '3001', PORT: '3000' }
			)
		).toBe('http://127.0.0.1:3007');
	});

	it('defaults to port 3000 when no env vars are set', () => {
		expect(
			resolveGameServerProxyTarget({}, 'development', emptyLoaded)
		).toBe('http://127.0.0.1:3000');
	});
});

describe('isHarnessCapture', () => {
	it('is true when HARNESS_GAME_PORT is set in subprocess env', () => {
		expect(isHarnessCapture({ HARNESS_GAME_PORT: '3001' }, {})).toBe(true);
	});

	it('is true when HARNESS_GAME_PORT is set only in loaded env', () => {
		expect(isHarnessCapture({}, { HARNESS_GAME_PORT: '3001' })).toBe(true);
	});

	it('is false for normal local dev without harness env', () => {
		expect(isHarnessCapture({}, {})).toBe(false);
	});
});

describe('probeGameServerHealthz', () => {
	it('returns true only for HTTP 200 with { ok: true }', async () => {
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
		await expect(
			probeGameServerHealthz('http://127.0.0.1:3001', fetchImpl)
		).resolves.toBe(true);

		const notReady = vi
			.fn()
			.mockResolvedValueOnce({ ok: false, json: async () => ({ ok: false }) });
		await expect(
			probeGameServerHealthz('http://127.0.0.1:3001', notReady)
		).resolves.toBe(false);
	});
});

describe('waitForGameServerReady', () => {
	it('resolves true after consecutive /healthz successes', async () => {
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce({ ok: false, json: async () => ({ ok: false }) })
			.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });

		await expect(
			waitForGameServerReady('http://127.0.0.1:3001', {
				intervalMs: 1,
				stableGapMs: 1,
				stableProbes: 3,
				fetchImpl,
			})
		).resolves.toBe(true);
		expect(fetchImpl).toHaveBeenCalledTimes(4);
	});

	it('resets the stability streak when /healthz flips back to not-ready', async () => {
		const sequence = [
			{ ok: true, json: async () => ({ ok: true }) },
			{ ok: true, json: async () => ({ ok: true }) },
			{ ok: false, json: async () => ({ ok: false }) },
			{ ok: true, json: async () => ({ ok: true }) },
			{ ok: true, json: async () => ({ ok: true }) },
			{ ok: true, json: async () => ({ ok: true }) },
		];
		const fetchImpl = vi.fn().mockImplementation(() => {
			const next = sequence.shift();
			return Promise.resolve(
				next ?? { ok: true, json: async () => ({ ok: true }) }
			);
		});

		await expect(
			waitForGameServerReady('http://127.0.0.1:3001', {
				intervalMs: 1,
				stableGapMs: 1,
				stableProbes: 3,
				fetchImpl,
			})
		).resolves.toBe(true);
	});

	it('resolves false when the backend never becomes ready', async () => {
		const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

		await expect(
			waitForGameServerReady('http://127.0.0.1:3099', {
				timeoutMs: 50,
				intervalMs: 10,
				fetchImpl,
			})
		).resolves.toBe(false);
	});
});
