import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	resetGameState,
	gameState,
	isBurning,
	updateMinions,
} from '../index.js';

function resetState() {
	resetGameState();
	gameState.gamePhase = 'playing';
	gameState.players.p1 = {
		id: 'p1',
		x: 0,
		z: 0,
		hp: 100,
		dead: false,
		lastActivity: Date.now(),
	};
}

function spawnVaultWyrmMinion(overrides = {}) {
	gameState.minions.push({
		id: 'drake-1',
		ownerId: 'p1',
		type: 'dungeon_drake',
		x: 0,
		z: 0,
		hp: 20,
		ttl: 30,
		breathRange: 6,
		breathHoldDistance: 3.5,
		breathConeAngle: Math.PI / 4,
		breathDamage: 2,
		burnDurationMs: 2000,
		breathDurationMs: 2000,
		breathTickMs: 500,
		breathIntervalMs: 2500,
		lastBreathAt: 0,
		...overrides,
	});
}

describe('Vault Wyrm breath burning', () => {
	beforeEach(() => {
		resetState();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('does not damage or burn an enemy outside the breath cone', () => {
		const now = 1_000_000;
		vi.useFakeTimers();
		vi.setSystemTime(now);

		gameState.enemies.push({
			id: 'e1',
			x: 0,
			z: 6,
			hp: 50,
			state: 'idle',
			wanderTarget: { x: 0, z: 6 },
		});
		spawnVaultWyrmMinion({
			breathState: 'breathing',
			breathStartedAt: now,
			breathDirX: 1,
			breathDirZ: 0,
			lastBreathTickAt: now - 500,
		});

		updateMinions();

		expect(gameState.enemies[0].hp).toBe(50);
		expect(isBurning(gameState.enemies[0])).toBe(false);
		expect(gameState.enemies[0].burningUntil).toBeUndefined();
	});

	it('extends burningUntil on subsequent breath ticks without shortening', () => {
		const now = 1_000_000;
		vi.useFakeTimers();
		vi.setSystemTime(now);

		gameState.enemies.push({
			id: 'e1',
			x: 4,
			z: 0,
			hp: 50,
			state: 'idle',
			wanderTarget: { x: 4, z: 0 },
		});
		spawnVaultWyrmMinion();

		updateMinions();

		const firstExpiry = gameState.enemies[0].burningUntil;
		expect(firstExpiry).toBe(now + 2000);

		vi.setSystemTime(now + 500);
		updateMinions();

		expect(gameState.enemies[0].burningUntil).toBeGreaterThan(firstExpiry);
		expect(gameState.enemies[0].burningUntil).toBe(now + 500 + 2000);
	});

	it('does not apply burning for Archive Wyrm breath hits', () => {
		const now = 1_000_000;
		vi.useFakeTimers();
		vi.setSystemTime(now);

		gameState.enemies.push({
			id: 'e1',
			x: 6,
			z: 0,
			hp: 50,
			state: 'idle',
			wanderTarget: { x: 6, z: 0 },
		});
		gameState.minions.push({
			id: 'wyrm-1',
			ownerId: 'p1',
			type: 'ancient_wyrm',
			x: 0,
			z: 0,
			hp: 90,
			ttl: 30,
			lastBreathAt: now - 3100,
			breathIntervalMs: 3000,
			breathRange: 10,
			breathHoldDistance: 5.5,
			breathDamage: 4,
			breathConeAngle: Math.PI / 3,
			breathDurationMs: 2500,
			breathTickMs: 500,
		});

		updateMinions();

		expect(gameState.enemies[0].hp).toBe(46);
		expect(isBurning(gameState.enemies[0])).toBe(false);
	});
});
