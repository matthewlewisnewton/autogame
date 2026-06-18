import { describe, it, expect, beforeEach, vi } from 'vitest';
import { computeWorldBearing, computeArrowRotation } from '../objectiveNav.js';

const REQUIRED_IDS = [
	'status', 'vanguard-hud', 'character-id', 'player-level',
	'hp-bar-container', 'hp-label', 'hp-bar-bg', 'hp-bar-fill', 'hp-text',
	'ms-bar-container', 'ms-label', 'ms-bar-bg', 'ms-bar-fill', 'ms-text',
	'deck-count', 'deck-weapon-count', 'deck-spell-count', 'deck-creature-count', 'deck-enchantment-count',
	'currency-display', 'objective-hud', 'ui', 'card-hand',
	'lobby', 'lobby-browser', 'lobby-player-list',
	'run-summary-overlay', 'summary-status', 'summary-duration', 'summary-enemies',
	'summary-currency', 'summary-rewards', 'return-to-lobby-btn',
];

function ensureBaseDom() {
	for (const id of REQUIRED_IDS) {
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
}

function ensureObjectiveNavDom() {
	if (document.getElementById('objective-nav-indicator')) return;
	const container = document.createElement('div');
	container.id = 'objective-nav-indicator';
	container.setAttribute('aria-label', 'Objective direction');

	const arrow = document.createElement('div');
	arrow.id = 'objective-nav-arrow';
	container.appendChild(arrow);

	const distance = document.createElement('span');
	distance.id = 'objective-nav-distance';
	distance.className = 'objective-nav-distance';
	container.appendChild(distance);

	document.body.appendChild(container);
}

function makeCollectItemsState(overrides = {}) {
	return {
		gamePhase: 'playing',
		loot: [
			{ id: 'far', kind: 'crystal', questCritical: true, x: 20, z: 0 },
			{ id: 'mid', kind: 'crystal', questCritical: true, x: 0, z: 8 },
			{ id: 'near', kind: 'crystal', questCritical: true, x: 3, z: 4 },
		],
		run: {
			questId: 'crystal_rescue',
			questName: 'Prism Salvage',
			questTier: 1,
			objective: {
				type: 'collect_items',
				collectedItems: 0,
				totalItems: 3,
			},
		},
		players: { p1: { hp: 80, magicStones: 40, currency: 0, x: 0, z: 0 } },
		...overrides,
	};
}

describe('updateObjectiveNavIndicator()', () => {
	beforeEach(() => {
		ensureBaseDom();
		ensureObjectiveNavDom();
		vi.resetModules();
		vi.restoreAllMocks();
	});

	it('shows the indicator and rotates toward the nearest crystal during collect_items', async () => {
		await import('../main.js');

		window.__setGameState(makeCollectItemsState(), 'p1');
		window.__updateObjectiveNavIndicator();

		const indicator = document.getElementById('objective-nav-indicator');
		const arrow = document.getElementById('objective-nav-arrow');
		const distance = document.getElementById('objective-nav-distance');
		const expectedRotation = computeArrowRotation(
			computeWorldBearing(0, 0, 3, 4),
			0,
		);

		expect(indicator.style.display).toBe('flex');
		expect(distance.textContent).toBe('5m');
		expect(arrow.style.transform).toBe(`rotate(${expectedRotation * (180 / Math.PI)}deg)`);
		expect(expectedRotation).not.toBeCloseTo(0, 5);
	});

	it('hides when all crystals are collected even if objective HUD may still show title', async () => {
		await import('../main.js');

		window.__setGameState(makeCollectItemsState({
			loot: [],
			run: {
				questId: 'crystal_rescue',
				questName: 'Prism Salvage',
				questTier: 1,
				objective: {
					type: 'collect_items',
					collectedItems: 3,
					totalItems: 3,
				},
			},
		}), 'p1');
		window.__updateObjectiveNavIndicator();

		expect(document.getElementById('objective-nav-indicator').style.display).toBe('none');
	});

	it('hides outside playing phase and for stage_boss runs', async () => {
		await import('../main.js');
		const indicator = document.getElementById('objective-nav-indicator');

		window.__setGameState(makeCollectItemsState({ gamePhase: 'lobby' }), 'p1');
		window.__updateObjectiveNavIndicator();
		expect(indicator.style.display).toBe('none');

		window.__setGameState(makeCollectItemsState({
			run: {
				questId: 'frost_crossing',
				objective: { type: 'stage_boss', bossDefeated: false },
			},
		}), 'p1');
		window.__updateObjectiveNavIndicator();
		expect(indicator.style.display).toBe('none');
	});

	it('retargets to the next-nearest crystal after loot is removed', async () => {
		await import('../main.js');

		const state = makeCollectItemsState();
		window.__setGameState(state, 'p1');
		window.__updateObjectiveNavIndicator();
		expect(document.getElementById('objective-nav-distance').textContent).toBe('5m');

		state.loot = state.loot.filter((item) => item.id !== 'near');
		window.__updateObjectiveNavIndicator();
		expect(document.getElementById('objective-nav-distance').textContent).toBe('8m');
	});
});
