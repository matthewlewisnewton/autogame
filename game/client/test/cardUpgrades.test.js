import { describe, it, expect } from 'vitest';
import { CARD_DEFS } from '../cards.js';
import {
	MAX_CARD_LEVEL,
	getUpgradeCost,
	getLevelStatMultiplier,
	canAffordUpgrade,
	getForgeStatPreview,
} from '../cardUpgrades.js';

describe('cardUpgrades helpers', () => {
	it('scales upgrade cost with current level', () => {
		expect(getUpgradeCost(1)).toBe(100);
		expect(getUpgradeCost(3)).toBe(300);
	});

	it('computes level stat multipliers', () => {
		expect(getLevelStatMultiplier(1)).toBe(1);
		expect(getLevelStatMultiplier(2)).toBeCloseTo(1.1);
	});

	it('detects affordable upgrades', () => {
		expect(canAffordUpgrade(100, 1)).toBe(true);
		expect(canAffordUpgrade(99, 1)).toBe(false);
		expect(canAffordUpgrade(9999, MAX_CARD_LEVEL)).toBe(false);
	});

	it('builds forge stat preview rows', () => {
		const rows = getForgeStatPreview(CARD_DEFS.battle_familiar, 1);
		expect(rows.some((row) => row.label === 'Level' && row.current === '1' && row.next === '2')).toBe(true);
		expect(rows.some((row) => row.label === 'Damage' && row.current === '40' && row.next === '44')).toBe(true);
	});
});
