import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	startTestServer,
	closeServer,
	connectClient,
	waitForEvent,
	playerForSocket,
	testGameState,
} from './helpers.js';
import {
	COOLDOWN_MS,
	checkRunTerminalState,
	returnPlayersToLobby,
	giveUpRun,
	checkAllReady,
	recordEnemyDefeated,
	startDungeonRun,
	resetTransientRunState,
	gameState,
	createGameState,
	setTestProvider,
	io as serverIo,
	MAX_MAGIC_STONES,
} from '../index.js';

function sleep(ms) {
	return new Promise(r => setTimeout(r, ms));
}

// ── Helpers ──

/**
 * Connect a client and enter the playing phase via the summon-ready debug scenario.
 */
async function connectAndEnterPlaying(baseUrl) {
	const { socket } = await connectClient(baseUrl);
	const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
	socket.emit('debugScenario', { name: 'summon-ready' });
	await debugResultPromise;
	await waitForEvent(socket, 'stateUpdate');
	return { socket };
}

/**
 * Find a slot index holding a weapon card in the player hand.
 */
function findWeaponSlot(player) {
	return player.hand.findIndex(c => c && c.type === 'weapon');
}

/**
 * Place an enemy within attack range of the player.
 */
function placeEnemyInRange(state, player) {
	state.enemies.push({
		id: `e-overclock-${Date.now()}`,
		type: 'grunt',
		x: player.x + 3,
		z: player.z,
		hp: 100,
		state: 'idle',
		wanderTarget: { x: player.x + 3, z: player.z },
	});
}

/**
 * Play a card and assert it succeeds (cardUsed, not cardError).
 */
async function playCard(socket, cardId, slotIndex) {
	// Listen for both cardUsed and cardError; whichever fires first wins
	let cardUsedData = null;
	let cardErrorData = null;

	const cardUsedPromise = waitForEvent(socket, 'cardUsed').then(d => { cardUsedData = d; });
	const cardErrorPromise = waitForEvent(socket, 'cardError').then(d => { cardErrorData = d; });

	socket.emit('useCard', { cardId, slotIndex });

	// Wait for either (use a short race)
	await Promise.race([cardUsedPromise, cardErrorPromise]);
	await sleep(50); // let the resolve settle

	if (cardErrorData) {
		throw new Error(`Card play failed: ${cardErrorData.reason}`);
	}
	return cardUsedData;
}

// ── Tests ──

describe('Overclock key item', () => {
	let baseUrl;

	beforeEach(async () => {
		baseUrl = await startTestServer();
	});

	afterEach(async () => {
		await closeServer();
	});

	it('useKeyItem overclock sets overclockChargesRemaining to 2 and applies key item cooldown', async () => {
		const { socket } = await connectAndEnterPlaying(baseUrl);
		const player = playerForSocket(socket);

		// Equip overclock and ensure clean state
		player.equippedKeyItemId = 'overclock';
		player.overclockChargesRemaining = 0;
		player.keyItemCooldownUntil = 0;

		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'overclock' });
		const result = await resultPromise;

		expect(result.ok).toBe(true);
		expect(result.charges).toBe(2);
		expect(player.overclockChargesRemaining).toBe(2);
		expect(player.keyItemCooldownUntil).toBeGreaterThan(Date.now());
	});

	it('first card play with overclock skips slot cooldown and decrements charges', async () => {
		const { socket } = await connectAndEnterPlaying(baseUrl);
		const player = playerForSocket(socket);
		const state = testGameState();

		// Set up overclock
		player.equippedKeyItemId = 'overclock';
		player.overclockChargesRemaining = 2;
		player.slotCooldowns = {};

		// Find a weapon card and ensure it has enough charges
		const weaponSlot = findWeaponSlot(player);
		expect(weaponSlot).toBeGreaterThanOrEqual(0);
		player.hand[weaponSlot].remainingCharges = 3;

		// Place an enemy in range
		placeEnemyInRange(state, player);

		// Play card — should succeed and consume 1 charge
		await playCard(socket, player.hand[weaponSlot].id, weaponSlot);

		// Slot cooldown should NOT be set
		expect(player.slotCooldowns[weaponSlot]).toBeUndefined();

		// Charge should be decremented
		expect(player.overclockChargesRemaining).toBe(1);
	});

	it('second rapid card play from same slot succeeds and consumes last charge', async () => {
		const { socket } = await connectAndEnterPlaying(baseUrl);
		const player = playerForSocket(socket);
		const state = testGameState();

		// Set up overclock with 1 remaining charge (simulating after first play)
		player.equippedKeyItemId = 'overclock';
		player.overclockChargesRemaining = 1;
		player.slotCooldowns = {};

		// Find a weapon card and ensure enough charges
		const weaponSlot = findWeaponSlot(player);
		expect(weaponSlot).toBeGreaterThanOrEqual(0);
		player.hand[weaponSlot].remainingCharges = 3;

		// Place an enemy in range
		placeEnemyInRange(state, player);

		// Play card again — should succeed (consume last charge)
		const cardUsed = await playCard(socket, player.hand[weaponSlot].id, weaponSlot);

		expect(cardUsed).toBeDefined();

		// All charges consumed
		expect(player.overclockChargesRemaining).toBe(0);
	});

	it('third card play respects slot cooldown after charges exhausted', async () => {
		const { socket } = await connectAndEnterPlaying(baseUrl);
		const player = playerForSocket(socket);
		const state = testGameState();

		// Set up overclock with 2 charges
		player.equippedKeyItemId = 'overclock';
		player.overclockChargesRemaining = 2;
		player.slotCooldowns = {};

		// Find a weapon card and ensure enough charges for 3+ plays
		const weaponSlot = findWeaponSlot(player);
		expect(weaponSlot).toBeGreaterThanOrEqual(0);
		const cardId = player.hand[weaponSlot].id;
		player.hand[weaponSlot].remainingCharges = 5;

		// Place an enemy in range
		placeEnemyInRange(state, player);

		// First play — consumes charge 1 (overclock -> 1)
		await playCard(socket, cardId, weaponSlot);
		expect(player.overclockChargesRemaining).toBe(1);

		// Second play — consumes charge 2 (overclock -> 0)
		await playCard(socket, cardId, weaponSlot);
		expect(player.overclockChargesRemaining).toBe(0);

		// Third play — no overclock left; should succeed but set slot cooldown
		await playCard(socket, cardId, weaponSlot);

		// The slot should now have a cooldown set
		expect(player.slotCooldowns[weaponSlot]).toBeGreaterThan(Date.now() - COOLDOWN_MS);

		// Fourth play — should be rejected with cooldown error
		const cardErrorPromise = waitForEvent(socket, 'cardError');
		socket.emit('useCard', {
			cardId: player.hand[weaponSlot].id,
			slotIndex: weaponSlot,
		});
		const err = await cardErrorPromise;

		expect(err.reason).toBe('Slot on cooldown');
	}, 20000);

	it('overclock does not bypass MS cost — card still consumes magic stones', async () => {
		const { socket } = await connectAndEnterPlaying(baseUrl);
		const player = playerForSocket(socket);
		const state = testGameState();

		// Set up overclock
		player.equippedKeyItemId = 'overclock';
		player.overclockChargesRemaining = 2;
		player.magicStones = 100;
		player.slotCooldowns = {};

		// Find a spell card (spells have magicStoneCost; weapons do not)
		const spellSlot = player.hand.findIndex(c => c && c.type === 'spell');
		expect(spellSlot).toBeGreaterThanOrEqual(0);
		const cardId = player.hand[spellSlot].id;
		const cardCost = player.hand[spellSlot].magicStoneCost || 0;
		expect(cardCost).toBeGreaterThan(0);

		// Clear enemies so no MS is gained from hits — isolates pure MS cost
		state.enemies = [];

		const msBefore = player.magicStones;

		// Play card — should succeed (overclock bypasses cooldown, not MS cost)
		await playCard(socket, cardId, spellSlot);

		// Magic stones should have decreased by approximately the card's cost
		// (tiny drift from MS regen tick is expected)
		expect(player.magicStones).toBeLessThan(msBefore);
		expect(msBefore - player.magicStones).toBeCloseTo(cardCost, 1);
	}, 20000);

	it('overclockChargesRemaining appears in stateSnapshot and is visible in stateUpdate', async () => {
		const { socket } = await connectAndEnterPlaying(baseUrl);
		const player = playerForSocket(socket);

		// Set up overclock
		player.equippedKeyItemId = 'overclock';
		player.overclockChargesRemaining = 2;

		// Verify the player object has the field
		expect(player.overclockChargesRemaining).toBe(2);

		// Verify it appears in the stateUpdate event
		const stateUpdatePromise = waitForEvent(socket, 'stateUpdate');
		socket.emit('useKeyItem', { keyItemId: 'dodge_roll' });
		await waitForEvent(socket, 'keyItemUsed');
		const stateUpdate = await stateUpdatePromise;

		const playerId = socket._playerId;
		const playerInUpdate = stateUpdate.players[playerId];
		expect(playerInUpdate).toBeDefined();
		expect(playerInUpdate.overclockChargesRemaining).toBe(2);
	});
});

// ── Unit tests: Overclock run-end lifecycle ──

function resetState() {
	Object.assign(gameState, createGameState());
}

function addPlayer(id, overrides = {}) {
	gameState.players[id] = {
		x: 0, y: 0.5, z: 0, rotation: 0, hp: 100, dead: false,
		lastActivity: Date.now(), ready: false, magicStones: MAX_MAGIC_STONES,
		currency: 0, debugScenario: null, pendingSummons: new Set(),
		deck: [], overclockChargesRemaining: 0, ...overrides,
	};
}

function mockIoEmit() {
	const emitCalls = [];
	const origTo = serverIo.to;
	const origEmit = serverIo.emit;
	const mockEmit = (event, data) => emitCalls.push({ event, data });
	serverIo.to = () => ({ emit: mockEmit });
	serverIo.emit = mockEmit;
	return { emitCalls, restore: () => { serverIo.to = origTo; serverIo.emit = origEmit; } };
}

describe('Overclock run-end lifecycle', () => {
	beforeEach(() => {
		resetState();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('checkRunTerminalState clears overclockChargesRemaining on victory', () => {
		startDungeonRun();
		addPlayer('p1', { overclockChargesRemaining: 2 });
		gameState.enemies.push({ id: 'e1', type: 'grunt', x: 0, z: 0, hp: 50, state: 'idle', wanderTarget: { x: 0, z: 0 } });
		recordEnemyDefeated(1);
		checkRunTerminalState();
		expect(gameState.players.p1.overclockChargesRemaining).toBe(0);
	});

	it('checkRunTerminalState clears overclockChargesRemaining on failure', () => {
		startDungeonRun();
		addPlayer('p1', { hp: 0, dead: true, overclockChargesRemaining: 2 });
		checkRunTerminalState();
		expect(gameState.players.p1.overclockChargesRemaining).toBe(0);
	});

	it('returnPlayersToLobby clears overclockChargesRemaining', () => {
		gameState._lobbyId = 'test-lobby';
		startDungeonRun();
		addPlayer('p1', { overclockChargesRemaining: 2 });
		const { restore } = mockIoEmit();
		returnPlayersToLobby();
		restore();
		expect(gameState.players.p1.overclockChargesRemaining).toBe(0);
	});

	it('giveUpRun clears overclockChargesRemaining', () => {
		gameState._lobbyId = 'test-lobby';
		gameState.gamePhase = 'playing';
		startDungeonRun();
		addPlayer('p1', { overclockChargesRemaining: 2 });
		const { restore } = mockIoEmit();
		giveUpRun();
		restore();
		expect(gameState.players.p1.overclockChargesRemaining).toBe(0);
	});

	it('checkAllReady clears overclockChargesRemaining on fresh run', () => {
		gameState._lobbyId = 'test-lobby';
		addPlayer('p1', { ready: true, overclockChargesRemaining: 2, selectedDeck: ['iron_sword', 'flame_blade', 'battle_familiar', 'dungeon_drake'] });
		const { restore } = mockIoEmit();
		checkAllReady();
		restore();
		expect(gameState.players.p1.overclockChargesRemaining).toBe(0);
	});
});
