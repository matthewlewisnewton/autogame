import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateLayout, questLayoutSeed } from '../../server/dungeon.js';
import { getLayoutProfileForQuest } from '../../server/quests.js';

const initSceneMock = vi.fn();
const rebuildDungeonLayoutMock = vi.fn();
const setPlayerPositionMock = vi.fn();
let sceneReady = false;

vi.mock('../renderer.js', async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		initScene: (...args) => {
			initSceneMock(...args);
			sceneReady = true;
		},
		rebuildDungeonLayout: (...args) => rebuildDungeonLayoutMock(...args),
		isSceneInitialized: () => sceneReady,
		getSpawnPosition: () => ({ x: 1, z: 2 }),
		setPlayerPosition: (...args) => setPlayerPositionMock(...args),
	};
});

const hubLayout = {
	profile: 'hub',
	rooms: [{ role: 'start', x: 0, z: 0, hubZone: 'operations' }],
	passages: [],
};

const questLayout = {
	profile: 'compact',
	rooms: [{ role: 'start', x: 5, z: 5 }],
	passages: [],
};

function ensureLobbyDom() {
	const requiredIds = [
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
		'quest-board', 'quest-error',
	];
	for (const id of requiredIds) {
		if (!document.getElementById(id)) {
			const el = (id === 'ready-btn' || id === 'return-to-lobby-btn')
				? document.createElement('button')
				: document.createElement('div');
			el.id = id;
			document.body.appendChild(el);
		}
	}
}

describe('hub lobby scene bootstrap', () => {
	beforeEach(async () => {
		vi.resetModules();
		sceneReady = false;
		initSceneMock.mockClear();
		rebuildDungeonLayoutMock.mockClear();
		setPlayerPositionMock.mockClear();
		ensureLobbyDom();
		await import('../main.js');
	});

	it('lobby join initializes the renderer with hub layout and server spawn', () => {
		window.applyLobbyJoinedData({
			id: 'p1',
			layout: hubLayout,
			layoutSeed: 42,
			state: {
				gamePhase: 'lobby',
				players: { p1: { x: 3, z: 4, currency: 0 } },
			},
		});

		expect(initSceneMock).toHaveBeenCalledTimes(1);
		expect(initSceneMock).toHaveBeenCalledWith(hubLayout, { x: 3, z: 4 });
		expect(rebuildDungeonLayoutMock).not.toHaveBeenCalled();
	});

	it('quest layout payload in lobby updates metadata without rebuilding meshes', () => {
		sceneReady = true;
		window.__setGameState({
			gamePhase: 'lobby',
			players: { p1: {} },
			enemies: [],
			loot: [],
			minions: [],
		}, 'p1');

		window.applyQuestLayoutFromServer({
			layout: questLayout,
			layoutSeed: 99,
		});

		expect(rebuildDungeonLayoutMock).not.toHaveBeenCalled();
		expect(window.__AUTOGAME_HARNESS_STATE__().layout.profile).toBe('compact');
	});

	it('quest layout payload in playing phase rebuilds dungeon meshes', () => {
		sceneReady = true;
		window.__setGameState({ gamePhase: 'playing', players: { p1: { x: 1, z: 1 } } }, 'p1');

		window.applyQuestLayoutFromServer({
			layout: questLayout,
			layoutSeed: 99,
		});

		expect(rebuildDungeonLayoutMock).toHaveBeenCalledWith(questLayout);
	});

	it('startGame after hub lobby rebuilds quest dungeon layout from selected quest', () => {
		window.applyLobbyJoinedData({
			id: 'p1',
			layout: hubLayout,
			layoutSeed: 0,
			state: {
				gamePhase: 'lobby',
				selectedQuestId: 'crystal_rescue',
				selectedQuestTier: 1,
				players: { p1: { x: 3, z: 4, currency: 0 } },
				enemies: [],
				minions: [],
				loot: [],
			},
		});

		const socket = {
			_handlers: {},
			on(event, callback) {
				if (!this._handlers[event]) this._handlers[event] = [];
				this._handlers[event].push(callback);
				return this;
			},
			emit: vi.fn(),
			io: {
				_handlers: {},
				on(event, callback) {
					if (!this._handlers[event]) this._handlers[event] = [];
					this._handlers[event].push(callback);
					return this;
				},
			},
		};
		window.bindSocketHandlers(socket);

		const questId = 'crystal_rescue';
		const tier = 1;
		const seed = questLayoutSeed(questId, tier);
		const deployLayout = generateLayout(
			seed,
			getLayoutProfileForQuest(questId, tier),
			{ slopes: true },
		);

		for (const handler of socket._handlers.startGame ?? []) {
			handler({ layout: deployLayout, layoutSeed: seed });
		}

		expect(rebuildDungeonLayoutMock).toHaveBeenCalledTimes(1);
		const deployedLayout = rebuildDungeonLayoutMock.mock.calls[0][0];
		expect(deployedLayout.profile).toBe('open');
		expect(deployedLayout.profile).not.toBe('hub');
		expect(window.__AUTOGAME_HARNESS_STATE__().layout.profile).toBe('open');
	});

	it('playing to lobby stateUpdate rebuilds hub walkable geometry', () => {
		window.applyLobbyJoinedData({
			id: 'p1',
			layout: hubLayout,
			layoutSeed: 0,
			state: {
				gamePhase: 'lobby',
				players: { p1: { x: 3, z: 4, currency: 0 } },
				enemies: [],
				minions: [],
				loot: [],
			},
		});

		const socket = {
			_handlers: {},
			on(event, callback) {
				if (!this._handlers[event]) this._handlers[event] = [];
				this._handlers[event].push(callback);
				return this;
			},
			emit: vi.fn(),
			io: {
				_handlers: {},
				on(event, callback) {
					if (!this._handlers[event]) this._handlers[event] = [];
					this._handlers[event].push(callback);
					return this;
				},
			},
		};
		window.bindSocketHandlers(socket);

		window.applyQuestLayoutFromServer({
			layout: questLayout,
			layoutSeed: 99,
		});
		window.__setGameState({
			gamePhase: 'playing',
			players: { p1: { x: 10, z: 10, currency: 0 } },
			enemies: [],
			minions: [],
			loot: [],
		}, 'p1');

		for (const handler of socket._handlers.stateUpdate ?? []) {
			handler({
				gamePhase: 'lobby',
				layout: hubLayout,
				layoutSeed: 0,
				players: { p1: { x: 3, z: 4, currency: 0 } },
				enemies: [],
				minions: [],
				loot: [],
			});
		}

		expect(rebuildDungeonLayoutMock).toHaveBeenCalledTimes(1);
		expect(rebuildDungeonLayoutMock).toHaveBeenCalledWith(hubLayout);
		expect(rebuildDungeonLayoutMock.mock.calls[0][0].profile).toBe('hub');
		expect(window.__AUTOGAME_HARNESS_STATE__().layout.profile).toBe('hub');
		expect(setPlayerPositionMock).toHaveBeenCalledWith(3, 4);
	});
});
