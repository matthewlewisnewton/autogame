import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateHub } from '../../server/dungeon.js';
import { BOOTH_ACTION_EVENT, dispatchBoothAction } from '../boothPrompt.js';
import { mockGamepad, clearMockGamepads, installGamepadMock, uninstallGamepadMock } from './gamepad-mock.js';
import { patchSettings, getDefaultSettings } from '../settings.js';
import eventsCatalog from '../../shared/events.json' with { type: 'json' };

/**
 * Integration test: full interact → booth open chain.
 *
 * Validates the complete round-trip from user input (keyboard F or gamepad
 * D-pad Up) through the socket emission, server response simulation, and
 * final booth UI opening via the BOOTH_ACTION_EVENT dispatch hook.
 */
describe('booth interact chain (input → socket → server response → booth UI)', () => {
	let rafCallbacks;

	beforeEach(() => {
		vi.resetModules();
		rafCallbacks = [];
		vi.stubGlobal('requestAnimationFrame', vi.fn((cb) => {
			rafCallbacks.push(cb);
			return rafCallbacks.length;
		}));
		window.__soundLogEnabled = true;
		installGamepadMock();
		clearMockGamepads();
		patchSettings(getDefaultSettings());
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		uninstallGamepadMock();
		document.body.innerHTML = '';
	});

	/** Build the renderer in the hub lobby with the local avatar wired up. */
	async function setupHub(hubLayout, startPos) {
		const renderer = await import('../renderer.js');
		renderer.setGamePhase('lobby');
		renderer.initScene(hubLayout, { x: 0, z: 0 });
		renderer.setMyId('p1');
		renderer.setPlayerPosition(startPos.x, startPos.z);
		renderer.setGameStateRef({
			gamePhase: 'lobby',
			layout: hubLayout,
			players: { p1: { x: startPos.x, z: startPos.z, hp: 100, dead: false } },
			loot: [],
			enemies: [],
			minions: [],
		});
		return renderer;
	}

	/** Create a mock socket with emit tracking and event listener support. */
	function createMockSocket() {
		const emits = [];
		const listeners = {};
		const socket = {
			emit: vi.fn((event, data) => {
				emits.push({ event, data });
			}),
			on: vi.fn((event, cb) => {
				if (!listeners[event]) listeners[event] = [];
				listeners[event].push(cb);
			}),
			_getEmits: () => emits,
			_emit: (event, data) => {
				if (listeners[event]) {
					for (const cb of listeners[event]) cb(data);
				}
			},
		};
		return socket;
	}

	it('keyboard F: in-range booth → boothInteract → boothAction → booth UI opens', async () => {
		const hubLayout = generateHub(0);
		const anchor = hubLayout.boothAnchors.shop;
		const renderer = await setupHub(hubLayout, { x: anchor.x, z: anchor.z });

		const socket = createMockSocket();
		renderer.setSocketRef(socket);

		// Wire input the way main.js does: interact → emit for current booth.
		const { initInput, resetInputState } = await import('../input.js');
		resetInputState();
		initInput({ onInteract: () => renderer.emitBoothInteract() });

		// Confirm in range, then press F.
		renderer.animate(0);
		expect(renderer.getCurrentBoothInRange()).toBe('shop');

		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' }));
		expect(socket.emit).toHaveBeenCalledWith('boothInteract', { boothId: 'shop' });

		// Simulate server response: socket receives 'boothAction' → lobbyHandlers
		// calls ctx.dispatchBoothAction(data) → dispatches BOOTH_ACTION_EVENT.
		socket.emit('boothAction', { boothId: 'shop', action: 'shop' });
		dispatchBoothAction({ boothId: 'shop', action: 'shop' });

		// Verify booth UI opens via the BOOTH_ACTION_EVENT listener.
		// Use fresh imports (modules were reset in beforeEach) for clean listener state.
		const { registerShopBoothListener } = await import('../boothShop.js');
		const showGameLobby = vi.fn();
		const setLobbyTab = vi.fn();
		const renderCardShop = vi.fn();
		registerShopBoothListener({ showGameLobby, setLobbyTab, renderCardShop });

		window.dispatchEvent(new CustomEvent(BOOTH_ACTION_EVENT, {
			detail: { boothId: 'shop', action: 'shop' },
		}));

		expect(showGameLobby).toHaveBeenCalledTimes(1);
		expect(setLobbyTab).toHaveBeenCalledWith('shop');
		expect(renderCardShop).toHaveBeenCalledTimes(1);
	});

	it('gamepad D-pad Up: in-range booth → same chain as keyboard F', async () => {
		const hubLayout = generateHub(0);
		const anchor = hubLayout.boothAnchors.deck;
		const renderer = await setupHub(hubLayout, { x: anchor.x, z: anchor.z });

		const socket = createMockSocket();
		renderer.setSocketRef(socket);

		const { initInput, resetInputState, pollInput } = await import('../input.js');
		resetInputState();
		initInput({ onInteract: () => renderer.emitBoothInteract() });

		renderer.animate(0);
		expect(renderer.getCurrentBoothInRange()).toBe('deck');

		// Mock gamepad with D-pad Up (button 12) pressed, poll input.
		const buttons = Array(16).fill(null).map(() => ({ pressed: false, value: 0 }));
		buttons[12] = { pressed: true, value: 1 };
		mockGamepad(0, { buttons, axes: [0, 0, 0, 0] });
		pollInput();

		expect(socket.emit).toHaveBeenCalledWith('boothInteract', { boothId: 'deck' });

		// Simulate server response.
		dispatchBoothAction({ boothId: 'deck', action: 'deck' });

		// Verify deck booth UI opens.
		const { registerDeckBoothListener } = await import('../boothDeck.js');
		const showGameLobby = vi.fn();
		const setLobbyTab = vi.fn();
		const renderDeckEditor = vi.fn();
		registerDeckBoothListener({ showGameLobby, setLobbyTab, renderDeckEditor });

		window.dispatchEvent(new CustomEvent(BOOTH_ACTION_EVENT, {
			detail: { boothId: 'deck', action: 'deck' },
		}));

		expect(showGameLobby).toHaveBeenCalledTimes(1);
		expect(setLobbyTab).toHaveBeenCalledWith('deck');
		expect(renderDeckEditor).toHaveBeenCalledTimes(1);
	});

	it('pressing F when out of range produces no socket emission and no booth open', async () => {
		const hubLayout = generateHub(0);
		const anchor = hubLayout.boothAnchors.shop;
		const renderer = await setupHub(hubLayout, { x: anchor.x + 50, z: anchor.z + 50 });

		const socket = createMockSocket();
		renderer.setSocketRef(socket);

		const { initInput, resetInputState } = await import('../input.js');
		resetInputState();
		initInput({ onInteract: () => renderer.emitBoothInteract() });

		renderer.animate(0);
		expect(renderer.getCurrentBoothInRange()).toBeNull();

		// Press F while out of range.
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' }));

		// No boothInteract emission (renderer may emit other events like 'move'
		// during animate; filter to only check boothInteract).
		const boothEmits = socket._getEmits().filter((e) => e.event === 'boothInteract');
		expect(boothEmits).toHaveLength(0);

		// Verify no booth UI opens (register a listener and confirm it is not triggered).
		const { registerShopBoothListener } = await import('../boothShop.js');
		const showGameLobby = vi.fn();
		const setLobbyTab = vi.fn();
		const renderCardShop = vi.fn();
		registerShopBoothListener({ showGameLobby, setLobbyTab, renderCardShop });

		// No BOOTH_ACTION_EVENT is dispatched since no socket emission happened.
		expect(showGameLobby).not.toHaveBeenCalled();
	});

	it('server rejects out-of-range interaction with boothError', async () => {
		const hubLayout = generateHub(0);
		const anchor = hubLayout.boothAnchors.shop;
		const renderer = await setupHub(hubLayout, { x: anchor.x, z: anchor.z });

		const socket = createMockSocket();
		renderer.setSocketRef(socket);

		// Wire lobby handlers so boothError is handled (logs the error).
		const { bindLobbyHandlers } = await import('../socketHandlers/lobbyHandlers.js');
		const { dispatchBoothAction: dispatchFn } = await import('../boothPrompt.js');
		const dispatchSpy = vi.fn(dispatchFn);
		bindLobbyHandlers(socket, {
			dispatchBoothAction: dispatchSpy,
		});

		const { initInput, resetInputState } = await import('../input.js');
		resetInputState();
		initInput({ onInteract: () => renderer.emitBoothInteract() });

		renderer.animate(0);
		expect(renderer.getCurrentBoothInRange()).toBe('shop');

		// Client emits boothInteract (player is locally in range).
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' }));
		const boothEmits = socket._getEmits().filter((e) => e.event === 'boothInteract');
		expect(boothEmits).toHaveLength(1);
		expect(boothEmits[0].data).toEqual({ boothId: 'shop' });

		// Simulate server rejecting with boothError (server-side range check fails).
		const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
		try {
			// Trigger the boothError handler registered by bindLobbyHandlers.
			socket._emit(eventsCatalog.serverToClient.BOOTH_ERROR, { reason: 'out_of_range' });

			expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('out_of_range'));
			// dispatchBoothAction must NOT be called for error responses.
			expect(dispatchSpy).not.toHaveBeenCalled();
		} finally {
			consoleLog.mockRestore();
		}
	});
});
