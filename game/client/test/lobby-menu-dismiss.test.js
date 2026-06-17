import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateHub } from '../../server/dungeon.js';
import { dispatchBoothAction, BOOTH_ACTION_EVENT } from '../boothPrompt.js';

const gltfLoadMock = vi.hoisted(() => vi.fn());

vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
	GLTFLoader: vi.fn(function GLTFLoader() {
		this.load = gltfLoadMock;
	}),
}));

const LOBBY_PANEL_IDS = [
	'deck-editor',
	'card-shop',
	'photon-forge',
	'card-economy',
	'guild-medic',
	'key-item-loadout',
];

const MAIN_DOM_IDS = [
	'status', 'vanguard-hud', 'character-id', 'player-level',
	'hp-bar-container', 'hp-label', 'hp-bar-bg', 'hp-bar-fill', 'hp-text',
	'ms-bar-container', 'ms-label', 'ms-bar-bg', 'ms-bar-fill', 'ms-text',
	'deck-count', 'deck-weapon-count', 'deck-spell-count', 'deck-creature-count', 'deck-enchantment-count',
	'currency-display', 'objective-hud', 'ui', 'card-hand',
	'lobby', 'lobby-browser', 'lobby-player-list', 'lobby-hud',
	'run-summary-overlay', 'summary-status', 'summary-duration', 'summary-enemies',
	'summary-currency', 'summary-rewards', 'summary-rewards-currency',
	'summary-rewards-cards', 'summary-card-choices', 'summary-card-choices-heading',
	'summary-card-choices-list', 'summary-card-choices-empty', 'return-to-lobby-btn',
	'owned-cards-list', 'selected-deck-list', 'deck-size-display', 'deck-error',
	'lobby-currency-display', 'pending-trade-offer', 'pending-trade-text',
	'accept-trade-btn', 'reject-trade-btn', 'trade-target-select',
	'trade-offer-select', 'trade-request-select', 'offer-trade-btn',
	'quest-board', 'quest-board-wrapper', 'quest-error', 'booth-prompt', 'suspended-run-banner',
	...LOBBY_PANEL_IDS,
];

function ensureElement(id, tag = 'div') {
	if (document.getElementById(id)) return;
	const el = document.createElement(tag);
	el.id = id;
	document.body.appendChild(el);
}

function ensureMainDom() {
	for (const id of MAIN_DOM_IDS) {
		const tag = (id === 'return-to-lobby-btn'
			|| id.endsWith('-btn'))
			? 'button'
			: id === 'trade-target-select' || id === 'trade-offer-select' || id === 'trade-request-select'
				? 'select'
				: 'div';
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

function hubStart(layout) {
	return layout.rooms.find((r) => r.role === 'start') || layout.rooms[0];
}

function lobbyJoinedPayload(hubLayout) {
	const start = hubStart(hubLayout);
	return {
		id: 'p1',
		state: {
			gamePhase: 'lobby',
			layout: hubLayout,
			players: {
				p1: { x: start.x, z: start.z, hp: 100, dead: false, cosmetic: { bodyShape: 'box', hat: 'none' } },
			},
			loot: [],
			enemies: [],
			minions: [],
		},
		layout: hubLayout,
		hubLayout,
		selectedDeck: [],
		ownedCards: {},
	};
}

function lobbyStateUpdate(hubLayout, extra = {}) {
	const start = hubStart(hubLayout);
	return {
		gamePhase: 'lobby',
		layout: hubLayout,
		players: {
			p1: { x: start.x, z: start.z, hp: 100, dead: false },
		},
		loot: [],
		enemies: [],
		minions: [],
		...extra,
	};
}

describe('lobby menu dismiss guard (main.js)', () => {
	let rafCallbacks;

	beforeEach(() => {
		vi.resetModules();
		document.body.innerHTML = '';
		ensureMainDom();
		stubLocalhostLocation();
		rafCallbacks = [];
		vi.stubGlobal('requestAnimationFrame', vi.fn((cb) => {
			rafCallbacks.push(cb);
			return rafCallbacks.length;
		}));
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('hub lobby join starts with #lobby hidden and lobbyMenuDismissed true', async () => {
		await import('../main.js');
		const hubLayout = generateHub(0);
		const lobby = document.getElementById('lobby');

		window.applyLobbyJoinedData(lobbyJoinedPayload(hubLayout));

		expect(lobby.classList.contains('hidden')).toBe(true);
		expect(window.__getLobbyMenuDismissed()).toBe(true);
		expect(window.__AUTOGAME_HARNESS_STATE__().lobbyVisible).toBe(false);
		expect(window.__AUTOGAME_HARNESS_STATE__().lobbyMenuDismissed).toBe(true);
	});

	it('dismissGameLobby then lobby-phase stateUpdate keeps #lobby hidden', async () => {
		await import('../main.js');
		const hubLayout = generateHub(0);
		const lobby = document.getElementById('lobby');

		window.applyLobbyJoinedData(lobbyJoinedPayload(hubLayout));
		window.dismissGameLobby();
		expect(lobby.classList.contains('hidden')).toBe(true);
		expect(window.__getLobbyMenuDismissed()).toBe(true);

		window.__triggerSocketEvent('stateUpdate', lobbyStateUpdate(hubLayout));

		expect(lobby.classList.contains('hidden')).toBe(true);
		expect(window.__getLobbyMenuDismissed()).toBe(true);
		expect(window.__AUTOGAME_HARNESS_STATE__().lobbyVisible).toBe(false);
	});

	it('hubPresenceUpdate and applyHubPresence while dismissed do not show #lobby', async () => {
		await import('../main.js');
		const hubLayout = generateHub(0);
		const lobby = document.getElementById('lobby');
		const showSpy = vi.spyOn(window, 'showGameLobby');

		window.applyLobbyJoinedData(lobbyJoinedPayload(hubLayout));
		window.dismissGameLobby();
		expect(lobby.classList.contains('hidden')).toBe(true);

		const remotePos = { x: hubStart(hubLayout).x + 4, z: hubStart(hubLayout).z + 2 };
		window.applyHubPresence({
			schemaVersion: 1,
			entries: {
				p2: {
					id: 'p2',
					x: remotePos.x,
					y: 0.5,
					z: remotePos.z,
					rotation: 0,
					cosmetic: { bodyShape: 'cylinder', hat: 'wizard' },
					connected: true,
				},
			},
		});

		window.__triggerSocketEvent('hubPresenceUpdate', {
			presence: {
				schemaVersion: 1,
				entries: {
					p2: {
						id: 'p2',
						x: remotePos.x + 2,
						y: 0.5,
						z: remotePos.z + 1,
						rotation: 0,
						cosmetic: { bodyShape: 'cone', hat: 'crown' },
						connected: true,
					},
				},
			},
		});

		expect(showSpy).not.toHaveBeenCalled();
		expect(lobby.classList.contains('hidden')).toBe(true);
		expect(window.__getLobbyMenuDismissed()).toBe(true);
		expect(window.__AUTOGAME_HARNESS_STATE__().squadmates).toEqual([
			{ id: 'p2', x: remotePos.x + 2, z: remotePos.z + 1 },
		]);
	});

	it('deck booth open shows #lobby and clears the dismissed flag', async () => {
		await import('../main.js');
		const hubLayout = generateHub(0);
		const lobby = document.getElementById('lobby');

		window.applyLobbyJoinedData(lobbyJoinedPayload(hubLayout));
		expect(lobby.classList.contains('hidden')).toBe(true);

		window.dispatchEvent(new CustomEvent(BOOTH_ACTION_EVENT, {
			detail: { boothId: 'deck', action: 'deck' },
		}));

		expect(lobby.classList.contains('hidden')).toBe(false);
		expect(window.__getLobbyMenuDismissed()).toBe(false);
		expect(document.getElementById('deck-editor').classList.contains('hidden')).toBe(false);
	});

	it('shop booth open shows #lobby and clears the dismissed flag', async () => {
		await import('../main.js');
		const hubLayout = generateHub(0);
		const lobby = document.getElementById('lobby');

		window.applyLobbyJoinedData(lobbyJoinedPayload(hubLayout));
		window.dismissGameLobby();

		dispatchBoothAction({ boothId: 'shop', action: 'shop' });

		expect(lobby.classList.contains('hidden')).toBe(false);
		expect(window.__getLobbyMenuDismissed()).toBe(false);
		expect(document.getElementById('card-shop').classList.contains('hidden')).toBe(false);
	});

	it('__openDeckBoothForTest and __openShopBoothForTest show #lobby when wired through main', async () => {
		await import('../main.js');
		const hubLayout = generateHub(0);
		const lobby = document.getElementById('lobby');

		window.__setGameState({ gamePhase: 'lobby', players: { p1: {} } }, 'p1');
		window.dismissGameLobby();

		window.__openDeckBoothForTest();
		expect(lobby.classList.contains('hidden')).toBe(false);
		expect(window.__getLobbyMenuDismissed()).toBe(false);
		expect(document.getElementById('deck-editor').classList.contains('hidden')).toBe(false);

		window.dismissGameLobby();
		window.__openShopBoothForTest();
		expect(lobby.classList.contains('hidden')).toBe(false);
		expect(window.__getLobbyMenuDismissed()).toBe(false);
		expect(document.getElementById('card-shop').classList.contains('hidden')).toBe(false);
	});
});
