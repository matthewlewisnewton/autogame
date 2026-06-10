import { describe, it, expect, beforeEach } from 'vitest';
import {
	resetGameState,
	gameState,
	updateEnemies,
	updateMinions,
	spawnEnemy,
	ENEMY_DEFS,
	CARD_DEFS,
	buildWorldSnapshot,
} from '../index.js';
// Pure helpers (no shared module state) — safe to import directly.
import {
	resolveEntityY,
	DEFAULT_FLY_ALTITUDE,
	computeWalkableAABBs,
	computeDungeonBounds,
} from '../simulation.js';
// Floor oracle: compute the expected grounded Y independently of the helper.
import { sampleFloorY, resolveFloorY } from '../../shared/floorSampling.js';
import { buildPlayerHotSnapshot } from '../progression.js';

// A single large open room with an explicit, non-default floor height so a
// hovering entity's Y is provably `floorY + altitude` (not just the 0.5 default).
const FLOOR_HEIGHT = 1.5;
function buildOpenLayout() {
	return {
		rooms: [
			{
				x: 0,
				z: 0,
				width: 60,
				depth: 60,
				role: 'start',
				walls: [],
				floorCorners: {
					yNW: FLOOR_HEIGHT,
					yNE: FLOOR_HEIGHT,
					ySE: FLOOR_HEIGHT,
					ySW: FLOOR_HEIGHT,
				},
			},
		],
		passages: [],
	};
}

function floorYAt(layout, x, z) {
	return resolveFloorY(sampleFloorY(layout, x, z));
}

function wireOpenWorld() {
	resetGameState();
	const layout = buildOpenLayout();
	gameState.layout = layout;
	gameState.walkableAABBs = computeWalkableAABBs(layout);
	gameState.dungeonBounds = computeDungeonBounds(layout);
	gameState.run = { status: 'playing' };
	gameState.enemies = [];
	gameState.minions = [];
	gameState.players = {};
	return layout;
}

describe('resolveEntityY — general altitude helper', () => {
	let layout;
	beforeEach(() => {
		layout = buildOpenLayout();
	});

	it('floor-snaps a grounded entity (no flying flag)', () => {
		const entity = { x: 4, z: -3 };
		expect(resolveEntityY(entity, layout)).toBe(floorYAt(layout, 4, -3));
		expect(resolveEntityY(entity, layout)).toBe(FLOOR_HEIGHT);
	});

	it('hovers a plain {flying, altitude, x, z} object at floorY + altitude (generality)', () => {
		const entity = { flying: true, altitude: 2, x: 4, z: -3 };
		const floorY = floorYAt(layout, 4, -3);
		expect(resolveEntityY(entity, layout)).toBe(floorY + 2);
		// Provably airborne: not equal to the floor-snapped Y.
		expect(resolveEntityY(entity, layout)).not.toBe(floorY);
	});

	it('falls back to DEFAULT_FLY_ALTITUDE when flying with no explicit altitude', () => {
		const entity = { flying: true, x: 0, z: 0 };
		const floorY = floorYAt(layout, 0, 0);
		expect(DEFAULT_FLY_ALTITUDE).toBeGreaterThan(0);
		expect(resolveEntityY(entity, layout)).toBe(floorY + DEFAULT_FLY_ALTITUDE);
	});
});

describe('player airborne symmetry (snapshot + resolveEntityY)', () => {
	let layout;
	beforeEach(() => {
		layout = buildOpenLayout();
	});

	it('resolves a flying player object to floorY + altitude (same helper as enemies/minions)', () => {
		const player = { id: 'p1', flying: true, altitude: 2.5, x: 4, z: -3 };
		const floorY = floorYAt(layout, 4, -3);
		expect(resolveEntityY(player, layout)).toBe(floorY + 2.5);
		expect(resolveEntityY(player, layout)).not.toBe(floorY);
	});

	it('floor-snaps a grounded player to floorY', () => {
		const player = { id: 'p1', x: 4, z: -3 };
		expect(resolveEntityY(player, layout)).toBe(floorYAt(layout, 4, -3));
	});

	it('hot snapshot carries flying/altitude for a flying player', () => {
		const floorY = floorYAt(layout, 4, -3);
		const player = { x: 4, y: floorY + 2.5, z: -3, flying: true, altitude: 2.5 };
		const snap = buildPlayerHotSnapshot('p1', player);
		expect(snap.flying).toBe(true);
		expect(snap.altitude).toBe(2.5);
		// Still broadcasts the resolved airborne world Y.
		expect(snap.y).toBe(floorY + 2.5);
	});

	it('hot snapshot reports a grounded player as flying:false with floor y', () => {
		const floorY = floorYAt(layout, 4, -3);
		const player = { x: 4, y: floorY, z: -3 };
		const snap = buildPlayerHotSnapshot('p1', player);
		expect(snap.flying).toBe(false);
		expect(snap.altitude).toBe(0);
		expect(snap.y).toBe(floorY);
	});
});

describe('ember_wraith enemy is airborne', () => {
	beforeEach(() => {
		wireOpenWorld();
	});

	it('declares flying + a positive altitude in its enemy def', () => {
		expect(ENEMY_DEFS.ember_wraith.flying).toBe(true);
		expect(ENEMY_DEFS.ember_wraith.altitude).toBeGreaterThan(0);
	});

	it('hovers a spawned wraith at floorY + altitude each tick (never re-grounded)', () => {
		const wraith = spawnEnemy(5, 5, 'ember_wraith');
		// The def's flying/altitude flow onto the instance via ...statFieldsFromDef.
		expect(wraith.flying).toBe(true);
		expect(wraith.altitude).toBe(ENEMY_DEFS.ember_wraith.altitude);

		const floorY = floorYAt(gameState.layout, wraith.x, wraith.z);
		updateEnemies();
		expect(wraith.y).toBe(floorY + wraith.altitude);
		// Airborne, not floor-snapped.
		expect(wraith.y).not.toBe(floorY);

		// Stays airborne across further ticks.
		updateEnemies();
		const floorY2 = floorYAt(gameState.layout, wraith.x, wraith.z);
		expect(wraith.y).toBe(floorY2 + wraith.altitude);
	});

	it('floor-snaps a grounded enemy (grunt) to floorY', () => {
		const grunt = spawnEnemy(2, -4, 'grunt');
		expect(grunt.flying).toBeFalsy();
		const floorY = floorYAt(gameState.layout, grunt.x, grunt.z);
		updateEnemies();
		expect(grunt.y).toBe(floorY);
	});
});

describe('aerial minions hover', () => {
	beforeEach(() => {
		wireOpenWorld();
		gameState.players.p1 = { id: 'p1', x: 0, z: 0, hp: 100, dead: false };
	});

	// Mirror what cardEffects.js stamps onto a freshly summoned aerial minion.
	function makeAerialMinion(type, altitude) {
		return {
			id: type,
			ownerId: 'p1',
			type,
			x: 6,
			z: 6,
			hp: 50,
			maxHp: 50,
			flying: true,
			altitude,
			attackRange: 7,
			attackDamage: 12,
		};
	}

	it('hovers a flagged storm_eagle at floorY + altitude', () => {
		const eagle = makeAerialMinion('storm_eagle', 3.5);
		gameState.minions.push(eagle);
		const floorY = floorYAt(gameState.layout, eagle.x, eagle.z);
		updateMinions();
		expect(eagle.y).toBe(floorY + 3.5);
		expect(eagle.y).not.toBe(floorY);
	});

	it('hovers a flagged thunderbird at floorY + altitude', () => {
		const bird = makeAerialMinion('thunderbird', 4.5);
		gameState.minions.push(bird);
		const floorY = floorYAt(gameState.layout, bird.x, bird.z);
		updateMinions();
		expect(bird.y).toBe(floorY + 4.5);
		expect(bird.y).not.toBe(floorY);
	});

	it('hovers a flagged ancient_wyrm at floorY + altitude', () => {
		const altitude = CARD_DEFS.ancient_wyrm.altitude;
		const wyrm = {
			id: 'wyrm-1',
			ownerId: 'p1',
			type: 'ancient_wyrm',
			x: 4,
			z: -2,
			hp: 90,
			maxHp: 90,
			flying: true,
			altitude,
			ttl: 30,
			breathIntervalMs: 3000,
			lastBreathAt: 0,
		};
		gameState.minions.push(wyrm);
		const floorY = floorYAt(gameState.layout, wyrm.x, wyrm.z);
		updateMinions();
		expect(wyrm.y).toBe(floorY + altitude);
		expect(wyrm.y).not.toBe(floorY);

		const snapMinion = buildWorldSnapshot().minions.find((m) => m.id === 'wyrm-1');
		expect(snapMinion.flying).toBe(true);
		expect(snapMinion.altitude).toBe(altitude);
		expect(snapMinion.y).toBe(floorY + altitude);
	});

	it('floor-snaps a dungeon_drake minion without flying fields', () => {
		const drake = {
			id: 'drake-1',
			ownerId: 'p1',
			type: 'dungeon_drake',
			x: -3,
			z: 5,
			hp: 20,
			maxHp: 20,
			ttl: 30,
			breathIntervalMs: 2500,
			lastBreathAt: 0,
		};
		gameState.minions.push(drake);
		const floorY = floorYAt(gameState.layout, drake.x, drake.z);
		updateMinions();
		expect(drake.flying).toBeFalsy();
		expect(drake.altitude).toBeFalsy();
		expect(drake.y).toBe(floorY);
	});

	it('floor-snaps a grounded minion', () => {
		const grunt = {
			id: 'g1',
			ownerId: 'p1',
			type: 'skeleton_knight',
			x: -6,
			z: 3,
			hp: 50,
			maxHp: 50,
		};
		gameState.minions.push(grunt);
		const floorY = floorYAt(gameState.layout, grunt.x, grunt.z);
		updateMinions();
		expect(grunt.y).toBe(floorY);
	});
});
