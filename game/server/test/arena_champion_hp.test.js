import { describe, it, expect } from 'vitest';
import { ENEMY_DEFS } from '../index.js';

// Guards the open-plaza boss HP retune (ticket 285/02). arena_champion was the
// outlier at 500 HP, which could not be defeated within the 180s `defeatBoss`
// validation window at the driver's attack DPS. It was lowered to 420 to align
// with spire_warden (the next-highest stage boss). This test pins the new value
// and keeps it from drifting back above spire_warden.
describe('arena_champion stage-boss HP tuning', () => {
	it('arena_champion.hp is the retuned 420', () => {
		expect(ENEMY_DEFS.arena_champion.hp).toBe(420);
	});

	it('arena_champion.hp does not exceed spire_warden.hp', () => {
		expect(ENEMY_DEFS.arena_champion.hp).toBeLessThanOrEqual(
			ENEMY_DEFS.spire_warden.hp,
		);
	});

	it('arena_champion.hp is strictly below the old outlier value of 500', () => {
		expect(ENEMY_DEFS.arena_champion.hp).toBeLessThan(500);
	});

	it('boss identity fields are unchanged (only hp was retuned)', () => {
		const champ = ENEMY_DEFS.arena_champion;
		expect(champ.attackDamage).toBe(26);
		expect(champ.attackStyle).toBe('cone');
		expect(champ.attackConeAngle).toBe((2 * Math.PI) / 3);
		expect(champ.attackRange).toBe(6.5);
	});
});
