import { describe, it, expect, vi, afterEach } from 'vitest';
import { wrapSocketListener } from '../socketSafe.js';

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
