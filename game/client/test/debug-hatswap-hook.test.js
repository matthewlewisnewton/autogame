import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const gltfLoadMock = vi.hoisted(() => vi.fn());

vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
	GLTFLoader: vi.fn(function GLTFLoader() {
		this.load = gltfLoadMock;
	}),
}));

const DEFAULT_COSMETIC = {
	bodyColor: '#4f9dde',
	accentColor: '#f2c94c',
	bodyShape: 'box',
	hat: 'none',
	proportions: {
		height: 1,
		headSize: 1,
		torsoWidth: 1,
		armLength: 1,
		legLength: 1,
		shoulderWidth: 1,
	},
};

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
];

const PROPORTION_KEYS = [
	'height', 'headSize', 'torsoWidth', 'armLength', 'legLength', 'shoulderWidth',
];

function ensureElement(id, tag = 'div') {
	if (document.getElementById(id)) return;
	const el = document.createElement(tag);
	el.id = id;
	document.body.appendChild(el);
}

// Mirrors characterBooth.test.js: openCharacterBooth() needs the booth overlay
// DOM to exist, so the `?booth=hatswap` hook can actually reveal it.
function buildCharacterBoothDom() {
	if (document.getElementById('character-booth-overlay')) return;

	const overlay = document.createElement('div');
	overlay.id = 'character-booth-overlay';
	overlay.classList.add('hidden');

	const modal = document.createElement('div');
	modal.id = 'character-booth-modal';

	const closeBtn = document.createElement('button');
	closeBtn.id = 'character-booth-close-btn';

	const canvas = document.createElement('canvas');
	canvas.id = 'character-booth-preview-canvas';
	canvas.width = 180;
	canvas.height = 180;

	const bodySwatches = document.createElement('div');
	bodySwatches.id = 'character-booth-body-swatches';

	const accentSwatches = document.createElement('div');
	accentSwatches.id = 'character-booth-accent-swatches';

	const shapeSelect = document.createElement('select');
	shapeSelect.id = 'character-booth-shape-select';
	for (const value of ['box', 'cylinder', 'cone', 'capsule']) {
		const option = document.createElement('option');
		option.value = value;
		option.textContent = value;
		shapeSelect.appendChild(option);
	}

	const hatList = document.createElement('div');
	hatList.id = 'character-booth-hat-list';

	const proportions = document.createElement('div');
	proportions.id = 'character-booth-proportions';
	for (const prop of PROPORTION_KEYS) {
		const input = document.createElement('input');
		input.type = 'range';
		input.id = `character-booth-prop-${prop}`;
		input.dataset.prop = prop;
		input.min = '0.7';
		input.max = '1.3';
		input.step = '0.01';
		input.value = '1.0';
		const valueEl = document.createElement('span');
		valueEl.id = `character-booth-prop-${prop}-value`;
		proportions.appendChild(input);
		proportions.appendChild(valueEl);
	}

	const errorEl = document.createElement('p');
	errorEl.id = 'character-booth-cosmetic-error';
	errorEl.hidden = true;

	const confirmEl = document.createElement('div');
	confirmEl.id = 'character-booth-confirm';
	confirmEl.classList.add('hidden');

	const confirmMessage = document.createElement('p');
	confirmMessage.id = 'character-booth-confirm-message';
	confirmEl.appendChild(confirmMessage);

	const confirmActions = document.createElement('div');
	confirmActions.className = 'character-booth-confirm-actions';

	const confirmCancel = document.createElement('button');
	confirmCancel.id = 'character-booth-confirm-cancel';
	confirmCancel.type = 'button';

	const confirmOk = document.createElement('button');
	confirmOk.id = 'character-booth-confirm-ok';
	confirmOk.type = 'button';

	confirmActions.appendChild(confirmCancel);
	confirmActions.appendChild(confirmOk);
	confirmEl.appendChild(confirmActions);

	const saveBtn = document.createElement('button');
	saveBtn.id = 'character-booth-save-btn';
	saveBtn.type = 'button';

	modal.appendChild(closeBtn);
	modal.appendChild(canvas);
	modal.appendChild(bodySwatches);
	modal.appendChild(accentSwatches);
	modal.appendChild(shapeSelect);
	modal.appendChild(hatList);
	modal.appendChild(proportions);
	modal.appendChild(errorEl);
	modal.appendChild(confirmEl);
	modal.appendChild(saveBtn);
	overlay.appendChild(modal);
	document.body.appendChild(overlay);
}

function ensureMainDom() {
	for (const id of MAIN_DOM_IDS) {
		const tag = (id === 'return-to-lobby-btn') ? 'button' : 'div';
		ensureElement(id, tag);
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
	buildCharacterBoothDom();
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

// ── `?booth=hatswap` debug hook (main.js requestBoothDebugOpen) ──
// Mirrors the `?booth=quest` gate test: the localhost-only `?booth=` param is
// parsed at module load, so each case stubs `location` before importing main.js
// and drives the real requestBoothDebugOpen via the test hook. The socket.io
// mock is connected by default and records emits in window.__socketEmitLog().
describe('?booth=hatswap debug hook (main.js requestBoothDebugOpen)', () => {
	beforeEach(() => {
		vi.resetModules();
		document.body.innerHTML = '';
		ensureMainDom();
		try { localStorage.setItem('autogame_token', 'test-fake-jwt-token'); } catch (_) { /* ignore */ }
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('opens the character booth and requests hats-unlocked once on localhost', async () => {
		stubLocation('localhost', '?booth=hatswap');
		await import('../main.js');
		window.__clearSocketEmitLog();
		const overlay = document.getElementById('character-booth-overlay');

		window.__setGameState({
			gamePhase: 'lobby',
			players: { p1: { cosmetic: { ...DEFAULT_COSMETIC } } },
		}, 'p1');

		window.__requestBoothDebugOpenForTest();
		expect(overlay.classList.contains('hidden')).toBe(false);
		const scenarioEmits = window.__socketEmitLog()
			.filter((e) => e.event === 'debugScenario' && e.data?.name === 'hats-unlocked');
		expect(scenarioEmits).toHaveLength(1);

		// boothDebugRequested guard: a second call is a no-op for the session.
		window.__requestBoothDebugOpenForTest();
		expect(window.__socketEmitLog()
			.filter((e) => e.event === 'debugScenario' && e.data?.name === 'hats-unlocked'))
			.toHaveLength(1);
	});

	it('does nothing for ?booth=hatswap on a non-localhost host', async () => {
		stubLocation('example.com', '?booth=hatswap');
		await import('../main.js');
		window.__clearSocketEmitLog();
		const overlay = document.getElementById('character-booth-overlay');

		window.__setGameState({
			gamePhase: 'lobby',
			players: { p1: { cosmetic: { ...DEFAULT_COSMETIC } } },
		}, 'p1');

		window.__requestBoothDebugOpenForTest();
		expect(overlay.classList.contains('hidden')).toBe(true);
		expect(window.__socketEmitLog()
			.filter((e) => e.event === 'debugScenario')).toHaveLength(0);
	});

	it('does not fire before the phase is lobby', async () => {
		stubLocation('localhost', '?booth=hatswap');
		await import('../main.js');
		window.__clearSocketEmitLog();
		const overlay = document.getElementById('character-booth-overlay');

		window.__setGameState({
			gamePhase: 'playing',
			players: { p1: { cosmetic: { ...DEFAULT_COSMETIC } } },
		}, 'p1');

		window.__requestBoothDebugOpenForTest();
		expect(overlay.classList.contains('hidden')).toBe(true);
		expect(window.__socketEmitLog()
			.filter((e) => e.event === 'debugScenario')).toHaveLength(0);
	});
});
