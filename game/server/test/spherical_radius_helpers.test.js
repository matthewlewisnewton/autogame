import { describe, it, expect, beforeEach } from 'vitest';
import {
	createGameState,
	gameState,
	sphericalDistanceToEntity,
	applyFreezeInRadius,
	healPlayersInRadius,
	pullEnemiesToward,
	applyEventHorizon,
	collectRadialHits,
	isEnemyFrozen,
	computeWalkableAABBs,
	rebuildWallColliders,
} from '../index.js';

// With no layout in gameState, the floor fallback resolves to DEFAULT_FLOOR_Y.
const FLOOR_Y = 0.5;
const RADIUS = 6;

function resetState() {
	Object.assign(gameState, createGameState());
}

function addPlayer(id, overrides = {}) {
	gameState.players[id] = {
		x: 0,
		y: FLOOR_Y,
		z: 0,
		rotation: 0,
		hp: 100,
		dead: false,
		extracted: false,
		magicStones: 100,
		hand: [],
		deck: [],
		pendingSummons: new Set(),
		slotCooldowns: [null, null, null, null],
		debuffs: [],
		...overrides,
	};
}

function addEnemy(id, overrides = {}) {
	const enemy = { id, type: 'grunt', x: 0, z: 0, hp: 40, ...overrides };
	gameState.enemies.push(enemy);
	return enemy;
}

// pullEnemiesToward displaces via tryEntityDisplacement, which only moves
// entities inside a walkable area — give the tests a flat open room.
function setupWalkableRoom() {
	gameState.layout = {
		rooms: [{ x: 0, z: 0, width: 40, depth: 40, walls: [] }],
		passages: [],
	};
	gameState.dungeonBounds = { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };
	gameState.walkableAABBs = computeWalkableAABBs(gameState.layout);
	rebuildWallColliders();
}

describe('sphericalDistanceToEntity', () => {
	beforeEach(resetState);

	it('returns the 3D distance when originY is explicit', () => {
		const enemy = addEnemy('e1', { x: 3, z: 0, y: FLOOR_Y + 4 });
		expect(sphericalDistanceToEntity(0, FLOOR_Y, 0, enemy)).toBeCloseTo(5);
	});

	it('falls back to floor Y when originY is null — never to 2D', () => {
		const flat = addEnemy('flat', { x: 3, z: 4 });
		expect(sphericalDistanceToEntity(0, null, 0, flat)).toBeCloseTo(5);

		// Directly above the origin: a 2D fallback would report 0.
		const above = addEnemy('above', { x: 0, z: 0, y: FLOOR_Y + 8 });
		expect(sphericalDistanceToEntity(0, null, 0, above)).toBeCloseTo(8);
	});
});

describe('applyFreezeInRadius — spherical inclusion', () => {
	beforeEach(resetState);

	it('freezes an elevated enemy whose 3D distance is within the radius', () => {
		const enemy = addEnemy('e1', { x: 3, z: 0, y: FLOOR_Y + 4, hp: 40 });
		const hits = applyFreezeInRadius(0, FLOOR_Y, 0, RADIUS, 2000, 5);
		expect(hits).toHaveLength(1);
		expect(hits[0].enemyId).toBe('e1');
		expect(enemy.hp).toBe(35);
		expect(isEnemyFrozen(enemy)).toBe(true);
	});

	it('skips an enemy within XZ range but beyond the 3D radius', () => {
		const enemy = addEnemy('e1', { x: 0, z: 0, y: FLOOR_Y + RADIUS + 1, hp: 40 });
		const hits = applyFreezeInRadius(0, FLOOR_Y, 0, RADIUS, 2000, 5);
		expect(hits).toHaveLength(0);
		expect(enemy.hp).toBe(40);
		expect(isEnemyFrozen(enemy)).toBe(false);
	});
});

describe('healPlayersInRadius — spherical inclusion', () => {
	beforeEach(resetState);

	it('heals an elevated player whose 3D distance is within the radius', () => {
		addPlayer('p1', { x: 3, z: 0, y: FLOOR_Y + 4, hp: 50 });
		const healed = healPlayersInRadius(0, FLOOR_Y, 0, RADIUS, 10);
		expect(healed).toEqual([{ playerId: 'p1', hpGained: 10, cleansed: true }]);
		expect(gameState.players.p1.hp).toBe(60);
	});

	it('skips a player within XZ range but beyond the 3D radius', () => {
		addPlayer('p1', { x: 0, z: 0, y: FLOOR_Y + RADIUS + 1, hp: 50 });
		const healed = healPlayersInRadius(0, FLOOR_Y, 0, RADIUS, 10);
		expect(healed).toEqual([]);
		expect(gameState.players.p1.hp).toBe(50);
	});
});

describe('pullEnemiesToward — spherical inclusion, horizontal displacement', () => {
	beforeEach(() => {
		resetState();
		setupWalkableRoom();
	});

	it('pulls an elevated enemy within the 3D radius along XZ only', () => {
		const enemy = addEnemy('e1', { x: 4, z: 0, y: FLOOR_Y + 3, hp: 40 });
		const moved = pullEnemiesToward(0, FLOOR_Y, 0, RADIUS, 2);
		expect(moved).toHaveLength(1);
		expect(enemy.x).toBeCloseTo(2);
		expect(enemy.z).toBe(0);
		// Inclusion is spherical but no vertical movement is introduced.
		expect(enemy.y).toBe(FLOOR_Y + 3);
	});

	it('ignores an enemy within XZ range but beyond the 3D radius', () => {
		const enemy = addEnemy('e1', { x: 4, z: 0, y: FLOOR_Y + 20, hp: 40 });
		const moved = pullEnemiesToward(0, FLOOR_Y, 0, RADIUS, 2);
		expect(moved).toHaveLength(0);
		expect(enemy.x).toBe(4);
	});
});

describe('applyEventHorizon — spherical inclusion', () => {
	beforeEach(() => {
		resetState();
		setupWalkableRoom();
	});

	const cardDef = { pullRadius: 12, pullStrength: 5, centerRadius: 2.5, centerDamage: 30 };

	it('pulls and crushes elevated enemies within the 3D radii', () => {
		const pullTarget = addEnemy('edge', { x: 8, z: 0, y: FLOOR_Y + 6, hp: 40 });
		const crushTarget = addEnemy('core', { x: 1, z: 0, y: FLOOR_Y + 2, hp: 40 });
		const { pulled, crushed } = applyEventHorizon(0, FLOOR_Y, 0, cardDef, 'p1');
		expect(pulled.map((m) => m.enemyId)).toContain('edge');
		expect(pullTarget.x).toBeLessThan(8);
		expect(pullTarget.y).toBe(FLOOR_Y + 6);
		expect(crushed).toHaveLength(1);
		expect(crushed[0].enemyId).toBe('core');
		expect(crushTarget.hp).toBe(40 - cardDef.centerDamage);
	});

	it('ignores an enemy within XZ range but beyond the 3D pull radius', () => {
		const enemy = addEnemy('high', { x: 2, z: 0, y: FLOOR_Y + 14, hp: 40 });
		const { pulled, crushed } = applyEventHorizon(0, FLOOR_Y, 0, cardDef, 'p1');
		expect(pulled).toHaveLength(0);
		expect(crushed).toHaveLength(0);
		expect(enemy.x).toBe(2);
		expect(enemy.hp).toBe(40);
	});
});

describe('collectRadialHits — spherical inclusion', () => {
	beforeEach(resetState);

	it('damages an elevated enemy whose 3D distance is within the radius', () => {
		const enemy = addEnemy('e1', { x: 3, z: 0, y: FLOOR_Y + 4, hp: 40 });
		const result = collectRadialHits(0, FLOOR_Y, 0, RADIUS, 10);
		expect(result.hits).toHaveLength(1);
		expect(result.hits[0].enemyId).toBe('e1');
		expect(enemy.hp).toBe(30);
	});

	it('skips an enemy within XZ range but beyond the 3D radius', () => {
		const enemy = addEnemy('e1', { x: 0, z: 0, y: FLOOR_Y + RADIUS + 1, hp: 40 });
		const result = collectRadialHits(0, FLOOR_Y, 0, RADIUS, 10);
		expect(result.hits).toHaveLength(0);
		expect(enemy.hp).toBe(40);
	});

	it('null originY resolves to the floor, still excluding targets high above', () => {
		const flat = addEnemy('flat', { x: 3, z: 0, hp: 40 });
		const above = addEnemy('above', { x: 0, z: 0, y: FLOOR_Y + RADIUS + 1, hp: 40 });
		const result = collectRadialHits(0, null, 0, RADIUS, 10);
		expect(result.hits.map((h) => h.enemyId)).toEqual(['flat']);
		expect(flat.hp).toBe(30);
		expect(above.hp).toBe(40);
	});
});
