import { describe, it, expect } from 'vitest';
import {
	CARD_DEFS,
	createStartingDeck,
	CARD_TYPE_STYLE,
	CARD_ACCENT_STYLE,
	weaponCardIds,
	summonCardIds,
	monsterCardIds,
	EVOLUTION_TRANSFORMS,
} from '../cards.js';

// ── CARD_DEFS ──

describe('CARD_DEFS', () => {
	it('has base, evolved, synergistic, and pack card entries', () => {
		expect(Object.keys(CARD_DEFS)).toHaveLength(24);
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

	it('contains evolved cards with special effects', () => {
		for (const evolvedId of Object.values(EVOLUTION_TRANSFORMS)) {
			expect(CARD_DEFS[evolvedId]).toMatchObject({
				id: evolvedId,
				isEvolved: true,
				specialEffect: expect.any(String),
			});
		}
	});

	it('contains synergistic resource and charge cards', () => {
		expect(CARD_DEFS.mana_prism).toMatchObject({
			id: 'mana_prism',
			name: 'Mana Prism',
			type: 'summon',
			charges: 1,
			magicStoneCost: 0,
			effect: 'mana_prism',
		});
		expect(CARD_DEFS.harvesting_scythe).toMatchObject({
			id: 'harvesting_scythe',
			name: 'Harvesting Scythe',
			type: 'weapon',
			charges: 3,
		});
		expect(CARD_DEFS.sacrificial_altar).toMatchObject({
			id: 'sacrificial_altar',
			name: 'Sacrificial Altar',
			type: 'summon',
			charges: 1,
			magicStoneCost: 0,
			effect: 'sacrificial_altar',
		});
		expect(CARD_DEFS.battery_automaton).toMatchObject({
			id: 'battery_automaton',
			name: 'Battery Automaton',
			type: 'monster',
			charges: 1,
			magicStoneCost: 50,
			effect: 'battery_automaton',
		});
		expect(CARD_DEFS.chrono_trigger).toMatchObject({
			id: 'chrono_trigger',
			name: 'Chrono Trigger',
			type: 'summon',
			charges: 1,
			magicStoneCost: 0,
			effect: 'chrono_trigger',
			adjacentChargeRestore: 2,
		});
	});

	it('contains the new card pack entries', () => {
		expect(CARD_DEFS.saber_of_light).toMatchObject({
			id: 'saber_of_light',
			name: 'Saber of Light',
			type: 'weapon',
		});
		expect(CARD_DEFS.excalibur_photon).toMatchObject({
			id: 'excalibur_photon',
			name: 'Excalibur Photon',
			type: 'weapon',
			isEvolved: true,
			specialEffect: 'photon_barrage',
		});
		expect(EVOLUTION_TRANSFORMS.saber_of_light).toBe('excalibur_photon');
		expect(CARD_DEFS.photon_slicer).toMatchObject({
			id: 'photon_slicer',
			name: 'Photon Slicer',
			type: 'weapon',
			specialEffect: 'returning_projectile',
		});
		expect(CARD_DEFS.infinite_disk).toMatchObject({
			id: 'infinite_disk',
			name: 'Infinite Disk',
			type: 'weapon',
			charges: 4,
			isEvolved: true,
			specialEffect: 'triple_returning_projectile',
		});
		expect(EVOLUTION_TRANSFORMS.photon_slicer).toBe('infinite_disk');
		expect(CARD_DEFS.frost_nova).toMatchObject({
			id: 'frost_nova',
			name: 'Frost Nova',
			type: 'summon',
			effect: 'frost_nova',
		});
		expect(CARD_DEFS.glacier_collapse).toMatchObject({
			id: 'glacier_collapse',
			name: 'Glacier Collapse',
			type: 'summon',
			effect: 'glacier_collapse',
			isEvolved: true,
			specialEffect: 'shatter',
		});
		expect(EVOLUTION_TRANSFORMS.frost_nova).toBe('glacier_collapse');
		expect(CARD_DEFS.healing_font).toMatchObject({
			id: 'healing_font',
			name: 'Healing Font',
			type: 'summon',
			effect: 'healing_font',
		});
		expect(CARD_DEFS.divine_grace).toMatchObject({
			id: 'divine_grace',
			name: 'Divine Grace',
			type: 'summon',
			effect: 'divine_grace',
			healAmount: 38,
			magicStoneRestore: 10,
			isEvolved: true,
			specialEffect: 'heal_and_mana',
		});
		expect(EVOLUTION_TRANSFORMS.healing_font).toBe('divine_grace');
		expect(CARD_DEFS.skeleton_knight).toMatchObject({
			id: 'skeleton_knight',
			name: 'Skeleton Knight',
			type: 'monster',
		});
		expect(CARD_DEFS.storm_eagle).toMatchObject({
			id: 'storm_eagle',
			name: 'Storm Eagle',
			type: 'monster',
		});
		expect(CARD_DEFS.gravity_well).toMatchObject({
			id: 'gravity_well',
			name: 'Gravity Well',
			type: 'summon',
			effect: 'gravity_well',
		});
		expect(CARD_DEFS.echo_blade).toMatchObject({
			id: 'echo_blade',
			name: 'Echo Blade',
			type: 'weapon',
			specialEffect: 'shockwave',
		});
		expect(CARD_DEFS.mana_leach).toMatchObject({
			id: 'mana_leach',
			name: 'Mana Leach',
			type: 'summon',
		});
		expect(CARD_DEFS.dragons_breath).toMatchObject({
			id: 'dragons_breath',
			name: "Dragon's Breath",
			type: 'summon',
			effect: 'dragons_breath',
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
	it('weaponCardIds contains base, evolved, and synergistic weapon card IDs', () => {
		expect(weaponCardIds).toBeInstanceOf(Set);
		expect(weaponCardIds.has('iron_sword')).toBe(true);
		expect(weaponCardIds.has('flame_blade')).toBe(true);
		expect(weaponCardIds.has('steel_broadsword')).toBe(true);
		expect(weaponCardIds.has('inferno_edge')).toBe(true);
		expect(weaponCardIds.has('harvesting_scythe')).toBe(true);
		expect(weaponCardIds.has('saber_of_light')).toBe(true);
		expect(weaponCardIds.has('photon_slicer')).toBe(true);
		expect(weaponCardIds.has('infinite_disk')).toBe(true);
		expect(weaponCardIds.has('echo_blade')).toBe(true);
		expect(weaponCardIds.has('excalibur_photon')).toBe(true);
		expect(weaponCardIds.has('battle_familiar')).toBe(false);
		expect(weaponCardIds.has('dungeon_drake')).toBe(false);
		expect(weaponCardIds.size).toBe(9);
	});

	it('summonCardIds contains base, evolved, and synergistic summon card IDs', () => {
		expect(summonCardIds).toBeInstanceOf(Set);
		expect(summonCardIds.has('battle_familiar')).toBe(true);
		expect(summonCardIds.has('guardian_familiar')).toBe(true);
		expect(summonCardIds.has('mana_prism')).toBe(true);
		expect(summonCardIds.has('sacrificial_altar')).toBe(true);
		expect(summonCardIds.has('chrono_trigger')).toBe(true);
		expect(summonCardIds.has('frost_nova')).toBe(true);
		expect(summonCardIds.has('glacier_collapse')).toBe(true);
		expect(summonCardIds.has('healing_font')).toBe(true);
		expect(summonCardIds.has('divine_grace')).toBe(true);
		expect(summonCardIds.has('gravity_well')).toBe(true);
		expect(summonCardIds.has('mana_leach')).toBe(true);
		expect(summonCardIds.has('dragons_breath')).toBe(true);
		expect(summonCardIds.has('iron_sword')).toBe(false);
		expect(summonCardIds.size).toBe(11);
	});

	it('monsterCardIds contains base, evolved, and synergistic monster card IDs', () => {
		expect(monsterCardIds).toBeInstanceOf(Set);
		expect(monsterCardIds.has('dungeon_drake')).toBe(true);
		expect(monsterCardIds.has('ancient_drake')).toBe(true);
		expect(monsterCardIds.has('battery_automaton')).toBe(true);
		expect(monsterCardIds.has('skeleton_knight')).toBe(true);
		expect(monsterCardIds.has('storm_eagle')).toBe(true);
		expect(monsterCardIds.has('iron_sword')).toBe(false);
		expect(monsterCardIds.size).toBe(5);
	});

	it('CARD_ACCENT_STYLE defines icon and color for each new pack card', () => {
		const packIds = [
			'saber_of_light',
			'excalibur_photon',
			'photon_slicer',
			'frost_nova',
			'healing_font',
			'skeleton_knight',
			'storm_eagle',
			'gravity_well',
			'echo_blade',
			'mana_leach',
			'dragons_breath',
			'glacier_collapse',
		];
		for (const cardId of packIds) {
			expect(CARD_ACCENT_STYLE[cardId]).toMatchObject({
				color: expect.any(String),
				icon: expect.any(String),
			});
		}
		expect(CARD_ACCENT_STYLE.infinite_disk).toMatchObject({
			color: '#a5f3fc',
			icon: '∞',
		});
	});

	it('CARD_ACCENT_STYLE defines icon and color for Divine Grace', () => {
		expect(CARD_ACCENT_STYLE.divine_grace).toMatchObject({
			color: '#fde68a',
			icon: '✧',
		});
	});
});
