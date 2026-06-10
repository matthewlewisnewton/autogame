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
	const enemy = {
		id,
		type: 'grunt',
		x,
		z,
		hp,
		maxHp: hp,
	};
	if (y !== undefined) enemy.y = y;
	gameState.enemies.push(enemy);
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

	it('chains to an elevated neighbor within vertical range on flat primary aim', () => {
		addEnemy('primary', 5, 0);
		addEnemy('chain', 8, 0, 100, 3);

		const result = collectChainLightningHits(0, 0, 1, 0, attackRange, baseDamage, {
			chainRadius,
			maxChainTargets: 1,
		});

		expect(result.hits.map((h) => h.enemyId)).toEqual(['primary', 'chain']);
	});

	it('skips an elevated neighbor beyond vertical range on flat primary aim', () => {
		addEnemy('primary', 5, 0);
		addEnemy('too-high', 8, 0, 100, 6);

		const result = collectChainLightningHits(0, 0, 1, 0, attackRange, baseDamage, {
			chainRadius,
			maxChainTargets: 1,
		});

		expect(result.hits.map((h) => h.enemyId)).toEqual(['primary']);
	});
});
