import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BOOTH_ACTION_EVENT } from '../boothPrompt.js';
import { openDeckBooth } from '../boothDeck.js';

const LOBBY_PANEL_IDS = [
	'deck-editor',
	'card-shop',
	'photon-forge',
	'card-economy',
	'guild-medic',
	'key-item-loadout',
];

const LOBBY_TAB_IDS = [
	'lobby-tab-forge',
	'lobby-tab-economy',
	'lobby-tab-medic',
	'lobby-tab-keyitems',
];

function ensureLobbyDom() {
	const requiredIds = [
		'status', 'hp-bar-container', 'hp-label', 'hp-bar-bg', 'hp-bar-fill', 'hp-text',
		'ms-bar-container', 'ms-label', 'ms-bar-bg', 'ms-bar-fill', 'ms-text',
		'currency-display', 'objective-hud', 'ui', 'card-hand',
		'lobby', 'lobby-browser', 'lobby-player-list',
		'run-summary-overlay', 'summary-status', 'summary-duration', 'summary-enemies',
		'summary-currency', 'summary-rewards', 'summary-rewards-currency',
		'summary-rewards-cards', 'return-to-lobby-btn',
		'owned-cards-list', 'selected-deck-list', 'deck-size-display', 'deck-error',
		'lobby-currency-display', 'pending-trade-offer', 'pending-trade-text',
		'accept-trade-btn', 'reject-trade-btn', 'trade-target-select',
		'trade-offer-select', 'trade-request-select', 'offer-trade-btn',
		...LOBBY_PANEL_IDS,
		...LOBBY_TAB_IDS,
	];
	for (const id of requiredIds) {
		if (!document.getElementById(id)) {
			const el = (id === 'return-to-lobby-btn' ||
				id.endsWith('-btn') || id.startsWith('lobby-tab-'))
				? document.createElement('button')
				: document.createElement('div');
			el.id = id;
			document.body.appendChild(el);
		}
	}
}

function dispatchDeckBoothAction() {
	window.dispatchEvent(new CustomEvent(BOOTH_ACTION_EVENT, {
		detail: { boothId: 'deck', action: 'deck' },
	}));
}

describe('openDeckBooth()', () => {
	it('shows the lobby, activates the deck tab, and renders the editor', () => {
		const showGameLobby = vi.fn();
		const setLobbyTab = vi.fn();
		const renderDeckEditor = vi.fn();

		openDeckBooth({ showGameLobby, setLobbyTab, renderDeckEditor });

		expect(showGameLobby).toHaveBeenCalledOnce();
		expect(setLobbyTab).toHaveBeenCalledWith('deck');
		expect(renderDeckEditor).toHaveBeenCalledOnce();
	});
});

describe('deck booth via booth:action', () => {
	beforeEach(() => {
		vi.resetModules();
		document.body.innerHTML = '';
		ensureLobbyDom();
		const lobby = document.getElementById('lobby');
		lobby.classList.add('hidden');
		document.getElementById('lobby-browser').classList.remove('hidden');
		for (const id of LOBBY_PANEL_IDS) {
			document.getElementById(id).classList.add('hidden');
		}
	});

	afterEach(() => {
		document.body.innerHTML = '';
	});

	it('opens the loadout bay when booth:action targets the deck booth', async () => {
		await import('../main.js');

		dispatchDeckBoothAction();

		expect(document.getElementById('lobby').classList.contains('hidden')).toBe(false);
		expect(window.__getLobbyTabState().activeLobbyTab).toBe('deck');
		expect(document.getElementById('deck-editor').classList.contains('hidden')).toBe(false);
		expect(document.getElementById('card-shop').classList.contains('hidden')).toBe(true);
		expect(document.getElementById('photon-forge').classList.contains('hidden')).toBe(true);
		expect(document.getElementById('card-economy').classList.contains('hidden')).toBe(true);
		expect(document.getElementById('guild-medic').classList.contains('hidden')).toBe(true);
		expect(document.getElementById('key-item-loadout').classList.contains('hidden')).toBe(true);
	});

	it('populates the deck editor and deck-add still emits deckAddCard', async () => {
		await import('../main.js');

		const mockInventory = [
			{ instanceId: 'iron-1', cardId: 'iron_sword', grind: 0, level: 1 },
			{ instanceId: 'iron-2', cardId: 'iron_sword', grind: 0, level: 1 },
			{ instanceId: 'flame-1', cardId: 'flame_blade', grind: 0, level: 1 },
		];
		window.__setDeckState(['iron-1'], { iron_sword: 2, flame_blade: 1 }, mockInventory);
		window.__clearSocketEmitLog();

		dispatchDeckBoothAction();

		expect(document.querySelectorAll('.owned-card-entry').length).toBeGreaterThan(0);
		expect(document.getElementById('deck-size-display').textContent).toBe('1/24');

		const ironEntry = Array.from(document.querySelectorAll('.owned-card-entry'))
			.find((entry) => entry.querySelector('.card-label').textContent === 'Rust-Forged Saber');
		expect(ironEntry).toBeTruthy();

		ironEntry.querySelector('.deck-add-btn').click();

		const emits = window.__socketEmitLog().filter((entry) => entry.event === 'deckAddCard');
		expect(emits).toHaveLength(1);
		expect(emits[0].data).toEqual({ instanceId: 'iron-2', cardId: 'iron_sword' });
	});

	it('ignores non-deck booth actions', async () => {
		const { registerDeckBoothListener: registerListener } = await import('../boothDeck.js');
		const showGameLobby = vi.fn();
		const setLobbyTab = vi.fn();
		const renderDeckEditor = vi.fn();

		registerListener({ showGameLobby, setLobbyTab, renderDeckEditor });

		window.dispatchEvent(new CustomEvent(BOOTH_ACTION_EVENT, {
			detail: { boothId: 'shop', action: 'shop' },
		}));

		expect(showGameLobby).not.toHaveBeenCalled();
		expect(setLobbyTab).not.toHaveBeenCalled();
		expect(renderDeckEditor).not.toHaveBeenCalled();
	});
});
