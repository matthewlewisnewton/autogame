import { describe, it, expect, vi } from 'vitest';
import {
	shouldOpenDebugShopBooth,
	createRequestDebugShopBoothOpener,
} from '../boothShop.js';

describe('shouldOpenDebugShopBooth()', () => {
	it('allows shop on localhost-only hosts', () => {
		expect(shouldOpenDebugShopBooth('shop', 'localhost')).toBe(true);
		expect(shouldOpenDebugShopBooth('shop', '127.0.0.1')).toBe(true);
		expect(shouldOpenDebugShopBooth('shop', '::1')).toBe(true);
	});

	it('rejects missing or non-shop params', () => {
		expect(shouldOpenDebugShopBooth(null, 'localhost')).toBe(false);
		expect(shouldOpenDebugShopBooth('', 'localhost')).toBe(false);
		expect(shouldOpenDebugShopBooth('deck', 'localhost')).toBe(false);
	});

	it('rejects shop on non-localhost hostnames', () => {
		expect(shouldOpenDebugShopBooth('shop', 'example.com')).toBe(false);
		expect(shouldOpenDebugShopBooth('shop', 'staging.mygame.io')).toBe(false);
	});
});

describe('createRequestDebugShopBoothOpener()', () => {
	it('calls openShopBooth exactly once when enabled', () => {
		const showGameLobby = vi.fn();
		const setLobbyTab = vi.fn();
		const renderCardShop = vi.fn();
		const openFn = vi.fn();
		const deps = { showGameLobby, setLobbyTab, renderCardShop };
		const requestOpen = createRequestDebugShopBoothOpener({
			param: 'shop',
			hostname: 'localhost',
			openShopBooth: openFn,
			deps,
		});

		requestOpen();
		requestOpen();

		expect(openFn).toHaveBeenCalledOnce();
		expect(openFn).toHaveBeenCalledWith(deps);
	});

	it('is a no-op when gating fails', () => {
		const openFn = vi.fn();
		const requestOpen = createRequestDebugShopBoothOpener({
			param: 'shop',
			hostname: 'prod.example.com',
			openShopBooth: openFn,
			deps: {},
		});

		requestOpen();
		requestOpen();

		expect(openFn).not.toHaveBeenCalled();
	});
});
