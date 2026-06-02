import { describe, it, expect, beforeEach } from 'vitest';
import {
	gameState,
	createGameState,
	computeWalkableAABBs,
	updateEnemies,
	isInSmokeZone,
	spawnEnemy,
	MAX_HP,
} from '../index.js';

// ── Helpers ──

/**
 * Reset game state in-place so simulation._gameState (same object reference)
 * still sees the cleared contents.
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
	gameState.run = null;
	gameState.pendingTrades = {};
	gameState.shopOffer = null;
	gameState.telepipe = null;
	gameState.suspendedCheckpoint = null;
	gameState._pendingMinionBreaths = [];
}

function setupLayout() {
	const layout = {
		rooms: [{ x: 0, z: 0, width: 24, depth: 24, walls: [] }],
		passages: [],
	};
	gameState.layout = layout;
	gameState.walkableAABBs = computeWalkableAABBs(layout);
	gameState.dungeonBounds = { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };
}

/**
 * Create a player at (x, z). By default no active smoke zone.
 */
function createPlayer(id, x, z, overrides = {}) {
	return {
		id,
		x,
		y: 0.5,
		z,
		rotation: 0,
		hp: MAX_HP,
		dead: false,
		invulnerableUntil: 0,
		smokeBombUntil: 0,
		smokeBombX: 0,
		smokeBombZ: 0,
		smokeBombRadius: 0,
		...overrides,
	};
}

/** Stamp an active smoke zone on a player, centered at its current position. */
function smokePlayer(player, { radius = 4, durationMs = 2000 } = {}) {
	player.smokeBombUntil = Date.now() + durationMs;
	player.smokeBombX = player.x;
	player.smokeBombZ = player.z;
	player.smokeBombRadius = radius;
}

// ── isInSmokeZone ──

describe('isInSmokeZone(x, z)', () => {
	beforeEach(() => {
		resetState();
		setupLayout();
	});

	it('returns true inside the radius of an active zone, false outside', () => {
		const p = createPlayer('p1', 0, 0);
		smokePlayer(p, { radius: 4 });
		gameState.players.p1 = p;

		expect(isInSmokeZone(0, 0)).toBe(true); // at the center
		expect(isInSmokeZone(3.9, 0)).toBe(true); // just inside
		expect(isInSmokeZone(4.5, 0)).toBe(false); // just outside the radius
	});

	it('returns false once the zone has expired', () => {
		const p = createPlayer('p1', 0, 0);
		smokePlayer(p, { radius: 4 });
		p.smokeBombUntil = Date.now() - 1; // already expired
		gameState.players.p1 = p;

		expect(isInSmokeZone(0, 0)).toBe(false);
	});

	it('returns false for a dead player even with an active timestamp', () => {
		const p = createPlayer('p1', 0, 0, { dead: true });
		smokePlayer(p, { radius: 4 });
		gameState.players.p1 = p;

		expect(isInSmokeZone(0, 0)).toBe(false);
	});

	it('co-op: a caster zone protects any point in it, regardless of who stands there', () => {
		// Caster casts at (0,0); a second player standing at (2,0) is inside it.
		const caster = createPlayer('caster', 0, 0);
		smokePlayer(caster, { radius: 4 });
		const ally = createPlayer('ally', 2, 0); // no zone of their own
		gameState.players.caster = caster;
		gameState.players.ally = ally;

		expect(isInSmokeZone(ally.x, ally.z)).toBe(true);
	});
});

// ── Enemy targeting suppression ──

describe('Smoke Bomb — enemy targeting suppression', () => {
	beforeEach(() => {
		resetState();
		setupLayout();
	});

	it('does NOT acquire a player who is inside an active smoke zone', () => {
		const p = createPlayer('p1', 0, 0);
		smokePlayer(p);
		gameState.players.p1 = p;

		// Enemy within detection + attack range of the player
		const enemy = spawnEnemy(3, 0, 'grunt');

		updateEnemies();

		// No target acquired: enemy stays idle and never winds up
		expect(enemy.state).toBe('idle');
		expect(enemy.attackState).toBe('idle');
		expect(enemy.windupTargetId).toBeUndefined();
	});

	it('DOES acquire the same player once the smoke zone expires', () => {
		const p = createPlayer('p1', 0, 0);
		smokePlayer(p);
		gameState.players.p1 = p;
		const enemy = spawnEnemy(3, 0, 'grunt');

		// Sanity: suppressed while smoked
		updateEnemies();
		expect(enemy.attackState).toBe('idle');

		// Expire the zone
		p.smokeBombUntil = Date.now() - 1;
		updateEnemies();

		// Now within attack range → enters windup against the player
		expect(enemy.state).toBe('chasing');
		expect(enemy.attackState).toBe('windup');
		expect(enemy.windupTargetType).toBe('player');
		expect(enemy.windupTargetId).toBe('p1');
	});

	it('DOES acquire the player once they step outside the smoke radius', () => {
		// Zone fixed at (0,0); player walks out to (10,0) but zone is still active.
		const p = createPlayer('p1', 0, 0);
		smokePlayer(p);
		gameState.players.p1 = p;
		const enemy = spawnEnemy(6, 0, 'grunt');

		updateEnemies();
		expect(enemy.attackState).toBe('idle'); // suppressed while inside

		// Step outside the radius (zone center stays at 0,0)
		p.x = 10;
		updateEnemies();

		// Detected again (distance 4 < DETECTION_RADIUS) → chases
		expect(enemy.state).toBe('chasing');
	});

	it('still targets a non-smoked player when another player is smoked', () => {
		const smoked = createPlayer('smoked', 0, 0);
		smokePlayer(smoked);
		const exposed = createPlayer('exposed', 6, 0); // no zone
		gameState.players.smoked = smoked;
		gameState.players.exposed = exposed;

		// Enemy nearer the smoked player but should ignore them and chase exposed
		const enemy = spawnEnemy(2, 0, 'grunt');

		updateEnemies();

		expect(enemy.state).toBe('chasing');
		// It must have picked the exposed player as its windup/chase target
		if (enemy.attackState === 'windup') {
			expect(enemy.windupTargetId).toBe('exposed');
		}
	});

	it('cancels a mid-windup attack when the target enters the smoke (misses into the fog)', () => {
		const p = createPlayer('p1', 0, 0);
		gameState.players.p1 = p;
		const enemy = spawnEnemy(3, 0, 'grunt');

		// Put the enemy mid-windup against the player, windup already elapsed
		enemy.attackState = 'windup';
		enemy.windupTargetType = 'player';
		enemy.windupTargetId = 'p1';
		enemy.windupStartTime = Date.now() - 10000; // long past the windup duration

		// Player slips into a fresh smoke zone before the strike resolves
		smokePlayer(p);

		const hpBefore = p.hp;
		updateEnemies();

		expect(p.hp).toBe(hpBefore); // no damage dealt
		expect(enemy.attackState).toBe('chasing'); // attack cancelled
	});

	it('lands the windup hit when the target is NOT smoked (control)', () => {
		const p = createPlayer('p1', 0, 0);
		gameState.players.p1 = p;
		const enemy = spawnEnemy(3, 0, 'grunt');

		enemy.attackState = 'windup';
		enemy.windupTargetType = 'player';
		enemy.windupTargetId = 'p1';
		enemy.windupStartTime = Date.now() - 10000;

		const hpBefore = p.hp;
		updateEnemies();

		expect(p.hp).toBeLessThan(hpBefore); // damage landed
		expect(enemy.attackState).toBe('recovering');
	});
});
