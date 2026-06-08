import { describe, it, expect } from 'vitest';
import {
	CARD_DEFS,
	ATTACK_RANGE,
	GRIND_STAT_SCALE,
	scaledGrindArea,
} from '../index.js';

// saber_of_light gets a tiny, opt-in per-grind reach (attackRange) increase
// while keeping its base damage (12) and cooldown (400ms). The growth is much
// smaller than the standard damage grind rate, and grind 0 is unchanged.
describe('saber_of_light per-grind AoE/reach scaling', () => {
	const saber = CARD_DEFS.saber_of_light;

	it('keeps saber fast: damage and cooldown are unchanged', () => {
		expect(saber.damage).toBe(12);
		expect(saber.cooldownMs).toBe(400);
		expect(saber.specialEffect).toBe('swift_slash');
	});

	it('exposes an explicit base attackRange equal to the server default', () => {
		expect(saber.attackRange).toBe(ATTACK_RANGE);
	});

	it('opts in via a grindAreaScale strictly smaller than the damage grind rate', () => {
		expect(saber.grindAreaScale).toBeGreaterThan(0);
		expect(saber.grindAreaScale).toBeLessThan(GRIND_STAT_SCALE);
		expect(saber.grindAreaScale).toBeLessThanOrEqual(0.02);
	});

	it('reach at grind 0 equals the base value (no regression un-ground)', () => {
		const base = saber.attackRange;
		expect(scaledGrindArea(base, 0, saber.grindAreaScale)).toBe(base);
	});

	it('reach at a higher grind is larger than at grind 0', () => {
		const base = saber.attackRange;
		const reach0 = scaledGrindArea(base, 0, saber.grindAreaScale);
		const reach5 = scaledGrindArea(base, 5, saber.grindAreaScale);
		expect(reach5).toBeGreaterThan(reach0);
		// base * (1 + 5 * 0.02) = base * 1.1, kept as a smooth float (no rounding).
		expect(reach5).toBeCloseTo(base * (1 + 5 * saber.grindAreaScale), 10);
	});

	it('floors fractional grind and clamps negatives to grind 0', () => {
		const base = saber.attackRange;
		expect(scaledGrindArea(base, 2.9, saber.grindAreaScale))
			.toBeCloseTo(base * (1 + 2 * saber.grindAreaScale), 10);
		expect(scaledGrindArea(base, -3, saber.grindAreaScale)).toBe(base);
	});

	it('is saber-scoped: no other card carries grindAreaScale', () => {
		const carriers = Object.entries(CARD_DEFS)
			.filter(([, def]) => def && def.grindAreaScale != null)
			.map(([id]) => id);
		expect(carriers).toEqual(['saber_of_light']);
	});
});
