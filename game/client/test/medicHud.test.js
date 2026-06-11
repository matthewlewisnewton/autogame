import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MAX_HP, MEDIC_HEAL_COST } from '../config.js';
import { formatCurrencyPrice } from '../theme.js';

const BASE_DOM_IDS = [
	'status', 'vanguard-hud', 'hp-bar-container', 'hp-label', 'hp-bar-bg', 'hp-bar-fill', 'hp-text',
	'ms-bar-container', 'ms-label', 'ms-bar-bg', 'ms-bar-fill', 'ms-text',
	'currency-display', 'objective-hud', 'ui', 'card-hand',
	'lobby', 'lobby-browser', 'lobby-player-list',
	'run-summary-overlay', 'summary-status', 'summary-duration', 'summary-enemies',
	'summary-currency', 'summary-rewards', 'summary-rewards-currency',
	'summary-rewards-cards', 'return-to-lobby-btn',
	'owned-cards-list', 'selected-deck-list', 'deck-size-display', 'deck-error',
	'lobby-tab-medic', 'guild-medic',
	'medic-hp-display', 'medic-cost-display', 'medic-heal-btn', 'medic-error',
];

function ensureMedicDom() {
	for (const id of BASE_DOM_IDS) {
		if (!document.getElementById(id)) {
			const el = (id === 'return-to-lobby-btn' || id.endsWith('-btn') || id.startsWith('lobby-tab-'))
				? document.createElement('button')
				: document.createElement('div');
			el.id = id;
			document.body.appendChild(el);
		}
	}
}

function mockPlayer({ hp = MAX_HP, currency = 0, dead = false } = {}) {
	return {
		gamePhase: 'lobby',
		players: {
			p1: { hp, currency, dead },
		},
	};
}

describe('renderGuildMedic() charity medic HUD', () => {
	beforeEach(() => {
		vi.resetModules();
		document.body.innerHTML = '';
		ensureMedicDom();
	});

	afterEach(() => {
		document.body.innerHTML = '';
	});

	it('disables heal at full health with zero currency', async () => {
		await import('../main.js');
		window.__setGameState(mockPlayer({ hp: MAX_HP, currency: 0 }), 'p1');
		window.renderGuildMedic();

		const healBtn = document.getElementById('medic-heal-btn');
		expect(healBtn.disabled).toBe(true);
		expect(document.getElementById('medic-cost-display').textContent)
			.toBe('You are already at full health.');
	});

	it('enables heal with shortfall copy when injured and broke', async () => {
		await import('../main.js');
		window.__setGameState(mockPlayer({ hp: 50, currency: 0 }), 'p1');
		window.renderGuildMedic();

		const healBtn = document.getElementById('medic-heal-btn');
		const costDisplay = document.getElementById('medic-cost-display');
		const medicError = document.getElementById('medic-error');
		expect(healBtn.disabled).toBe(false);
		expect(costDisplay.textContent).toBe(
			`Need ${formatCurrencyPrice(MEDIC_HEAL_COST)} — you have 0. Free triage available.`,
		);
		expect(costDisplay.textContent).toContain(String(MEDIC_HEAL_COST));
		expect(costDisplay.textContent).toContain('you have 0');
		expect(costDisplay.textContent).toContain('Free triage available');
		expect(healBtn.textContent).toBe('Heal to full (free triage)');
		expect(healBtn.textContent).not.toContain(String(MEDIC_HEAL_COST));
		expect(medicError.textContent).toBe('');
		expect(medicError.style.display).toBe('none');
	});

	it('enables heal with paid copy when injured and can afford medic', async () => {
		await import('../main.js');
		window.__setGameState(mockPlayer({ hp: 40, currency: MEDIC_HEAL_COST }), 'p1');
		window.renderGuildMedic();

		const healBtn = document.getElementById('medic-heal-btn');
		const costDisplay = document.getElementById('medic-cost-display');
		const medicError = document.getElementById('medic-error');
		expect(healBtn.disabled).toBe(false);
		expect(costDisplay.textContent).toBe(`Full restore: ${formatCurrencyPrice(MEDIC_HEAL_COST)}`);
		expect(costDisplay.textContent).not.toMatch(/Need .+ — you have/);
		expect(costDisplay.textContent).not.toContain('Free triage available');
		expect(healBtn.textContent).toBe(`Heal to full (${MEDIC_HEAL_COST} money)`);
		expect(medicError.textContent).toBe('');
		expect(medicError.style.display).toBe('none');
	});
});
