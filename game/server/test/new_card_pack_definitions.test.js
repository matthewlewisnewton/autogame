import { describe, it, expect } from 'vitest';
import { CARD_DEFS } from '../index.js';
import { SHOP_CARD_POOL } from '../config.js';

describe('new card pack definitions', () => {
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
		// baseline: 42 cards as of initial pack
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
});
