import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { dispatchBoothAction, BOOTH_ACTION_EVENT } from '../boothPrompt.js';
import {
	QUEST_BOOTH_ID,
	isQuestBoothAction,
	getBoothDebugHook,
} from '../questBooth.js';

// Pure-helper contract for the quest booth, mirroring launchBooth.test.js:
// main.js (v8-ignored UI glue) wires these to the `booth:action` window event,
// so we exercise the DOM-free helpers directly.
describe('quest booth helpers', () => {
	it('QUEST_BOOTH_ID is the stable "quest" booth id', () => {
		expect(QUEST_BOOTH_ID).toBe('quest');
	});

	describe('isQuestBoothAction', () => {
		it('is true for the quest booth detail', () => {
			expect(isQuestBoothAction({ boothId: QUEST_BOOTH_ID })).toBe(true);
			expect(isQuestBoothAction({ boothId: 'quest', action: 'open' })).toBe(true);
		});

		it('is false for a different booth id', () => {
			expect(isQuestBoothAction({ boothId: 'launch' })).toBe(false);
			expect(isQuestBoothAction({ boothId: 'character' })).toBe(false);
		});

		it('is false for missing/empty details', () => {
			expect(isQuestBoothAction(null)).toBe(false);
			expect(isQuestBoothAction(undefined)).toBe(false);
			expect(isQuestBoothAction({})).toBe(false);
		});
	});

	describe('getBoothDebugHook (re-exported from launchBooth)', () => {
		it('returns "quest" when ?booth=quest is present', () => {
			expect(getBoothDebugHook('?booth=quest')).toBe(QUEST_BOOTH_ID);
		});

		it('returns null when the booth param is absent', () => {
			expect(getBoothDebugHook('')).toBe(null);
		});
	});
});

// ── booth:action wiring (main.js) ──
// Mirrors the booth:action portion of characterBooth.test.js: dispatching the
// shared event with boothId 'quest' in the lobby phase reveals the existing
// inline quest panel (scrolls #quest-board-wrapper into view); other booth ids
// and non-lobby phases are ignored.

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
	'lobby', 'lobby-browser', 'lobby-player-list', 'ready-btn',
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

function ensureMainDom() {
	for (const id of MAIN_DOM_IDS) {
		const tag = (id === 'ready-btn' || id === 'return-to-lobby-btn') ? 'button' : 'div';
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

describe('quest booth booth:action hook (main.js)', () => {
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

	it('scrolls the quest panel into view for boothId quest in lobby and ignores other booths', async () => {
		await import('../main.js');
		const wrapper = document.getElementById('quest-board-wrapper');
		// jsdom lacks scrollIntoView; stub it so we can observe the open path.
		wrapper.scrollIntoView = vi.fn();

		window.__setGameState({ gamePhase: 'lobby', players: { p1: {} } }, 'p1');

		dispatchBoothAction({ boothId: 'quest' });
		expect(wrapper.scrollIntoView).toHaveBeenCalledTimes(1);

		dispatchBoothAction({ boothId: 'launch' });
		expect(wrapper.scrollIntoView).toHaveBeenCalledTimes(1);
	});

	it('does not open the panel when gamePhase is not lobby', async () => {
		await import('../main.js');
		const wrapper = document.getElementById('quest-board-wrapper');
		wrapper.scrollIntoView = vi.fn();

		window.__setGameState({ gamePhase: 'playing', players: { p1: {} } }, 'p1');

		dispatchBoothAction({ boothId: 'quest' });
		expect(wrapper.scrollIntoView).not.toHaveBeenCalled();
	});

	it('listens on the shared booth:action event name', async () => {
		await import('../main.js');
		const wrapper = document.getElementById('quest-board-wrapper');
		wrapper.scrollIntoView = vi.fn();

		window.__setGameState({ gamePhase: 'lobby', players: { p1: {} } }, 'p1');

		window.dispatchEvent(new CustomEvent(BOOTH_ACTION_EVENT, { detail: { boothId: 'quest' } }));
		expect(wrapper.scrollIntoView).toHaveBeenCalledTimes(1);
	});
});
