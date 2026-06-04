import { describe, it, expect } from 'vitest';
import {
	CARD_DEFS,
	COOLDOWN_MS,
} from '../index.js';
import { SHOP_CARD_POOL } from '../config.js';

describe('card registry', () => {
	const newCardIds = [
		'saber_of_light',
		'photon_slicer',
		'frost_nova',
		'healing_font',
		'skeleton_knight',
		'storm_eagle',
		'gravity_well',
		'echo_blade',
		'mana_leach',
		'dragons_breath',
		'arcane_bolt',
	];

	it('defines all eleven new cards with expected types', () => {
		// floor check — adding cards is data-only and should not break this test
		expect(Object.keys(CARD_DEFS).length).toBeGreaterThanOrEqual(42);
		for (const cardId of newCardIds) {
			expect(CARD_DEFS[cardId]).toBeDefined();
		}
		expect(CARD_DEFS.saber_of_light.type).toBe('weapon');
		expect(CARD_DEFS.photon_slicer.type).toBe('weapon');
		expect(CARD_DEFS.echo_blade.type).toBe('weapon');
		expect(CARD_DEFS.frost_nova.type).toBe('spell');
		expect(CARD_DEFS.healing_font.type).toBe('spell');
		expect(CARD_DEFS.gravity_well.type).toBe('spell');
		expect(CARD_DEFS.mana_leach.type).toBe('spell');
		expect(CARD_DEFS.dragons_breath.type).toBe('spell');
		expect(CARD_DEFS.arcane_bolt.type).toBe('weapon');
		expect(CARD_DEFS.skeleton_knight.type).toBe('creature');
		expect(CARD_DEFS.storm_eagle.type).toBe('creature');
	});

	it('defines Permafrost Lance with correct spell stats', () => {
		expect(CARD_DEFS.permafrost_lance).toMatchObject({
			type: 'spell',
			magicStoneCost: 30,
			damage: 8,
			radius: 6,
			freezeDurationMs: 2000,
			effect: 'frost_nova',
		});
	});

	it('includes Permafrost Lance in the shop card pool', () => {
		expect(SHOP_CARD_POOL).toContain('permafrost_lance');
	});

	it('Saber of Light uses a faster cooldown than default weapons', () => {
		expect(CARD_DEFS.saber_of_light.cooldownMs).toBeLessThan(COOLDOWN_MS);
		expect(CARD_DEFS.saber_of_light.damage).toBeLessThan(CARD_DEFS.iron_sword.damage);
	});

	it('Excalibur Photon inherits Saber stats with +50% damage and double swings', () => {
		expect(CARD_DEFS.excalibur_photon.damage).toBe(
			Math.round(CARD_DEFS.saber_of_light.damage * 1.5)
		);
		expect(CARD_DEFS.excalibur_photon.charges).toBe(CARD_DEFS.saber_of_light.charges);
		expect(CARD_DEFS.excalibur_photon.cooldownMs).toBeLessThan(CARD_DEFS.saber_of_light.cooldownMs);
		expect(CARD_DEFS.excalibur_photon.swingsPerUse).toBe(2);
	});
});
