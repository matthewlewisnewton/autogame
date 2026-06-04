import { describe, it, expect } from 'vitest';
import {
	CARD_DEFS,
	createStartingDeck,
	CARD_TYPE_STYLE,
	CARD_ACCENT_STYLE,
	weaponCardIds,
	spellCardIds,
	creatureCardIds,
	EVOLUTION_TRANSFORMS,
} from '../cards.js';

// ── CARD_DEFS ──

describe('CARD_DEFS', () => {
	it('has base, evolved, synergistic, and pack card entries', () => {
		expect(Object.keys(CARD_DEFS)).toHaveLength(41);
	});

	it('contains iron_sword with correct type and charges', () => {
		expect(CARD_DEFS.iron_sword).toMatchObject({
			id: 'iron_sword',
			name: 'Rust-Forged Saber',
			type: 'weapon',
			charges: 5,
		});
	});

	it('contains flame_blade with correct type and charges', () => {
		expect(CARD_DEFS.flame_blade).toMatchObject({
			id: 'flame_blade',
			name: 'Solar Edge',
			type: 'weapon',
			charges: 3,
		});
	});

	it('contains magma_greatsword evolved weapon with fire trail', () => {
		expect(CARD_DEFS.magma_greatsword).toMatchObject({
			id: 'magma_greatsword',
			name: 'Corebreaker Greatsword',
			type: 'weapon',
			charges: 4,
			isEvolved: true,
			specialEffect: 'fire_trail',
		});
		expect(EVOLUTION_TRANSFORMS.flame_blade).toBe('magma_greatsword');
	});

	it('contains battle_familiar with summon fields', () => {
		expect(CARD_DEFS.battle_familiar).toMatchObject({
			id: 'battle_familiar',
			name: 'Signal Familiar',
			type: 'spell',
			charges: 1,
			magicStoneCost: 50,
			damage: 44,
		});
	});

	it('contains dungeon_drake with correct type and charges', () => {
		expect(CARD_DEFS.dungeon_drake).toMatchObject({
			id: 'dungeon_drake',
			name: 'Vault Wyrm',
			type: 'creature',
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
			type: 'spell',
			charges: 1,
			magicStoneCost: 0,
			effect: 'mana_prism',
		});
		expect(CARD_DEFS.harvesting_scythe).toMatchObject({
			id: 'harvesting_scythe',
			name: 'Ether Scythe',
			type: 'weapon',
			charges: 3,
		});
		expect(CARD_DEFS.sacrificial_altar).toMatchObject({
			id: 'sacrificial_altar',
			name: 'Offering Terminal',
			type: 'spell',
			charges: 1,
			magicStoneCost: 0,
			effect: 'sacrificial_altar',
		});
		expect(CARD_DEFS.battery_automaton).toMatchObject({
			id: 'battery_automaton',
			name: 'Battery Automaton',
			type: 'creature',
			charges: 1,
			magicStoneCost: 50,
			effect: 'battery_automaton',
		});
		expect(CARD_DEFS.chrono_trigger).toMatchObject({
			id: 'chrono_trigger',
			name: 'Chrono Trigger',
			type: 'spell',
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
		expect(CARD_DEFS.arcane_bolt).toMatchObject({
			id: 'arcane_bolt',
			name: 'Arcane Bolt',
			type: 'weapon',
			charges: 4,
			attackRange: 10,
			specialEffect: 'long_range',
		});
		expect(CARD_ACCENT_STYLE.arcane_bolt).toMatchObject({ color: '#a78bfa', icon: '⟡' });
		expect(CARD_DEFS.frost_nova).toMatchObject({
			id: 'frost_nova',
			name: 'Cryo Burst',
			type: 'spell',
			effect: 'frost_nova',
		});
		expect(CARD_DEFS.glacier_collapse).toMatchObject({
			id: 'glacier_collapse',
			name: 'Glacier Rupture',
			type: 'spell',
			effect: 'glacier_collapse',
			isEvolved: true,
			specialEffect: 'shatter',
		});
		expect(EVOLUTION_TRANSFORMS.frost_nova).toBe('glacier_collapse');
		expect(CARD_DEFS.healing_font).toMatchObject({
			id: 'healing_font',
			name: 'Restoration Beacon',
			type: 'spell',
			effect: 'healing_font',
		});
		expect(CARD_DEFS.divine_grace).toMatchObject({
			id: 'divine_grace',
			name: 'Sanctum Pulse',
			type: 'spell',
			effect: 'divine_grace',
			healAmount: 38,
			magicStoneRestore: 10,
			isEvolved: true,
			specialEffect: 'heal_and_mana',
		});
		expect(EVOLUTION_TRANSFORMS.healing_font).toBe('divine_grace');
		expect(CARD_DEFS.skeleton_knight).toMatchObject({
			id: 'skeleton_knight',
			name: 'Necroframe Knight',
			type: 'creature',
		});
		expect(CARD_DEFS.undead_commander).toMatchObject({
			id: 'undead_commander',
			name: 'Legion Marshal',
			type: 'creature',
			isEvolved: true,
			specialEffect: 'summon_skeletons',
		});
		expect(EVOLUTION_TRANSFORMS.skeleton_knight).toBe('undead_commander');
		expect(CARD_DEFS.storm_eagle).toMatchObject({
			id: 'storm_eagle',
			name: 'Stormwing Drone',
			type: 'creature',
		});
		expect(CARD_DEFS.thunderbird).toMatchObject({
			id: 'thunderbird',
			name: 'Thunderbird',
			type: 'creature',
			isEvolved: true,
			specialEffect: 'chain_lightning',
		});
		expect(CARD_DEFS.gravity_well).toMatchObject({
			id: 'gravity_well',
			name: 'Gravity Well',
			type: 'spell',
			effect: 'gravity_well',
		});
		expect(CARD_DEFS.event_horizon).toMatchObject({
			id: 'event_horizon',
			name: 'Event Horizon',
			type: 'spell',
			effect: 'event_horizon',
			isEvolved: true,
			specialEffect: 'crush',
		});
		expect(EVOLUTION_TRANSFORMS.gravity_well).toBe('event_horizon');
		expect(CARD_DEFS.echo_blade).toMatchObject({
			id: 'echo_blade',
			name: 'Phase Echo',
			type: 'weapon',
			specialEffect: 'shockwave',
		});
		expect(CARD_DEFS.resonance_edge).toMatchObject({
			id: 'resonance_edge',
			name: 'Resonance Edge',
			type: 'weapon',
			isEvolved: true,
			specialEffect: 'shockwave',
		});
		expect(CARD_DEFS.mana_leach).toMatchObject({
			id: 'mana_leach',
			name: 'Ether Siphon',
			type: 'spell',
		});
		expect(CARD_DEFS.soul_drain).toMatchObject({
			id: 'soul_drain',
			name: 'Soul Drain',
			type: 'spell',
			isEvolved: true,
			specialEffect: 'soul_drain',
		});
		expect(EVOLUTION_TRANSFORMS.mana_leach).toBe('soul_drain');
		expect(CARD_ACCENT_STYLE.soul_drain).toMatchObject({
			color: '#e879f9',
			icon: '☠',
		});
		expect(CARD_DEFS.dragons_breath).toMatchObject({
			id: 'dragons_breath',
			name: "Wyrmflare",
			type: 'spell',
			effect: 'dragons_breath',
		});
		expect(CARD_DEFS.inferno_pillar).toMatchObject({
			id: 'inferno_pillar',
			name: 'Thermal Column',
			type: 'spell',
			effect: 'inferno_pillar',
			isEvolved: true,
			specialEffect: 'fire_dot',
		});
	});
});

// ── createStartingDeck ──

describe('createStartingDeck()', () => {
	it('returns exactly 12 card IDs', () => {
		expect(createStartingDeck()).toHaveLength(12);
	});

	it('has the expected composition', () => {
		const deck = createStartingDeck();
		expect(deck.filter((id) => id === 'iron_sword').length).toBe(4);
		expect(deck.filter((id) => id === 'flame_blade').length).toBe(3);
		expect(deck.filter((id) => id === 'battle_familiar').length).toBe(3);
		expect(deck.filter((id) => id === 'dungeon_drake').length).toBe(2);
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

	it('has an entry for spell with color and icon', () => {
		expect(CARD_TYPE_STYLE.spell).toHaveProperty('color');
		expect(CARD_TYPE_STYLE.spell).toHaveProperty('icon');
		expect(typeof CARD_TYPE_STYLE.spell.color).toBe('string');
		expect(typeof CARD_TYPE_STYLE.spell.icon).toBe('string');
	});

	it('has an entry for creature with color and icon', () => {
		expect(CARD_TYPE_STYLE.creature).toHaveProperty('color');
		expect(CARD_TYPE_STYLE.creature).toHaveProperty('icon');
		expect(typeof CARD_TYPE_STYLE.creature.color).toBe('string');
		expect(typeof CARD_TYPE_STYLE.creature.icon).toBe('string');
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
		expect(weaponCardIds.has('steel_claymore')).toBe(true);
		expect(weaponCardIds.has('magma_greatsword')).toBe(true);
		expect(weaponCardIds.has('harvesting_scythe')).toBe(true);
		expect(weaponCardIds.has('saber_of_light')).toBe(true);
		expect(weaponCardIds.has('photon_slicer')).toBe(true);
		expect(weaponCardIds.has('arcane_bolt')).toBe(true);
		expect(weaponCardIds.has('infinite_disk')).toBe(true);
		expect(weaponCardIds.has('echo_blade')).toBe(true);
		expect(weaponCardIds.has('excalibur_photon')).toBe(true);
		expect(weaponCardIds.has('resonance_edge')).toBe(true);
		expect(weaponCardIds.has('battle_familiar')).toBe(false);
		expect(weaponCardIds.has('dungeon_drake')).toBe(false);
		expect(weaponCardIds.size).toBe(16);
	});

	it('spellCardIds contains base, evolved, and synergistic spell card IDs', () => {
		expect(spellCardIds).toBeInstanceOf(Set);
		expect(spellCardIds.has('battle_familiar')).toBe(true);
		expect(spellCardIds.has('astral_guardian')).toBe(true);
		expect(spellCardIds.has('mana_prism')).toBe(true);
		expect(spellCardIds.has('sacrificial_altar')).toBe(true);
		expect(spellCardIds.has('chrono_trigger')).toBe(true);
		expect(spellCardIds.has('frost_nova')).toBe(true);
		expect(spellCardIds.has('glacier_collapse')).toBe(true);
		expect(spellCardIds.has('healing_font')).toBe(true);
		expect(spellCardIds.has('divine_grace')).toBe(true);
		expect(spellCardIds.has('gravity_well')).toBe(true);
		expect(spellCardIds.has('event_horizon')).toBe(true);
		expect(spellCardIds.has('mana_leach')).toBe(true);
		expect(spellCardIds.has('soul_drain')).toBe(true);
		expect(spellCardIds.has('dragons_breath')).toBe(true);
		expect(spellCardIds.has('inferno_pillar')).toBe(true);
		expect(spellCardIds.has('permafrost_lance')).toBe(true);
		expect(spellCardIds.has('iron_sword')).toBe(false);
		expect(spellCardIds.size).toBe(18);
	});

	it('creatureCardIds contains base, evolved, and synergistic creature card IDs', () => {
		expect(creatureCardIds).toBeInstanceOf(Set);
		expect(creatureCardIds.has('dungeon_drake')).toBe(true);
		expect(creatureCardIds.has('ancient_wyrm')).toBe(true);
		expect(creatureCardIds.has('battery_automaton')).toBe(true);
		expect(creatureCardIds.has('skeleton_knight')).toBe(true);
		expect(creatureCardIds.has('undead_commander')).toBe(true);
		expect(creatureCardIds.has('storm_eagle')).toBe(true);
		expect(creatureCardIds.has('thunderbird')).toBe(true);
		expect(creatureCardIds.has('null_crawler')).toBe(true);
		expect(creatureCardIds.has('bulkhead_mauler')).toBe(true);
		expect(creatureCardIds.has('iron_sword')).toBe(false);
		expect(creatureCardIds.size).toBe(9);
	});

	it('CARD_ACCENT_STYLE defines icon and color for each new pack card', () => {
		const packIds = [
			'saber_of_light',
			'excalibur_photon',
			'photon_slicer',
			'frost_nova',
			'healing_font',
			'skeleton_knight',
			'undead_commander',
			'storm_eagle',
			'thunderbird',
			'gravity_well',
			'event_horizon',
			'echo_blade',
			'resonance_edge',
			'mana_leach',
			'dragons_breath',
			'glacier_collapse',
			'inferno_pillar',
			'soul_drain',
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

	it('CARD_ACCENT_STYLE defines icon and color for Sanctum Pulse', () => {
		expect(CARD_ACCENT_STYLE.divine_grace).toMatchObject({
			color: '#fde68a',
			icon: '✧',
		});
	});
});
