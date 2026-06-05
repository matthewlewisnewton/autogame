import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BOOTH_ACTION_EVENT } from '../boothPrompt.js';
import { openShopBooth } from '../boothShop.js';

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
		'lobby', 'lobby-browser', 'lobby-player-list', 'ready-btn',
		'run-summary-overlay', 'summary-status', 'summary-duration', 'summary-enemies',
		'summary-currency', 'summary-rewards', 'summary-rewards-currency',
		'summary-rewards-cards', 'return-to-lobby-btn',
		'owned-cards-list', 'selected-deck-list', 'deck-size-display', 'deck-error',
		'lobby-currency-display', 'pending-trade-offer', 'pending-trade-text',
		'accept-trade-btn', 'reject-trade-btn', 'trade-target-select',
		'trade-offer-select', 'trade-request-select', 'offer-trade-btn',
		'shop-currency-display', 'shop-offer-display', 'buy-shop-card-btn',
		'shop-sell-list', 'shop-error',
		...LOBBY_PANEL_IDS,
		...LOBBY_TAB_IDS,
	];
	for (const id of requiredIds) {
		if (!document.getElementById(id)) {
			const el = (id === 'ready-btn' || id === 'return-to-lobby-btn' ||
				id.endsWith('-btn') || id.startsWith('lobby-tab-'))
				? document.createElement('button')
				: document.createElement('div');
			el.id = id;
			document.body.appendChild(el);
		}
	}
}

function dispatchShopBoothAction() {
	window.dispatchEvent(new CustomEvent(BOOTH_ACTION_EVENT, {
		detail: { boothId: 'shop', action: 'shop' },
	}));
}

describe('openShopBooth()', () => {
	it('shows the lobby, activates the shop tab, and renders the card shop', () => {
		const showGameLobby = vi.fn();
		const setLobbyTab = vi.fn();
		const renderCardShop = vi.fn();

		openShopBooth({ showGameLobby, setLobbyTab, renderCardShop });

		expect(showGameLobby).toHaveBeenCalledOnce();
		expect(setLobbyTab).toHaveBeenCalledWith('shop');
		expect(renderCardShop).toHaveBeenCalledOnce();
	});
});

describe('shop booth via booth:action', () => {
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

	it('opens the card shop when booth:action targets the shop booth', async () => {
		await import('../main.js');

		dispatchShopBoothAction();

		expect(document.getElementById('lobby').classList.contains('hidden')).toBe(false);
		expect(window.__getLobbyTabState().activeLobbyTab).toBe('shop');
		expect(document.getElementById('card-shop').classList.contains('hidden')).toBe(false);
		expect(document.getElementById('deck-editor').classList.contains('hidden')).toBe(true);
		expect(document.getElementById('photon-forge').classList.contains('hidden')).toBe(true);
		expect(document.getElementById('card-economy').classList.contains('hidden')).toBe(true);
		expect(document.getElementById('guild-medic').classList.contains('hidden')).toBe(true);
		expect(document.getElementById('key-item-loadout').classList.contains('hidden')).toBe(true);
	});

	it('emits buyShopCard when the buy button is clicked after booth open', async () => {
		await import('../main.js');

		window.__setGameState({
			gamePhase: 'lobby',
			shopOffer: { cardId: 'iron_sword', name: 'Rust-Forged Saber', price: 10, type: 'weapon' },
			players: { p1: { currency: 100 } },
		}, 'p1');
		window.__clearSocketEmitLog();

		dispatchShopBoothAction();

		const buyBtn = document.getElementById('buy-shop-card-btn');
		expect(buyBtn.disabled).toBe(false);
		buyBtn.click();

		const emits = window.__socketEmitLog().filter((entry) => entry.event === 'buyShopCard');
		expect(emits).toHaveLength(1);
	});

	it('emits sellCard when a sell button is clicked after booth open', async () => {
		await import('../main.js');

		const mockInventory = [
			{ instanceId: 'iron-1', cardId: 'iron_sword', grind: 0, level: 1 },
			{ instanceId: 'iron-2', cardId: 'iron_sword', grind: 0, level: 1 },
			{ instanceId: 'flame-1', cardId: 'flame_blade', grind: 0, level: 1 },
			{ instanceId: 'fam-1', cardId: 'battle_familiar', grind: 0, level: 1 },
			{ instanceId: 'drake-1', cardId: 'dungeon_drake', grind: 0, level: 1 },
		];
		const mockOwned = {
			iron_sword: 2,
			flame_blade: 1,
			battle_familiar: 1,
			dungeon_drake: 1,
		};
		window.__setDeckState(['iron-1', 'flame-1', 'fam-1', 'drake-1'], mockOwned, mockInventory);
		window.__clearSocketEmitLog();

		dispatchShopBoothAction();

		const ironEntry = Array.from(document.querySelectorAll('#shop-sell-list .owned-card-entry'))
			.find((entry) => entry.querySelector('.card-label').textContent === 'Rust-Forged Saber');
		expect(ironEntry).toBeTruthy();
		ironEntry.querySelector('.sell-card-btn').click();

		const emits = window.__socketEmitLog().filter((entry) => entry.event === 'sellCard');
		expect(emits).toHaveLength(1);
		expect(emits[0].data).toEqual({ instanceId: 'iron-2', cardId: 'iron_sword' });
	});

	it('ignores non-shop booth actions', async () => {
		const { registerShopBoothListener: registerListener } = await import('../boothShop.js');
		const showGameLobby = vi.fn();
		const setLobbyTab = vi.fn();
		const renderCardShop = vi.fn();

		registerListener({ showGameLobby, setLobbyTab, renderCardShop });

		window.dispatchEvent(new CustomEvent(BOOTH_ACTION_EVENT, {
			detail: { boothId: 'deck', action: 'deck' },
		}));

		expect(showGameLobby).not.toHaveBeenCalled();
		expect(setLobbyTab).not.toHaveBeenCalled();
		expect(renderCardShop).not.toHaveBeenCalled();
	});
});
