import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	gameState,
	createGameState,
	damagePlayer,
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
} from './helpers.js';

// ── Helpers ──

/**
 * Reset game state by clearing existing arrays/objects in-place.
 * This preserves array references so simulation._gameState (which points
 * to the same gameState object) still sees updated contents.
 */
function resetState() {
	const fresh = createGameState();
	// Clear in-place to preserve references held by simulation._gameState
	gameState.players.length = undefined; // players is an object, not array
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
 * Create a player at origin with full HP and guard_block active.
 * Optionally override specific fields.
 */
function createBlockingPlayer(overrides = {}) {
	const now = Date.now();
	const def = KEY_ITEM_DEFS.guard_block;
	return {
		x: 0,
		y: 0.5,
		z: 0,
		rotation: 0,
		hp: MAX_HP,
		dead: false,
		blockingUntil: now + (def.durationMs || 700),
		blockingYaw: 0, // facing +X direction
		invulnerableUntil: 0,
		...overrides,
	};
}

/**
 * Create an enemy at a given angle (radians) as seen by angleFromPlayerTo.
 *
 * angleFromPlayerTo computes: Math.atan2(attacker.z - player.z, attacker.x - player.x)
 * So to place an enemy at a specific computed angle:
 *   enemy.x = player.x + cos(angle) * distance
 *   enemy.z = player.z + sin(angle) * distance
 *
 * angle = 0   → enemy at +X (directly "in front" when blockingYaw = 0)
 * angle = PI  → enemy at -X (directly behind)
 */
function createEnemyAtAngle(playerX, playerZ, angle, distance) {
	return {
		id: 'test-enemy',
		type: 'grunt',
		x: playerX + Math.cos(angle) * distance,
		z: playerZ + Math.sin(angle) * distance,
		y: 0.5,
		hp: 50,
		maxHp: 50,
		dead: false,
		attackState: 'idle',
	};
}

// ── Unit tests: angle-based damage reduction ──

describe('Guard Block — angle-based damage reduction (unit)', () => {
	beforeEach(() => {
		resetState();
		setupLayout();
	});

	it('guard_block sets blockingUntil and blockingYaw on the player', () => {
		const def = KEY_ITEM_DEFS.guard_block;
		expect(def).toBeDefined();
		expect(def.damageReduction).toBe(0.7);
		expect(def.durationMs).toBe(700);
		expect(def.cooldownMs).toBe(3500);

		const now = Date.now();
		const player = createBlockingPlayer();
		gameState.players['p1'] = player;

		expect(player.blockingUntil).toBeGreaterThan(now);
		expect(player.blockingUntil - now).toBeLessThanOrEqual(def.durationMs + 100);
		expect(player.blockingYaw).toBe(0);
	});

	it('frontal attack (0° offset): damage reduced by 70%', () => {
		const player = createBlockingPlayer({ hp: MAX_HP });
		gameState.players['p1'] = player;

		// Enemy at angle 0 (frontal — directly in player's blocking direction)
		const enemy = createEnemyAtAngle(player.x, player.z, 0, 3);
		gameState.enemies.push(enemy);

		const originalHp = player.hp;
		const damageAmount = 100;
		damagePlayer('p1', damageAmount, { attackerEnemyId: 'test-enemy' });

		const expectedRemaining = damageAmount * (1 - 0.7); // 30
		expect(player.hp).toBeCloseTo(originalHp - expectedRemaining, 0);
	});

	it('edge of arc (75° offset): damage still reduced', () => {
		const player = createBlockingPlayer({ hp: MAX_HP });
		gameState.players['p1'] = player;

		// Enemy at 75° — exactly at the edge of 150° arc (half = 75°)
		const angle75 = (75 * Math.PI) / 180;
		const enemy = createEnemyAtAngle(player.x, player.z, angle75, 3);
		gameState.enemies.push(enemy);

		const originalHp = player.hp;
		const damageAmount = 100;
		damagePlayer('p1', damageAmount, { attackerEnemyId: 'test-enemy' });

		const expectedRemaining = damageAmount * (1 - 0.7); // 30
		expect(player.hp).toBeCloseTo(originalHp - expectedRemaining, 0);
	});

	it('rear attack (180° offset): full damage', () => {
		const player = createBlockingPlayer({ hp: MAX_HP });
		gameState.players['p1'] = player;

		// Enemy at 180° — directly behind player
		const enemy = createEnemyAtAngle(player.x, player.z, Math.PI, 3);
		gameState.enemies.push(enemy);

		const originalHp = player.hp;
		const damageAmount = 100;
		damagePlayer('p1', damageAmount, { attackerEnemyId: 'test-enemy' });

		expect(player.hp).toBe(originalHp - damageAmount);
	});

	it('attack at 90° offset: full damage (outside 150° arc)', () => {
		const player = createBlockingPlayer({ hp: MAX_HP });
		gameState.players['p1'] = player;

		// Enemy at 90° — outside the 150° frontal arc (half = 75°)
		const angle90 = (Math.PI / 2);
		const enemy = createEnemyAtAngle(player.x, player.z, angle90, 3);
		gameState.enemies.push(enemy);

		const originalHp = player.hp;
		const damageAmount = 100;
		damagePlayer('p1', damageAmount, { attackerEnemyId: 'test-enemy' });

		expect(player.hp).toBe(originalHp - damageAmount);
	});

	it('after blockingUntil expires: full damage from any angle', () => {
		const def = KEY_ITEM_DEFS.guard_block;
		const now = Date.now();
		const player = {
			x: 0,
			y: 0.5,
			z: 0,
			rotation: 0,
			hp: MAX_HP,
			dead: false,
			blockingUntil: now + (def.durationMs || 700),
			blockingYaw: 0,
			invulnerableUntil: 0,
		};
		gameState.players['p1'] = player;

		// Enemy in front
		const enemy = createEnemyAtAngle(player.x, player.z, 0, 3);
		gameState.enemies.push(enemy);

		// First hit while blocking — should be reduced to 30% (30 damage from 100)
		const damageAmount = 100;
		damagePlayer('p1', damageAmount, { attackerEnemyId: 'test-enemy' });
		expect(player.hp).toBeCloseTo(MAX_HP - damageAmount * 0.3, 0); // 100 - 30 = 70

		// Expire the block by setting blockingUntil to the past
		player.blockingUntil = Date.now() - 100;

		// Reset HP to test second hit cleanly (avoid Math.max(0, ...) clamping)
		player.hp = MAX_HP;

		// Second hit after expiry — should be full damage (100)
		damagePlayer('p1', damageAmount, { attackerEnemyId: 'test-enemy' });
		expect(player.hp).toBeCloseTo(MAX_HP - damageAmount, 0); // 100 - 100 = 0
	});

	it('invulnerableUntil takes priority over blockingUntil (dodge wins)', () => {
		const player = createBlockingPlayer({
			hp: MAX_HP,
			invulnerableUntil: Date.now() + 500, // dodge i-frames active
		});
		gameState.players['p1'] = player;

		// Enemy in front
		const enemy = createEnemyAtAngle(player.x, player.z, 0, 3);
		gameState.enemies.push(enemy);

		const originalHp = player.hp;
		const damageAmount = 100;
		const result = damagePlayer('p1', damageAmount, { attackerEnemyId: 'test-enemy' });

		// damagePlayer returns null when invulnerable
		expect(result).toBeNull();
		expect(player.hp).toBe(originalHp);
	});

	it('invulnerableUntil + blockingUntil both set: damage is null regardless of angle', () => {
		const player = createBlockingPlayer({
			hp: MAX_HP,
			invulnerableUntil: Date.now() + 500,
		});
		gameState.players['p1'] = player;

		// Enemy from behind (would be full damage if not for dodge)
		const enemy = createEnemyAtAngle(player.x, player.z, Math.PI, 3);
		gameState.enemies.push(enemy);

		const originalHp = player.hp;
		const damageAmount = 100;
		const result = damagePlayer('p1', damageAmount, { attackerEnemyId: 'test-enemy' });

		expect(result).toBeNull();
		expect(player.hp).toBe(originalHp);
	});
});

// ── Socket integration tests ──

describe('useKeyItem — guard_block (socket integration)', () => {
	let baseUrl;
	let activeSocket;

	beforeEach(async () => {
		baseUrl = await startTestServer();
	}, 20000);

	afterEach(async () => {
		// Disconnect any active socket before closing server
		if (activeSocket) {
			try { activeSocket.disconnect(); } catch (_) {}
			activeSocket = null;
		}
		await closeServer();
	}, 20000);

	/**
	 * Connect a client and start a dungeon run so we're in 'playing' phase.
	 */
	async function connectAndStartRun() {
		const { socket } = await connectClient(baseUrl);
		activeSocket = socket;
		const startGamePromise = waitForEvent(socket, 'startGame', 15000);
		socket.emit('playerReady', true);
		await startGamePromise;
		return { socket };
	}

	it('useKeyItem for guard_block sets blockingUntil and blockingYaw', async () => {
		const { socket } = await connectAndStartRun();
		const player = playerForSocket(socket);

		// Ensure clean state
		player.keyItemCooldownUntil = 0;
		player.blockingUntil = 0;
		player.blockingYaw = undefined;

		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'guard_block' });
		const result = await resultPromise;

		expect(result.ok).toBe(true);
		expect(result.keyItemId).toBe('guard_block');
		expect(result.blockingUntil).toBeGreaterThan(Date.now());
		expect(result.cooldownUntil).toBeGreaterThan(Date.now());

		// Verify player state
		expect(player.blockingUntil).toBeGreaterThan(Date.now());
		expect(player.blockingYaw).toBeDefined();
		expect(player.keyItemCooldownUntil).toBeGreaterThan(Date.now());
	});

	it('cooldown enforced: second use within 3500ms returns on_cooldown', async () => {
		const { socket } = await connectAndStartRun();
		const player = playerForSocket(socket);

		// Ensure clean state
		player.keyItemCooldownUntil = 0;

		// First use — should succeed
		const result1Promise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'guard_block' });
		const result1 = await result1Promise;

		expect(result1.ok).toBe(true);
		expect(result1.keyItemId).toBe('guard_block');

		// Immediate second use — should be rejected with on_cooldown
		const result2Promise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'guard_block' });
		const result2 = await result2Promise;

		expect(result2.ok).toBe(false);
		expect(result2.reason).toBe('on_cooldown');
		expect(result2.remainingMs).toBeGreaterThan(0);

		// guard_block has 3500ms cooldown. A few ms elapse between the use and this
		// assertion, so bound remainingMs against the cooldown with a drift tolerance
		// instead of an exact match.
		const def = KEY_ITEM_DEFS.guard_block;
		expect(result2.remainingMs).toBeLessThanOrEqual(def.cooldownMs);
		expect(result2.remainingMs).toBeGreaterThanOrEqual(def.cooldownMs - 250);
	});

	it('blockingUntil expires and subsequent hits deal full damage', async () => {
		const { socket } = await connectAndStartRun();
		const player = playerForSocket(socket);

		// Use guard_block
		player.keyItemCooldownUntil = 0;
		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'guard_block' });
		const result = await resultPromise;

		expect(result.ok).toBe(true);
		expect(player.blockingUntil).toBeGreaterThan(Date.now());

		// Verify blockingUntil was set to a future timestamp
		// Elapsed real time shrinks blockingDuration slightly below durationMs, so
		// bound it with a drift tolerance rather than an exact match.
		const blockingDuration = player.blockingUntil - Date.now();
		const def = KEY_ITEM_DEFS.guard_block;
		expect(blockingDuration).toBeGreaterThan(0);
		expect(blockingDuration).toBeLessThanOrEqual(def.durationMs);
		expect(blockingDuration).toBeGreaterThanOrEqual(def.durationMs - 250);
	});
});
