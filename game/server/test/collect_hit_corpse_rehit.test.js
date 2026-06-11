import { describe, it, expect, beforeEach } from 'vitest';
import {
	ATTACK_RANGE,
	createGameState,
	gameState,
	collectConeHits,
	collectRadialHits,
} from '../index.js';

function resetState() {
	Object.assign(gameState, createGameState());
}

describe('collectConeHits / collectRadialHits — skip corpses on multi-swing re-hit', () => {
	beforeEach(resetState);

	it('grants magicStoneOnHit only once when two cone swings kill the same enemy', () => {
		const damage = 10;
		gameState.enemies = [{ id: 'e1', type: 'grunt', x: 3, z: 0, hp: damage }];
		const options = { magicStoneOnHit: 5 };
		let totalMagicStones = 0;

		for (let swing = 0; swing < 2; swing++) {
			const result = collectConeHits(0, 0, 1, 0, ATTACK_RANGE, Math.PI / 2, damage, options);
			totalMagicStones += result.magicStonesGained;
			if (swing === 1) {
				expect(result.hits).toHaveLength(0);
			}
		}

		expect(totalMagicStones).toBe(5);
		expect(gameState.enemies[0].hp).toBeLessThanOrEqual(0);
	});

	it('grants magicStoneOnHit only once when two radial swings kill the same enemy', () => {
		const damage = 10;
		const radius = 5;
		gameState.enemies = [{ id: 'e1', type: 'grunt', x: 3, z: 0, hp: damage }];
		const options = { magicStoneOnHit: 8 };
		let totalMagicStones = 0;

		for (let swing = 0; swing < 2; swing++) {
			const result = collectRadialHits(0, null, 0, radius, damage, options);
			totalMagicStones += result.magicStonesGained;
			if (swing === 1) {
				expect(result.hits).toHaveLength(0);
			}
		}

		expect(totalMagicStones).toBe(8);
		expect(gameState.enemies[0].hp).toBeLessThanOrEqual(0);
	});
});
