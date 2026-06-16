import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	resetGameState,
	gameState,
	applyBurning,
	updateBurning,
} from '../index.js';

// Burn DoT each tick deals 5 (see above); an enemy at low HP dies purely to burn.

// Each burn tick deals BURN_BASE_TICK_DAMAGE + BURN_EXTRA_FIRE_DAMAGE (4 + 1 = 5)
// every BURN_TICK_INTERVAL_MS (500ms).
const TICK_INTERVAL = 500;
const TICK_DAMAGE = 5;
const START = 1_000_000;

function resetState() {
	resetGameState();
	gameState.gamePhase = 'playing';
	gameState.run = { status: 'playing' };
}

function addPlayer(id, overrides = {}) {
	gameState.players[id] = {
		id,
		x: 0,
		y: 0.5,
		z: 0,
		hp: 100,
		dead: false,
		...overrides,
	};
	return gameState.players[id];
}

function addEnemy(id, overrides = {}) {
	const enemy = { id, type: 'grunt', x: 0, y: 0, z: 0, hp: 100, ...overrides };
	gameState.enemies.push(enemy);
	return enemy;
}

describe('updateBurning() periodic damage', () => {
	beforeEach(() => {
		resetState();
		vi.useFakeTimers();
		vi.setSystemTime(START);
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('a burning player loses HP over successive ticks and stops after expiry', () => {
		const player = addPlayer('p1', { hp: 100 });
		applyBurning(player, 2000); // burningUntil = START + 2000

		// First pass arms the tick clock; no damage on the same frame.
		updateBurning();
		expect(player.hp).toBe(100);

		vi.setSystemTime(START + TICK_INTERVAL);
		updateBurning();
		expect(player.hp).toBe(100 - TICK_DAMAGE);

		vi.setSystemTime(START + 2 * TICK_INTERVAL);
		updateBurning();
		expect(player.hp).toBe(100 - 2 * TICK_DAMAGE);

		vi.setSystemTime(START + 3 * TICK_INTERVAL);
		updateBurning();
		expect(player.hp).toBe(100 - 3 * TICK_DAMAGE);

		// At/after expiry (START + 2000) the entity is no longer burning.
		const hpAtExpiry = player.hp;
		vi.setSystemTime(START + 2000);
		updateBurning();
		vi.setSystemTime(START + 5000);
		updateBurning();
		expect(player.hp).toBe(hpAtExpiry);
	});

	it('a burning enemy loses HP over successive ticks and stops after expiry', () => {
		const enemy = addEnemy('e1', { hp: 100 });
		applyBurning(enemy, 2000);

		updateBurning();
		expect(enemy.hp).toBe(100);

		vi.setSystemTime(START + TICK_INTERVAL);
		updateBurning();
		expect(enemy.hp).toBe(100 - TICK_DAMAGE);

		vi.setSystemTime(START + 2 * TICK_INTERVAL);
		updateBurning();
		expect(enemy.hp).toBe(100 - 2 * TICK_DAMAGE);

		const hpBeforeExpiry = enemy.hp;
		vi.setSystemTime(START + 5000);
		updateBurning();
		expect(enemy.hp).toBe(hpBeforeExpiry);
	});

	it('a debugGodmode player takes no burn damage', () => {
		const player = addPlayer('god', { hp: 100, debugGodmode: true });
		applyBurning(player, 5000);

		updateBurning();
		vi.setSystemTime(START + TICK_INTERVAL);
		updateBurning();
		vi.setSystemTime(START + 4 * TICK_INTERVAL);
		updateBurning();

		expect(player.hp).toBe(100);
	});

	it('dead and extracted players are skipped', () => {
		const dead = addPlayer('dead', { hp: 100, dead: true });
		const extracted = addPlayer('out', { hp: 100, extracted: true });
		applyBurning(dead, 5000);
		applyBurning(extracted, 5000);

		updateBurning();
		vi.setSystemTime(START + TICK_INTERVAL);
		updateBurning();

		expect(dead.hp).toBe(100);
		expect(extracted.hp).toBe(100);
	});

	it('re-application keeps an entity taking burn damage past the original expiry', () => {
		const player = addPlayer('p1', { hp: 100 });
		applyBurning(player, 2000); // original expiry START + 2000

		updateBurning();
		vi.setSystemTime(START + TICK_INTERVAL);
		updateBurning();
		expect(player.hp).toBe(100 - TICK_DAMAGE);

		// Re-apply before expiry, extending the burn well past the original window.
		applyBurning(player, 3000); // now burningUntil = START + 500 + 3000 = START + 3500

		// Past the ORIGINAL expiry (2000) the player keeps taking damage.
		vi.setSystemTime(START + 2500);
		updateBurning();
		expect(player.hp).toBeLessThan(100 - TICK_DAMAGE);
		const hpAfterRefresh = player.hp;

		// After the refreshed expiry, damage stops.
		vi.setSystemTime(START + 6000);
		updateBurning();
		expect(player.hp).toBe(hpAfterRefresh);
	});

	it('an enemy killed purely by burn is reaped within the same updateBurning() tick', () => {
		// cleanupAfterDamage → recordEnemyDefeated needs a concrete objective.
		gameState.run.objective = { type: 'defeat_enemies', current: 0, target: 5 };
		// HP below one tick of burn damage so the burn alone finishes it.
		const enemy = addEnemy('e_burn_kill', { hp: TICK_DAMAGE - 1 });
		applyBurning(enemy, 5000);

		updateBurning(); // arm the clock — no damage yet
		expect(gameState.enemies.some((e) => e.id === 'e_burn_kill')).toBe(true);

		// Next tick deals lethal burn damage AND must clean up the corpse this pass
		// (cleanupAfterDamage), not defer it to a later tick.
		vi.setSystemTime(START + TICK_INTERVAL);
		updateBurning();

		expect(gameState.enemies.some((e) => e.id === 'e_burn_kill')).toBe(false);
	});

	it('a re-ignition after a gap does not dump a burst of catch-up ticks', () => {
		const player = addPlayer('p1', { hp: 100 });
		applyBurning(player, 1000);

		updateBurning(); // arm
		vi.setSystemTime(START + TICK_INTERVAL);
		updateBurning();
		expect(player.hp).toBe(100 - TICK_DAMAGE);

		// Let the burn expire and a long time pass with several updateBurning calls.
		vi.setSystemTime(START + 1000);
		updateBurning();
		vi.setSystemTime(START + 50_000);
		updateBurning();
		const hpBeforeReignite = player.hp;

		// Re-ignite: the next pass arms a fresh clock; no giant catch-up burst.
		applyBurning(player, 1000);
		updateBurning();
		expect(player.hp).toBe(hpBeforeReignite);

		vi.setSystemTime(START + 50_000 + TICK_INTERVAL);
		updateBurning();
		expect(player.hp).toBe(hpBeforeReignite - TICK_DAMAGE);
	});
});
