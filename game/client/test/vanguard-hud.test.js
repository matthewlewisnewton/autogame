import { describe, it, expect } from 'vitest';
import {
	getHpBarTier,
	getMsBarTier,
	getCardMagicStoneCost,
	countDeckTypes,
	computeDeckHudStats,
	computeDesperationHudStats,
	formatCharacterId,
	formatPlayerLevel,
	resolveDeckEntryCardId,
} from '../vanguard-hud.js';

describe('getMsBarTier()', () => {
	it('returns high tier above 55%', () => {
		expect(getMsBarTier(100)).toBe('ms-high');
		expect(getMsBarTier(56)).toBe('ms-high');
	});

	it('returns mid tier between 25% and 55%', () => {
		expect(getMsBarTier(55)).toBe('ms-mid');
		expect(getMsBarTier(26)).toBe('ms-mid');
	});

	it('returns low tier at or below 25%', () => {
		expect(getMsBarTier(25)).toBe('ms-low');
		expect(getMsBarTier(0)).toBe('ms-low');
	});
});

describe('getCardMagicStoneCost()', () => {
	it('reads cost from card instance or definition', () => {
		expect(getCardMagicStoneCost({ id: 'battle_familiar', magicStoneCost: 50 })).toBe(50);
		expect(getCardMagicStoneCost({ id: 'battle_familiar' })).toBe(50);
		expect(getCardMagicStoneCost({ id: 'iron_sword' })).toBe(0);
		expect(getCardMagicStoneCost(null)).toBe(0);
	});
});

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

describe('resolveDeckEntryCardId()', () => {
	it('returns card ids directly and resolves inventory instance ids', () => {
		const inventory = [
			{ instanceId: 'inst-1', cardId: 'iron_sword' },
			{ instanceId: 'inst-2', cardId: 'battle_familiar' },
		];

		expect(resolveDeckEntryCardId('flame_blade', inventory)).toBe('flame_blade');
		expect(resolveDeckEntryCardId('inst-1', inventory)).toBe('iron_sword');
		expect(resolveDeckEntryCardId('inst-2', inventory)).toBe('battle_familiar');
		expect(resolveDeckEntryCardId('missing', inventory)).toBeNull();
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

	it('resolves inventory instance ids in the draw pile', () => {
		const inventory = [
			{ instanceId: 'inst-1', cardId: 'iron_sword' },
			{ instanceId: 'inst-2', cardId: 'flame_blade' },
			{ instanceId: 'inst-3', cardId: 'battle_familiar' },
			{ instanceId: 'inst-4', cardId: 'dungeon_drake' },
		];
		const deck = ['inst-1', 'inst-2', 'inst-3', 'inst-4', 'inst-1'];

		expect(countDeckTypes(deck, inventory)).toEqual({
			weapon: 3,
			spell: 1,
			creature: 1,
			enchantment: 0,
		});
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

	it('resolves inventory instance ids when counting draw pile types', () => {
		const inventory = [
			{ instanceId: 'inst-1', cardId: 'iron_sword' },
			{ instanceId: 'inst-2', cardId: 'flame_blade' },
			{ instanceId: 'inst-3', cardId: 'battle_familiar' },
		];
		const deck = ['inst-1', 'inst-2', 'inst-3'];
		const hand = [{ id: 'dungeon_drake', type: 'creature' }];

		expect(computeDeckHudStats(deck, hand, inventory)).toEqual({
			drawCount: 3,
			total: 4,
			label: 'Deck: 3/4',
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

describe('computeDesperationHudStats()', () => {
	it('formats desperation draw pile and counts desperation card types', () => {
		const stats = computeDesperationHudStats(
			['rusty_shiv', 'throw_rock', 'memory_shard'],
			[{ id: 'throw_rock', isDesperation: true }, null],
		);
		expect(stats).toEqual({
			drawCount: 3,
			total: 4,
			label: 'Desperation: 3 left',
			types: { weapon: 2, spell: 1, creature: 0, enchantment: 0 },
		});
	});

	it('shows in-hand label when the draw pile is empty', () => {
		expect(computeDesperationHudStats([], [{ id: 'rusty_shiv', isDesperation: true }])).toMatchObject({
			drawCount: 0,
			label: 'Desperation: in hand',
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
	it('returns the level from the player snapshot', () => {
		expect(formatPlayerLevel({ level: 3 })).toBe(3);
		expect(formatPlayerLevel({ level: 1 })).toBe(1);
	});

	it('floors fractional levels', () => {
		expect(formatPlayerLevel({ level: 4.9 })).toBe(4);
	});

	it('falls back to 1 for missing or invalid levels', () => {
		expect(formatPlayerLevel(null)).toBe(1);
		expect(formatPlayerLevel({})).toBe(1);
		expect(formatPlayerLevel({ level: NaN })).toBe(1);
		expect(formatPlayerLevel({ level: 0 })).toBe(1);
		expect(formatPlayerLevel({ level: -2 })).toBe(1);
	});
});
