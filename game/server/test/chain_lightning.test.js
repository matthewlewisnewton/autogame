import { describe, it, expect, beforeEach } from 'vitest';
import {
	CARD_DEFS,
	PROJECTILE_HIT_WIDTH,
	createGameState,
	gameState,
	collectChainLightningHits,
} from '../index.js';

function resetState() {
	Object.assign(gameState, createGameState());
}

function addEnemy(id, x, z, hp = 100, y = undefined) {
	gameState.enemies.push({
		id,
		type: 'grunt',
		x,
		y,
		z,
		hp,
		maxHp: hp,
	});
}

describe('collectChainLightningHits', () => {
	beforeEach(resetState);

	const baseDamage = CARD_DEFS.chain_lightning.damage;
	const chainDamage = Math.round(baseDamage * 0.5);
	const chainRadius = CARD_DEFS.chain_lightning.chainRadius;
	const attackRange = CARD_DEFS.chain_lightning.attackRange;

	it('hits three distinct enemies with full + half + half damage', () => {
		addEnemy('primary', 5, 0);
		addEnemy('chain1', 8, 0);
		addEnemy('chain2', 11, 0);

		const result = collectChainLightningHits(0, 0, 1, 0, attackRange, baseDamage, {
			chainRadius,
			maxChainTargets: 2,
		});

		expect(result.hits).toHaveLength(3);
		expect(result.hits.map((h) => h.enemyId)).toEqual(['primary', 'chain1', 'chain2']);
		expect(result.hits[0].damageDealt).toBe(baseDamage);
		expect(result.hits[1].damageDealt).toBe(chainDamage);
		expect(result.hits[2].damageDealt).toBe(chainDamage);
		expect(gameState.enemies.find((e) => e.id === 'primary').hp).toBe(100 - baseDamage);
		expect(gameState.enemies.find((e) => e.id === 'chain1').hp).toBe(100 - chainDamage);
		expect(gameState.enemies.find((e) => e.id === 'chain2').hp).toBe(100 - chainDamage);
	});

	it('hits only two enemies when two are available', () => {
		addEnemy('primary', 5, 0);
		addEnemy('chain1', 8, 0);

		const result = collectChainLightningHits(0, 0, 1, 0, attackRange, baseDamage, {
			chainRadius,
			maxChainTargets: 2,
		});

		expect(result.hits).toHaveLength(2);
		expect(result.hits.map((h) => h.enemyId)).toEqual(['primary', 'chain1']);
	});

	it('hits only the primary when one enemy is in range', () => {
		addEnemy('primary', 5, 0);

		const result = collectChainLightningHits(0, 0, 1, 0, attackRange, baseDamage, {
			chainRadius,
			maxChainTargets: 2,
		});

		expect(result.hits).toHaveLength(1);
		expect(result.hits[0].enemyId).toBe('primary');
		expect(result.hits[0].damageDealt).toBe(baseDamage);
	});

	it('skips enemies outside chainRadius even when they are nearest globally', () => {
		addEnemy('primary', 5, 0);
		addEnemy('outside', 5, 5.2);
		addEnemy('inside', 9, 2);

		const result = collectChainLightningHits(0, 0, 1, 0, attackRange, baseDamage, {
			chainRadius,
			maxChainTargets: 2,
		});

		expect(result.hits.map((h) => h.enemyId)).toEqual(['primary', 'inside']);
		expect(result.hits.some((h) => h.enemyId === 'outside')).toBe(false);
	});

	it('never damages the same enemy twice when multiple enemies overlap chain range', () => {
		addEnemy('primary', 5, 0);
		addEnemy('overlap-a', 6, 0);
		addEnemy('overlap-b', 6.2, 0.1);
		addEnemy('overlap-c', 6.1, -0.1);

		const result = collectChainLightningHits(0, 0, 1, 0, attackRange, baseDamage, {
			chainRadius,
			maxChainTargets: 2,
		});

		const enemyIds = result.hits.map((h) => h.enemyId);
		expect(new Set(enemyIds).size).toBe(enemyIds.length);
		expect(enemyIds[0]).toBe('primary');
		expect(enemyIds).toHaveLength(3);
	});

	it('does not chain when primary ray misses', () => {
		addEnemy('near-caster', 0, 2);

		const result = collectChainLightningHits(0, 0, 1, 0, attackRange, baseDamage, {
			chainRadius,
			maxChainTargets: 2,
		});

		expect(result.hits).toEqual([]);
		expect(result.magicStonesGained).toBe(0);
		expect(gameState.enemies.find((e) => e.id === 'near-caster').hp).toBe(100);
	});

	it('chains to an elevated enemy inside the 3D sphere and skips an XZ-near enemy above it on a level cast', () => {
		addEnemy('primary', 5, 0);
		// 3D distance from primary (floor Y 0.5): √(3² + 3²) ≈ 4.24 ≤ chainRadius (5)
		addEnemy('elevated', 8, 0, 100, 3.5);
		// XZ distance from primary ≈ 1.41 (inside chainRadius) but 3D ≈ √(1² + 10² + 1²) ≈ 10.1,
		// and still ≈ 7.35 from the elevated enemy after the first hop — never eligible
		addEnemy('too-high', 6, 1, 100, 10.5);

		const result = collectChainLightningHits(0, 0, 1, 0, attackRange, baseDamage, {
			chainRadius,
			maxChainTargets: 2,
		});

		expect(result.hits.map((h) => h.enemyId)).toEqual(['primary', 'elevated']);
		expect(gameState.enemies.find((e) => e.id === 'too-high').hp).toBe(100);
	});

	it('orders chain hops by 3D distance, not XZ distance', () => {
		addEnemy('primary', 5, 0);
		// XZ-nearest (1.0) but 3D from primary ≈ √(1² + 3.5²) ≈ 3.64
		addEnemy('xz-near-high', 6, 0, 100, 4);
		// XZ 3.0 and 3D 3.0 — nearer in 3D than xz-near-high
		addEnemy('xz-far-flat', 8, 0, 100, 0.5);

		const result = collectChainLightningHits(0, 0, 1, 0, attackRange, baseDamage, {
			chainRadius,
			maxChainTargets: 2,
		});

		expect(result.hits.map((h) => h.enemyId)).toEqual(['primary', 'xz-far-flat', 'xz-near-high']);
	});

	it('does not hit enemies beyond projectile range on the primary ray', () => {
		const outOfRangeMargin = 2;
		addEnemy('in-range', PROJECTILE_HIT_WIDTH, 0);
		addEnemy('out-of-range', attackRange + PROJECTILE_HIT_WIDTH + outOfRangeMargin, 0);

		const result = collectChainLightningHits(0, 0, 1, 0, attackRange, baseDamage, {
			chainRadius,
			maxChainTargets: 2,
		});

		expect(result.hits.map((h) => h.enemyId)).toEqual(['in-range']);
		expect(gameState.enemies.find((e) => e.id === 'out-of-range').hp).toBe(100);
	});
});
