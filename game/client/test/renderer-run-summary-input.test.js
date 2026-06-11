import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
	const overlay = document.getElementById('run-summary-overlay');
	if (overlay) overlay.style.display = 'none';
}

describe('renderer run-summary input lock', () => {
	let rafCallbacks;

	beforeEach(() => {
		vi.resetModules();
		document.body.innerHTML = '';
		ensureMainDom();
		rafCallbacks = [];
		vi.stubGlobal('requestAnimationFrame', vi.fn((cb) => {
			rafCallbacks.push(cb);
			return rafCallbacks.length;
		}));
		try { localStorage.setItem('autogame_token', 'test-fake-jwt-token'); } catch (_) { /* ignore */ }
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('updateMyPlayer() does not advance position or emit move while overlay is visible', async () => {
		await import('../main.js');
		const { updateMyPlayer, setGamePhase, getSimPlayerPosition, setPlayerPosition } = await import('../renderer.js');

		window.createSocket('test-token');
		window.__setGameState({
			gamePhase: 'playing',
			run: { status: 'playing' },
			players: { p1: { x: 0, z: 0, dead: false, hp: 100 } },
			enemies: [],
		}, 'p1');
		setGamePhase('playing');
		setPlayerPosition(0, 0);

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

		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
		window.__clearSocketEmitLog();

		updateMyPlayer(0.1);
		updateMyPlayer(0.1);

		expect(getSimPlayerPosition()).toEqual({ x: 0, z: 0 });
		expect(window.__socketEmitLog().filter((e) => e.event === 'move')).toHaveLength(0);

		window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w' }));
	});

	it('animate() does not emit lootPickup while overlay is visible', async () => {
		await import('../main.js');
		const {
			initScene,
			setGameStateRef,
			setMyId,
			setSocketRef,
			setPlayerPosition,
			animate,
		} = await import('../renderer.js');

		const emit = vi.fn();
		initScene(null, { x: 0, z: 0 });
		setSocketRef({ emit });
		setMyId('p1');
		setPlayerPosition(0, 0);
		setGameStateRef({
			gamePhase: 'playing',
			run: { status: 'victory' },
			players: { p1: { x: 0, z: 0, dead: false, hp: 100 } },
			loot: [{ id: 'ms_nearby', x: 0, z: 0, value: 3, kind: 'magic_stone' }],
			enemies: [],
			minions: [],
		});

		document.getElementById('run-summary-overlay').style.display = 'flex';

		emit.mockClear();
		animate(0);

		expect(emit.mock.calls.filter(([event]) => event === 'lootPickup')).toHaveLength(0);
	});

	it('updateMyPlayer() blocks movement when run.status is failed without overlay checker', async () => {
		await import('../main.js');
		const { updateMyPlayer, setGamePhase, getSimPlayerPosition, setPlayerPosition } = await import('../renderer.js');

		window.createSocket('test-token');
		window.__setGameState({
			gamePhase: 'playing',
			run: { status: 'failed' },
			players: { p1: { x: 0, z: 0, dead: false, hp: 100 } },
			enemies: [],
		}, 'p1');
		setGamePhase('playing');
		setPlayerPosition(0, 0);

		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
		window.__clearSocketEmitLog();

		updateMyPlayer(0.1);
		updateMyPlayer(0.1);

		expect(getSimPlayerPosition()).toEqual({ x: 0, z: 0 });
		expect(window.__socketEmitLog().filter((e) => e.event === 'move')).toHaveLength(0);

		window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w' }));
	});
});
