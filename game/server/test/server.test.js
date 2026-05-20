import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import config from '../config.js';
import {
	mulberry32,
	generateLayout,
	damagePlayer,
	updateEnemies,
	updateMinions,
	spawnLoot,
	spawnEnemy,
	spawnEnemies,
	createGameState,
	resetGameState,
	gameState,
	cleanupStalePlayers,
	regenMagicStones,
	createRunState,
	startDungeonRun,
	recordEnemyDefeated,
	clampObjectiveProgress,
	buildRunSummary,
	checkRunTerminalState,
	resetTransientRunState,
	returnPlayersToLobby,
	createPlayerProgress,
	grantCard,
	grantRunRewards,
	buildPlayerRewardSummary,
	validateDeck,
	canAddCardToDeck,
	createDrawDeckFromSelectedDeck,
	stateSnapshot,
	CARD_DEFS,
	STARTING_DECK_IDS,
	io as serverIo,
	STALE_THRESHOLD,
	MAX_MAGIC_STONES,
	MAGIC_STONES_REGEN_PER_TICK,
	DETECTION_RADIUS,
	ATTACK_RANGE,
	TICK_RATE,
	GRID_COLS,
	GRID_ROWS,
	CELL_SPACING,
	DECK_MIN_SIZE,
	DECK_MAX_SIZE,
	ENEMY_ATTACK_RANGE,
	ENEMY_ATTACK_RECOVERY_MS,
	ENEMY_DEFS
} from '../index.js';

// ── Helpers ──

function resetState() {
	Object.assign(gameState, createGameState());
}

function addPlayer(id, overrides = {}) {
	gameState.players[id] = {
		x: 0,
		y: 0.5,
		z: 0,
		rotation: 0,
		hp: 100,
		dead: false,
		lastActivity: Date.now(),
		ready: false,
		magicStones: MAX_MAGIC_STONES,
		currency: 0,
		debugScenario: null,
		pendingSummons: new Set(),
		deck: [],
		...overrides
	};
}

function firstRoomSpawn() {
	const first = gameState.layout.rooms[0];
	return { x: first.x, z: first.z };
}

// ── mulberry32 PRNG ──

describe('mulberry32(seed)', () => {
	it('returns a function', () => {
		expect(typeof mulberry32(42)).toBe('function');
	});

	it('produces values in [0, 1)', () => {
		const rng = mulberry32(123);
		for (let i = 0; i < 100; i++) {
			const v = rng();
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(1);
		}
	});

	it('is deterministic for a fixed seed', () => {
		const a = mulberry32(99);
		const b = mulberry32(99);
		for (let i = 0; i < 50; i++) {
			expect(a()).toBe(b());
		}
	});

	it('produces different sequences for different seeds', () => {
		const a = mulberry32(1);
		const b = mulberry32(2);
		let differs = false;
		for (let i = 0; i < 100; i++) {
			if (a() !== b()) {
				differs = true;
				break;
			}
		}
		expect(differs).toBe(true);
	});
});

// ── generateLayout ──

describe('generateLayout(seed)', () => {
	it('returns an object with rooms and passages arrays', () => {
		const layout = generateLayout(42);
		expect(Array.isArray(layout.rooms)).toBe(true);
		expect(Array.isArray(layout.passages)).toBe(true);
	});

	it('is deterministic for a fixed seed', () => {
		const a = generateLayout(777);
		const b = generateLayout(777);
		expect(a.rooms.length).toBe(b.rooms.length);
		expect(a.passages.length).toBe(b.passages.length);
		expect(a.rooms[0].x).toBe(b.rooms[0].x);
		expect(a.rooms[0].z).toBe(b.rooms[0].z);
	});

	it('produces at least 4 rooms', () => {
		const layout = generateLayout(1);
		expect(layout.rooms.length).toBeGreaterThanOrEqual(4);
	});

	it('rooms respect grid bounds', () => {
		const layout = generateLayout(12345);
		// Max cell index is (N-1), center offset is (N-1)/2, so max coord = ((N-1) - (N-1)/2) * CELL_SPACING
		// For N=4: max coord = (3 - 1.5) * 20 = 30
		const maxCoord = ((Math.max(GRID_COLS, GRID_ROWS) - 1) - (Math.max(GRID_COLS, GRID_ROWS) - 1) / 2) * CELL_SPACING;
		for (const room of layout.rooms) {
			expect(Math.abs(room.x)).toBeLessThanOrEqual(maxCoord);
			expect(Math.abs(room.z)).toBeLessThanOrEqual(maxCoord);
		}
	});

	it('each room has width, depth, and walls', () => {
		const layout = generateLayout(99);
		for (const room of layout.rooms) {
			expect(room.width).toBeGreaterThan(0);
			expect(room.depth).toBeGreaterThan(0);
			expect(Array.isArray(room.walls)).toBe(true);
		}
	});

	it('different seeds produce different layouts', () => {
		const a = generateLayout(1);
		const b = generateLayout(2);
		// At least one room position should differ
		let differs = false;
		for (let i = 0; i < Math.min(a.rooms.length, b.rooms.length); i++) {
			if (a.rooms[i].x !== b.rooms[i].x || a.rooms[i].z !== b.rooms[i].z) {
				differs = true;
				break;
			}
		}
		expect(differs).toBe(true);
	});
});

// ── damagePlayer ──

describe('damagePlayer(playerId, amount)', () => {
	beforeEach(() => {
		resetState();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('reduces HP by the given amount', () => {
		addPlayer('p1');
		damagePlayer('p1', 30);
		expect(gameState.players['p1'].hp).toBe(70);
	});

	it('clamps HP at 0', () => {
		addPlayer('p1');
		damagePlayer('p1', 200);
		expect(gameState.players['p1'].hp).toBe(0);
	});

	it('does nothing for unknown player', () => {
		const beforeCount = Object.keys(gameState.players).length;
		damagePlayer('nonexistent', 10);
		const afterCount = Object.keys(gameState.players).length;
		expect(afterCount).toBe(beforeCount);
	});

	it('marks player as dead when HP reaches 0', () => {
		addPlayer('p1', { hp: 30 });
		damagePlayer('p1', 30);
		expect(gameState.players['p1'].dead).toBe(true);
	});

	it('schedules respawn after 3 seconds', () => {
		addPlayer('p1', { hp: 30 });
		damagePlayer('p1', 30);

		// Before timeout fires
		expect(gameState.players['p1'].dead).toBe(true);

		// Advance 3 seconds
		vi.advanceTimersByTime(3000);

		// After respawn
		expect(gameState.players['p1'].dead).toBe(false);
		expect(gameState.players['p1'].hp).toBe(100);
	});

	it('respawn resets position to the first room spawn', () => {
		addPlayer('p1', { hp: 30, x: 10, z: 20 });
		damagePlayer('p1', 30);
		vi.advanceTimersByTime(3000);
		const spawn = firstRoomSpawn();
		expect(gameState.players['p1'].x).toBe(spawn.x);
		expect(gameState.players['p1'].z).toBe(spawn.z);
	});

	it('partial damage does not mark dead', () => {
		addPlayer('p1', { hp: 100 });
		damagePlayer('p1', 50);
		expect(gameState.players['p1'].dead).toBe(false);
		expect(gameState.players['p1'].hp).toBe(50);
	});
});

// ── updateEnemies ──

describe('updateEnemies()', () => {
	beforeEach(() => resetState());

	it('does nothing when no enemies exist', () => {
		expect(() => updateEnemies()).not.toThrow();
	});

	it('enemies chase players within DETECTION_RADIUS', () => {
		addPlayer('p1', { x: 0, z: 0, dead: false });
		gameState.enemies.push({
			id: 'e1',
			x: DETECTION_RADIUS - 1,
			z: 0,
			hp: 50,
			state: 'idle',
			wanderTarget: { x: 10, z: 10 }
		});

		updateEnemies();

		expect(gameState.enemies[0].state).toBe('chasing');
		// Enemy should have moved toward player (x decreased)
		expect(gameState.enemies[0].x).toBeLessThan(DETECTION_RADIUS - 1);
	});

	it('enemies wander when no player is within DETECTION_RADIUS', () => {
		addPlayer('p1', { x: 100, z: 100, dead: false });
		gameState.enemies.push({
			id: 'e1',
			x: 0,
			z: 0,
			hp: 50,
			state: 'idle',
			wanderTarget: { x: 10, z: 0 }
		});

		updateEnemies();

		expect(gameState.enemies[0].state).toBe('idle');
	});

	it('dead players are ignored for detection', () => {
		addPlayer('p1', { x: 0, z: 0, dead: true });
		gameState.enemies.push({
			id: 'e1',
			x: 1,
			z: 0,
			hp: 50,
			state: 'idle',
			wanderTarget: { x: 10, z: 0 }
		});

		updateEnemies();

		expect(gameState.enemies[0].state).toBe('idle');
	});

	it('enemy picks new wander target when reaching current one', () => {
		gameState.enemies.push({
			id: 'e1',
			x: 5,
			z: 5,
			hp: 50,
			state: 'idle',
			wanderTarget: { x: 5, z: 5 }
		});

		const oldTarget = { ...gameState.enemies[0].wanderTarget };
		updateEnemies();

		// Should have picked a new target since distance < 0.5
		expect(gameState.enemies[0].wanderTarget).not.toEqual(oldTarget);
	});

	it('skips all AI when run status is victory', () => {
		addPlayer('p1', { x: 0, z: 0, dead: false });
		gameState.enemies.push({
			id: 'e1',
			x: DETECTION_RADIUS - 1,
			z: 0,
			hp: 50,
			state: 'idle',
			wanderTarget: { x: 10, z: 10 }
		});
		gameState.run = { status: 'victory' };

		updateEnemies();

		// Enemy should not have moved or changed state
		expect(gameState.enemies[0].state).toBe('idle');
		expect(gameState.enemies[0].x).toBe(DETECTION_RADIUS - 1);
	});

	it('skips all AI when run status is failed', () => {
		addPlayer('p1', { x: 0, z: 0, dead: false });
		gameState.enemies.push({
			id: 'e1',
			x: DETECTION_RADIUS - 1,
			z: 0,
			hp: 50,
			state: 'idle',
			wanderTarget: { x: 10, z: 10 }
		});
		gameState.run = { status: 'failed' };

		updateEnemies();

		expect(gameState.enemies[0].state).toBe('idle');
		expect(gameState.enemies[0].x).toBe(DETECTION_RADIUS - 1);
	});

	it('resumes AI after run is cleared (returnToLobby + new run)', () => {
		addPlayer('p1', { x: 0, z: 0, dead: false });
		gameState.enemies.push({
			id: 'e1',
			x: DETECTION_RADIUS - 1,
			z: 0,
			hp: 50,
			state: 'idle',
			wanderTarget: { x: 10, z: 10 }
		});

		// Set run to victory — AI should be skipped
		gameState.run = { status: 'victory' };
		updateEnemies();
		expect(gameState.enemies[0].state).toBe('idle');

		// Clear run (simulating returnToLobby) and start a new one
		delete gameState.run;
		startDungeonRun();
		expect(gameState.run.status).toBe('playing');

		// AI should resume — enemy should chase player
		updateEnemies();
		expect(gameState.enemies[0].state).toBe('chasing');
	});
});

// ── Enemy attack state machine ──

describe('Enemy attack state machine', () => {
	beforeEach(() => {
		resetState();
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2000, 0, 1));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('transitions to windup when in range', () => {
		addPlayer('p1', { id: 'p1', x: 0, z: 0, dead: false });
		gameState.enemies.push({
			id: 'e1',
			x: ENEMY_ATTACK_RANGE - 1, // within ENEMY_ATTACK_RANGE of player
			z: 0,
			hp: 50,
			state: 'chasing',
			attackState: 'chasing',
			wanderTarget: { x: 0, z: 0 }
		});

		updateEnemies();

		expect(gameState.enemies[0].attackState).toBe('windup');
		expect(gameState.enemies[0].windupTargetId).toBe('p1');
		expect(gameState.enemies[0].windupStartTime).toBeDefined();
	});

	it('applies damage after windup expires', () => {
		addPlayer('p1', { id: 'p1', x: 0, z: 0, dead: false, hp: 100 });
		const now = Date.now();

		gameState.enemies.push({
			id: 'e1',
			x: 0, // at player position — within range
			z: 0,
			hp: 50,
			state: 'chasing',
			attackState: 'windup',
			windupTargetId: 'p1',
			windupStartTime: now - ENEMY_DEFS.grunt.attackWindupMs - 100, // windup already expired
			wanderTarget: { x: 0, z: 0 }
		});

		updateEnemies();

		expect(gameState.players['p1'].hp).toBe(100 - ENEMY_DEFS.grunt.attackDamage);
		expect(gameState.enemies[0].attackState).toBe('recovering');
		expect(gameState.enemies[0].recoverUntil).toBeDefined();
	});

	it('cancels attack when target leaves range', () => {
		addPlayer('p1', { x: 0, z: 0, dead: false, hp: 100 });
		const now = Date.now();

		gameState.enemies.push({
			id: 'e1',
			x: 0, // enemy stays here
			z: 0,
			hp: 50,
			state: 'chasing',
			attackState: 'windup',
			windupTargetId: 'p1',
			windupStartTime: now - ENEMY_DEFS.grunt.attackWindupMs - 100, // windup expired
			wanderTarget: { x: 0, z: 0 }
		});

		// Move player out of range before updateEnemies
		gameState.players['p1'].x = ENEMY_ATTACK_RANGE + 10;
		gameState.players['p1'].z = ENEMY_ATTACK_RANGE + 10;

		updateEnemies();

		expect(gameState.players['p1'].hp).toBe(100); // no damage
		// After cancel the code sets attackState → 'chasing' and continues (does not fall through to idle)
		expect(gameState.enemies[0].attackState).toBe('chasing');
	});

	it('recovers and returns to chasing', () => {
		addPlayer('p1', { x: 0, z: 0, dead: false, hp: 100 });
		const now = Date.now();

		// Place enemy within DETECTION_RADIUS so after recovery it finds the player and enters chasing
		gameState.enemies.push({
			id: 'e1',
			x: DETECTION_RADIUS - 2,
			z: 0,
			hp: 50,
			state: 'chasing',
			attackState: 'recovering',
			recoverUntil: now - 100, // recovery already expired
			wanderTarget: { x: 0, z: 0 }
		});

		updateEnemies();

		expect(gameState.enemies[0].attackState).toBe('chasing');
	});

	it('does not move or attack while recovering (recovery not expired)', () => {
		addPlayer('p1', { x: 0, z: 0, dead: false, hp: 100 });
		const now = Date.now();

		gameState.enemies.push({
			id: 'e1',
			x: ENEMY_ATTACK_RANGE + 5,
			z: 0,
			hp: 50,
			state: 'chasing',
			attackState: 'recovering',
			recoverUntil: now + ENEMY_ATTACK_RECOVERY_MS + 1000, // still recovering
			wanderTarget: { x: 0, z: 0 }
		});

		const posBefore = { x: gameState.enemies[0].x, z: gameState.enemies[0].z };

		updateEnemies();

		// Enemy should not have moved
		expect(gameState.enemies[0].x).toBe(posBefore.x);
		expect(gameState.enemies[0].z).toBe(posBefore.z);
		// Should still be recovering
		expect(gameState.enemies[0].attackState).toBe('recovering');
		// Player should not have taken damage
		expect(gameState.players['p1'].hp).toBe(100);
	});

	it('constants exported with expected values', () => {
		expect(ENEMY_DEFS.grunt.attackWindupMs).toBeGreaterThanOrEqual(800);
		expect(ENEMY_ATTACK_RECOVERY_MS).toBeGreaterThanOrEqual(1000);
		expect(ENEMY_DEFS.grunt.attackWindupMs).toBe(800);
		expect(ENEMY_ATTACK_RECOVERY_MS).toBe(1200);
	});
});

// ── updateMinions ──

describe('updateMinions()', () => {
	beforeEach(() => resetState());

	it('does nothing when no minions exist', () => {
		expect(() => updateMinions()).not.toThrow();
	});

	it('minions attack enemies within ATTACK_RANGE', () => {
		gameState.minions.push({
			id: 'm1',
			ownerId: 'p1',
			x: 0,
			z: 0,
			hp: 50,
			ttl: 30
		});
		gameState.enemies.push({
			id: 'e1',
			x: ATTACK_RANGE - 1,
			z: 0,
			hp: 50,
			state: 'idle',
			wanderTarget: { x: 0, z: 0 }
		});

		updateMinions();

		expect(gameState.enemies[0].hp).toBe(45);
	});

	it('minions chase enemies within DETECTION_RADIUS but outside ATTACK_RANGE', () => {
		gameState.minions.push({
			id: 'm1',
			ownerId: 'p1',
			x: 0,
			z: 0,
			hp: 50,
			ttl: 30
		});
		gameState.enemies.push({
			id: 'e1',
			x: ATTACK_RANGE + 1,
			z: 0,
			hp: 50,
			state: 'idle',
			wanderTarget: { x: 0, z: 0 }
		});

		const startX = gameState.minions[0].x;
		updateMinions();

		// Minion should have moved toward enemy
		expect(gameState.minions[0].x).toBeGreaterThan(startX);
	});

	it('removes minions with expired TTL', () => {
		gameState.minions.push({
			id: 'm1',
			ownerId: 'p1',
			x: 0,
			z: 0,
			hp: 50,
			ttl: 0.01 // less than one tick (dt = 1/20 = 0.05)
		});

		updateMinions();

		expect(gameState.minions.length).toBe(0);
	});

	it('removes minions with hp <= 0', () => {
		gameState.minions.push({
			id: 'm1',
			ownerId: 'p1',
			x: 0,
			z: 0,
			hp: 0,
			ttl: 30
		});

		updateMinions();

		expect(gameState.minions.length).toBe(0);
	});

	it('decrements minion TTL each tick', () => {
		gameState.minions.push({
			id: 'm1',
			ownerId: 'p1',
			x: 0,
			z: 0,
			hp: 50,
			ttl: 10
		});

		updateMinions();

		expect(gameState.minions[0].ttl).toBeCloseTo(10 - 1 / TICK_RATE, 4);
	});

	it('spawns loot for dead enemies and removes them', () => {
		// Mock Math.random below config.LOOT_SPAWN_CHANCE to force loot spawn
		vi.spyOn(Math, 'random').mockReturnValue(config.LOOT_SPAWN_CHANCE - 0.1);

		gameState.minions.push({
			id: 'm1',
			ownerId: 'p1',
			x: 0,
			z: 0,
			hp: 50,
			ttl: 30
		});
		gameState.enemies.push({
			id: 'e1',
			x: 0,
			z: 0,
			hp: 3, // minion deals 5 damage, so enemy dies
			state: 'idle',
			wanderTarget: { x: 0, z: 0 }
		});

		updateMinions();

		expect(gameState.enemies.length).toBe(0);
		expect(gameState.loot.length).toBe(1);
		expect(gameState.loot[0]).toHaveProperty('id');
		expect(gameState.loot[0]).toHaveProperty('value');
		expect(gameState.loot[0]).toHaveProperty('x');
		expect(gameState.loot[0]).toHaveProperty('z');
		expect(gameState.loot[0]).toHaveProperty('createdAt');

		vi.restoreAllMocks();
	});

	it('skips minion AI when run status is victory', () => {
		gameState.minions.push({
			id: 'm1',
			ownerId: 'p1',
			x: 0,
			z: 0,
			hp: 50,
			ttl: 30
		});
		gameState.enemies.push({
			id: 'e1',
			x: ATTACK_RANGE - 1,
			z: 0,
			hp: 50,
			state: 'idle',
			wanderTarget: { x: 0, z: 0 }
		});
		gameState.run = { status: 'victory' };

		updateMinions();

		// Enemy should NOT have taken damage
		expect(gameState.enemies[0].hp).toBe(50);
		// Minion should NOT have moved
		expect(gameState.minions[0].x).toBe(0);
	});

	it('skips minion AI when run status is failed', () => {
		gameState.minions.push({
			id: 'm1',
			ownerId: 'p1',
			x: 0,
			z: 0,
			hp: 50,
			ttl: 30
		});
		gameState.enemies.push({
			id: 'e1',
			x: ATTACK_RANGE - 1,
			z: 0,
			hp: 50,
			state: 'idle',
			wanderTarget: { x: 0, z: 0 }
		});
		gameState.run = { status: 'failed' };

		updateMinions();

		expect(gameState.enemies[0].hp).toBe(50);
		expect(gameState.minions[0].x).toBe(0);
	});

	it('still decrements minion TTL when run is terminal', () => {
		gameState.minions.push({
			id: 'm1',
			ownerId: 'p1',
			x: 0,
			z: 0,
			hp: 50,
			ttl: 10
		});
		gameState.run = { status: 'victory' };

		updateMinions();

		// TTL should still be decremented even though AI is skipped
		expect(gameState.minions[0].ttl).toBeCloseTo(10 - 1 / TICK_RATE, 4);
	});

	it('resumes minion AI after run is cleared and a new run starts', () => {
		gameState.minions.push({
			id: 'm1',
			ownerId: 'p1',
			x: 0,
			z: 0,
			hp: 50,
			ttl: 30
		});
		gameState.enemies.push({
			id: 'e1',
			x: ATTACK_RANGE - 1,
			z: 0,
			hp: 50,
			state: 'idle',
			wanderTarget: { x: 0, z: 0 }
		});

		// Set run to victory — AI should be skipped
		gameState.run = { status: 'victory' };
		updateMinions();
		expect(gameState.enemies[0].hp).toBe(50);

		// Clear run and start a new one
		delete gameState.run;
		startDungeonRun();

		// AI should resume — minion should attack enemy
		updateMinions();
		expect(gameState.enemies[0].hp).toBe(45);
	});
});

// ── spawnLoot ──

describe('spawnLoot(x, z)', () => {
	beforeEach(() => resetState());

	it('creates loot with correct structure when it spawns', () => {
		vi.spyOn(Math, 'random').mockReturnValue(config.LOOT_SPAWN_CHANCE - 0.1); // below LOOT_SPAWN_CHANCE so it spawns

		spawnLoot(10, 20);

		expect(gameState.loot.length).toBe(1);
		const loot = gameState.loot[0];
		expect(loot).toHaveProperty('id');
		expect(loot).toHaveProperty('x', 10);
		expect(loot).toHaveProperty('z', 20);
		expect(loot).toHaveProperty('value');
		expect(loot).toHaveProperty('createdAt');
		expect(typeof loot.id).toBe('string');
		expect(typeof loot.value).toBe('number');
		expect(typeof loot.createdAt).toBe('number');

		vi.restoreAllMocks();
	});

	it('loot value is in range [5, 20)', () => {
		vi.spyOn(Math, 'random').mockReturnValueOnce(config.LOOT_SPAWN_CHANCE - 0.1).mockReturnValueOnce(0.5); // below LOOT_SPAWN_CHANCE to spawn; 0.5 for value

		spawnLoot(0, 0);
		expect(gameState.loot[0].value).toBeGreaterThanOrEqual(5);
		expect(gameState.loot[0].value).toBeLessThan(20);

		vi.restoreAllMocks();
	});

	it('does not spawn loot when random >= LOOT_SPAWN_CHANCE', () => {
		vi.spyOn(Math, 'random').mockReturnValue(config.LOOT_SPAWN_CHANCE + 0.1); // above LOOT_SPAWN_CHANCE

		spawnLoot(0, 0);

		expect(gameState.loot.length).toBe(0);

		vi.restoreAllMocks();
	});

	it('loot createdAt is a timestamp', () => {
		vi.spyOn(Math, 'random').mockReturnValue(config.LOOT_SPAWN_CHANCE - 0.1);

		const before = Date.now();
		spawnLoot(0, 0);
		const after = Date.now();

		expect(gameState.loot[0].createdAt).toBeGreaterThanOrEqual(before);
		expect(gameState.loot[0].createdAt).toBeLessThanOrEqual(after);

		vi.restoreAllMocks();
	});
});

// ── Magic Stone regeneration ──

describe('regenMagicStones (game tick)', () => {
	beforeEach(() => resetState());

	it('regenerates MAGIC_STONES_REGEN_PER_TICK per call', () => {
		addPlayer('p1', { magicStones: 50 });
		const before = gameState.players['p1'].magicStones;

		regenMagicStones();

		expect(gameState.players['p1'].magicStones).toBeCloseTo(
			before + MAGIC_STONES_REGEN_PER_TICK,
			5
		);
	});

	it('caps at MAX_MAGIC_STONES', () => {
		addPlayer('p1', { magicStones: MAX_MAGIC_STONES });

		regenMagicStones();

		expect(gameState.players['p1'].magicStones).toBe(MAX_MAGIC_STONES);
	});

	it('does not exceed cap when close to it', () => {
		addPlayer('p1', { magicStones: MAX_MAGIC_STONES - 0.1 });

		regenMagicStones();

		expect(gameState.players['p1'].magicStones).toBe(MAX_MAGIC_STONES);
	});

	it('keeps magicStones at 0 for summon-low-mana debug scenario', () => {
		addPlayer('p1', { magicStones: 50, debugScenario: 'summon-low-mana' });

		regenMagicStones();

		expect(gameState.players['p1'].magicStones).toBe(0);
	});

	it('clears pendingSummons for each player', () => {
		addPlayer('p1');
		gameState.players['p1'].pendingSummons.add('0:iron_sword');

		regenMagicStones();

		expect(gameState.players['p1'].pendingSummons.size).toBe(0);
	});

	it('regen rate constant is correct', () => {
		expect(MAGIC_STONES_REGEN_PER_TICK).toBe(0.5);
	});

	it('max magic stones constant is correct', () => {
		expect(MAX_MAGIC_STONES).toBe(100);
	});
});

// ── Stale player cleanup ──

describe('cleanupStalePlayers', () => {
	beforeEach(() => resetState());

	it('removes players inactive for STALE_THRESHOLD ms', () => {
		addPlayer('p1', { lastActivity: Date.now() - STALE_THRESHOLD - 1000 });

		cleanupStalePlayers();

		expect(gameState.players['p1']).toBeUndefined();
	});

	it('keeps active players', () => {
		addPlayer('p1', { lastActivity: Date.now() });

		cleanupStalePlayers();

		expect(gameState.players['p1']).toBeDefined();
	});

	it('keeps players at exactly STALE_THRESHOLD (not exceeding)', () => {
		addPlayer('p1', { lastActivity: Date.now() - STALE_THRESHOLD + 1 });

		cleanupStalePlayers();

		expect(gameState.players['p1']).toBeDefined();
	});

	it('stale threshold constant is 10 seconds', () => {
		expect(STALE_THRESHOLD).toBe(10000);
	});

	it('removes multiple stale players', () => {
		addPlayer('p1', { lastActivity: Date.now() - 20000 });
		addPlayer('p2', { lastActivity: Date.now() - 15000 });
		addPlayer('p3', { lastActivity: Date.now() });

		cleanupStalePlayers();

		expect(gameState.players['p1']).toBeUndefined();
		expect(gameState.players['p2']).toBeUndefined();
		expect(gameState.players['p3']).toBeDefined();
	});
});

// ── Constants ──

describe('constants', () => {
	it('DETECTION_RADIUS is 8', () => {
		expect(DETECTION_RADIUS).toBe(8);
	});

	it('ATTACK_RANGE is 5', () => {
		expect(ATTACK_RANGE).toBe(5);
	});

	it('TICK_RATE is 20', () => {
		expect(TICK_RATE).toBe(20);
	});

	it('GRID_COLS is 4', () => {
		expect(GRID_COLS).toBe(4);
	});

	it('GRID_ROWS is 4', () => {
		expect(GRID_ROWS).toBe(4);
	});

	it('CELL_SPACING is 20', () => {
		expect(CELL_SPACING).toBe(20);
	});
});

// ── createGameState ──

describe('createGameState()', () => {
	it('returns a fresh state object with expected keys', () => {
		const state = createGameState();
		expect(state).toHaveProperty('players');
		expect(state).toHaveProperty('enemies');
		expect(state).toHaveProperty('minions');
		expect(state).toHaveProperty('loot');
		expect(state).toHaveProperty('lobby');
		expect(state).toHaveProperty('gamePhase', 'lobby');
	});

	it('returns empty collections', () => {
		const state = createGameState();
		expect(Object.keys(state.players).length).toBe(0);
		expect(state.enemies.length).toBe(0);
		expect(state.minions.length).toBe(0);
		expect(state.loot.length).toBe(0);
	});

	it('returns independent objects (no shared state)', () => {
		const a = createGameState();
		const b = createGameState();
		a.players['test'] = {};
		expect(b.players['test']).toBeUndefined();
	});
});

// ── Run State ──

describe('run state', () => {
	beforeEach(() => {
		resetState();
		// Ensure run is cleared before each test
		delete gameState.run;
	});

	describe('createRunState()', () => {
		it('produces an object with all required fields', () => {
			// Set a known number of enemies
			gameState.enemies = [
				{ id: 'e1', x: 0, z: 0, hp: 50, state: 'idle', wanderTarget: { x: 0, z: 0 } },
				{ id: 'e2', x: 5, z: 5, hp: 50, state: 'idle', wanderTarget: { x: 5, z: 5 } },
				{ id: 'e3', x: 10, z: 10, hp: 50, state: 'idle', wanderTarget: { x: 10, z: 10 } },
			];

			const run = createRunState();

			expect(run).toHaveProperty('id');
			expect(typeof run.id).toBe('string');
			expect(run).toHaveProperty('status', 'playing');
			expect(run).toHaveProperty('objective');
			expect(run.objective).toHaveProperty('type', 'defeat_enemies');
			expect(run.objective).toHaveProperty('label', 'Defeat all enemies');
			expect(run.objective).toHaveProperty('totalEnemies', 3);
			expect(run.objective).toHaveProperty('defeatedEnemies', 0);
			expect(run).toHaveProperty('startedAt');
			expect(typeof run.startedAt).toBe('number');
		});
	});

	describe('recordEnemyDefeated(n)', () => {
		it('increments defeatedEnemies by n', () => {
			gameState.run = {
				id: 'run1',
				status: 'playing',
				objective: {
					type: 'defeat_enemies',
					label: 'Defeat all enemies',
					totalEnemies: 10,
					defeatedEnemies: 0
				},
				startedAt: Date.now()
			};

			recordEnemyDefeated(3);

			expect(gameState.run.objective.defeatedEnemies).toBe(3);
		});

		it('clamps defeatedEnemies at totalEnemies', () => {
			gameState.run = {
				id: 'run1',
				status: 'playing',
				objective: {
					type: 'defeat_enemies',
					label: 'Defeat all enemies',
					totalEnemies: 5,
					defeatedEnemies: 0
				},
				startedAt: Date.now()
			};

			recordEnemyDefeated(10);

			expect(gameState.run.objective.defeatedEnemies).toBe(5);
		});

		it('is a no-op when gameState.run is undefined', () => {
			expect(() => recordEnemyDefeated(1)).not.toThrow();
			expect(gameState.run).toBeUndefined();
		});
	});

	describe('clampObjectiveProgress(run)', () => {
		it('caps defeatedEnemies at totalEnemies', () => {
			const run = {
				objective: {
					totalEnemies: 5,
					defeatedEnemies: 12
				}
			};

			clampObjectiveProgress(run);

			expect(run.objective.defeatedEnemies).toBe(5);
		});

		it('leaves defeatedEnemies unchanged when below total', () => {
			const run = {
				objective: {
					totalEnemies: 10,
					defeatedEnemies: 3
				}
			};

			clampObjectiveProgress(run);

			expect(run.objective.defeatedEnemies).toBe(3);
		});

		it('leaves defeatedEnemies unchanged when equal to total', () => {
			const run = {
				objective: {
					totalEnemies: 5,
					defeatedEnemies: 5
				}
			};

			clampObjectiveProgress(run);

			expect(run.objective.defeatedEnemies).toBe(5);
		});
	});

	describe('buildRunSummary(status)', () => {
		beforeEach(() => {
			resetState();
			delete gameState.run;
		});

		it('returns null when gameState.run is undefined', () => {
			expect(buildRunSummary('victory')).toBeNull();
		});

		it('returns an object with all required fields', () => {
			gameState.enemies = [
				{ id: 'e1', x: 0, z: 0, hp: 50, state: 'idle', wanderTarget: { x: 0, z: 0 } },
			];
			startDungeonRun();
			addPlayer('p1', { hp: 80, currency: 15 });
			recordEnemyDefeated(1);

			const summary = buildRunSummary('victory');

			expect(summary).toHaveProperty('runId');
			expect(summary).toHaveProperty('status', 'victory');
			expect(summary).toHaveProperty('durationMs');
			expect(typeof summary.durationMs).toBe('number');
			expect(summary).toHaveProperty('objective');
			expect(summary.objective.type).toBe('defeat_enemies');
			expect(summary).toHaveProperty('players');
			expect(summary.players.length).toBe(1);
			expect(summary.players[0]).toHaveProperty('id', 'p1');
			expect(summary.players[0]).toHaveProperty('hp', 80);
			expect(summary.players[0]).toHaveProperty('dead', false);
			expect(summary.players[0]).toHaveProperty('currency', 15);
			expect(summary).toHaveProperty('defeatedEnemies', 1);
			expect(summary).toHaveProperty('currencyCollected', 15);
		});

		it('sums currencyCollected from multiple players', () => {
			startDungeonRun();
			addPlayer('p1', { currency: 10 });
			addPlayer('p2', { currency: 25 });

			const summary = buildRunSummary('failed');

			expect(summary.currencyCollected).toBe(35);
		});

		it('handles zero currency', () => {
			startDungeonRun();
			addPlayer('p1', { currency: 0 });

			const summary = buildRunSummary('victory');

			expect(summary.currencyCollected).toBe(0);
		});
	});

	describe('checkRunTerminalState()', () => {
		beforeEach(() => {
			resetState();
			delete gameState.run;
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it('is a no-op when gameState.run is undefined', () => {
			expect(() => checkRunTerminalState()).not.toThrow();
		});

		it('is a no-op when run.status is not playing', () => {
			startDungeonRun();
			gameState.run.status = 'victory';

			checkRunTerminalState();

			expect(gameState.run.status).toBe('victory');
		});

		it('sets status to victory when all enemies are defeated', () => {
			gameState.enemies = [
				{ id: 'e1', x: 0, z: 0, hp: 50, state: 'idle', wanderTarget: { x: 0, z: 0 } },
			];
			startDungeonRun();
			addPlayer('p1');

			recordEnemyDefeated(1);

			checkRunTerminalState();

			expect(gameState.run.status).toBe('victory');
		});

		it('sets status to failed when all players are dead', () => {
			gameState.enemies = [
				{ id: 'e1', x: 0, z: 0, hp: 50, state: 'idle', wanderTarget: { x: 0, z: 0 } },
			];
			startDungeonRun();
			addPlayer('p1', { hp: 0, dead: true });

			checkRunTerminalState();

			expect(gameState.run.status).toBe('failed');
		});

		it('does not set failed when at least one player is alive', () => {
			gameState.enemies = [
				{ id: 'e1', x: 0, z: 0, hp: 50, state: 'idle', wanderTarget: { x: 0, z: 0 } },
			];
			startDungeonRun();
			addPlayer('p1', { hp: 0, dead: true });
			addPlayer('p2', { hp: 50, dead: false });

			checkRunTerminalState();

			expect(gameState.run.status).toBe('playing');
		});

		it('does not set failed when there are no players', () => {
			gameState.enemies = [
				{ id: 'e1', x: 0, z: 0, hp: 50, state: 'idle', wanderTarget: { x: 0, z: 0 } },
			];
			startDungeonRun();

			checkRunTerminalState();

			expect(gameState.run.status).toBe('playing');
		});

		it('is idempotent — calling twice does not double-emit', () => {
			gameState.enemies = [
				{ id: 'e1', x: 0, z: 0, hp: 50, state: 'idle', wanderTarget: { x: 0, z: 0 } },
			];
			startDungeonRun();
			addPlayer('p1');
			recordEnemyDefeated(1);

			// Track io.emit calls
			const emitCalls = [];
			const originalEmit = serverIo.emit;
			serverIo.emit = (event, data) => emitCalls.push({ event, data });

			checkRunTerminalState();
			checkRunTerminalState(); // second call — should be a no-op

			serverIo.emit = originalEmit;

			expect(gameState.run.status).toBe('victory');
			// Only one emit should have happened
			const victoryEmits = emitCalls.filter(c => c.event === 'runComplete');
			expect(victoryEmits.length).toBe(1);
		});

		it('emits runComplete with correct payload structure on victory', () => {
			gameState.enemies = [
				{ id: 'e1', x: 0, z: 0, hp: 50, state: 'idle', wanderTarget: { x: 0, z: 0 } },
			];
			startDungeonRun();
			addPlayer('p1', { hp: 80, currency: 10 });
			recordEnemyDefeated(1);

			const emitCalls = [];
			const originalEmit = serverIo.emit;
			serverIo.emit = (event, data) => emitCalls.push({ event, data });

			checkRunTerminalState();

			serverIo.emit = originalEmit;

			const emit = emitCalls.find(c => c.event === 'runComplete');
			expect(emit).toBeDefined();
			expect(emit.data).toHaveProperty('runId');
			expect(emit.data.status).toBe('victory');
			expect(emit.data).toHaveProperty('durationMs');
			expect(emit.data).toHaveProperty('objective');
			expect(emit.data).toHaveProperty('players');
			expect(emit.data).toHaveProperty('defeatedEnemies');
			expect(emit.data).toHaveProperty('currencyCollected');
		});

		it('emits runFailed with correct payload structure on failure', () => {
			gameState.enemies = [
				{ id: 'e1', x: 0, z: 0, hp: 50, state: 'idle', wanderTarget: { x: 0, z: 0 } },
			];
			startDungeonRun();
			addPlayer('p1', { hp: 0, dead: true, currency: 5 });

			const emitCalls = [];
			const originalEmit = serverIo.emit;
			serverIo.emit = (event, data) => emitCalls.push({ event, data });

			checkRunTerminalState();

			serverIo.emit = originalEmit;

			const emit = emitCalls.find(c => c.event === 'runFailed');
			expect(emit).toBeDefined();
			expect(emit.data.status).toBe('failed');
			expect(emit.data.currencyCollected).toBe(5);
		});
	});

	describe('resetTransientRunState()', () => {
		beforeEach(() => {
			resetState();
		});

		it('clears enemies, minions, and loot arrays', () => {
			gameState.enemies.push({ id: 'e1', x: 0, z: 0, hp: 50, state: 'idle', wanderTarget: { x: 0, z: 0 } });
			gameState.minions.push({ id: 'm1', ownerId: 'p1', x: 0, z: 0, hp: 50, ttl: 30 });
			gameState.loot.push({ id: 'l1', x: 0, z: 0, value: 10, createdAt: Date.now() });

			resetTransientRunState();

			expect(gameState.enemies.length).toBe(0);
			expect(gameState.minions.length).toBe(0);
			expect(gameState.loot.length).toBe(0);
		});

		it('preserves players and gamePhase', () => {
			addPlayer('p1', { currency: 42 });
			gameState.gamePhase = 'playing';

			resetTransientRunState();

			expect(gameState.players['p1']).toBeDefined();
			expect(gameState.players['p1'].currency).toBe(42);
			expect(gameState.gamePhase).toBe('playing');
		});

		it('preserves the run object', () => {
			startDungeonRun();
			const runId = gameState.run.id;

			resetTransientRunState();

			expect(gameState.run).toBeDefined();
			expect(gameState.run.id).toBe(runId);
		});
	});

	describe('returnPlayersToLobby()', () => {
		beforeEach(() => {
			resetState();
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it('resets gamePhase to lobby', () => {
			gameState.gamePhase = 'playing';
			startDungeonRun();

			const emitCalls = [];
			const originalEmit = serverIo.emit;
			serverIo.emit = (event, data) => emitCalls.push({ event, data });

			returnPlayersToLobby();

			serverIo.emit = originalEmit;

			expect(gameState.gamePhase).toBe('lobby');
		});

		it('clears gameState.run', () => {
			startDungeonRun();

			const emitCalls = [];
			const originalEmit = serverIo.emit;
			serverIo.emit = (event, data) => emitCalls.push({ event, data });

			returnPlayersToLobby();

			serverIo.emit = originalEmit;

			expect(gameState.run).toBeUndefined();
		});

		it('clears enemies, minions, and loot', () => {
			gameState.enemies.push({ id: 'e1', x: 0, z: 0, hp: 50, state: 'idle', wanderTarget: { x: 0, z: 0 } });
			gameState.minions.push({ id: 'm1', ownerId: 'p1', x: 0, z: 0, hp: 50, ttl: 30 });
			gameState.loot.push({ id: 'l1', x: 0, z: 0, value: 10, createdAt: Date.now() });

			const emitCalls = [];
			const originalEmit = serverIo.emit;
			serverIo.emit = (event, data) => emitCalls.push({ event, data });

			returnPlayersToLobby();

			serverIo.emit = originalEmit;

			expect(gameState.enemies.length).toBe(0);
			expect(gameState.minions.length).toBe(0);
			expect(gameState.loot.length).toBe(0);
		});

		it('sets all players to ready: false and resets HP/position', () => {
			addPlayer('p1', { x: 50, z: 50, hp: 30, ready: true, currency: 20 });

			const emitCalls = [];
			const originalEmit = serverIo.emit;
			serverIo.emit = (event, data) => emitCalls.push({ event, data });

			returnPlayersToLobby();

			serverIo.emit = originalEmit;

			expect(gameState.players['p1'].ready).toBe(false);
			expect(gameState.players['p1'].hp).toBe(100);
			expect(gameState.players['p1'].dead).toBe(false);
			// Currency should be preserved
			expect(gameState.players['p1'].currency).toBe(20);
		});

		it('emits stateUpdate to all clients', () => {
			addPlayer('p1');
			startDungeonRun();

			const emitCalls = [];
			const originalEmit = serverIo.emit;
			serverIo.emit = (event, data) => emitCalls.push({ event, data });

			returnPlayersToLobby();

			serverIo.emit = originalEmit;

			const stateUpdateCalls = emitCalls.filter(c => c.event === 'stateUpdate');
			expect(stateUpdateCalls.length).toBeGreaterThan(0);
		});

		it('emits lobbyUpdate after stateUpdate', () => {
			addPlayer('p1');

			const emitCalls = [];
			const originalEmit = serverIo.emit;
			serverIo.emit = (event, data) => emitCalls.push({ event, data });

			returnPlayersToLobby();

			serverIo.emit = originalEmit;

			const lobbyUpdateCalls = emitCalls.filter(c => c.event === 'lobbyUpdate');
			expect(lobbyUpdateCalls.length).toBeGreaterThan(0);
		});

		it('clears pendingSummons for all players', () => {
			addPlayer('p1');
			gameState.players['p1'].pendingSummons.add('0:iron_sword');
			gameState.players['p1'].pendingSummons.add('1:fireball');

			const emitCalls = [];
			const originalEmit = serverIo.emit;
			serverIo.emit = (event, data) => emitCalls.push({ event, data });

			returnPlayersToLobby();

			serverIo.emit = originalEmit;

			expect(gameState.players['p1'].pendingSummons.size).toBe(0);
		});
	});

	describe('createPlayerProgress()', () => {
		it('returns currency of 0', () => {
			const progress = createPlayerProgress();
			expect(progress.currency).toBe(0);
		});

		it('returns runRewards of null', () => {
			const progress = createPlayerProgress();
			expect(progress.runRewards).toBeNull();
		});

		it('populates ownedCards with starting deck card ids at correct frequency counts', () => {
			const progress = createPlayerProgress();
			expect(progress.ownedCards).toEqual({
				iron_sword: 3,
				flame_blade: 2,
				battle_familiar: 2,
				dungeon_drake: 1
			});
		});

		it('has exactly 4 owned card entries', () => {
			const progress = createPlayerProgress();
			expect(Object.keys(progress.ownedCards).length).toBe(4);
		});

		it('each owned card count matches expected frequency', () => {
			const progress = createPlayerProgress();
			const expected = { iron_sword: 3, flame_blade: 2, battle_familiar: 2, dungeon_drake: 1 };
			for (const [cardId, count] of Object.entries(progress.ownedCards)) {
				expect(count).toBe(expected[cardId]);
			}
		});

		it('returns independent objects on each call', () => {
			const a = createPlayerProgress();
			const b = createPlayerProgress();
			a.ownedCards.iron_sword = 99;
			expect(b.ownedCards.iron_sword).toBe(3);
		});
	});

	// ── grantCard ──

	describe('grantCard(player, cardId)', () => {
		beforeEach(() => resetState());

		it('increments owned card count starting from 0', () => {
			const player = { ownedCards: {} };
			expect(grantCard(player, 'flame_blade')).toBe(true);
			expect(player.ownedCards['flame_blade']).toBe(1);
		});

		it('increments existing count', () => {
			const player = { ownedCards: { flame_blade: 3 } };
			expect(grantCard(player, 'flame_blade')).toBe(true);
			expect(player.ownedCards['flame_blade']).toBe(4);
		});

		it('rejects unknown card id', () => {
			const player = { ownedCards: {} };
			expect(grantCard(player, 'nonexistent_card')).toBe(false);
			expect(player.ownedCards['nonexistent_card']).toBeUndefined();
		});

		it('accepts all CARD_DEFS ids', () => {
			const player = { ownedCards: {} };
			for (const cardId of Object.keys(CARD_DEFS)) {
				expect(grantCard(player, cardId)).toBe(true);
				expect(player.ownedCards[cardId]).toBe(1);
			}
		});
	});

	// ── grantRunRewards ──

	describe('grantRunRewards(playerId, summary)', () => {
		beforeEach(() => {
			resetState();
			delete gameState._victoryCounters;
		});

		it('on victory: adds currency bonus', () => {
			addPlayer('p1', { currency: 0, ownedCards: {} });
			grantRunRewards('p1', { status: 'victory' });
			expect(gameState.players['p1'].currency).toBe(10);
		});

		it('on victory: grants at least one card reward', () => {
			addPlayer('p1', { currency: 0, ownedCards: {} });
			grantRunRewards('p1', { status: 'victory' });
			const cards = gameState.players['p1'].ownedCards;
			const granted = Object.values(cards).reduce((s, c) => s + c, 0);
			expect(granted).toBeGreaterThan(0);
		});

		it('on victory: sets player.runRewards summary', () => {
			addPlayer('p1', { currency: 0, ownedCards: {} });
			grantRunRewards('p1', { status: 'victory' });
			const rewards = gameState.players['p1'].runRewards;
			expect(rewards).toBeDefined();
			expect(rewards.currency).toBe(10);
			expect(Array.isArray(rewards.cards)).toBe(true);
			expect(rewards.cards.length).toBeGreaterThan(0);
			expect(rewards.cards[0]).toHaveProperty('id');
			expect(rewards.cards[0]).toHaveProperty('name');
			expect(rewards.cards[0]).toHaveProperty('count', 1);
		});

		it('on victory: first reward is flame_blade', () => {
			addPlayer('p1', { currency: 0, ownedCards: {} });
			grantRunRewards('p1', { status: 'victory' });
			expect(gameState.players['p1'].ownedCards['flame_blade']).toBe(1);
		});

		it('on victory: subsequent victories rotate through card ids', () => {
			addPlayer('p1', { currency: 0, ownedCards: {} });
			grantRunRewards('p1', { status: 'victory' }); // flame_blade
			grantRunRewards('p1', { status: 'victory' }); // battle_familiar
			grantRunRewards('p1', { status: 'victory' }); // dungeon_drake
			expect(gameState.players['p1'].ownedCards['flame_blade']).toBe(1);
			expect(gameState.players['p1'].ownedCards['battle_familiar']).toBe(1);
			expect(gameState.players['p1'].ownedCards['dungeon_drake']).toBe(1);
		});

		it('on failure: does not add currency bonus', () => {
			addPlayer('p1', { currency: 5, ownedCards: {} });
			grantRunRewards('p1', { status: 'failed' });
			expect(gameState.players['p1'].currency).toBe(5);
		});

		it('on failure: does not grant a victory card', () => {
			addPlayer('p1', { currency: 5, ownedCards: {} });
			grantRunRewards('p1', { status: 'failed' });
			expect(Object.keys(gameState.players['p1'].ownedCards).length).toBe(0);
		});

		it('on failure: preserves existing currency', () => {
			addPlayer('p1', { currency: 42, ownedCards: { iron_sword: 1 } });
			grantRunRewards('p1', { status: 'failed' });
			expect(gameState.players['p1'].currency).toBe(42);
			expect(gameState.players['p1'].ownedCards['iron_sword']).toBe(1);
		});

		it('does nothing for unknown player', () => {
			grantRunRewards('nonexistent', { status: 'victory' });
			expect(gameState.players['nonexistent']).toBeUndefined();
		});
	});

	// ── buildPlayerRewardSummary ──

	describe('buildPlayerRewardSummary(playerId)', () => {
		beforeEach(() => resetState());

		it('returns correct structure', () => {
			addPlayer('p1', { runRewards: { currency: 10, cards: [{ id: 'flame_blade', name: 'Flame Blade', count: 1 }] } });
			const summary = buildPlayerRewardSummary('p1');
			expect(summary.currency).toBe(10);
			expect(Array.isArray(summary.cards)).toBe(true);
		});

		it('maps card ids to names via CARD_DEFS', () => {
			addPlayer('p1', { runRewards: { currency: 0, cards: [{ id: 'iron_sword', name: 'Iron Sword', count: 1 }] } });
			const summary = buildPlayerRewardSummary('p1');
			const cardEntry = summary.cards.find(c => c.id === 'iron_sword');
			expect(cardEntry).toBeDefined();
			expect(cardEntry.name).toBe('Iron Sword');
			expect(cardEntry.count).toBe(1);
		});

		it('includes all owned cards', () => {
			addPlayer('p1', {
				runRewards: {
					currency: 0,
					cards: [
						{ id: 'iron_sword', name: 'Iron Sword', count: 2 },
						{ id: 'flame_blade', name: 'Flame Blade', count: 1 },
						{ id: 'battle_familiar', name: 'Battle Familiar', count: 1 }
					]
				}
			});
			const summary = buildPlayerRewardSummary('p1');
			expect(summary.cards.length).toBe(3);
		});

		it('returns empty cards array for unknown player', () => {
			const summary = buildPlayerRewardSummary('nonexistent');
			expect(summary.currency).toBe(0);
			expect(summary.cards.length).toBe(0);
		});
	});
});

// ── Deck Validation ──

describe('validateDeck(deck, ownedCards)', () => {
	it('returns valid for a correct deck', () => {
		const owned = { iron_sword: 3, flame_blade: 2, battle_familiar: 2, dungeon_drake: 1 };
		const deck = ['iron_sword', 'flame_blade', 'battle_familiar', 'dungeon_drake'];
		const result = validateDeck(deck, owned);
		expect(result).toEqual({ valid: true });
	});

	it('returns valid when deck uses duplicate copies within ownership', () => {
		const owned = { iron_sword: 3, flame_blade: 1 };
		const deck = ['iron_sword', 'iron_sword', 'flame_blade', 'iron_sword'];
		const result = validateDeck(deck, owned);
		expect(result).toEqual({ valid: true });
	});

	it('returns invalid for unknown card id', () => {
		const owned = { iron_sword: 3 };
		const deck = ['iron_sword', 'iron_sword', 'iron_sword', 'nonexistent_card'];
		const result = validateDeck(deck, owned);
		expect(result.valid).toBe(false);
		expect(result.reason).toContain('nonexistent_card');
	});

	it('returns invalid when deck is too small', () => {
		const owned = { iron_sword: 3 };
		const deck = ['iron_sword', 'iron_sword'];
		const result = validateDeck(deck, owned);
		expect(result.valid).toBe(false);
		expect(result.reason).toContain('at least');
	});

	it('returns invalid when deck is too large', () => {
		const owned = { iron_sword: 20, flame_blade: 20 };
		const deck = Array(13).fill('iron_sword');
		const result = validateDeck(deck, owned);
		expect(result.valid).toBe(false);
		expect(result.reason).toContain('at most');
	});

	it('returns invalid when too many copies of a card', () => {
		const owned = { iron_sword: 1, flame_blade: 2, battle_familiar: 2 };
		const deck = ['iron_sword', 'iron_sword', 'flame_blade', 'battle_familiar'];
		const result = validateDeck(deck, owned);
		expect(result.valid).toBe(false);
		expect(result.reason).toContain('iron_sword');
	});

	it('accepts deck at exactly DECK_MIN_SIZE', () => {
		const owned = { iron_sword: 4, flame_blade: 1, battle_familiar: 1, dungeon_drake: 1 };
		const deck = ['iron_sword', 'flame_blade', 'battle_familiar', 'dungeon_drake'];
		const result = validateDeck(deck, owned);
		expect(result).toEqual({ valid: true });
	});

	it('accepts deck at exactly DECK_MAX_SIZE', () => {
		const owned = { iron_sword: 12 };
		const deck = Array(12).fill('iron_sword');
		const result = validateDeck(deck, owned);
		expect(result).toEqual({ valid: true });
	});
});

describe('canAddCardToDeck(cardId, deck, ownedCards)', () => {
	it('returns true when adding a card keeps deck valid', () => {
		const owned = { iron_sword: 3, flame_blade: 2 };
		const deck = ['iron_sword', 'flame_blade', 'battle_familiar'];
		expect(canAddCardToDeck('iron_sword', deck, owned)).toBe(true);
	});

	it('returns false for unknown card id', () => {
		const owned = { iron_sword: 3 };
		const deck = ['iron_sword'];
		expect(canAddCardToDeck('nonexistent_card', deck, owned)).toBe(false);
	});

	it('returns false when already at max copies of a card', () => {
		const owned = { iron_sword: 2 };
		const deck = ['iron_sword', 'iron_sword', 'flame_blade', 'battle_familiar'];
		expect(canAddCardToDeck('iron_sword', deck, owned)).toBe(false);
	});

	it('returns false when deck is already at DECK_MAX_SIZE', () => {
		const owned = { iron_sword: 12, flame_blade: 5 };
		const deck = Array(12).fill('iron_sword');
		expect(canAddCardToDeck('flame_blade', deck, owned)).toBe(false);
	});

	it('returns true when deck is at DECK_MAX_SIZE - 1 and card is available', () => {
		const owned = { iron_sword: 10, flame_blade: 3 };
		const deck = Array(11).fill('iron_sword');
		expect(canAddCardToDeck('flame_blade', deck, owned)).toBe(true);
	});

	it('returns false when player owns zero copies of card', () => {
		const owned = { iron_sword: 3 };
		const deck = ['iron_sword', 'iron_sword', 'iron_sword'];
		expect(canAddCardToDeck('flame_blade', deck, owned)).toBe(false);
	});
});

describe('deck constants', () => {
	it('DECK_MIN_SIZE is 4', () => {
		expect(DECK_MIN_SIZE).toBe(4);
	});

	it('DECK_MAX_SIZE is 12', () => {
		expect(DECK_MAX_SIZE).toBe(12);
	});
});

describe('createDrawDeckFromSelectedDeck(player)', () => {
	it('produces a deck of the same length as selectedDeck', () => {
		const player = {
			selectedDeck: ['iron_sword', 'flame_blade', 'battle_familiar', 'dungeon_drake'],
			deck: []
		};
		const deck = createDrawDeckFromSelectedDeck(player);
		expect(deck.length).toBe(player.selectedDeck.length);
	});

	it('assigns the shuffled deck to player.deck', () => {
		const player = {
			selectedDeck: ['iron_sword', 'flame_blade', 'battle_familiar', 'dungeon_drake'],
			deck: []
		};
		const deck = createDrawDeckFromSelectedDeck(player);
		expect(player.deck).toBe(deck);
	});

	it('contains the same card ids as selectedDeck (possibly reordered)', () => {
		const player = {
			selectedDeck: ['iron_sword', 'iron_sword', 'flame_blade', 'battle_familiar'],
			deck: []
		};
		const deck = createDrawDeckFromSelectedDeck(player);
		expect(deck.sort()).toEqual(player.selectedDeck.slice().sort());
	});

	it('does not mutate the original selectedDeck', () => {
		const selectedDeck = ['iron_sword', 'flame_blade', 'battle_familiar', 'dungeon_drake'];
		const player = { selectedDeck, deck: [] };
		createDrawDeckFromSelectedDeck(player);
		expect(player.selectedDeck).toEqual(selectedDeck);
	});
});

describe('stateSnapshot() — explicit public snapshot', () => {
	beforeEach(() => {
		resetState();
		// Ensure gameState has layout and dungeonBounds (set by module init, but resetState clears them)
		gameState.layoutSeed = 42;
		if (!gameState.layout) gameState.layout = { rooms: [{ x: 0, z: 0, width: 10, depth: 10 }] };
		if (!gameState.dungeonBounds) gameState.dungeonBounds = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
	});

	it('includes players with public sub-fields', () => {
		addPlayer('p1', { hp: 80, magicStones: 50, currency: 10, deck: ['iron_sword'] });
		const snapshot = stateSnapshot();

		expect(snapshot.players['p1']).toEqual({
			x: 0,
			y: 0.5,
			z: 0,
			rotation: 0,
			deck: ['iron_sword'],
			hand: undefined,
			hp: 80,
			dead: false,
			ready: false,
			magicStones: 50,
			currency: 10,
			ownedCards: undefined,
			runRewards: undefined,
			currencyEarnedThisRun: undefined,
			selectedDeck: undefined,
			inventory: undefined,
			debugScenario: null
		});
	});

	it('includes enemies, minions, loot, gamePhase, run, layoutSeed, lobby, dungeonBounds', () => {
		addPlayer('p1');
		gameState.enemies = [{ id: 'e1', x: 5, z: 5, hp: 50 }];
		gameState.minions = [{ id: 'm1', x: 0, z: 0, hp: 50, ttl: 30, ownerId: 'p1' }];
		gameState.loot = [{ id: 'l1', x: 3, z: 3, value: 10 }];
		gameState.gamePhase = 'playing';
		gameState.run = { id: 'run-1', status: 'playing' };
		gameState.lobby = [];

		const snapshot = stateSnapshot();

		expect(snapshot.enemies).toEqual(gameState.enemies);
		expect(snapshot.minions).toEqual(gameState.minions);
		expect(snapshot.loot).toEqual(gameState.loot);
		expect(snapshot.gamePhase).toBe('playing');
		expect(snapshot.run).toEqual(gameState.run);
		expect(snapshot.layoutSeed).toBe(42);
		expect(snapshot.lobby).toEqual([]);
		expect(snapshot.dungeonBounds).toEqual(gameState.dungeonBounds);
		expect(snapshot.bounds).toBeUndefined();
	});

	it('does not include layout', () => {
		addPlayer('p1');
		const snapshot = stateSnapshot();
		expect(snapshot.layout).toBeUndefined();
	});

	it('does not include _victoryCounters', () => {
		addPlayer('p1');
		gameState._victoryCounters = { p1: 3 };
		const snapshot = stateSnapshot();
		expect(snapshot._victoryCounters).toBeUndefined();
	});

	it('strips pendingSummons (Set) from player objects', () => {
		addPlayer('p1');
		gameState.players['p1'].pendingSummons.add('0:iron_sword');
		const snapshot = stateSnapshot();
		expect(snapshot.players['p1'].pendingSummons).toBeUndefined();
	});

	it('strips lastActivity from player objects', () => {
		addPlayer('p1');
		const snapshot = stateSnapshot();
		expect(snapshot.players['p1'].lastActivity).toBeUndefined();
	});

	it('preserves all client-facing player fields', () => {
		addPlayer('p1', {
			hp: 75,
			magicStones: 30,
			currency: 25,
			deck: ['iron_sword', 'flame_blade'],
			selectedDeck: ['iron_sword', 'flame_blade', 'battle_familiar'],
			ownedCards: { iron_sword: 2, flame_blade: 1 },
			runRewards: { currency: 10, cards: [] },
			currencyEarnedThisRun: 5
		});
		const snapshot = stateSnapshot();
		const p = snapshot.players['p1'];

		expect(p.hp).toBe(75);
		expect(p.magicStones).toBe(30);
		expect(p.currency).toBe(25);
		expect(p.deck).toEqual(['iron_sword', 'flame_blade']);
		expect(p.selectedDeck).toEqual(['iron_sword', 'flame_blade', 'battle_familiar']);
		expect(p.ownedCards).toEqual({ iron_sword: 2, flame_blade: 1 });
		expect(p.runRewards).toEqual({ currency: 10, cards: [] });
		expect(p.currencyEarnedThisRun).toBe(5);
		expect(p.x).toBe(0);
		expect(p.y).toBe(0.5);
		expect(p.z).toBe(0);
		expect(p.dead).toBe(false);
		expect(p.ready).toBe(false);
	});

	it('returns independent objects per call (no shared mutation)', () => {
		addPlayer('p1');
		const a = stateSnapshot();
		const b = stateSnapshot();
		a.players['p1'].hp = 0;
		expect(b.players['p1'].hp).toBe(100);
	});
});

// ── ENEMY_DEFS ──

describe('ENEMY_DEFS', () => {
	it('is exported and contains grunt, skirmisher, miniboss, spawner keys', () => {
		expect(ENEMY_DEFS).toBeDefined();
		expect(ENEMY_DEFS).toHaveProperty('grunt');
		expect(ENEMY_DEFS).toHaveProperty('skirmisher');
		expect(ENEMY_DEFS).toHaveProperty('miniboss');
		expect(ENEMY_DEFS).toHaveProperty('spawner');
	});

	it('grunt has correct stat values', () => {
		expect(ENEMY_DEFS.grunt.hp).toBe(50);
		expect(ENEMY_DEFS.grunt.chaseSpeed).toBe(2.5);
		expect(ENEMY_DEFS.grunt.wanderSpeed).toBe(1.0);
		expect(ENEMY_DEFS.grunt.attackDamage).toBe(10);
		expect(ENEMY_DEFS.grunt.attackWindupMs).toBe(800);
	});

	it('skirmisher has correct stat values', () => {
		expect(ENEMY_DEFS.skirmisher.hp).toBe(20);
		expect(ENEMY_DEFS.skirmisher.chaseSpeed).toBe(4.5);
		expect(ENEMY_DEFS.skirmisher.wanderSpeed).toBe(1.5);
		expect(ENEMY_DEFS.skirmisher.attackDamage).toBe(6);
		expect(ENEMY_DEFS.skirmisher.attackWindupMs).toBe(500);
	});

	it('miniboss has correct stat values', () => {
		expect(ENEMY_DEFS.miniboss.hp).toBe(150);
		expect(ENEMY_DEFS.miniboss.chaseSpeed).toBe(1.2);
		expect(ENEMY_DEFS.miniboss.wanderSpeed).toBe(0.6);
		expect(ENEMY_DEFS.miniboss.attackDamage).toBe(18);
		expect(ENEMY_DEFS.miniboss.attackWindupMs).toBe(1200);
	});

	it('spawner has correct stat and spawning fields', () => {
		expect(ENEMY_DEFS.spawner.hp).toBe(60);
		expect(ENEMY_DEFS.spawner.chaseSpeed).toBe(1.8);
		expect(ENEMY_DEFS.spawner.wanderSpeed).toBe(0.9);
		expect(ENEMY_DEFS.spawner.attackDamage).toBe(8);
		expect(ENEMY_DEFS.spawner.attackWindupMs).toBe(900);
		expect(ENEMY_DEFS.spawner.spawnIntervalMs).toBe(4000);
		expect(ENEMY_DEFS.spawner.spawnMaxAlive).toBe(3);
		expect(ENEMY_DEFS.spawner.spawnType).toBe('skirmisher');
	});
});

// ── spawnEnemy type validation ──

describe('spawnEnemy() type validation', () => {
	beforeEach(() => resetState());

	it('throws on unknown enemy type', () => {
		expect(() => spawnEnemy(0, 0, 'dragon')).toThrow(/Unknown enemy type/);
	});

	it('does not push to gameState.enemies when type is unknown', () => {
		gameState.enemies = [];
		expect(() => spawnEnemy(0, 0, 'dragon')).toThrow();
		expect(gameState.enemies.length).toBe(0);
	});

	it('accepts valid types without throwing', () => {
		gameState.enemies = [];
		expect(() => spawnEnemy(0, 0, 'grunt')).not.toThrow();
		expect(() => spawnEnemy(0, 0, 'skirmisher')).not.toThrow();
		expect(() => spawnEnemy(0, 0, 'miniboss')).not.toThrow();
		expect(() => spawnEnemy(0, 0, 'spawner')).not.toThrow();
		expect(gameState.enemies.length).toBe(4);
	});
});

// ── spawnEnemies mixed pack ──

describe('spawnEnemies() mixed pack', () => {
	beforeEach(() => {
		resetGameState();
	});

	it('produces 5 enemies: 2 skirmishers, 1 grunt, 1 miniboss, 1 spawner', () => {
		gameState.enemies = [];
		spawnEnemies();
		expect(gameState.enemies.length).toBe(5);

		const counts = { skirmisher: 0, grunt: 0, miniboss: 0, spawner: 0 };
		for (const e of gameState.enemies) {
			counts[e.type] = (counts[e.type] || 0) + 1;
		}
		expect(counts.skirmisher).toBe(2);
		expect(counts.grunt).toBe(1);
		expect(counts.miniboss).toBe(1);
		expect(counts.spawner).toBe(1);
	});
});

// ── Per-type chase speed ──

describe('per-type chase speed in updateEnemies()', () => {
	beforeEach(() => {
		resetState();
	});

	it('skirmishers move faster than grunts (chase distance per tick is larger)', () => {
		addPlayer('p1', { x: 0, z: 0, dead: false });

		// Place a skirmisher and a grunt at the same distance from player
		// Use x = DETECTION_RADIUS - 1, z = 0 so dist = DETECTION_RADIUS - 1 < DETECTION_RADIUS
		const startDist = DETECTION_RADIUS - 1;
		gameState.enemies.push({
			id: 'skirm',
			x: startDist,
			z: 0,
			type: 'skirmisher',
			hp: 20,
			state: 'idle',
			attackState: 'idle',
			wanderTarget: { x: startDist, z: 0 }
		});
		// Place grunt on the other side, same distance
		gameState.enemies.push({
			id: 'grunt',
			x: -startDist,
			z: 0,
			type: 'grunt',
			hp: 50,
			state: 'idle',
			attackState: 'idle',
			wanderTarget: { x: -startDist, z: 0 }
		});

		const skirmXBefore = gameState.enemies[0].x;
		const gruntXBefore = gameState.enemies[1].x;

		updateEnemies();

		// Skirmisher moved from +startDist toward 0 (x decreased)
		const skirmMoved = Math.abs(skirmXBefore - gameState.enemies[0].x);
		// Grunt moved from -startDist toward 0 (x increased)
		const gruntMoved = Math.abs(gruntXBefore - gameState.enemies[1].x);

		expect(skirmMoved).toBeGreaterThan(gruntMoved);
	});
});

// ── Per-type damage (miniboss HP > grunt, skirmisher damage < grunt) ──

describe('per-type stats verification', () => {
	beforeEach(() => {
		resetState();
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2000, 0, 1));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('miniboss has higher HP than grunt (takes more hits to kill)', () => {
		expect(ENEMY_DEFS.miniboss.hp).toBeGreaterThan(ENEMY_DEFS.grunt.hp);
	});

	it('skirmisher deals less damage than grunt on successful windup', () => {
		expect(ENEMY_DEFS.skirmisher.attackDamage).toBeLessThan(ENEMY_DEFS.grunt.attackDamage);
	});

	it('skirmisher deals less damage than grunt — verified via windup strike', () => {
		const now = Date.now();

		// Skirmisher windup strike
		addPlayer('ps', { id: 'ps', x: 0, z: 0, dead: false, hp: 100 });
		gameState.enemies.push({
			id: 'skirm',
			x: 0,
			z: 0,
			type: 'skirmisher',
			hp: 20,
			state: 'chasing',
			attackState: 'windup',
			windupTargetId: 'ps',
			windupStartTime: now - ENEMY_DEFS.skirmisher.attackWindupMs - 100,
			wanderTarget: { x: 0, z: 0 }
		});
		updateEnemies();
		const skirmDamage = 100 - gameState.players['ps'].hp;

		// Reset for grunt test
		resetState();
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2000, 0, 1));

		addPlayer('pg', { id: 'pg', x: 0, z: 0, dead: false, hp: 100 });
		gameState.enemies.push({
			id: 'grunt',
			x: 0,
			z: 0,
			type: 'grunt',
			hp: 50,
			state: 'chasing',
			attackState: 'windup',
			windupTargetId: 'pg',
			windupStartTime: now - ENEMY_DEFS.grunt.attackWindupMs - 100,
			wanderTarget: { x: 0, z: 0 }
		});
		updateEnemies();
		const gruntDamage = 100 - gameState.players['pg'].hp;

		expect(skirmDamage).toBeLessThan(gruntDamage);
	});
});

// ── Spawner periodic spawn ──

describe('Spawner periodic spawn', () => {
	beforeEach(() => {
		resetState();
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2000, 0, 1));
		// Ensure layout / dungeonBounds exist after resetState
		gameState.layoutSeed = 42;
		if (!gameState.layout) gameState.layout = { rooms: [{ x: 0, z: 0, width: 10, depth: 10 }] };
		if (!gameState.dungeonBounds) gameState.dungeonBounds = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('spawns a skirmisher add when interval has elapsed', () => {
		addPlayer('p1', { x: 0, z: 0, dead: false });
		const now = Date.now();

		gameState.enemies.push({
			id: 'spawner1',
			x: 0,
			z: 0,
			type: 'spawner',
			hp: 60,
			maxHp: 60,
			state: 'idle',
			attackState: 'idle',
			wanderTarget: { x: 0, z: 0 },
			lastSpawnTime: now - ENEMY_DEFS.spawner.spawnIntervalMs - 100,
		});

		expect(gameState.enemies.length).toBe(1);
		updateEnemies();

		expect(gameState.enemies.length).toBe(2);
		const add = gameState.enemies[1];
		expect(add.type).toBe('skirmisher');
	});

	it('sets spawnedBy on the add to the spawner id', () => {
		const now = Date.now();
		gameState.enemies.push({
			id: 'spawner1',
			x: 0,
			z: 0,
			type: 'spawner',
			hp: 60,
			maxHp: 60,
			state: 'idle',
			attackState: 'idle',
			wanderTarget: { x: 0, z: 0 },
			lastSpawnTime: now - ENEMY_DEFS.spawner.spawnIntervalMs - 100,
		});

		updateEnemies();

		const add = gameState.enemies.find(e => e.spawnedBy);
		expect(add).toBeDefined();
		expect(add.spawnedBy).toBe('spawner1');
	});

	it('does not spawn when interval has not elapsed', () => {
		const now = Date.now();
		gameState.enemies.push({
			id: 'spawner1',
			x: 0,
			z: 0,
			type: 'spawner',
			hp: 60,
			maxHp: 60,
			state: 'idle',
			attackState: 'idle',
			wanderTarget: { x: 0, z: 0 },
			lastSpawnTime: now, // just spawned, interval not elapsed
		});

		updateEnemies();

		expect(gameState.enemies.length).toBe(1);
	});

	it('respects spawnMaxAlive cap', () => {
		const now = Date.now();
		const spawnerId = 'spawner1';

		// Create a spawner with 3 living adds (at max)
		gameState.enemies.push({
			id: spawnerId,
			x: 0,
			z: 0,
			type: 'spawner',
			hp: 60,
			maxHp: 60,
			state: 'idle',
			attackState: 'idle',
			wanderTarget: { x: 0, z: 0 },
			lastSpawnTime: now - ENEMY_DEFS.spawner.spawnIntervalMs - 100,
		});
		// Pre-populate 3 adds
		for (let i = 0; i < 3; i++) {
			gameState.enemies.push({
				id: `add${i}`,
				x: 0.5 * i,
				z: 0.5 * i,
				type: 'skirmisher',
				hp: 20,
				maxHp: 20,
				state: 'idle',
				attackState: 'idle',
				spawnedBy: spawnerId,
				wanderTarget: { x: 0.5 * i, z: 0.5 * i },
			});
		}

		expect(gameState.enemies.length).toBe(4);
		updateEnemies();

		// Should still be 4 — no new add spawned
		expect(gameState.enemies.length).toBe(4);
	});

	it('spawns a new add when one of the existing adds dies', () => {
		const now = Date.now();
		const spawnerId = 'spawner1';

		gameState.enemies.push({
			id: spawnerId,
			x: 0,
			z: 0,
			type: 'spawner',
			hp: 60,
			maxHp: 60,
			state: 'idle',
			attackState: 'idle',
			wanderTarget: { x: 0, z: 0 },
			lastSpawnTime: now - ENEMY_DEFS.spawner.spawnIntervalMs - 100,
		});
		// 2 living adds + 1 dead add
		gameState.enemies.push({ id: 'add0', x: 0.5, z: 0, type: 'skirmisher', hp: 20, maxHp: 20, state: 'idle', attackState: 'idle', spawnedBy: spawnerId, wanderTarget: { x: 0.5, z: 0 } });
		gameState.enemies.push({ id: 'add1', x: 1, z: 0, type: 'skirmisher', hp: 20, maxHp: 20, state: 'idle', attackState: 'idle', spawnedBy: spawnerId, wanderTarget: { x: 1, z: 0 } });
		gameState.enemies.push({ id: 'add2', x: 1.5, z: 0, type: 'skirmisher', hp: 0, maxHp: 20, state: 'idle', attackState: 'idle', spawnedBy: spawnerId, wanderTarget: { x: 1.5, z: 0 } });

		expect(gameState.enemies.length).toBe(4);
		updateEnemies();

		// Should have spawned a new add (only 2 alive, cap is 3)
		expect(gameState.enemies.length).toBe(5);
		const newAdd = gameState.enemies.find(e => e.id !== spawnerId && e.id !== 'add0' && e.id !== 'add1' && e.id !== 'add2');
		expect(newAdd).toBeDefined();
		expect(newAdd.spawnedBy).toBe(spawnerId);
	});

	it('adds survive spawner death', () => {
		const spawnerId = 'spawner1';

		gameState.enemies.push({
			id: spawnerId,
			x: 0,
			z: 0,
			type: 'spawner',
			hp: 60,
			maxHp: 60,
			state: 'idle',
			attackState: 'idle',
			wanderTarget: { x: 0, z: 0 },
			lastSpawnTime: Date.now() - ENEMY_DEFS.spawner.spawnIntervalMs - 100,
		});
		// Pre-existing add
		gameState.enemies.push({
			id: 'add0',
			x: 0.5,
			z: 0,
			type: 'skirmisher',
			hp: 20,
			maxHp: 20,
			state: 'idle',
			attackState: 'idle',
			spawnedBy: spawnerId,
			wanderTarget: { x: 0.5, z: 0 },
		});

		// Kill the spawner
		gameState.enemies[0].hp = 0;

		updateEnemies();

		// The add should still be alive (no mass despawn)
		const add = gameState.enemies.find(e => e.id === 'add0');
		expect(add).toBeDefined();
		expect(add.hp).toBe(20);
	});

	it('add is placed within ~3 units of spawner', () => {
		const now = Date.now();
		gameState.enemies.push({
			id: 'spawner1',
			x: 0,
			z: 0,
			type: 'spawner',
			hp: 60,
			maxHp: 60,
			state: 'idle',
			attackState: 'idle',
			wanderTarget: { x: 0, z: 0 },
			lastSpawnTime: now - ENEMY_DEFS.spawner.spawnIntervalMs - 100,
		});

		updateEnemies();

		const add = gameState.enemies[1];
		const dist = Math.hypot(add.x - 0, add.z - 0);
		expect(dist).toBeLessThanOrEqual(3);
	});

	it('spawnEnemy sets lastSpawnTime on spawner type', () => {
		gameState.enemies = [];
		spawnEnemy(0, 0, 'spawner');
		expect(gameState.enemies[0].lastSpawnTime).toBeDefined();
		expect(typeof gameState.enemies[0].lastSpawnTime).toBe('number');
	});

	it('spawnEnemy does not set lastSpawnTime on non-spawner types', () => {
		gameState.enemies = [];
		spawnEnemy(0, 0, 'grunt');
		expect(gameState.enemies[0].lastSpawnTime).toBeUndefined();
	});

	it('spawnEnemy sets spawnedBy when provided', () => {
		gameState.enemies = [];
		spawnEnemy(0, 0, 'skirmisher', 'parent123');
		expect(gameState.enemies[0].spawnedBy).toBe('parent123');
	});

	it('spawnEnemy does not set spawnedBy when omitted', () => {
		gameState.enemies = [];
		spawnEnemy(0, 0, 'skirmisher');
		expect(gameState.enemies[0].spawnedBy).toBeUndefined();
	});
});
