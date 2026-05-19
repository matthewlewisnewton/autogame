import { describe, it, expect } from 'vitest';
import {
	CARD_DEFS,
	createStartingDeck,
	CARD_TYPE_STYLE,
	weaponCardIds,
	summonCardIds,
	monsterCardIds,
} from '../cards.js';

// ── CARD_DEFS ──

describe('CARD_DEFS', () => {
	it('has exactly 4 entries', () => {
		expect(Object.keys(CARD_DEFS)).toHaveLength(4);
	});

	it('contains iron_sword with correct type and charges', () => {
		expect(CARD_DEFS.iron_sword).toMatchObject({
			id: 'iron_sword',
			name: 'Iron Sword',
			type: 'weapon',
			charges: 5,
		});
	});

	it('contains flame_blade with correct type and charges', () => {
		expect(CARD_DEFS.flame_blade).toMatchObject({
			id: 'flame_blade',
			name: 'Flame Blade',
			type: 'weapon',
			charges: 3,
		});
	});

	it('contains battle_familiar with summon fields', () => {
		expect(CARD_DEFS.battle_familiar).toMatchObject({
			id: 'battle_familiar',
			name: 'Battle Familiar',
			type: 'summon',
			charges: 1,
			magicStoneCost: 50,
			damage: 40,
		});
	});

	it('contains dungeon_drake with correct type and charges', () => {
		expect(CARD_DEFS.dungeon_drake).toMatchObject({
			id: 'dungeon_drake',
			name: 'Dungeon Drake',
			type: 'monster',
			charges: 1,
		});
	});
});

// ── createStartingDeck ──

describe('createStartingDeck()', () => {
	it('returns exactly 8 card IDs', () => {
		expect(createStartingDeck()).toHaveLength(8);
	});

	it('has the expected composition', () => {
		const deck = createStartingDeck();
		expect(deck.filter((id) => id === 'iron_sword').length).toBe(3);
		expect(deck.filter((id) => id === 'flame_blade').length).toBe(2);
		expect(deck.filter((id) => id === 'battle_familiar').length).toBe(2);
		expect(deck.filter((id) => id === 'dungeon_drake').length).toBe(1);
	});

	it('is deterministic (same output every call)', () => {
		expect(createStartingDeck()).toEqual(createStartingDeck());
	});
});

// ── CARD_TYPE_STYLE ──

describe('CARD_TYPE_STYLE', () => {
	it('has an entry for weapon with color and icon', () => {
		expect(CARD_TYPE_STYLE.weapon).toHaveProperty('color');
		expect(CARD_TYPE_STYLE.weapon).toHaveProperty('icon');
		expect(typeof CARD_TYPE_STYLE.weapon.color).toBe('string');
		expect(typeof CARD_TYPE_STYLE.weapon.icon).toBe('string');
	});

	it('has an entry for summon with color and icon', () => {
		expect(CARD_TYPE_STYLE.summon).toHaveProperty('color');
		expect(CARD_TYPE_STYLE.summon).toHaveProperty('icon');
		expect(typeof CARD_TYPE_STYLE.summon.color).toBe('string');
		expect(typeof CARD_TYPE_STYLE.summon.icon).toBe('string');
	});

	it('has an entry for monster with color and icon', () => {
		expect(CARD_TYPE_STYLE.monster).toHaveProperty('color');
		expect(CARD_TYPE_STYLE.monster).toHaveProperty('icon');
		expect(typeof CARD_TYPE_STYLE.monster.color).toBe('string');
		expect(typeof CARD_TYPE_STYLE.monster.icon).toBe('string');
	});

	it('each type has a distinct color', () => {
		const colors = Object.values(CARD_TYPE_STYLE).map((s) => s.color);
		expect(new Set(colors).size).toBe(colors.length);
	});
});

// ── Card ID Sets ──

describe('card ID sets', () => {
	it('weaponCardIds contains the two weapon card IDs', () => {
		expect(weaponCardIds).toBeInstanceOf(Set);
		expect(weaponCardIds.has('iron_sword')).toBe(true);
		expect(weaponCardIds.has('flame_blade')).toBe(true);
		expect(weaponCardIds.has('battle_familiar')).toBe(false);
		expect(weaponCardIds.has('dungeon_drake')).toBe(false);
		expect(weaponCardIds.size).toBe(2);
	});

	it('summonCardIds contains the summon card ID', () => {
		expect(summonCardIds).toBeInstanceOf(Set);
		expect(summonCardIds.has('battle_familiar')).toBe(true);
		expect(summonCardIds.has('iron_sword')).toBe(false);
		expect(summonCardIds.size).toBe(1);
	});

	it('monsterCardIds contains the monster card ID', () => {
		expect(monsterCardIds).toBeInstanceOf(Set);
		expect(monsterCardIds.has('dungeon_drake')).toBe(true);
		expect(monsterCardIds.has('iron_sword')).toBe(false);
		expect(monsterCardIds.size).toBe(1);
	});
});
