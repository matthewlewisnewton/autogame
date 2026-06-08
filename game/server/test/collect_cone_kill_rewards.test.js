import { describe, it, expect, beforeEach } from 'vitest';
import {
	ATTACK_RANGE,
	createGameState,
	gameState,
	collectConeHits,
} from '../index.js';

function resetState() {
	Object.assign(gameState, createGameState());
}

describe('collectConeHits kill rewards', () => {
	beforeEach(resetState);

	it('accumulates heal and currency when a cone hit kills an enemy', () => {
		gameState.enemies = [{ id: 'e1', type: 'grunt', x: 3, z: 0, hp: 10 }];
		const result = collectConeHits(0, 0, 1, 0, ATTACK_RANGE, Math.PI / 2, 10, {
			healOnKill: 8,
			currencyOnKill: 6,
		});
		expect(result.hits).toHaveLength(1);
		expect(result.hpHealed).toBe(8);
		expect(result.currencyGained).toBe(6);
		expect(gameState.enemies[0].hp).toBe(0);
	});

	it('grants zero heal and currency when a cone hit does not kill', () => {
		gameState.enemies = [{ id: 'e1', type: 'grunt', x: 3, z: 0, hp: 40 }];
		const result = collectConeHits(0, 0, 1, 0, ATTACK_RANGE, Math.PI / 2, 10, {
			healOnKill: 8,
			currencyOnKill: 6,
		});
		expect(result.hits).toHaveLength(1);
		expect(result.hpHealed).toBe(0);
		expect(result.currencyGained).toBe(0);
		expect(gameState.enemies[0].hp).toBe(30);
	});

	it('defaults heal and currency rewards to zero when options are omitted', () => {
		gameState.enemies = [{ id: 'e1', type: 'grunt', x: 3, z: 0, hp: 10 }];
		const result = collectConeHits(0, 0, 1, 0, ATTACK_RANGE, Math.PI / 2, 10);
		expect(result.hpHealed).toBe(0);
		expect(result.currencyGained).toBe(0);
	});
});
