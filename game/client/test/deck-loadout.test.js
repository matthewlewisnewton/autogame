import { describe, it, expect } from 'vitest';
import {
	LOADOUT_TYPE_ORDER,
	loadoutTypeRank,
	groupLoadoutDeckEntries,
	sortLoadoutDeckGroups,
	buildLoadoutDeckDisplay,
} from '../deck-loadout.js';

const cardIdForEntry = (entryId) => entryId;

describe('loadoutTypeRank', () => {
	it('orders types like the Vanguard HUD breakdown', () => {
		expect(loadoutTypeRank('weapon')).toBeLessThan(loadoutTypeRank('spell'));
		expect(loadoutTypeRank('spell')).toBeLessThan(loadoutTypeRank('creature'));
		expect(loadoutTypeRank('creature')).toBeLessThan(loadoutTypeRank('enchantment'));
		expect(loadoutTypeRank('unknown')).toBe(LOADOUT_TYPE_ORDER.length);
	});
});

describe('groupLoadoutDeckEntries', () => {
	it('merges duplicate card ids at the same attune level into one group with count', () => {
		const groups = groupLoadoutDeckEntries(
			['iron_sword', 'iron_sword', 'flame_blade'],
			cardIdForEntry,
		);
		expect(groups).toHaveLength(2);
		const iron = groups.find((g) => g.cardId === 'iron_sword');
		expect(iron.count).toBe(2);
		expect(iron.grind).toBe(0);
		expect(iron.entryIds).toEqual(['iron_sword', 'iron_sword']);
	});

	it('keeps separate rows for the same card id at different attune levels', () => {
		const grindForEntry = (entryId) => ({ 'iron-a': 0, 'iron-b': 5, 'iron-c': 5 }[entryId] ?? 0);
		const groups = groupLoadoutDeckEntries(
			['iron-a', 'iron-b', 'iron-c'],
			(entryId) => 'iron_sword',
			grindForEntry,
		);
		expect(groups).toHaveLength(2);
		const plusZero = groups.find((g) => g.grind === 0);
		const plusFive = groups.find((g) => g.grind === 5);
		expect(plusZero.count).toBe(1);
		expect(plusFive.count).toBe(2);
		expect(plusFive.entryIds).toEqual(['iron-b', 'iron-c']);
	});
});

describe('buildLoadoutDeckDisplay', () => {
	it('sorts groups by type then name', () => {
		const rows = buildLoadoutDeckDisplay(
			['battle_familiar', 'iron_sword', 'flame_blade', 'dungeon_drake'],
			cardIdForEntry,
		);
		expect(rows.map((r) => r.def.type)).toEqual(['weapon', 'weapon', 'spell', 'creature']);
		expect(rows.map((r) => r.cardId)).toEqual(['iron_sword', 'flame_blade', 'battle_familiar', 'dungeon_drake']);
	});

	it('keeps duplicate entry ids on the grouped row', () => {
		const rows = buildLoadoutDeckDisplay(['iron_sword', 'iron_sword'], cardIdForEntry);
		expect(rows).toHaveLength(1);
		expect(rows[0].count).toBe(2);
	});
});

describe('sortLoadoutDeckGroups', () => {
	it('does not mutate the input array', () => {
		const input = groupLoadoutDeckEntries(['flame_blade', 'iron_sword'], cardIdForEntry);
		const copy = [...input];
		sortLoadoutDeckGroups(input);
		expect(input).toEqual(copy);
	});
});
