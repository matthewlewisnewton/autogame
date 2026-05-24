import { describe, it, expect } from 'vitest';
import {
	getHpBarTier,
	countDeckTypes,
	computeDeckHudStats,
	formatCharacterId,
	formatPlayerLevel,
} from '../vanguard-hud.js';

describe('getHpBarTier()', () => {
	it('returns high tier above 50%', () => {
		expect(getHpBarTier(100)).toBe('hp-high');
		expect(getHpBarTier(51)).toBe('hp-high');
	});

	it('returns mid tier between 25% and 50%', () => {
		expect(getHpBarTier(50)).toBe('hp-mid');
		expect(getHpBarTier(26)).toBe('hp-mid');
	});

	it('returns low tier at or below 25%', () => {
		expect(getHpBarTier(25)).toBe('hp-low');
		expect(getHpBarTier(0)).toBe('hp-low');
	});
});

describe('countDeckTypes()', () => {
	it('counts weapon, spell, creature, and enchantment cards in the draw pile', () => {
		const deck = [
			'iron_sword',
			'flame_blade',
			'battle_familiar',
			'dungeon_drake',
			'iron_sword',
		];
		expect(countDeckTypes(deck)).toEqual({ weapon: 3, spell: 1, creature: 1, enchantment: 0 });
	});

	it('returns zero counts for missing or invalid input', () => {
		expect(countDeckTypes(null)).toEqual({ weapon: 0, spell: 0, creature: 0, enchantment: 0 });
		expect(countDeckTypes([])).toEqual({ weapon: 0, spell: 0, creature: 0, enchantment: 0 });
	});
});

describe('computeDeckHudStats()', () => {
	it('formats draw pile count and total including hand cards', () => {
		const deck = ['iron_sword', 'flame_blade', 'battle_familiar'];
		const hand = [
			{ id: 'iron_sword', type: 'weapon' },
			null,
			{ id: 'dungeon_drake', type: 'creature' },
			null,
		];

		expect(computeDeckHudStats(deck, hand)).toEqual({
			drawCount: 3,
			total: 5,
			label: 'Deck: 3/5',
			types: { weapon: 2, spell: 1, creature: 0, enchantment: 0 },
		});
	});

	it('handles empty deck and hand', () => {
		expect(computeDeckHudStats([], [])).toEqual({
			drawCount: 0,
			total: 0,
			label: 'Deck: 0/0',
			types: { weapon: 0, spell: 0, creature: 0, enchantment: 0 },
		});
	});
});

describe('formatCharacterId()', () => {
	it('uses the first two characters uppercased', () => {
		expect(formatCharacterId('abc123')).toBe('AB');
	});

	it('returns a placeholder when id is missing', () => {
		expect(formatCharacterId(null)).toBe('?');
	});
});

describe('formatPlayerLevel()', () => {
	it('returns the placeholder level', () => {
		expect(formatPlayerLevel()).toBe(1);
	});
});
