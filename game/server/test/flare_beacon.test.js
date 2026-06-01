import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	gameState,
	createGameState,
	computeWalkableAABBs,
	MAX_HP,
	KEY_ITEM_DEFS,
} from '../index.js';
import {
	startTestServer,
	closeServer,
	connectClient,
	waitForEvent,
	playerForSocket,
	testGameState,
} from './helpers.js';

// ── Helpers ──

/**
 * Reset game state by clearing existing arrays/objects in-place.
 */
function resetState() {
	const fresh = createGameState();
	Object.keys(gameState.players).forEach((k) => delete gameState.players[k]);
	gameState.enemies.length = 0;
	gameState.minions.length = 0;
	gameState.loot.length = 0;
	gameState.areaEffects.length = 0;
	gameState.enchantments.length = 0;
	gameState.lobby.length = 0;
	gameState.gamePhase = fresh.gamePhase;
	gameState.selectedQuestId = fresh.selectedQuestId;
	gameState.pendingTrades = {};
	gameState.shopOffer = null;
	gameState.telepipe = null;
	gameState.suspendedCheckpoint = null;
	gameState._pendingMinionBreaths = [];
}

/**
 * Build a minimal 2-room layout for unit tests.
 */
function buildLayout() {
	return {
		rooms: [
			{ x: 0, z: 0, width: 12, depth: 12, walls: [] },
			{ x: 20, z: 0, width: 12, depth: 12, walls: [] },
		],
		passages: [
			{ x1: 0, z1: 0, x2: 20, z2: 0, walls: [], corridorLength: 4 },
		],
	};
}

function setupLayout() {
	const layout = buildLayout();
	gameState.layout = layout;
	gameState.walkableAABBs = computeWalkableAABBs(layout);
	gameState.dungeonBounds = { minX: -20, maxX: 40, minZ: -20, maxZ: 20 };
}

/**
 * Create a minimal enemy object for unit tests.
 */
function createEnemy(id, x, z, hp = 50) {
	return {
		id,
		type: 'grunt',
		x,
		z,
		y: 0.5,
		hp,
		maxHp: 50,
		state: 'idle',
		attackState: 'idle',
		wanderTarget: { x, z },
	};
}

/**
 * Connect a client and start a dungeon run so we're in 'playing' phase.
 */
async function connectAndStartRun(baseUrl) {
	const { socket } = await connectClient(baseUrl);
	const startGamePromise = waitForEvent(socket, 'startGame');
	socket.emit('playerReady', true);
	await startGamePromise;
	return { socket };
}

// ── Definition check (unit) ──

describe('KEY_ITEM_DEFS.flare_beacon — definition', () => {
	beforeEach(() => {
		resetState();
		setupLayout();
	});

	it('has correct parameters: revealRadius=25, revealDurationMs=3000, cooldownMs=10000', () => {
		const def = KEY_ITEM_DEFS.flare_beacon;
		expect(def).toBeDefined();
		expect(def.id).toBe('flare_beacon');
		expect(def.revealRadius).toBe(25);
		expect(def.revealDurationMs).toBe(3000);
		expect(def.cooldownMs).toBe(10000);
		expect(def.type).toBe('utility');
	});
});

// ── Integration tests (via socket) ──

describe('useKeyItem — flare_beacon', () => {
	let baseUrl;

	beforeEach(async () => {
		baseUrl = await startTestServer();
	});

	afterEach(async () => {
		await closeServer();
	});

	it('enemy within revealRadius gets revealedUntil set to now + revealDurationMs', async () => {
		const { socket } = await connectAndStartRun(baseUrl);
		const player = playerForSocket(socket);
		const state = testGameState();

		player.keyItemCooldownUntil = 0;
		state.enemies.length = 0;

		// Place enemy at 5m distance (well within radius=25)
		state.enemies.push(createEnemy('near', player.x + 5, player.z + 5));

		const before = Date.now();
		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'flare_beacon' });
		const result = await resultPromise;
		const after = Date.now();

		const nearEnemy = state.enemies.find(e => e.id === 'near');
		expect(nearEnemy.revealedUntil).toBeDefined();
		expect(nearEnemy.revealedUntil).toBeGreaterThanOrEqual(before + 3000);
		expect(nearEnemy.revealedUntil).toBeLessThanOrEqual(after + 3000);
	});

	it('enemy outside revealRadius does NOT get revealedUntil set', async () => {
		const { socket } = await connectAndStartRun(baseUrl);
		const player = playerForSocket(socket);
		const state = testGameState();

		player.keyItemCooldownUntil = 0;
		state.enemies.length = 0;

		// Place enemy at 30m distance (outside radius=25)
		state.enemies.push(createEnemy('far', player.x + 30, player.z + 30));

		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'flare_beacon' });
		await resultPromise;

		const farEnemy = state.enemies.find(e => e.id === 'far');
		expect(farEnemy.revealedUntil).toBeUndefined();
	});

	it('dead enemies are skipped (do not get revealedUntil)', async () => {
		const { socket } = await connectAndStartRun(baseUrl);
		const player = playerForSocket(socket);
		const state = testGameState();

		player.keyItemCooldownUntil = 0;
		state.enemies.length = 0;

		// Place a dead enemy within radius
		state.enemies.push(createEnemy('dead', player.x + 3, player.z + 3, 0));

		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'flare_beacon' });
		const result = await resultPromise;

		const deadEnemy = state.enemies.find(e => e.id === 'dead');
		expect(deadEnemy.revealedUntil).toBeUndefined();
		expect(result.revealed).toBe(0);
	});

	it('cooldown enforced: second use within 10s returns on_cooldown', async () => {
		const { socket } = await connectAndStartRun(baseUrl);
		const player = playerForSocket(socket);
		const state = testGameState();

		player.keyItemCooldownUntil = 0;
		state.enemies.length = 0;
		state.enemies.push(createEnemy('e1', player.x + 5, player.z + 5));

		// First use — should succeed
		const result1Promise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'flare_beacon' });
		const result1 = await result1Promise;
		expect(result1.ok).toBe(true);

		// Immediate second use — should be on cooldown
		const result2Promise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'flare_beacon' });
		const result2 = await result2Promise;

		expect(result2.ok).toBe(false);
		expect(result2.reason).toBe('on_cooldown');
		expect(result2.remainingMs).toBeGreaterThan(0);
		// flare_beacon has 10000ms cooldown; remaining should be close to that
		expect(result2.remainingMs).toBeCloseTo(10000, -1);
	});

	it('keyItemUsed response includes ok: true and revealed count', async () => {
		const { socket } = await connectAndStartRun(baseUrl);
		const player = playerForSocket(socket);
		const state = testGameState();

		player.keyItemCooldownUntil = 0;
		state.enemies.length = 0;

		// 2 enemies within radius, 1 outside
		state.enemies.push(createEnemy('near1', player.x + 3, player.z + 3));
		state.enemies.push(createEnemy('near2', player.x + 10, player.z + 10));
		state.enemies.push(createEnemy('far', player.x + 30, player.z + 30));

		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'flare_beacon' });
		const result = await resultPromise;

		expect(result.ok).toBe(true);
		expect(result.keyItemId).toBe('flare_beacon');
		expect(result.revealed).toBe(2);
		expect(result.cooldownUntil).toBeGreaterThan(Date.now());
	});

	it('mixed scenario: near enemy revealed, far enemy not, dead enemy skipped', async () => {
		const { socket } = await connectAndStartRun(baseUrl);
		const player = playerForSocket(socket);
		const state = testGameState();

		player.keyItemCooldownUntil = 0;
		state.enemies.length = 0;

		// 2 enemies: one at 5m, one at 30m — only the close one gets revealed
		state.enemies.push(createEnemy('near', player.x + 5, player.z + 5));
		state.enemies.push(createEnemy('far', player.x + 30, player.z + 30));
		state.enemies.push(createEnemy('dead', player.x + 2, player.z + 2, 0));

		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'flare_beacon' });
		const result = await resultPromise;

		expect(result.ok).toBe(true);
		expect(result.revealed).toBe(1);

		const nearEnemy = state.enemies.find(e => e.id === 'near');
		const farEnemy = state.enemies.find(e => e.id === 'far');
		const deadEnemy = state.enemies.find(e => e.id === 'dead');

		expect(nearEnemy.revealedUntil).toBeDefined();
		expect(farEnemy.revealedUntil).toBeUndefined();
		expect(deadEnemy.revealedUntil).toBeUndefined();
	});
});
