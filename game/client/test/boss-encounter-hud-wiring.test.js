import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { buildEnemyDisplayCatalog } = require('../../server/enemyDisplay.js');

// DOM main.js queries at module load (mirrors main.test.js), plus the
// #boss-encounter-hud nodes added in sub-ticket 01 that the wiring toggles.
const REQUIRED_IDS = [
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
	'lobby-currency-display', 'pending-trade-offer', 'pending-trade-text',
	'accept-trade-btn', 'reject-trade-btn', 'trade-target-select',
	'trade-offer-select', 'trade-request-select', 'offer-trade-btn',
];

function ensureBaseDom() {
	for (const id of REQUIRED_IDS) {
		if (!document.getElementById(id)) {
			const el = (id === 'return-to-lobby-btn' || id === 'accept-trade-btn'
				|| id === 'reject-trade-btn' || id === 'offer-trade-btn')
				? document.createElement('button')
				: (id === 'trade-target-select' || id === 'trade-offer-select' || id === 'trade-request-select')
					? document.createElement('select')
					: document.createElement('div');
			el.id = id;
			document.body.appendChild(el);
		}
	}
	if (!document.getElementById('boss-encounter-hud')) {
		const container = document.createElement('div');
		container.id = 'boss-encounter-hud';
		container.classList.add('hidden');
		container.setAttribute('aria-hidden', 'true');

		const nameEl = document.createElement('div');
		nameEl.id = 'boss-encounter-name';
		container.appendChild(nameEl);

		const fillEl = document.createElement('div');
		fillEl.id = 'boss-encounter-hp-fill';
		fillEl.classList.add('hp-high');
		container.appendChild(fillEl);

		document.body.appendChild(container);
	}
}

function makeGameState({ encounter, enemies } = {}) {
	return {
		gamePhase: 'playing',
		players: {},
		enemies: enemies || [],
		run: { status: 'active', encounter: encounter || null },
	};
}

describe('boss-encounter HUD wiring in main.js', () => {
	beforeEach(() => {
		ensureBaseDom();
	});

	it('populates the model and shows the HUD for an active encounter with a live boss', async () => {
		await import('../main.js');
		window.__setEnemyDisplayCatalog(buildEnemyDisplayCatalog());

		const boss = { id: 'boss-1', type: 'annex_overseer', hp: 600, maxHp: 1000 };
		window.__setGameState(
			makeGameState({
				encounter: { phase: 'active', locked: false, bossEnemyId: 'boss-1' },
				enemies: [boss],
			}),
			'me',
		);

		const model = window.__updateBossEncounterHud();
		expect(model).not.toBeNull();
		expect(model.name).toBe('Annex Overseer');
		expect(model.hpPct).toBe(60);
		expect(window.__getBossEncounterModel()).toEqual(model);

		const container = document.getElementById('boss-encounter-hud');
		expect(container.classList.contains('hidden')).toBe(false);
		expect(container.getAttribute('aria-hidden')).toBe('false');
		expect(document.getElementById('boss-encounter-name').textContent).toBe('Annex Overseer');
		expect(document.getElementById('boss-encounter-hp-fill').style.width).toBe('60%');
	});

	it('tracks boss HP as it changes across updates', async () => {
		await import('../main.js');
		window.__setEnemyDisplayCatalog(buildEnemyDisplayCatalog());

		const gs = makeGameState({
			encounter: { phase: 'active', locked: false, bossEnemyId: 'boss-1' },
			enemies: [{ id: 'boss-1', type: 'annex_overseer', hp: 1000, maxHp: 1000 }],
		});
		window.__setGameState(gs, 'me');
		window.__updateBossEncounterHud();
		expect(document.getElementById('boss-encounter-hp-fill').style.width).toBe('100%');

		gs.enemies[0].hp = 250;
		window.__updateBossEncounterHud();
		expect(window.__getBossEncounterModel().hpPct).toBe(25);
		expect(document.getElementById('boss-encounter-hp-fill').style.width).toBe('25%');
	});

	it('shows the HUD while the encounter is locked even if not yet active', async () => {
		await import('../main.js');
		window.__setEnemyDisplayCatalog(buildEnemyDisplayCatalog());

		window.__setGameState(
			makeGameState({
				encounter: { phase: 'dormant', locked: true, bossEnemyId: 'boss-1' },
				enemies: [{ id: 'boss-1', type: 'spire_warden', hp: 500, maxHp: 1000 }],
			}),
			'me',
		);
		const model = window.__updateBossEncounterHud();
		expect(model).not.toBeNull();
		expect(model.name).toBe('Summit Warden');
		expect(document.getElementById('boss-encounter-hud').classList.contains('hidden')).toBe(false);
	});

	it('resolves the display name for each per-level stage boss', async () => {
		await import('../main.js');
		window.__setEnemyDisplayCatalog(buildEnemyDisplayCatalog());

		const cases = [
			['annex_overseer', 'Annex Overseer'],
			['arena_champion', 'Plaza Sovereign'],
			['miniboss', 'Vault Warden'],
			['spire_warden', 'Summit Warden'],
		];
		for (const [type, expectedName] of cases) {
			window.__setGameState(
				makeGameState({
					encounter: { phase: 'active', locked: false, bossEnemyId: 'boss-1' },
					enemies: [{ id: 'boss-1', type, hp: 800, maxHp: 1000 }],
				}),
				'me',
			);
			const model = window.__updateBossEncounterHud();
			expect(model.name).toBe(expectedName);
			expect(document.getElementById('boss-encounter-name').textContent).toBe(expectedName);
		}
	});

	it('hides the HUD when there is no encounter', async () => {
		await import('../main.js');
		window.__setEnemyDisplayCatalog(buildEnemyDisplayCatalog());

		window.__setGameState(makeGameState({ encounter: null, enemies: [] }), 'me');
		const model = window.__updateBossEncounterHud();
		expect(model).toBeNull();
		expect(window.__getBossEncounterModel()).toBeNull();

		const container = document.getElementById('boss-encounter-hud');
		expect(container.classList.contains('hidden')).toBe(true);
		expect(container.getAttribute('aria-hidden')).toBe('true');
	});

	it('hides the HUD once the boss is dead', async () => {
		await import('../main.js');
		window.__setEnemyDisplayCatalog(buildEnemyDisplayCatalog());

		window.__setGameState(
			makeGameState({
				encounter: { phase: 'active', locked: false, bossEnemyId: 'boss-1' },
				enemies: [{ id: 'boss-1', type: 'annex_overseer', hp: 0, maxHp: 1000 }],
			}),
			'me',
		);
		expect(window.__updateBossEncounterHud()).toBeNull();
		expect(document.getElementById('boss-encounter-hud').classList.contains('hidden')).toBe(true);
	});
});
