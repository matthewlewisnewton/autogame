import { describe, it, expect, beforeEach } from 'vitest';
import {
	CARD_DEFS,
	createGameState,
	gameState,
	collectConeHits,
	healPlayer,
} from '../index.js';
import { MAX_HP } from '../config.js';

function resetState() {
	Object.assign(gameState, createGameState());
}

describe('Soul Reaper kill rewards', () => {
	beforeEach(resetState);

	it('base Ether Scythe card def has no gold or heal on kill', () => {
		expect(CARD_DEFS.harvesting_scythe.goldOnKill).toBeUndefined();
		expect(CARD_DEFS.harvesting_scythe.healOnKill).toBeUndefined();
	});

	it('collectConeHits grants gold and heal only on kill', () => {
		const def = CARD_DEFS.soul_reaper;
		gameState.enemies = [
			{ id: 'hit-only', type: 'grunt', x: 3, z: 0, hp: 50 },
			{ id: 'killed', type: 'grunt', x: 4, z: 0, hp: 8 },
		];

		const result = collectConeHits(0, 0, 1, 0, def.attackRange || 5, def.attackConeAngle || Math.PI, def.damage, {
			magicStoneOnHit: def.magicStoneOnHit,
			magicStoneOnKill: def.magicStoneOnKill,
			goldOnKill: def.goldOnKill,
			healOnKill: def.healOnKill,
		});

		expect(result.goldGained).toBe(def.goldOnKill);
		expect(result.hpHealed).toBe(def.healOnKill);
		expect(result.magicStonesGained).toBe(def.magicStoneOnHit + def.magicStoneOnHit + def.magicStoneOnKill);
		expect(gameState.enemies.find(e => e.id === 'killed').hp).toBe(0);
		expect(gameState.enemies.find(e => e.id === 'hit-only').hp).toBe(50 - def.damage);
	});

	it('collectConeHits with goldOnKill/healOnKill grants neither on hit-only', () => {
		gameState.enemies = [
			{ id: 'survivor', type: 'grunt', x: 3, z: 0, hp: 50 },
		];

		const result = collectConeHits(0, 0, 1, 0, 5, Math.PI, CARD_DEFS.soul_reaper.damage, {
			goldOnKill: 3,
			healOnKill: 5,
		});

		expect(result.goldGained).toBe(0);
		expect(result.hpHealed).toBe(0);
		expect(gameState.enemies).toHaveLength(1);
	});

	it('collectConeHits healOnKill tally respects MAX_HP when applied via healPlayer', () => {
		gameState.players.p1 = { x: 0, z: 0, hp: MAX_HP - 2, dead: false };
		gameState.enemies = [
			{ id: 'killed', type: 'grunt', x: 3, z: 0, hp: 8 },
		];

		const result = collectConeHits(0, 0, 1, 0, 5, Math.PI, CARD_DEFS.soul_reaper.damage, {
			healOnKill: 5,
		});

		expect(result.hpHealed).toBe(5);
		const applied = healPlayer('p1', result.hpHealed);
		expect(applied).toBe(2);
		expect(gameState.players.p1.hp).toBe(MAX_HP);
	});
});
