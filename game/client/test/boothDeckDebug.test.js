import { describe, it, expect, vi } from 'vitest';
import {
	shouldOpenDebugBooth,
	createRequestDebugBoothOpener,
} from '../boothDeck.js';

describe('shouldOpenDebugBooth()', () => {
	it('allows deck on localhost-only hosts', () => {
		expect(shouldOpenDebugBooth('deck', 'localhost')).toBe(true);
		expect(shouldOpenDebugBooth('deck', '127.0.0.1')).toBe(true);
		expect(shouldOpenDebugBooth('deck', '::1')).toBe(true);
	});

	it('rejects missing or non-deck params', () => {
		expect(shouldOpenDebugBooth(null, 'localhost')).toBe(false);
		expect(shouldOpenDebugBooth('', 'localhost')).toBe(false);
		expect(shouldOpenDebugBooth('shop', 'localhost')).toBe(false);
	});

	it('rejects deck on non-localhost hostnames', () => {
		expect(shouldOpenDebugBooth('deck', 'example.com')).toBe(false);
		expect(shouldOpenDebugBooth('deck', 'staging.mygame.io')).toBe(false);
	});
});

describe('createRequestDebugBoothOpener()', () => {
	it('calls openDeckBooth exactly once when enabled', () => {
		const showGameLobby = vi.fn();
		const setLobbyTab = vi.fn();
		const renderDeckEditor = vi.fn();
		const openFn = vi.fn();
		const deps = { showGameLobby, setLobbyTab, renderDeckEditor };
		const requestOpen = createRequestDebugBoothOpener({
			param: 'deck',
			hostname: 'localhost',
			openDeckBooth: openFn,
			deps,
		});

		requestOpen();
		requestOpen();

		expect(openFn).toHaveBeenCalledOnce();
		expect(openFn).toHaveBeenCalledWith(deps);
	});

	it('is a no-op when gating fails', () => {
		const openFn = vi.fn();
		const requestOpen = createRequestDebugBoothOpener({
			param: 'deck',
			hostname: 'prod.example.com',
			openDeckBooth: openFn,
			deps: {},
		});

		requestOpen();
		requestOpen();

		expect(openFn).not.toHaveBeenCalled();
	});
});
