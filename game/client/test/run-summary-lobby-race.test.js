import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateHub } from '../../server/dungeon.js';

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

function victorySummaryPayload() {
	return {
		status: 'victory',
		durationMs: 42000,
		defeatedEnemies: 4,
		currencyCollected: 18,
		players: [{
			id: 'p1',
			rewards: { currency: 18, cards: [] },
			cardChoices: [],
		}],
	};
}

function lobbyVictoryRaceUpdate(hubLayout) {
	const start = hubLayout.rooms.find((r) => r.role === 'start') || hubLayout.rooms[0];
	return {
		gamePhase: 'lobby',
		layout: hubLayout,
		run: { status: 'victory' },
		players: {
			p1: { id: 'p1', x: start.x, z: start.z, hp: 100, dead: false },
		},
		enemies: [],
		minions: [],
		loot: [],
	};
}

function lobbyReturnUpdate(hubLayout) {
	const start = hubLayout.rooms.find((r) => r.role === 'start') || hubLayout.rooms[0];
	return {
		gamePhase: 'lobby',
		layout: hubLayout,
		players: {
			p1: { id: 'p1', x: start.x, z: start.z, hp: 100, dead: false },
		},
		enemies: [],
		minions: [],
		loot: [],
	};
}

describe('run-summary lobby-phase STATE_UPDATE race guard', () => {
	beforeEach(() => {
		vi.resetModules();
		document.body.innerHTML = '';
		ensureMainDom();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('keeps Sortie Complete visible when lobby stateUpdate follows showRunSummary', async () => {
		const hubLayout = generateHub(0);
		await import('../main.js');

		window.__setGameState({
			gamePhase: 'playing',
			run: { status: 'playing' },
			players: { p1: { id: 'p1', rewards: { currency: 0, cards: [] }, cardChoices: [] } },
			enemies: [],
		}, 'p1');
		window.createSocket();

		window.showRunSummary(victorySummaryPayload());

		const overlay = document.getElementById('run-summary-overlay');
		const summaryStatus = document.getElementById('summary-status');
		expect(overlay.style.display).toBe('flex');
		expect(summaryStatus.textContent).toBe('Sortie Complete');

		window.__triggerSocketEvent('stateUpdate', lobbyVictoryRaceUpdate(hubLayout));

		expect(overlay.style.display).toBe('flex');
		expect(summaryStatus.textContent).toBe('Sortie Complete');
		const harness = window.__AUTOGAME_HARNESS_STATE__();
		expect(harness.sortieCompleteOverlayVisible).toBe(true);
		expect(harness.lastRunSummary?.status).toBe('victory');
	});

	it('Return to Hub dismisses the overlay after server clears the run', async () => {
		const hubLayout = generateHub(0);
		await import('../main.js');

		window.__setGameState({
			gamePhase: 'playing',
			run: { status: 'victory' },
			players: { p1: { id: 'p1', rewards: { currency: 0, cards: [] }, cardChoices: [] } },
			enemies: [],
		}, 'p1');
		window.createSocket();

		window.showRunSummary(victorySummaryPayload());

		const overlay = document.getElementById('run-summary-overlay');
		const returnBtn = document.getElementById('return-to-lobby-btn');
		expect(overlay.style.display).toBe('flex');

		window.__clearSocketEmitLog();
		returnBtn.click();

		const returnEmits = window.__socketEmitLog().filter((e) => e.event === 'returnToLobby');
		expect(returnEmits).toHaveLength(1);

		window.__triggerSocketEvent('stateUpdate', lobbyReturnUpdate(hubLayout));

		expect(overlay.style.display).toBe('none');
		const harness = window.__AUTOGAME_HARNESS_STATE__();
		expect(harness.sortieCompleteOverlayVisible).toBe(false);
		expect(harness.lastRunSummary).toBe(null);
		expect(harness.phase).toBe('lobby');
	});
});
