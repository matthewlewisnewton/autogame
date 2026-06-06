import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const gltfLoadMock = vi.hoisted(() => vi.fn());

vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
	GLTFLoader: vi.fn(function GLTFLoader() {
		this.load = gltfLoadMock;
	}),
}));

const MAIN_DOM_IDS = [
	'status', 'vanguard-hud', 'character-id', 'player-level',
	'hp-bar-container', 'hp-label', 'hp-bar-bg', 'hp-bar-fill', 'hp-text',
	'ms-bar-container', 'ms-label', 'ms-bar-bg', 'ms-bar-fill', 'ms-text',
	'deck-count', 'deck-weapon-count', 'deck-spell-count', 'deck-creature-count', 'deck-enchantment-count',
	'currency-display', 'objective-hud', 'ui', 'card-hand',
	'lobby', 'lobby-browser', 'lobby-player-list',
	'run-summary-overlay', 'summary-status', 'summary-duration', 'summary-enemies',
	'summary-currency', 'summary-rewards', 'summary-rewards-currency',
	'summary-rewards-cards', 'summary-card-choices', 'summary-card-choices-heading',
	'summary-card-choices-list', 'summary-card-choices-empty', 'return-to-lobby-btn',
	'owned-cards-list', 'selected-deck-list', 'deck-size-display', 'deck-error',
	'quest-board', 'quest-board-wrapper', 'quest-error', 'booth-prompt', 'suspended-run-banner',
];

function ensureElement(id, tag = 'div') {
	if (document.getElementById(id)) return;
	const el = document.createElement(tag);
	el.id = id;
	document.body.appendChild(el);
}

const OVERLAY_IDS = new Set(['run-summary-overlay']);

function ensureMainDom() {
	for (const id of MAIN_DOM_IDS) {
		const tag = (id === 'return-to-lobby-btn') ? 'button' : 'div';
		ensureElement(id, tag);
		if (OVERLAY_IDS.has(id)) {
			document.getElementById(id).classList.add('hidden');
		}
	}
	const cardHand = document.getElementById('card-hand');
	if (cardHand && cardHand.querySelectorAll('.card-slot').length === 0) {
		for (let i = 0; i < 6; i++) {
			const slot = document.createElement('div');
			slot.className = 'card-slot';
			slot.dataset.slotIndex = String(i);
			cardHand.appendChild(slot);
		}
	}
}

function stubLocation(hostname, search = '') {
	const q = search ? (search.startsWith('?') ? search : `?${search}`) : '';
	const url = new URL(`http://${hostname}:5173/${q}`);
	vi.stubGlobal('location', {
		hostname,
		host: `${hostname}:5173`,
		protocol: 'http:',
		search: url.search,
		href: url.href,
		pathname: url.pathname,
	});
}

function dispatchShiftG(target = window) {
	target.dispatchEvent(new KeyboardEvent('keydown', { key: 'G', shiftKey: true, bubbles: true }));
}

describe('debug godmode toggle (main.js)', () => {
	beforeEach(() => {
		vi.resetModules();
		document.body.innerHTML = '';
		ensureMainDom();
		try { localStorage.setItem('autogame_token', 'test-fake-jwt-token'); } catch (_) { /* ignore */ }
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('Shift+G emits toggleDebugGodmode when debugScenarioAllowed is true', async () => {
		stubLocation('localhost');
		await import('../main.js');
		window.__clearSocketEmitLog();

		dispatchShiftG();

		const log = window.__socketEmitLog();
		expect(log.filter((entry) => entry.event === 'toggleDebugGodmode')).toHaveLength(1);
	});

	it('Shift+G does not emit toggleDebugGodmode when debugScenarioAllowed is false', async () => {
		stubLocation('example.com');
		await import('../main.js');
		window.__clearSocketEmitLog();

		dispatchShiftG();

		const log = window.__socketEmitLog();
		expect(log.filter((entry) => entry.event === 'toggleDebugGodmode')).toHaveLength(0);
	});

	it('Shift+G is swallowed when focus is in a text input', async () => {
		stubLocation('127.0.0.1');
		await import('../main.js');
		const input = document.createElement('input');
		document.body.appendChild(input);
		window.__clearSocketEmitLog();

		dispatchShiftG(input);

		const log = window.__socketEmitLog();
		expect(log.filter((entry) => entry.event === 'toggleDebugGodmode')).toHaveLength(0);
	});

	it('__toggleDebugGodmodeForTest emits toggleDebugGodmode when the socket is ready', async () => {
		stubLocation('localhost');
		await import('../main.js');
		window.__clearSocketEmitLog();

		window.__toggleDebugGodmodeForTest();

		const log = window.__socketEmitLog();
		expect(log.filter((entry) => entry.event === 'toggleDebugGodmode')).toHaveLength(1);
	});

	it('mirrors debugGodmode onto local player when toggle succeeds', async () => {
		stubLocation('localhost');
		await import('../main.js');
		window.__setGameState({
			gamePhase: 'playing',
			players: {
				p1: { hp: 80, magicStones: 40, x: 0, z: 0, debugGodmode: false },
			},
			enemies: [],
		}, 'p1');
		window.__triggerSocketEvent('debugGodmodeResult', { ok: true, enabled: true });
		const harness = window.__AUTOGAME_HARNESS_STATE__();
		expect(harness.player.debugGodmode).toBe(true);
		expect(harness.debugGodmodeResult).toEqual({ ok: true, enabled: true });
	});

	it('stores debugGodmodeResult in harness state and logs success/failure', async () => {
		stubLocation('localhost');
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		await import('../main.js');

		window.__triggerSocketEvent('debugGodmodeResult', { ok: true, enabled: true });
		expect(window.__AUTOGAME_HARNESS_STATE__().debugGodmodeResult).toEqual({ ok: true, enabled: true });
		expect(logSpy).toHaveBeenCalledWith('[debugGodmode] enabled');

		window.__triggerSocketEvent('debugGodmodeResult', { ok: true, enabled: false });
		expect(logSpy).toHaveBeenCalledWith('[debugGodmode] disabled');

		window.__triggerSocketEvent('debugGodmodeResult', { ok: false, reason: 'Debug godmode is disabled' });
		expect(window.__AUTOGAME_HARNESS_STATE__().debugGodmodeResult).toEqual({
			ok: false,
			reason: 'Debug godmode is disabled',
		});
		expect(warnSpy).toHaveBeenCalledWith('[debugGodmode] Debug godmode is disabled');

		logSpy.mockRestore();
		warnSpy.mockRestore();
	});
});
