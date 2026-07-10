import { describe, it, expect, vi, afterEach } from 'vitest';
import { wrapSocketListener } from '../socketSafe.js';
import { allowSocketEvent, EVENT_POLICIES } from '../socketRateLimit.js';

describe('socketSafe.wrapSocketListener', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('logs synchronous throws without rethrowing', () => {
		const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const wrapped = wrapSocketListener('playerReady', () => {
			throw new Error('simulated handler fault');
		});

		expect(() => wrapped('payload')).not.toThrow();
		expect(errSpy).toHaveBeenCalled();
		const logged = String(errSpy.mock.calls[0][0]);
		expect(logged).toContain('playerReady');
	});

	it('logs async rejections without rethrowing', async () => {
		const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const wrapped = wrapSocketListener('joinLobby', () => Promise.reject(new Error('async fault')));

		wrapped();
		await vi.waitFor(() => {
			expect(errSpy).toHaveBeenCalled();
		});
		const logged = String(errSpy.mock.calls[0][0]);
		expect(logged).toContain('joinLobby');
	});
});

describe('socket event rate limits', () => {
	it('allows the configured movement burst and drops excess packets', () => {
		const socket = { data: {} };
		const now = Date.now();
		for (let i = 0; i < EVENT_POLICIES.move.burst; i++) {
			expect(allowSocketEvent(socket, 'move', now)).toBe(true);
		}
		expect(allowSocketEvent(socket, 'move', now)).toBe(false);
		expect(socket.data._eventRateLimitDrops).toBe(1);
	});

	it('refills tokens over time', () => {
		const socket = { data: {} };
		const now = Date.now();
		for (let i = 0; i < EVENT_POLICIES.heartbeat.burst; i++) {
			allowSocketEvent(socket, 'heartbeat', now);
		}
		expect(allowSocketEvent(socket, 'heartbeat', now)).toBe(false);
		expect(allowSocketEvent(socket, 'heartbeat', now + 500)).toBe(true);
	});
});
