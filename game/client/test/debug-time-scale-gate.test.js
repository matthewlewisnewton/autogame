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
	'quest-board', 'quest-board-wrapper', 'quest-error', 'booth-prompt', 'lobby-status-banner',
	'debug-time-scale-badge',
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

function dispatchShiftT(target = window) {
	target.dispatchEvent(new KeyboardEvent('keydown', { key: 'T', shiftKey: true, bubbles: true }));
}

function timeScaleEmits() {
	return window.__socketEmitLog().filter((entry) => entry.event === 'setDebugTimeScale');
}

// Pushes a minimal playing-phase snapshot through the real stateUpdate handler
// so debugTimeScaleAllowed is tracked from the server-reported flag.
function pushSnapshot(allowed) {
	window.__triggerSocketEvent('stateUpdate', {
		gamePhase: 'playing',
		players: { p1: { hp: 80, magicStones: 40, x: 0, z: 0 } },
		enemies: [],
		debugTimeScale: 1,
		debugTimeScaleAllowed: allowed,
	});
}

describe('debug time-scale client gate (main.js)', () => {
	beforeEach(() => {
		vi.resetModules();
		document.body.innerHTML = '';
		ensureMainDom();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('Shift+T does not emit on localhost until the server reports the feature authorized', async () => {
		stubLocation('localhost');
		await import('../main.js');
		window.__setGameState({ gamePhase: 'playing', players: { p1: { hp: 80, x: 0, z: 0 } }, enemies: [] }, 'p1');
		window.__clearSocketEmitLog();

		dispatchShiftT();

		expect(timeScaleEmits()).toHaveLength(0);
	});

	it('Shift+T emits setDebugTimeScale once the snapshot reports debugTimeScaleAllowed:true', async () => {
		stubLocation('localhost');
		await import('../main.js');
		window.__setGameState({ gamePhase: 'playing', players: { p1: { hp: 80, x: 0, z: 0 } }, enemies: [] }, 'p1');
		pushSnapshot(true);
		window.__clearSocketEmitLog();

		dispatchShiftT();

		expect(timeScaleEmits()).toHaveLength(1);
	});

	it('Shift+T stops emitting again after the snapshot revokes authorization', async () => {
		stubLocation('localhost');
		await import('../main.js');
		window.__setGameState({ gamePhase: 'playing', players: { p1: { hp: 80, x: 0, z: 0 } }, enemies: [] }, 'p1');
		pushSnapshot(true);
		pushSnapshot(false);
		window.__clearSocketEmitLog();

		dispatchShiftT();

		expect(timeScaleEmits()).toHaveLength(0);
	});

	it('__setDebugTimeScaleForTest no-ops when not authorized and emits when authorized', async () => {
		stubLocation('localhost');
		await import('../main.js');
		window.__setGameState({ gamePhase: 'playing', players: { p1: { hp: 80, x: 0, z: 0 } }, enemies: [] }, 'p1');
		window.__clearSocketEmitLog();

		window.__setDebugTimeScaleForTest(0.5);
		expect(timeScaleEmits()).toHaveLength(0);

		pushSnapshot(true);
		window.__clearSocketEmitLog();
		window.__setDebugTimeScaleForTest(0.5);
		expect(timeScaleEmits()).toHaveLength(1);
	});

	it('exposes debugTimeScaleAllowed in the harness state', async () => {
		stubLocation('localhost');
		await import('../main.js');
		window.__setGameState({ gamePhase: 'playing', players: { p1: { hp: 80, x: 0, z: 0 } }, enemies: [] }, 'p1');

		expect(window.__AUTOGAME_HARNESS_STATE__().debugTimeScaleAllowed).toBe(false);
		pushSnapshot(true);
		expect(window.__AUTOGAME_HARNESS_STATE__().debugTimeScaleAllowed).toBe(true);
	});
});
