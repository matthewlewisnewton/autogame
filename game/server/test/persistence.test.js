import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	extractPersistentData,
	savePlayerData,
	saveAllPlayers,
	setTestProvider,
	persistenceKey,
	gameState,
	resetGameState,
	provider as defaultProvider
} from '../index.js';
import { StorageProvider } from '../storage.js';
import { InMemoryProvider, FileProvider } from '../providers.js';
import * as configMod from '../config.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

// ── StorageProvider (abstract base class) ──

describe('StorageProvider base class', () => {
	it('savePlayer() throws when called on the abstract class', () => {
		const sp = new StorageProvider();
		expect(() => sp.savePlayer('p1', {})).toThrow('Not implemented');
	});

	it('loadPlayer() throws when called on the abstract class', () => {
		const sp = new StorageProvider();
		expect(() => sp.loadPlayer('p1')).toThrow('Not implemented');
	});

	it('close() throws when called on the abstract class', () => {
		const sp = new StorageProvider();
		expect(() => sp.close()).toThrow('Not implemented');
	});
});

// ── InMemoryProvider ──

describe('InMemoryProvider', () => {
	let provider;

	beforeEach(() => {
		provider = new InMemoryProvider();
	});

	const sampleData = {
		currency: 42,
		ownedCards: { iron_sword: 2, flame_blade: 1 },
		selectedDeck: ['iron_sword', 'iron_sword', 'flame_blade'],
	};

	it('savePlayer() then loadPlayer() returns the same data', () => {
		provider.savePlayer('player1', sampleData);
		expect(provider.loadPlayer('player1')).toEqual(sampleData);
	});

	it('loadPlayer() for unknown id returns null', () => {
		expect(provider.loadPlayer('nonexistent')).toBeNull();
	});

	it('overwrites data on subsequent saves', () => {
		provider.savePlayer('player1', sampleData);
		const updated = { ...sampleData, currency: 100 };
		provider.savePlayer('player1', updated);
		expect(provider.loadPlayer('player1')).toEqual(updated);
	});

	it('isolates data between different players', () => {
		provider.savePlayer('player1', sampleData);
		provider.savePlayer('player2', { ...sampleData, currency: 99 });
		expect(provider.loadPlayer('player1').currency).toBe(42);
		expect(provider.loadPlayer('player2').currency).toBe(99);
	});

	it('save deep-copies input (mutations do not affect stored data)', () => {
		provider.savePlayer('player1', sampleData);
		sampleData.currency = 999;
		expect(provider.loadPlayer('player1').currency).toBe(42);
	});

	it('load returns a deep copy (mutations do not affect stored data)', () => {
		const data = { currency: 42, ownedCards: {}, selectedDeck: [] };
		provider.savePlayer('player1', data);
		const loaded = provider.loadPlayer('player1');
		loaded.currency = 999;
		expect(provider.loadPlayer('player1').currency).toBe(42);
	});

	it('close() is a no-op', () => {
		expect(() => provider.close()).not.toThrow();
	});
});

// ── FileProvider ──

describe('FileProvider', () => {
	let tmpDir;
	let provider;

	beforeEach(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-test-'));
		provider = new FileProvider(tmpDir);
	});

	afterEach(() => {
		provider.close();
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	const sampleData = {
		currency: 42,
		ownedCards: { iron_sword: 2, flame_blade: 1 },
		selectedDeck: ['iron_sword', 'iron_sword', 'flame_blade'],
	};

	it('savePlayer() then loadPlayer() returns the same data', () => {
		provider.savePlayer('player1', sampleData);
		expect(provider.loadPlayer('player1')).toEqual(sampleData);
	});

	it('loadPlayer() for unknown id returns null', () => {
		expect(provider.loadPlayer('nonexistent')).toBeNull();
	});

	it('overwrites data on subsequent saves', () => {
		provider.savePlayer('player1', sampleData);
		const updated = { ...sampleData, currency: 100 };
		provider.savePlayer('player1', updated);
		expect(provider.loadPlayer('player1')).toEqual(updated);
	});

	it('close() is a no-op', () => {
		expect(() => provider.close()).not.toThrow();
	});

	it('data survives across separate FileProvider instances', () => {
		provider.savePlayer('player1', sampleData);
		provider.close();

		const provider2 = new FileProvider(tmpDir);
		expect(provider2.loadPlayer('player1')).toEqual(sampleData);
		provider2.close();
	});

	it('isolates data between different player files', () => {
		provider.savePlayer('player1', sampleData);
		provider.savePlayer('player2', { ...sampleData, currency: 99 });
		expect(provider.loadPlayer('player1').currency).toBe(42);
		expect(provider.loadPlayer('player2').currency).toBe(99);
	});

	it('writes to .tmp file then renames (atomic save)', () => {
		provider.savePlayer('player1', sampleData);
		expect(fs.existsSync(path.join(tmpDir, 'player1.json'))).toBe(true);
		expect(fs.existsSync(path.join(tmpDir, 'player1.json.tmp'))).toBe(false);
	});

	it('creates basePath directory if it does not exist', () => {
		const nestedDir = path.join(tmpDir, 'deep', 'nested', 'dir');
		expect(fs.existsSync(nestedDir)).toBe(false);
		const nestedProvider = new FileProvider(nestedDir);
		expect(fs.existsSync(nestedDir)).toBe(true);
		nestedProvider.close();
	});

	it('throws on non-ENOENT errors (e.g. invalid JSON)', () => {
		fs.writeFileSync(path.join(tmpDir, 'bad.json'), '{not valid json', 'utf-8');
		expect(() => provider.loadPlayer('bad')).toThrow();
	});
});

// ── extractPersistentData ──

describe('extractPersistentData', () => {
	beforeEach(() => {
		resetGameState();
	});

	it('extracts currency, ownedCards, selectedDeck, and location from a player', () => {
		const player = {
			x: 3,
			y: 0.5,
			z: 7,
			rotation: 1.57,
			currency: 42,
			ownedCards: { iron_sword: 3, flame_blade: 2 },
			selectedDeck: ['iron_sword', 'flame_blade', 'battle_familiar', 'dungeon_drake'],
			hp: 100,
			dead: false,
			ready: false,
		};
		gameState.players['p1'] = player;

		const data = extractPersistentData(player);

		expect(data).toEqual({
			currency: 42,
			ownedCards: { iron_sword: 3, flame_blade: 2 },
			selectedDeck: ['iron_sword', 'flame_blade', 'battle_familiar', 'dungeon_drake'],
			x: 3,
			y: 0.5,
			z: 7,
			rotation: 1.57,
		});
	});

	it('returns defaults for missing fields', () => {
		const player = {};
		const data = extractPersistentData(player);

		expect(data).toEqual({
			currency: 0,
			ownedCards: {},
			selectedDeck: [],
			x: 0,
			y: 0.5,
			z: 0,
			rotation: 0,
		});
	});

	it('does not include transient fields (hp, dead, ready, hand, deck)', () => {
		const player = {
			x: 5,
			y: 0.5,
			z: 10,
			rotation: 0,
			currency: 10,
			ownedCards: { iron_sword: 1 },
			selectedDeck: ['iron_sword'],
			hp: 50,
			dead: false,
			ready: true,
			hand: [{ id: 'iron_sword' }],
			deck: ['flame_blade'],
			runRewards: { currency: 5, cards: [] },
			currencyEarnedThisRun: 5,
		};

		const data = extractPersistentData(player);

		expect(data).toEqual({
			currency: 10,
			ownedCards: { iron_sword: 1 },
			selectedDeck: ['iron_sword'],
			x: 5,
			y: 0.5,
			z: 10,
			rotation: 0,
		});
		expect(data).not.toHaveProperty('hp');
		expect(data).not.toHaveProperty('dead');
		expect(data).not.toHaveProperty('ready');
		expect(data).not.toHaveProperty('hand');
		expect(data).not.toHaveProperty('deck');
		expect(data).not.toHaveProperty('runRewards');
	});
});

// ── savePlayerData ──

describe('savePlayerData', () => {
	let testProvider;

	beforeEach(() => {
		resetGameState();
		testProvider = new InMemoryProvider();
		setTestProvider(testProvider);
	});

	afterEach(() => {
		setTestProvider(null);
	});

	it('calls provider.savePlayer with the correct data shape', () => {
		const player = {
			x: 2,
			y: 0.5,
			z: 4,
			rotation: 0.8,
			currency: 100,
			ownedCards: { iron_sword: 5 },
			selectedDeck: ['iron_sword', 'iron_sword', 'flame_blade'],
		};
		gameState.players['testPlayer'] = player;

		savePlayerData('testPlayer');

		const loaded = testProvider.loadPlayer('testPlayer');
		expect(loaded).toEqual({
			x: 2,
			y: 0.5,
			z: 4,
			rotation: 0.8,
			currency: 100,
			ownedCards: { iron_sword: 5 },
			selectedDeck: ['iron_sword', 'iron_sword', 'flame_blade'],
		});
	});

	it('saves only persistent fields (excludes hp, dead, hand, etc.)', () => {
		const player = {
			x: 0,
			y: 0.5,
			z: 0,
			rotation: 0,
			currency: 50,
			ownedCards: { flame_blade: 2 },
			selectedDeck: ['flame_blade', 'battle_familiar'],
			hp: 80,
			dead: false,
			ready: true,
			hand: [{ id: 'flame_blade' }],
			deck: ['battle_familiar'],
			magicStones: 100,
		};
		gameState.players['p1'] = player;

		savePlayerData('p1');

		const loaded = testProvider.loadPlayer('p1');
		expect(loaded).toEqual({
			x: 0,
			y: 0.5,
			z: 0,
			rotation: 0,
			currency: 50,
			ownedCards: { flame_blade: 2 },
			selectedDeck: ['flame_blade', 'battle_familiar'],
		});
		expect(loaded).not.toHaveProperty('hp');
		expect(loaded).not.toHaveProperty('hand');
	});

	it('does nothing when player does not exist in gameState', () => {
		expect(() => savePlayerData('nonexistent')).not.toThrow();
		expect(testProvider.loadPlayer('nonexistent')).toBeNull();
	});

	it('does nothing when provider is null', () => {
		setTestProvider(null);
		gameState.players['anyone'] = { currency: 10, ownedCards: {}, selectedDeck: [] };
		expect(() => savePlayerData('anyone')).not.toThrow();
	});

	it('catches and logs errors without rethrowing when provider.savePlayer throws', () => {
		const throwingProvider = {
			savePlayer: () => { throw new Error('disk full'); },
		};
		setTestProvider(throwingProvider);

		const player = {
			currency: 10,
			ownedCards: {},
			selectedDeck: [],
		};
		gameState.players['errPlayer'] = player;

		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(() => savePlayerData('errPlayer')).not.toThrow();
		expect(consoleErrorSpy).toHaveBeenCalledWith(
			expect.stringContaining('[persistence] savePlayerData failed for errPlayer'),
			expect.any(String)
		);
		consoleErrorSpy.mockRestore();
	});
});

// ── saveAllPlayers ──

describe('saveAllPlayers', () => {
	let testProvider;

	beforeEach(() => {
		resetGameState();
		testProvider = new InMemoryProvider();
		setTestProvider(testProvider);
	});

	afterEach(() => {
		setTestProvider(null);
	});

	it('calls savePlayerData for each player in gameState.players', () => {
		gameState.players['a'] = { x: 1, y: 0.5, z: 2, rotation: 0, currency: 1, ownedCards: { iron_sword: 1 }, selectedDeck: ['iron_sword'] };
		gameState.players['b'] = { x: 3, y: 0.5, z: 4, rotation: 1, currency: 2, ownedCards: { flame_blade: 1 }, selectedDeck: ['flame_blade'] };

		saveAllPlayers();

		expect(testProvider.loadPlayer('a')).toEqual({
			x: 1, y: 0.5, z: 2, rotation: 0,
			currency: 1,
			ownedCards: { iron_sword: 1 },
			selectedDeck: ['iron_sword'],
		});
		expect(testProvider.loadPlayer('b')).toEqual({
			x: 3, y: 0.5, z: 4, rotation: 1,
			currency: 2,
			ownedCards: { flame_blade: 1 },
			selectedDeck: ['flame_blade'],
		});
	});

	it('is a no-op when there are no players', () => {
		expect(Object.keys(gameState.players)).toHaveLength(0);
		expect(() => saveAllPlayers()).not.toThrow();
	});

	it('catches per-player errors without crashing the loop', () => {
		gameState.players['p1'] = { x: 0, y: 0.5, z: 0, rotation: 0, currency: 10, ownedCards: {}, selectedDeck: [] };
		gameState.players['p2'] = { x: 0, y: 0.5, z: 0, rotation: 0, currency: 20, ownedCards: {}, selectedDeck: [] };

		// Make p1's save throw but let p2's save call through to the real implementation
		const originalSave = testProvider.savePlayer.bind(testProvider);
		vi.spyOn(testProvider, 'savePlayer').mockImplementation((id, data) => {
			if (id === 'p1') throw new Error('fail');
			originalSave(id, data);
		});

		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(() => saveAllPlayers()).not.toThrow();
		// p2 should still have been saved
		expect(testProvider.loadPlayer('p2')).toEqual({
			x: 0, y: 0.5, z: 0, rotation: 0,
			currency: 20,
			ownedCards: {},
			selectedDeck: [],
		});
		testProvider.savePlayer.mockRestore();
		consoleErrorSpy.mockRestore();
	});
});

// ── Config ──

describe('PERIODIC_SAVE_INTERVAL_MS config', () => {
	it('is exported from config with a value of 30000', () => {
		expect(configMod.PERIODIC_SAVE_INTERVAL_MS).toBe(30000);
	});
});

// ── persistenceKey ──

describe('persistenceKey', () => {
	beforeEach(() => {
		resetGameState();
	});

	it('returns accountId for authenticated players', () => {
		gameState.players['player-uuid-1'] = {
			id: 'player-uuid-1',
			accountId: 'acct-alice',
			currency: 10,
			ownedCards: {},
			selectedDeck: [],
		};
		expect(persistenceKey('player-uuid-1')).toBe('acct-alice');
	});

	it('returns playerId for anonymous players (accountId null)', () => {
		gameState.players['anon-uuid-1'] = {
			id: 'anon-uuid-1',
			accountId: null,
			currency: 0,
			ownedCards: {},
			selectedDeck: [],
		};
		expect(persistenceKey('anon-uuid-1')).toBe('anon-uuid-1');
	});

	it('returns playerId for anonymous players (accountId undefined)', () => {
		gameState.players['anon-uuid-2'] = {
			id: 'anon-uuid-2',
			currency: 0,
			ownedCards: {},
			selectedDeck: [],
		};
		expect(persistenceKey('anon-uuid-2')).toBe('anon-uuid-2');
	});

	it('returns playerId when player does not exist', () => {
		expect(persistenceKey('nonexistent')).toBe('nonexistent');
	});
});

// ── Authenticated save/load round-trip by accountId ──

describe('authenticated save/load round-trip by accountId', () => {
	let testProvider;

	beforeEach(() => {
		resetGameState();
		testProvider = new InMemoryProvider();
		setTestProvider(testProvider);
	});

	afterEach(() => {
		setTestProvider(null);
	});

	it('saves under accountId and loads by accountId — round-trip preserves data', () => {
		const testAccountId = 'acct-roundtrip-' + Date.now();
		const playerId = 'player-uuid-' + Date.now();

		// Simulate an authenticated player: playerId differs from accountId
		gameState.players[playerId] = {
			id: playerId,
			accountId: testAccountId,
			x: 5,
			y: 0.5,
			z: 10,
			rotation: 1.57,
			currency: 42,
			ownedCards: { iron_sword: 3, flame_blade: 1 },
			selectedDeck: ['iron_sword', 'flame_blade', 'battle_familiar', 'dungeon_drake'],
		};

		// Save using playerId (as the server does)
		savePlayerData(playerId);

		// Verify data is stored under accountId, not playerId
		expect(testProvider.loadPlayer(testAccountId)).toEqual({
			x: 5,
			y: 0.5,
			z: 10,
			rotation: 1.57,
			currency: 42,
			ownedCards: { iron_sword: 3, flame_blade: 1 },
			selectedDeck: ['iron_sword', 'flame_blade', 'battle_familiar', 'dungeon_drake'],
		});

		// Verify data is NOT stored under playerId
		expect(testProvider.loadPlayer(playerId)).toBeNull();

		// Simulate reconnect: load by accountId and verify data matches
		const loaded = testProvider.loadPlayer(testAccountId);
		expect(loaded.currency).toBe(42);
		expect(loaded.ownedCards).toEqual({ iron_sword: 3, flame_blade: 1 });
		expect(loaded.selectedDeck).toEqual(['iron_sword', 'flame_blade', 'battle_familiar', 'dungeon_drake']);
		expect(loaded.x).toBe(5);
		expect(loaded.z).toBe(10);
	});

	it('multiple authenticated players save under distinct accountIds', () => {
		gameState.players['p1'] = {
			id: 'p1',
			accountId: 'acct-user-a',
			x: 0, y: 0.5, z: 0, rotation: 0,
			currency: 100,
			ownedCards: { iron_sword: 5 },
			selectedDeck: ['iron_sword'],
		};
		gameState.players['p2'] = {
			id: 'p2',
			accountId: 'acct-user-b',
			x: 10, y: 0.5, z: 20, rotation: 0,
			currency: 200,
			ownedCards: { flame_blade: 2 },
			selectedDeck: ['flame_blade'],
		};

		savePlayerData('p1');
		savePlayerData('p2');

		expect(testProvider.loadPlayer('acct-user-a').currency).toBe(100);
		expect(testProvider.loadPlayer('acct-user-b').currency).toBe(200);
		// Data isolated between accounts
		expect(testProvider.loadPlayer('acct-user-a').ownedCards).toEqual({ iron_sword: 5 });
		expect(testProvider.loadPlayer('acct-user-b').ownedCards).toEqual({ flame_blade: 2 });
	});
});

// ── Anonymous save/load round-trip by playerId ──

describe('anonymous save/load round-trip by playerId', () => {
	let testProvider;

	beforeEach(() => {
		resetGameState();
		testProvider = new InMemoryProvider();
		setTestProvider(testProvider);
	});

	afterEach(() => {
		setTestProvider(null);
	});

	it('saves under playerId and loads by playerId — round-trip preserves data', () => {
		const anonPlayerId = 'anon-player-' + Date.now();

		// Simulate an anonymous player (no accountId)
		gameState.players[anonPlayerId] = {
			id: anonPlayerId,
			accountId: null,
			x: 3,
			y: 0.5,
			z: 7,
			rotation: 0.8,
			currency: 15,
			ownedCards: { iron_sword: 2 },
			selectedDeck: ['iron_sword', 'flame_blade'],
		};

		// Save using playerId
		savePlayerData(anonPlayerId);

		// Verify data is stored under playerId
		const loaded = testProvider.loadPlayer(anonPlayerId);
		expect(loaded).toEqual({
			x: 3,
			y: 0.5,
			z: 7,
			rotation: 0.8,
			currency: 15,
			ownedCards: { iron_sword: 2 },
			selectedDeck: ['iron_sword', 'flame_blade'],
		});

		// Verify currency and ownedCards survive round-trip
		expect(loaded.currency).toBe(15);
		expect(loaded.ownedCards).toEqual({ iron_sword: 2 });
	});
});
