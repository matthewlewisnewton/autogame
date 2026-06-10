import { describe, it, expect, vi, afterEach } from 'vitest';
import {
	applySlow,
	applyBurning,
	isSlowed,
	isBurning,
} from '../simulation.js';
import {
	applyFreezeInRadius,
	createGameState,
	gameState,
	isEnemyFrozen,
} from '../index.js';

// BURNING (291) and SLOW/cold (290) are mutually exclusive on any entity: fire
// and ice cancel, so the most-recent application wins and the two are never
// active simultaneously. Enforcement lives inside applySlow / applyBurning, so
// players and enemies inherit it identically.

function makePlayer(overrides = {}) {
	return { id: 'p1', hp: 100, ...overrides };
}

function makeEnemy(overrides = {}) {
	return { id: 'e1', type: 'grunt', hp: 50, maxHp: 50, ...overrides };
}

describe('BURNING and SLOW mutual exclusion', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	for (const [label, factory] of [
		['player-shaped entity', makePlayer],
		['enemy-shaped entity', makeEnemy],
	]) {
		describe(label, () => {
			it('burning an already-slowed entity clears the slow, then ignites', () => {
				const now = 1_000_000;
				vi.useFakeTimers();
				vi.setSystemTime(now);
				const entity = factory();

				applySlow(entity, 5000, 0.5);
				expect(isSlowed(entity)).toBe(true);

				applyBurning(entity, 3000);
				expect(isBurning(entity)).toBe(true);
				expect(isSlowed(entity)).toBe(false);
				expect(entity.slowedUntil).toBe(0);
			});

			it('slowing an already-burning entity clears the burn, then slows', () => {
				const now = 1_000_000;
				vi.useFakeTimers();
				vi.setSystemTime(now);
				const entity = factory();

				applyBurning(entity, 5000);
				expect(isBurning(entity)).toBe(true);

				applySlow(entity, 3000, 0.5);
				expect(isSlowed(entity)).toBe(true);
				expect(isBurning(entity)).toBe(false);
				expect(entity.burningUntil).toBe(0);
			});

			it('clearing burn via applySlow also resets the burn tick clock', () => {
				const now = 1_000_000;
				vi.useFakeTimers();
				vi.setSystemTime(now);
				const entity = factory({ lastBurnTickAt: now - 9999 });

				applyBurning(entity, 5000);
				entity.lastBurnTickAt = now; // simulate an armed tick clock

				applySlow(entity, 3000, 0.5);
				expect(entity.lastBurnTickAt).toBe(null);
			});

			it('is never both burning and slowed regardless of application order', () => {
				const now = 1_000_000;
				vi.useFakeTimers();
				vi.setSystemTime(now);

				const slowFirst = factory();
				applySlow(slowFirst, 5000, 0.5);
				applyBurning(slowFirst, 5000);
				expect(isBurning(slowFirst) && isSlowed(slowFirst)).toBe(false);
				expect(isBurning(slowFirst)).toBe(true);

				const burnFirst = factory();
				applyBurning(burnFirst, 5000);
				applySlow(burnFirst, 5000, 0.5);
				expect(isBurning(burnFirst) && isSlowed(burnFirst)).toBe(false);
				expect(isSlowed(burnFirst)).toBe(true);
			});

			it('most-recent application wins across repeated toggles', () => {
				const now = 1_000_000;
				vi.useFakeTimers();
				vi.setSystemTime(now);
				const entity = factory();

				applySlow(entity, 5000, 0.5);
				applyBurning(entity, 5000);
				applySlow(entity, 5000, 0.5);
				expect(isSlowed(entity)).toBe(true);
				expect(isBurning(entity)).toBe(false);

				applyBurning(entity, 5000);
				expect(isBurning(entity)).toBe(true);
				expect(isSlowed(entity)).toBe(false);
			});
		});
	}

	it('both helpers remain null-safe', () => {
		expect(() => applySlow(null, 1000, 0.5)).not.toThrow();
		expect(() => applyBurning(null, 1000)).not.toThrow();
	});

	it('freezing a burning enemy clears burn and applies slow (permafrost path)', () => {
		const now = 1_000_000;
		vi.useFakeTimers();
		vi.setSystemTime(now);
		Object.assign(gameState, createGameState());
		gameState.enemies = [{ id: 'e1', type: 'grunt', x: 2, z: 0, hp: 50, maxHp: 50 }];
		const enemy = gameState.enemies[0];

		applyBurning(enemy, 5000);
		expect(isBurning(enemy)).toBe(true);

		applyFreezeInRadius(0, null, 0, 6, 2000, 0);
		expect(isBurning(enemy)).toBe(false);
		expect(isSlowed(enemy)).toBe(true);
		expect(isEnemyFrozen(enemy)).toBe(true);
	});
});
