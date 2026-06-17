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

const ZERO_LOOT_PREVIEW = {
	lootCurrency: 0,
	objectiveComplete: false,
	questBonus: 10,
	granted: false,
	currency: 0,
	cards: [],
	cardChoices: [],
};

function ensureElement(id, tag = 'div') {
	if (document.getElementById(id)) return;
	const el = document.createElement(tag);
	el.id = id;
	document.body.appendChild(el);
}

function ensureLevelSettingsDom() {
	const overlay = document.getElementById('level-settings-overlay')
		|| (() => {
			const el = document.createElement('div');
			el.id = 'level-settings-overlay';
			el.classList.add('hidden');
			document.body.appendChild(el);
			return el;
		})();

	for (const id of ['level-loot-earned', 'level-return-currency', 'level-return-cards', 'level-give-up-cost']) {
		if (!overlay.querySelector(`#${id}`)) {
			const line = document.createElement('p');
			line.id = id;
			overlay.appendChild(line);
		}
	}
	if (!document.getElementById('level-settings-error')) {
		const err = document.createElement('div');
		err.id = 'level-settings-error';
		overlay.appendChild(err);
	}
}

function ensureMainDom() {
	for (const id of MAIN_DOM_IDS) {
		const tag = id === 'return-to-lobby-btn' ? 'button' : 'div';
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
	ensureLevelSettingsDom();
}

function fullPlayingDeployState() {
	return {
		gamePhase: 'playing',
		players: {
			p1: {
				id: 'p1',
				hp: 100,
				magicStones: 40,
				x: 0,
				z: 0,
				hand: [],
				returnRewardsPreview: { ...ZERO_LOOT_PREVIEW },
			},
		},
		run: { questId: 'training_caverns', questTier: 1, objective: { type: 'defeat_enemies' } },
		enemies: [],
	};
}

function slimPlayingTickState() {
	return {
		gamePhase: 'playing',
		players: {
			p1: {
				id: 'p1',
				hp: 100,
				magicStones: 40,
				x: 0,
				z: 0,
				hand: [],
			},
		},
		run: { questId: 'training_caverns', questTier: 1, objective: { type: 'defeat_enemies' } },
		enemies: [],
	};
}

describe('level settings return rewards preview cache', () => {
	beforeEach(() => {
		vi.resetModules();
		document.body.innerHTML = '';
		if (typeof window.__resetSocketHandlersForTest === 'function') {
			window.__resetSocketHandlersForTest();
		}
		ensureMainDom();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('keeps return rewards preview across a slim stateUpdate tick after deploy', async () => {
		await import('../main.js');
		window.__setGameState({ gamePhase: 'lobby', players: { p1: { id: 'p1' } } }, 'p1');

		window.__triggerSocketEvent('stateUpdate', fullPlayingDeployState());
		window.openLevelSettingsOverlay();

		window.__triggerSocketEvent('stateUpdate', slimPlayingTickState());
		window.__syncLevelSettingsRewardsForTest();

		const lootEl = document.getElementById('level-loot-earned');
		const currencyEl = document.getElementById('level-return-currency');
		expect(lootEl.textContent).toBe('Money this run: none collected yet');
		expect(lootEl.textContent).not.toBe('Money this run: —');
		expect(currencyEl.textContent).not.toBe('—');
		expect(currencyEl.textContent).toContain('Complete the contract to earn');
	});

	it('clears cached preview when returning to the lobby', async () => {
		await import('../main.js');
		window.__setGameState({ gamePhase: 'lobby', players: { p1: { id: 'p1' } } }, 'p1');

		window.__triggerSocketEvent('stateUpdate', fullPlayingDeployState());
		window.__triggerSocketEvent('stateUpdate', {
			gamePhase: 'lobby',
			players: { p1: { id: 'p1' } },
		});
		window.__triggerSocketEvent('stateUpdate', {
			gamePhase: 'playing',
			players: {
				p1: {
					id: 'p1',
					hp: 100,
					magicStones: 40,
					x: 0,
					z: 0,
					hand: [],
				},
			},
			run: { questId: 'training_caverns', questTier: 1, objective: { type: 'defeat_enemies' } },
			enemies: [],
		});

		window.openLevelSettingsOverlay();
		window.__syncLevelSettingsRewardsForTest();

		expect(document.getElementById('level-loot-earned').textContent).toBe('Money this run: —');
		expect(document.getElementById('level-return-currency').textContent).toBe('—');
	});
});
