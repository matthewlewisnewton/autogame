import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import eventsCatalog from '../../shared/events.json' with { type: 'json' };

const { clientToServer: CLIENT_TO_SERVER } = eventsCatalog;

const MAIN_DOM_IDS = [
	'status', 'vanguard-hud', 'character-id', 'player-level',
	'hp-bar-container', 'hp-label', 'hp-bar-bg', 'hp-bar-fill', 'hp-text',
	'ms-bar-container', 'ms-label', 'ms-bar-bg', 'ms-bar-fill', 'ms-text',
	'deck-count', 'deck-weapon-count', 'deck-spell-count', 'deck-creature-count', 'deck-enchantment-count',
	'currency-display', 'objective-hud', 'ui', 'card-hand',
	'lobby', 'lobby-browser', 'lobby-list', 'lobby-browser-status', 'lobby-browser-error',
	'lobby-player-list', 'lobby-hud', 'lobby-close-btn', 'create-lobby-name', 'create-lobby-btn',
	'refresh-lobbies-btn', 'leave-lobby-btn',
	'run-summary-overlay', 'summary-status', 'summary-duration', 'summary-enemies',
	'summary-currency', 'summary-rewards', 'summary-rewards-currency',
	'summary-rewards-cards', 'summary-card-choices', 'summary-card-choices-heading',
	'summary-card-choices-list', 'summary-card-choices-empty', 'return-to-lobby-btn',
	'owned-cards-list', 'selected-deck-list', 'deck-size-display', 'deck-error',
	'lobby-currency-display', 'pending-trade-offer', 'pending-trade-text',
	'accept-trade-btn', 'reject-trade-btn', 'trade-target-select',
	'trade-offer-select', 'trade-request-select', 'offer-trade-btn',
	'quest-board', 'quest-board-wrapper', 'quest-error', 'booth-prompt', 'suspended-run-banner',
	'deck-editor', 'card-shop', 'photon-forge', 'card-economy', 'guild-medic', 'key-item-loadout',
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

function lastIoConfig() {
	const log = window.__ioCallLog();
	return log.length > 0 ? log[log.length - 1] : null;
}

describe('fly replay client socket affinity', () => {
	beforeEach(() => {
		vi.resetModules();
		document.body.innerHTML = '';
		ensureMainDom();
		stubLocalhostLocation();
		window.__resetSocketHandlersForTest?.();
		window.__clearSocketEmitLog?.();
		window.__clearIoCallLog?.();
		try { localStorage.setItem('autogame_token', 'test-fake-jwt-token'); } catch (_) { /* ignore */ }
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('createSocket omits fly query and headers without affinity options', async () => {
		await import('../main.js');
		window.__clearIoCallLog();
		window.createSocket('affinity-test-token');
		const config = lastIoConfig();
		expect(config.auth).toEqual({ token: 'affinity-test-token' });
		expect(config.query).toBeUndefined();
		expect(config.extraHeaders).toBeUndefined();
	});

	it('createSocket passes lobbyId and fly_instance_id query plus fly-force-instance-id header', async () => {
		await import('../main.js');
		window.__clearIoCallLog();
		window.createSocket('affinity-test-token', {
			lobbyId: 'lobby1234',
			flyInstanceId: 'fly-machine-b',
		});
		const config = lastIoConfig();
		expect(config.query).toEqual({
			lobbyId: 'lobby1234',
			fly_instance_id: 'fly-machine-b',
		});
		expect(config.extraHeaders).toEqual({
			'fly-force-instance-id': 'fly-machine-b',
		});
		expect(window.__getLastConnectedFlyInstanceIdForTest()).toBe('fly-machine-b');
	});

	it('requestJoinLobby reconnects with remote instanceId and emits joinLobby on connect', async () => {
		await import('../main.js');
		window.__clearIoCallLog();
		window.__clearSocketEmitLog();

		window.__requestJoinLobbyForTest({
			id: 'remote01',
			name: 'Remote Lobby',
			instanceId: 'fly-machine-remote',
			gamePhase: 'lobby',
			playerCount: 1,
		});

		const config = lastIoConfig();
		expect(config.query).toEqual({
			lobbyId: 'remote01',
			fly_instance_id: 'fly-machine-remote',
		});
		expect(config.extraHeaders).toEqual({
			'fly-force-instance-id': 'fly-machine-remote',
		});

		window.__triggerSocketEvent('connect');
		const emits = window.__socketEmitLog().filter((e) => e.event === CLIENT_TO_SERVER.JOIN_LOBBY);
		expect(emits).toHaveLength(1);
		expect(emits[0].data).toEqual({ lobbyId: 'remote01' });
		expect(window.__getPendingLobbyJoinForTest()).toBeNull();
	});

	it('requestJoinLobby without instanceId emits joinLobby on the existing socket', async () => {
		await import('../main.js');
		window.__clearSocketEmitLog();
		window.__triggerSocketEvent('connect');

		window.__requestJoinLobbyForTest({
			id: 'local01',
			name: 'Local Lobby',
			gamePhase: 'lobby',
			playerCount: 1,
		});

		const emits = window.__socketEmitLog().filter((e) => e.event === CLIENT_TO_SERVER.JOIN_LOBBY);
		expect(emits).toHaveLength(1);
		expect(emits[0].data).toEqual({ lobbyId: 'local01' });
		expect(window.__getLastConnectedFlyInstanceIdForTest()).toBeNull();
	});

	it('?lobby= deep link routes to the summary instanceId after init', async () => {
		vi.resetModules();
		stubLocalhostLocation('?lobby=deeplink1');
		await import('../main.js');

		expect(window.__getPendingLobbyJoinForTest()).toEqual({
			lobbyId: 'deeplink1',
			instanceId: null,
		});

		window.__clearIoCallLog();
		window.__clearSocketEmitLog();
		window.__triggerSocketEvent('init', {
			id: 'p1',
			inLobby: false,
			lobbies: [
				{ id: 'otherlob', name: 'Other', instanceId: 'fly-a', gamePhase: 'lobby', playerCount: 1 },
				{ id: 'deeplink1', name: 'Shared', instanceId: 'fly-target', gamePhase: 'lobby', playerCount: 2 },
			],
			selectedDeck: [],
			inventory: [],
			ownedCards: {},
		});

		const config = lastIoConfig();
		expect(config.query).toEqual({
			lobbyId: 'deeplink1',
			fly_instance_id: 'fly-target',
		});
		expect(config.extraHeaders).toEqual({
			'fly-force-instance-id': 'fly-target',
		});

		window.__triggerSocketEvent('connect');
		const emits = window.__socketEmitLog().filter((e) => e.event === CLIENT_TO_SERVER.JOIN_LOBBY);
		expect(emits.some((e) => e.data?.lobbyId === 'deeplink1')).toBe(true);
	});

	it('plain createSocket after affinity clears fly extras (restoreSession path)', async () => {
		await import('../main.js');
		window.createSocket('first-token', {
			lobbyId: 'temp01',
			flyInstanceId: 'fly-machine-temp',
		});
		window.__clearIoCallLog();

		window.createSocket('restored-token');
		const config = lastIoConfig();
		expect(config.auth).toEqual({ token: 'restored-token' });
		expect(config.query).toBeUndefined();
		expect(config.extraHeaders).toBeUndefined();
		expect(window.__getLastConnectedFlyInstanceIdForTest()).toBeNull();
	});
});
