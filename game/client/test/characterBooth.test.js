import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateHub } from '../../server/dungeon.js';
import { dispatchBoothAction, BOOTH_ACTION_EVENT } from '../boothPrompt.js';
import { createCosmeticSelection } from '../cosmeticForm.js';
import { APPEARANCE_CHANGE_COST } from '../config.js';

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
	'quest-board', 'quest-error', 'booth-prompt', 'suspended-run-banner',
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

function stubLocalhostLocation(search = '') {
	const href = search
		? `http://localhost:5173/${search.startsWith('?') ? search : `?${search}`}`
		: 'http://localhost:5173/';
	const url = new URL(href);
	vi.stubGlobal('location', {
		hostname: 'localhost',
		host: 'localhost:5173',
		protocol: 'http:',
		search: url.search,
		href: url.href,
		pathname: url.pathname,
	});
}

function lobbyJoinedPayload(hubLayout) {
	const start = hubLayout.rooms.find((r) => r.role === 'start') || hubLayout.rooms[0];
	return {
		id: 'p1',
		state: {
			gamePhase: 'lobby',
			layout: hubLayout,
			players: {
				p1: { x: start.x, z: start.z, hp: 100, dead: false, cosmetic: { ...DEFAULT_COSMETIC } },
			},
		},
		layout: hubLayout,
		hubLayout,
		selectedDeck: [],
		ownedCards: {},
	};
}

describe('character booth overlay (module)', () => {
	let rafCallbacks;

	beforeEach(() => {
		vi.resetModules();
		document.body.innerHTML = '';
		buildCharacterBoothDom();
		rafCallbacks = [];
		vi.stubGlobal('requestAnimationFrame', vi.fn((cb) => {
			rafCallbacks.push(cb);
			return rafCallbacks.length;
		}));
		vi.stubGlobal('cancelAnimationFrame', vi.fn());
		gltfLoadMock.mockReset();
		window.__soundLogEnabled = true;
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	async function initBooth(overrides = {}) {
		const selection = createCosmeticSelection();
		let savedCosmetic = { ...DEFAULT_COSMETIC, proportions: { ...DEFAULT_COSMETIC.proportions } };
		const gameState = {
			players: {
				p1: { cosmetic: { ...DEFAULT_COSMETIC } },
			},
		};
		let gameStateRef = gameState;

		const patchProfile = vi.fn(async ({ cosmetic }) => {
			savedCosmetic = {
				...cosmetic,
				proportions: { ...cosmetic.proportions },
			};
			return {};
		});

		const booth = await import('../characterBooth.js');
		booth.initCharacterBooth({
			selection,
			patchProfile,
			getAccountCosmetic: () => savedCosmetic,
			getGameState: () => gameStateRef,
			getMyId: () => 'p1',
			setGameStateRef: (state) => { gameStateRef = state; },
			getSocket: () => null,
			getCurrency: () => 0,
			...overrides,
		});

		return {
			...booth,
			selection,
			gameState: gameStateRef,
			patchProfile,
			getSavedCosmetic: () => savedCosmetic,
		};
	}

	it('openCharacterBooth() / closeCharacterBooth() toggle overlay visibility and preview', async () => {
		const { openCharacterBooth, closeCharacterBooth, isCharacterBoothOpen } = await initBooth();
		const { isPreviewOpen } = await import('../cosmetic-preview.js');
		const overlay = document.getElementById('character-booth-overlay');

		expect(overlay.classList.contains('hidden')).toBe(true);
		expect(isCharacterBoothOpen()).toBe(false);
		expect(isPreviewOpen()).toBe(false);

		openCharacterBooth();
		expect(overlay.classList.contains('hidden')).toBe(false);
		expect(isCharacterBoothOpen()).toBe(true);
		expect(isPreviewOpen()).toBe(true);

		closeCharacterBooth();
		expect(overlay.classList.contains('hidden')).toBe(true);
		expect(isCharacterBoothOpen()).toBe(false);
		expect(isPreviewOpen()).toBe(false);
	});

	it('closeCharacterBooth() is idempotent', async () => {
		const { openCharacterBooth, closeCharacterBooth, isCharacterBoothOpen } = await initBooth();
		const { isPreviewOpen } = await import('../cosmetic-preview.js');
		const overlay = document.getElementById('character-booth-overlay');

		openCharacterBooth();
		closeCharacterBooth();
		expect(() => closeCharacterBooth()).not.toThrow();
		expect(overlay.classList.contains('hidden')).toBe(true);
		expect(isCharacterBoothOpen()).toBe(false);
		expect(isPreviewOpen()).toBe(false);
	});

	it('shows paid confirm for appearance edits and saves after confirm', async () => {
		const { openCharacterBooth, selection, gameState, patchProfile } = await initBooth();
		const saveBtn = document.getElementById('character-booth-save-btn');
		const confirmEl = document.getElementById('character-booth-confirm');
		const confirmOk = document.getElementById('character-booth-confirm-ok');

		openCharacterBooth();
		selection.bodyColor = '#ef4444';
		selection.bodyShape = 'cylinder';

		saveBtn.click();
		expect(confirmEl.classList.contains('hidden')).toBe(false);
		expect(patchProfile).not.toHaveBeenCalled();

		confirmOk.click();
		await vi.waitFor(() => {
			expect(patchProfile).toHaveBeenCalledWith({
				cosmetic: expect.objectContaining({
					bodyColor: '#ef4444',
					bodyShape: 'cylinder',
				}),
			});
		});

		expect(gameState.players.p1.cosmetic.bodyColor).toBe('#ef4444');
		expect(gameState.players.p1.cosmetic.bodyShape).toBe('cylinder');
		expect(confirmEl.classList.contains('hidden')).toBe(true);
	});

	it('does not show confirm for hat-only changes', async () => {
		const { openCharacterBooth, selection, patchProfile } = await initBooth({
			getCurrency: () => 100,
		});
		const saveBtn = document.getElementById('character-booth-save-btn');
		const confirmEl = document.getElementById('character-booth-confirm');

		openCharacterBooth();
		selection.hat = 'cap';

		saveBtn.click();
		await vi.waitFor(() => {
			expect(patchProfile).toHaveBeenCalled();
		});

		expect(confirmEl.classList.contains('hidden')).toBe(true);
	});

	it('cancel on paid confirm aborts without save traffic', async () => {
		const { openCharacterBooth, selection, patchProfile } = await initBooth();
		const saveBtn = document.getElementById('character-booth-save-btn');
		const confirmEl = document.getElementById('character-booth-confirm');
		const confirmCancel = document.getElementById('character-booth-confirm-cancel');

		openCharacterBooth();
		selection.bodyColor = '#ef4444';

		saveBtn.click();
		expect(confirmEl.classList.contains('hidden')).toBe(false);

		confirmCancel.click();
		expect(confirmEl.classList.contains('hidden')).toBe(true);
		expect(patchProfile).not.toHaveBeenCalled();
	});

	it('emits applyAppearanceChange on confirm when socket is connected', async () => {
		const emit = vi.fn();
		const socket = { connected: true, emit };
		const { openCharacterBooth, selection, patchProfile, handleAppearanceChanged } = await initBooth({
			getSocket: () => socket,
		});
		const saveBtn = document.getElementById('character-booth-save-btn');
		const confirmOk = document.getElementById('character-booth-confirm-ok');

		openCharacterBooth();
		selection.accentColor = '#22d3ee';

		saveBtn.click();
		confirmOk.click();

		expect(emit).toHaveBeenCalledWith('applyAppearanceChange', {
			cosmetic: expect.objectContaining({ accentColor: '#22d3ee' }),
		});
		expect(patchProfile).not.toHaveBeenCalled();
		expect(saveBtn.disabled).toBe(true);

		handleAppearanceChanged();
		expect(saveBtn.disabled).toBe(false);
	});

	it('surfaces appearance errors and re-enables save', async () => {
		const emit = vi.fn();
		const socket = { connected: true, emit };
		const { openCharacterBooth, selection, showBoothCosmeticError, handleAppearanceError } = await initBooth({
			getSocket: () => socket,
		});
		const saveBtn = document.getElementById('character-booth-save-btn');
		const confirmOk = document.getElementById('character-booth-confirm-ok');
		const errorEl = document.getElementById('character-booth-cosmetic-error');

		openCharacterBooth();
		selection.bodyColor = '#ef4444';

		saveBtn.click();
		confirmOk.click();
		expect(saveBtn.disabled).toBe(true);

		const message = `Not enough money (need ${APPEARANCE_CHANGE_COST})`;
		showBoothCosmeticError(message);
		handleAppearanceError();

		expect(errorEl.textContent).toBe(message);
		expect(saveBtn.disabled).toBe(false);
	});

	it('save button shows cost hint when appearance fields are dirty', async () => {
		const { openCharacterBooth } = await initBooth();
		const saveBtn = document.getElementById('character-booth-save-btn');
		const bodySwatches = document.getElementById('character-booth-body-swatches');

		openCharacterBooth();
		expect(saveBtn.textContent).toBe('Save character');

		const redSwatch = bodySwatches.querySelector('[data-color="#ef4444"]');
		expect(redSwatch).toBeTruthy();
		redSwatch.click();

		expect(saveBtn.textContent).toMatch(/25/);
	});
});

describe('character booth booth:action hook (main.js)', () => {
	beforeEach(() => {
		vi.resetModules();
		document.body.innerHTML = '';
		ensureMainDom();
		stubLocalhostLocation();
		try { localStorage.setItem('autogame_token', 'test-fake-jwt-token'); } catch (_) { /* ignore */ }
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('opens the overlay for boothId character in lobby and ignores other booths', async () => {
		await import('../main.js');
		const overlay = document.getElementById('character-booth-overlay');

		window.__setGameState({
			gamePhase: 'lobby',
			players: { p1: { cosmetic: { ...DEFAULT_COSMETIC } } },
		}, 'p1');

		dispatchBoothAction({ boothId: 'character' });
		expect(overlay.classList.contains('hidden')).toBe(false);

		window.closeCharacterBooth();
		expect(overlay.classList.contains('hidden')).toBe(true);

		dispatchBoothAction({ boothId: 'shop' });
		expect(overlay.classList.contains('hidden')).toBe(true);
	});

	it('does not open the overlay when gamePhase is not lobby', async () => {
		await import('../main.js');
		const overlay = document.getElementById('character-booth-overlay');

		window.__setGameState({
			gamePhase: 'playing',
			players: { p1: { cosmetic: { ...DEFAULT_COSMETIC } } },
		}, 'p1');

		dispatchBoothAction({ boothId: 'character' });
		expect(overlay.classList.contains('hidden')).toBe(true);
	});

	it('listens on the shared booth:action event name', async () => {
		await import('../main.js');
		const overlay = document.getElementById('character-booth-overlay');

		window.__setGameState({ gamePhase: 'lobby', players: { p1: {} } }, 'p1');

		window.dispatchEvent(new CustomEvent(BOOTH_ACTION_EVENT, { detail: { boothId: 'character' } }));
		expect(overlay.classList.contains('hidden')).toBe(false);
	});
});

describe('character booth ?booth=character debug hook (main.js)', () => {
	let rafCallbacks;

	beforeEach(() => {
		vi.resetModules();
		document.body.innerHTML = '';
		ensureMainDom();
		rafCallbacks = [];
		vi.stubGlobal('requestAnimationFrame', vi.fn((cb) => {
			rafCallbacks.push(cb);
			return rafCallbacks.length;
		}));
		try { localStorage.setItem('autogame_token', 'test-fake-jwt-token'); } catch (_) { /* ignore */ }
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('auto-opens once after hub lobby entry on localhost with ?booth=character', async () => {
		stubLocalhostLocation('?booth=character');
		await import('../main.js');

		const overlay = document.getElementById('character-booth-overlay');
		const hubLayout = generateHub(0);

		window.applyLobbyJoinedData(lobbyJoinedPayload(hubLayout));
		expect(overlay.classList.contains('hidden')).toBe(false);

		window.closeCharacterBooth();
		expect(overlay.classList.contains('hidden')).toBe(true);

		window.applyLobbyJoinedData(lobbyJoinedPayload(hubLayout));
		expect(overlay.classList.contains('hidden')).toBe(true);
	});

	it('stays closed without the booth URL param', async () => {
		stubLocalhostLocation('');
		await import('../main.js');

		const overlay = document.getElementById('character-booth-overlay');
		const hubLayout = generateHub(0);

		window.applyLobbyJoinedData(lobbyJoinedPayload(hubLayout));
		expect(overlay.classList.contains('hidden')).toBe(true);
	});
});
