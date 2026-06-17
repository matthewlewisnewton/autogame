import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	resetGameState,
	gameState,
	setTestProvider,
	savePlayerData,
} from '../index.js';
import {
	flushDirtyPlayerSaves,
	setGameState,
	setSavePlayerCallback,
} from '../simulation.js';
import { TICK_RATE, PLAYER_MOVEMENT_SAVE_DEBOUNCE_MS } from '../config.js';
import { InMemoryProvider } from '../providers.js';

const GAME_TICK_MS = 1000 / TICK_RATE;

function makePlayer(overrides = {}) {
	return {
		x: 0,
		y: 0.5,
		z: 0,
		rotation: 0,
		currency: 0,
		ownedCards: {},
		selectedDeck: [],
		persistenceDirty: false,
		...overrides,
	};
}

describe('movement save debounce (flushDirtyPlayerSaves)', () => {
	let testProvider;
	let savePlayerSpy;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(1_700_000_000_000);

		testProvider = new InMemoryProvider();
		setTestProvider(testProvider);
		resetGameState();
		setSavePlayerCallback(savePlayerData);

		gameState.players.p1 = makePlayer();
		setGameState(gameState, {});

		savePlayerSpy = vi.spyOn(testProvider, 'savePlayer');
	});

	afterEach(() => {
		savePlayerSpy?.mockRestore();
		setTestProvider(null);
		setSavePlayerCallback(null);
		setGameState(null, null);
		vi.useRealTimers();
	});

	it('bounds savePlayer calls across many ticks of continuous movement', () => {
		const tickCount = 100; // 5 seconds at 20 Hz
		const elapsedMs = tickCount * GAME_TICK_MS;
		const maxSaves = Math.ceil(elapsedMs / PLAYER_MOVEMENT_SAVE_DEBOUNCE_MS) + 1;

		for (let i = 0; i < tickCount; i++) {
			gameState.players.p1.persistenceDirty = true;
			flushDirtyPlayerSaves();
			vi.advanceTimersByTime(GAME_TICK_MS);
		}

		expect(savePlayerSpy.mock.calls.length).toBeLessThanOrEqual(maxSaves);
		expect(savePlayerSpy.mock.calls.length).toBeGreaterThan(0);
		expect(savePlayerSpy.mock.calls.length).toBeLessThan(tickCount);
	});

	it('savePlayerData bypasses debounce and saves immediately', async () => {
		savePlayerSpy.mockClear();

		gameState.players.p1.persistenceDirty = true;
		gameState.players.p1.persistenceLastSavedAt = Date.now();

		await savePlayerData('p1');

		expect(savePlayerSpy).toHaveBeenCalledTimes(1);
		expect(savePlayerSpy).toHaveBeenCalledWith(
			'p1',
			expect.objectContaining({ x: 0, z: 0 }),
		);
	});
});
