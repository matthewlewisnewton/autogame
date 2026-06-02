import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import config from '../config.js';
import {
	mulberry32,
	generateLayout,
	pickFloorSpawnPosition,
	spawnCrystals,
	spawnLoot,
	spawnEnemies,
	buildWallColliders,
	checkWallCollision,
	gameState,
	resetGameState,
} from '../index.js';

// Open-plaza (arena_trials) cover-aware spawning. On the single-room plaza there
// are no 'combat'/'treasure' rooms, so enemy/objective/loot placement runs through
// pickFloorSpawnPosition, which must keep every entity on walkable floor (off any
// cover piece or wall) and be deterministic for a given seed.

const SEED = 4242;

function openPlazaLayout(seed = SEED) {
	return generateLayout(seed, 'open-plaza');
}

// A position is "on walkable floor" when it sits inside the plaza bounds and does
// not collide with any wall/cover collider (same collider set as player movement).
function assertOnFloor(layout, pos) {
	const half = layout.rooms[0].width / 2;
	expect(Math.abs(pos.x)).toBeLessThanOrEqual(half);
	expect(Math.abs(pos.z)).toBeLessThanOrEqual(half);
	expect(checkWallCollision(pos.x, pos.z, buildWallColliders(layout))).toBe(false);
}

describe('pickFloorSpawnPosition (open-plaza cover-aware spawn)', () => {
	it('every sampled position is on walkable floor, clear of cover and walls', () => {
		const layout = openPlazaLayout();
		const rng = mulberry32(SEED);
		for (let i = 0; i < 200; i++) {
			assertOnFloor(layout, pickFloorSpawnPosition(layout, rng));
		}
	});

	it('uses the seeded rng only — same seed yields the same positions', () => {
		const layout = openPlazaLayout();
		const a = mulberry32(SEED);
		const b = mulberry32(SEED);
		for (let i = 0; i < 50; i++) {
			expect(pickFloorSpawnPosition(layout, a)).toEqual(pickFloorSpawnPosition(layout, b));
		}
	});

	it('does not call Math.random()', () => {
		const layout = openPlazaLayout();
		const spy = vi.spyOn(Math, 'random');
		const rng = mulberry32(SEED);
		for (let i = 0; i < 50; i++) pickFloorSpawnPosition(layout, rng);
		expect(spy).not.toHaveBeenCalled();
		spy.mockRestore();
	});

	it('falls back to the plaza centre (spawn-clear zone) when every attempt collides', () => {
		const layout = openPlazaLayout();
		// rng always returns 0 ⇒ candidate is always the plaza centre, which is the
		// known-safe fallback regardless of cover. Force collisions by exhausting a
		// single attempt: the centre is clear, so we still get a valid floor point.
		const pos = pickFloorSpawnPosition(layout, () => 0, { maxAttempts: 1 });
		assertOnFloor(layout, pos);
	});
});

describe('spawnCrystals on open-plaza routes through the cover-aware helper', () => {
	beforeEach(() => resetGameState());

	it('places every objective crystal on walkable floor, clear of cover', () => {
		const layout = openPlazaLayout();
		gameState.loot = [];
		spawnCrystals(layout, mulberry32(SEED), 5);
		const crystals = gameState.loot.filter(l => l.kind === 'crystal');
		expect(crystals.length).toBe(5);
		for (const c of crystals) assertOnFloor(layout, c);
	});

	it('is deterministic: same seed yields identical crystal positions', () => {
		const layout = openPlazaLayout();
		gameState.loot = [];
		spawnCrystals(layout, mulberry32(SEED), 5);
		const first = gameState.loot.filter(l => l.kind === 'crystal').map(c => ({ x: c.x, z: c.z }));
		gameState.loot = [];
		spawnCrystals(layout, mulberry32(SEED), 5);
		const second = gameState.loot.filter(l => l.kind === 'crystal').map(c => ({ x: c.x, z: c.z }));
		expect(second).toEqual(first);
	});
});

describe('spawnLoot on open-plaza routes through the cover-aware helper', () => {
	beforeEach(() => resetGameState());
	afterEach(() => vi.restoreAllMocks());

	it('places the loot drop on walkable floor, clear of cover', () => {
		// Force the spawn-chance roll to pass; the position itself is seeded.
		vi.spyOn(Math, 'random').mockReturnValue(config.LOOT_SPAWN_CHANCE - 0.1);
		const layout = openPlazaLayout();
		gameState.loot = [];
		spawnLoot(layout, mulberry32(SEED));
		expect(gameState.loot.length).toBe(1);
		assertOnFloor(layout, gameState.loot[0]);
	});

	it('is deterministic: same seed yields the same loot position', () => {
		vi.spyOn(Math, 'random').mockReturnValue(config.LOOT_SPAWN_CHANCE - 0.1);
		const layout = openPlazaLayout();
		gameState.loot = [];
		spawnLoot(layout, mulberry32(SEED));
		const a = { x: gameState.loot[0].x, z: gameState.loot[0].z };
		gameState.loot = [];
		spawnLoot(layout, mulberry32(SEED));
		const b = { x: gameState.loot[0].x, z: gameState.loot[0].z };
		expect(b).toEqual(a);
	});
});

describe('spawnEnemies on the arena_trials open-plaza stage', () => {
	beforeEach(() => resetGameState());

	function deployArena(seed = SEED) {
		gameState.selectedQuestId = 'arena_trials';
		gameState.layout = openPlazaLayout(seed);
		gameState.layoutSeed = seed;
		gameState.enemies = [];
		gameState.loot = [];
		spawnEnemies();
	}

	it('places every spawned enemy on walkable floor, clear of cover and walls', () => {
		deployArena();
		expect(gameState.enemies.length).toBeGreaterThan(0);
		for (const e of gameState.enemies) {
			assertOnFloor(gameState.layout, e);
		}
	});

	it('is deterministic: same seed yields identical enemy spawn positions', () => {
		deployArena();
		const first = gameState.enemies.map(e => ({ x: e.x, z: e.z }));
		resetGameState();
		deployArena();
		const second = gameState.enemies.map(e => ({ x: e.x, z: e.z }));
		expect(second).toEqual(first);
	});
});

describe('normal rooms-and-passages stages are unaffected', () => {
	beforeEach(() => resetGameState());
	afterEach(() => vi.restoreAllMocks());

	it('spawnLoot still places loot inside a non-start room on a crowded layout', () => {
		vi.spyOn(Math, 'random').mockReturnValue(config.LOOT_SPAWN_CHANCE - 0.1);
		const layout = generateLayout(42); // default crowded profile, has combat/treasure rooms
		gameState.loot = [];
		spawnLoot(layout, mulberry32(99));
		const loot = gameState.loot[0];
		const inStart = layout.rooms
			.filter(r => r.role === 'start')
			.some(r => Math.abs(loot.x - r.x) < r.width / 2 && Math.abs(loot.z - r.z) < r.depth / 2);
		expect(inStart).toBe(false);
	});
});
