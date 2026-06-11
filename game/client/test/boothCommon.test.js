import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BOOTH_ACTION_EVENT } from '../boothPrompt.js';
import { createBoothModule, DEBUG_BOOTH_ALLOWED_HOSTS } from '../boothCommon.js';

const BOOTH_ID = 'mock';
const booth = createBoothModule({
	boothId: BOOTH_ID,
	tab: 'mock-tab',
	renderDepKey: 'renderMock',
});

describe('DEBUG_BOOTH_ALLOWED_HOSTS', () => {
	it('includes localhost loopback hosts', () => {
		expect(DEBUG_BOOTH_ALLOWED_HOSTS).toEqual(['localhost', '127.0.0.1', '::1']);
	});
});

describe('createBoothModule()', () => {
	it('gates shouldOpenDebug by booth id and localhost hosts', () => {
		expect(booth.shouldOpenDebug(BOOTH_ID, 'localhost')).toBe(true);
		expect(booth.shouldOpenDebug('other', 'localhost')).toBe(false);
		expect(booth.shouldOpenDebug(BOOTH_ID, 'example.com')).toBe(false);
	});

	it('openBooth calls showGameLobby, setLobbyTab, then render dep', () => {
		const showGameLobby = vi.fn();
		const setLobbyTab = vi.fn();
		const renderMock = vi.fn();
		const callOrder = [];

		showGameLobby.mockImplementation(() => callOrder.push('show'));
		setLobbyTab.mockImplementation(() => callOrder.push('tab'));
		renderMock.mockImplementation(() => callOrder.push('render'));

		booth.openBooth({ showGameLobby, setLobbyTab, renderMock });

		expect(showGameLobby).toHaveBeenCalledOnce();
		expect(setLobbyTab).toHaveBeenCalledWith('mock-tab');
		expect(renderMock).toHaveBeenCalledOnce();
		expect(callOrder).toEqual(['show', 'tab', 'render']);
	});

	it('isBoothAction matches action or boothId', () => {
		expect(booth.isBoothAction({ action: BOOTH_ID })).toBe(true);
		expect(booth.isBoothAction({ boothId: BOOTH_ID })).toBe(true);
		expect(booth.isBoothAction({ action: 'other' })).toBe(false);
		expect(booth.isBoothAction(null)).toBe(false);
	});

	it('createRequestDebugOpener is one-shot when enabled', () => {
		const openFn = vi.fn();
		const deps = { showGameLobby: vi.fn(), setLobbyTab: vi.fn(), renderMock: vi.fn() };
		const requestOpen = booth.createRequestDebugOpener({
			param: BOOTH_ID,
			hostname: 'localhost',
			openFn,
			deps,
		});

		requestOpen();
		requestOpen();

		expect(openFn).toHaveBeenCalledOnce();
		expect(openFn).toHaveBeenCalledWith(deps);
	});

	describe('registerBoothListener', () => {
		beforeEach(() => {
			vi.resetModules();
			document.body.innerHTML = '';
		});

		afterEach(() => {
			document.body.innerHTML = '';
		});

		it('ignores non-matching booth actions', async () => {
			const { createBoothModule: createModule } = await import('../boothCommon.js');
			const freshBooth = createModule({
				boothId: 'isolated',
				tab: 'isolated-tab',
				renderDepKey: 'renderIsolated',
			});
			const showGameLobby = vi.fn();
			const setLobbyTab = vi.fn();
			const renderIsolated = vi.fn();

			freshBooth.registerBoothListener({ showGameLobby, setLobbyTab, renderIsolated });

			window.dispatchEvent(new CustomEvent(BOOTH_ACTION_EVENT, {
				detail: { boothId: 'other', action: 'other' },
			}));

			expect(showGameLobby).not.toHaveBeenCalled();
			expect(setLobbyTab).not.toHaveBeenCalled();
			expect(renderIsolated).not.toHaveBeenCalled();
		});

		it('keeps listenerRegistered independent per module instance', async () => {
			const { createBoothModule: createModule } = await import('../boothCommon.js');
			const boothA = createModule({ boothId: 'a', tab: 'a', renderDepKey: 'renderA' });
			const boothB = createModule({ boothId: 'b', tab: 'b', renderDepKey: 'renderB' });
			const depsA = { showGameLobby: vi.fn(), setLobbyTab: vi.fn(), renderA: vi.fn() };
			const depsB = { showGameLobby: vi.fn(), setLobbyTab: vi.fn(), renderB: vi.fn() };

			boothA.registerBoothListener(depsA);
			boothB.registerBoothListener(depsB);

			window.dispatchEvent(new CustomEvent(BOOTH_ACTION_EVENT, {
				detail: { boothId: 'a', action: 'a' },
			}));

			expect(depsA.showGameLobby).toHaveBeenCalledOnce();
			expect(depsB.showGameLobby).not.toHaveBeenCalled();
		});
	});
});
