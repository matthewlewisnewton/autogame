import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const DEFAULT_COSMETIC = {
	bodyColor: '#4f9dde',
	accentColor: '#f2c94c',
	bodyShape: 'box'
};

describe('cosmetic profile client state', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('loadAccountSettings stores cosmetic from GET /api/me', async () => {
		const customCosmetic = { bodyColor: '#010203', accentColor: '#040506', bodyShape: 'cone' };
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				username: 'testuser',
				email: null,
				settings: {},
				cosmetic: customCosmetic
			})
		});

		const { loadAccountSettings, getCosmetic } = await import('../settings.js');
		await loadAccountSettings('token');
		expect(getCosmetic()).toEqual(customCosmetic);
	});

	it('loadAccountSettings defaults cosmetic when absent from GET /api/me', async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				username: 'testuser',
				settings: {}
			})
		});

		const { loadAccountSettings, getCosmetic } = await import('../settings.js');
		await loadAccountSettings('token');
		expect(getCosmetic()).toEqual(DEFAULT_COSMETIC);
	});

	it('getCosmetic returns defaults before load and never undefined', async () => {
		const { getCosmetic } = await import('../settings.js');
		expect(getCosmetic()).toEqual(DEFAULT_COSMETIC);
	});

	it('getCosmetic returns a shallow copy', async () => {
		const { getCosmetic } = await import('../settings.js');
		const copy = getCosmetic();
		copy.bodyColor = '#000000';
		expect(getCosmetic().bodyColor).toBe(DEFAULT_COSMETIC.bodyColor);
	});

	it('successful patchProfile({ cosmetic }) sends PATCH and updates cache', async () => {
		const updated = { bodyColor: '#aabbcc', accentColor: '#f2c94c', bodyShape: 'capsule' };
		global.fetch = vi.fn()
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ username: 'u', settings: {}, cosmetic: DEFAULT_COSMETIC })
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ username: 'u', email: null, cosmetic: updated })
			});

		const { loadAccountSettings, patchProfile, getCosmetic } = await import('../settings.js');
		await loadAccountSettings('token');
		const patchFields = { cosmetic: { bodyShape: 'capsule', bodyColor: '#aabbcc' } };
		const result = await patchProfile(patchFields);
		expect(result.error).toBeUndefined();
		expect(getCosmetic()).toEqual(updated);
		expect(global.fetch).toHaveBeenLastCalledWith('/api/me/profile', expect.objectContaining({
			method: 'PATCH',
			body: JSON.stringify(patchFields)
		}));
	});

	it('failed profile PATCH does not mutate cached cosmetic', async () => {
		const initial = { bodyColor: '#111111', accentColor: '#222222', bodyShape: 'cylinder' };
		global.fetch = vi.fn()
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ username: 'u', settings: {}, cosmetic: initial })
			})
			.mockResolvedValueOnce({
				ok: false,
				status: 400,
				json: async () => ({ error: 'Invalid cosmetic' })
			});

		const { loadAccountSettings, patchProfile, getCosmetic } = await import('../settings.js');
		await loadAccountSettings('token');
		const result = await patchProfile({ cosmetic: { bodyShape: 'pyramid' } });
		expect(result.error).toBeTruthy();
		expect(getCosmetic()).toEqual(initial);
	});
});
