import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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
];

function ensureMainDom() {
	for (const id of MAIN_DOM_IDS) {
		if (!document.getElementById(id)) {
			const el = (id === 'return-to-lobby-btn')
				? document.createElement('button')
				: document.createElement('div');
			el.id = id;
			document.body.appendChild(el);
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
	const overlay = document.getElementById('run-summary-overlay');
	if (overlay) overlay.style.display = 'none';
}

describe('run-summary overlay input lock', () => {
	beforeEach(() => {
		vi.resetModules();
		document.body.innerHTML = '';
		ensureMainDom();
		try { localStorage.setItem('autogame_token', 'test-fake-jwt-token'); } catch (_) { /* ignore */ }
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('isRunSummaryOverlayVisible() is true when #run-summary-overlay display is not none', async () => {
		await import('../main.js');

		const overlay = document.getElementById('run-summary-overlay');
		overlay.style.display = 'none';
		expect(window.__isRunSummaryOverlayVisible()).toBe(false);

		overlay.style.display = 'flex';
		expect(window.__isRunSummaryOverlayVisible()).toBe(true);
	});

	it('canUseGameActions() is false after showRunSummary({ status: victory })', async () => {
		await import('../main.js');

		window.__setGameState({
			gamePhase: 'playing',
			run: { status: 'playing' },
			players: { p1: { id: 'p1', rewards: { currency: 0, cards: [] }, cardChoices: [] } },
			enemies: [],
		}, 'p1');

		expect(window.__canUseGameActionsForTest()).toBe(true);

		window.showRunSummary({
			status: 'victory',
			durationMs: 1000,
			defeatedEnemies: 1,
			currencyCollected: 5,
			players: [{
				id: 'p1',
				rewards: { currency: 5, cards: [] },
				cardChoices: [],
			}],
		});

		expect(window.__isRunSummaryOverlayVisible()).toBe(true);
		expect(window.__canUseGameActionsForTest()).toBe(false);
	});

	it('key-item binding does not emit useKeyItem while run-summary overlay is visible', async () => {
		await import('../main.js');

		window.createSocket('test-token');
		window.__setGameState({
			gamePhase: 'playing',
			run: { status: 'playing' },
			players: {
				p1: {
					id: 'p1',
					equippedKeyItemId: 'dodge_roll',
					rewards: { currency: 0, cards: [] },
					cardChoices: [],
				},
			},
			enemies: [],
		}, 'p1');

		window.showRunSummary({
			status: 'victory',
			durationMs: 1000,
			defeatedEnemies: 1,
			currencyCollected: 0,
			players: [{
				id: 'p1',
				rewards: { currency: 0, cards: [] },
				cardChoices: [],
			}],
		});

		window.__clearSocketEmitLog();
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));

		const useKeyItemEmits = window.__socketEmitLog().filter((e) => e.event === 'useKeyItem');
		expect(useKeyItemEmits).toHaveLength(0);
	});

	it('showRunSummary mirrors failed onto gameState.run.status', async () => {
		await import('../main.js');

		window.__setGameState({
			gamePhase: 'playing',
			run: { status: 'playing' },
			players: { p1: { id: 'p1' } },
			enemies: [],
		}, 'p1');

		window.showRunSummary({
			status: 'failed',
			durationMs: 2000,
			defeatedEnemies: 0,
			currencyCollected: 0,
			failReason: 'Signal lost',
			players: [{ id: 'p1' }],
		});

		expect(window.__AUTOGAME_HARNESS_STATE__().runStatus).toBe('failed');
	});
});
