import { describe, it, expect, beforeEach } from 'vitest';
import {
	resetGameState,
	gameState,
	createPlayerProgress,
	createCardInstance,
	evolveCard,
	extractPersistentData,
	stateSnapshot,
	CARD_DEFS,
	EVOLUTION_GRIND_REQUIRED,
	EVOLUTION_TRANSFORMS,
} from '../index.js';

function freshPlayer() {
	const progress = createPlayerProgress();
	return {
		...progress,
		selectedDeck: progress.inventory.slice(0, 4).map((card) => card.instanceId),
	};
}

describe('card evolution', () => {
	beforeEach(() => {
		resetGameState();
	});

	it('evolves a +10 card while preserving the instance identity', () => {
		const player = freshPlayer();
		const instance = player.inventory.find((card) => card.cardId === 'iron_sword');
		instance.grind = EVOLUTION_GRIND_REQUIRED;

		const result = evolveCard(player, instance.instanceId);

		expect(result.ok).toBe(true);
		expect(result.fromCardId).toBe('iron_sword');
		expect(result.toCardId).toBe(EVOLUTION_TRANSFORMS.iron_sword);
		expect(result.instance.instanceId).toBe(instance.instanceId);
		const evolvedInstance = player.inventory.find((card) => card.instanceId === instance.instanceId);
		expect(evolvedInstance.cardId).toBe('steel_claymore');
		expect(evolvedInstance.grind).toBe(0);
		expect(evolvedInstance.evolvedFrom).toBe('iron_sword');
		expect(evolvedInstance.isEvolved).toBe(true);
		expect(player.ownedCards.steel_claymore).toBe(1);
		expect(player.ownedCards.iron_sword).toBe(3);
		expect(player.selectedDeck).toContain(instance.instanceId);
	});

	it('rejects evolution below +10 without mutating the card', () => {
		const player = freshPlayer();
		const instance = player.inventory.find((card) => card.cardId === 'flame_blade');
		instance.grind = EVOLUTION_GRIND_REQUIRED - 1;

		const result = evolveCard(player, instance.instanceId);

		expect(result.ok).toBe(false);
		expect(result.reason).toContain('+10');
		expect(instance.cardId).toBe('flame_blade');
		expect(instance.grind).toBe(EVOLUTION_GRIND_REQUIRED - 1);
		expect(player.ownedCards.flame_blade).toBe(3);
	});

	it('rejects cards without an evolution transform', () => {
		const player = {
			inventory: [
				createCardInstance('steel_claymore', {
					instanceId: 'evolved-weapon',
					grind: EVOLUTION_GRIND_REQUIRED,
					isEvolved: true,
				}),
			],
			ownedCards: { steel_claymore: 1 },
			selectedDeck: ['steel_claymore'],
		};

		const result = evolveCard(player, 'evolved-weapon');

		expect(result.ok).toBe(false);
		expect(result.reason).toContain('No evolution available');
		expect(player.inventory[0].cardId).toBe('steel_claymore');
	});

	it('evolves Saber of Light +10 into Excalibur Photon', () => {
		const player = {
			inventory: [
				createCardInstance('saber_of_light', {
					instanceId: 'saber-instance',
					grind: EVOLUTION_GRIND_REQUIRED,
				}),
			],
			ownedCards: { saber_of_light: 1 },
			selectedDeck: ['saber-instance'],
		};

		const result = evolveCard(player, 'saber-instance');

		expect(result.ok).toBe(true);
		expect(result.fromCardId).toBe('saber_of_light');
		expect(result.toCardId).toBe('excalibur_photon');
		expect(player.inventory[0].cardId).toBe('excalibur_photon');
		expect(player.inventory[0].evolvedFrom).toBe('saber_of_light');
		expect(player.ownedCards.excalibur_photon).toBe(1);
		expect(CARD_DEFS.excalibur_photon).toMatchObject({
			damage: 14,
			charges: 6,
			cooldownMs: 200,
			windUpMs: 600,
			swingsPerUse: 2,
			specialEffect: 'photon_barrage',
		});
	});

	it('persists evolved inventory and exposes it in snapshots', () => {
		const player = freshPlayer();
		const instance = player.inventory.find((card) => card.cardId === 'battle_familiar');
		instance.grind = EVOLUTION_GRIND_REQUIRED;
		evolveCard(player, instance.instanceId);
		gameState.players.p1 = player;

		const persistent = extractPersistentData(player);
		const savedInstance = persistent.inventory.find((card) => card.instanceId === instance.instanceId);
		expect(savedInstance).toMatchObject({
			instanceId: instance.instanceId,
			cardId: 'astral_guardian',
			evolvedFrom: 'battle_familiar',
			isEvolved: true,
		});
		expect(persistent.ownedCards.astral_guardian).toBe(1);

		const snapshot = stateSnapshot(gameState);
		expect(snapshot.players.p1.inventory).toEqual(player.inventory);
	});

	it('evolves Cryo Burst +10 into Glacier Rupture', () => {
		const player = freshPlayer();
		const instance = createCardInstance('frost_nova', { grind: EVOLUTION_GRIND_REQUIRED });
		player.inventory.push(instance);
		player.ownedCards.frost_nova = 1;
		player.selectedDeck = [instance.instanceId, ...player.selectedDeck.slice(0, 3)];

		const result = evolveCard(player, instance.instanceId);

		expect(result.ok).toBe(true);
		expect(result.toCardId).toBe('glacier_collapse');
		expect(player.inventory.find((c) => c.instanceId === instance.instanceId).cardId).toBe('glacier_collapse');
	});

	it('evolves Restoration Beacon +10 into Sanctum Pulse', () => {
		const player = {
			inventory: [
				createCardInstance('healing_font', {
					instanceId: 'heal-font-1',
					grind: EVOLUTION_GRIND_REQUIRED,
				}),
			],
			ownedCards: { healing_font: 1 },
			selectedDeck: ['heal-font-1'],
		};

		const result = evolveCard(player, 'heal-font-1');

		expect(result.ok).toBe(true);
		expect(result.fromCardId).toBe('healing_font');
		expect(result.toCardId).toBe('divine_grace');
		expect(player.inventory[0].cardId).toBe('divine_grace');
		expect(player.ownedCards.divine_grace).toBe(1);
	});

	it('evolves Stormwing Drone +10 into Thunderbird', () => {
		const player = {
			inventory: [
				createCardInstance('storm_eagle', {
					instanceId: 'eagle-instance',
					grind: EVOLUTION_GRIND_REQUIRED,
				}),
			],
			ownedCards: { storm_eagle: 1 },
			selectedDeck: ['eagle-instance'],
		};

		const result = evolveCard(player, 'eagle-instance');

		expect(result.ok).toBe(true);
		expect(result.toCardId).toBe('thunderbird');
		expect(player.inventory[0].cardId).toBe('thunderbird');
		expect(CARD_DEFS.thunderbird).toMatchObject({
			minionHp: 68,
			attackRange: 11,
			attackDamage: 20,
			specialEffect: 'chain_lightning',
		});
	});

	it('evolves Phase Echo +10 into Resonance Edge', () => {
		const player = {
			inventory: [
				createCardInstance('echo_blade', {
					instanceId: 'echo-instance',
					grind: EVOLUTION_GRIND_REQUIRED,
				}),
			],
			ownedCards: { echo_blade: 1 },
			selectedDeck: ['echo-instance'],
		};

		const result = evolveCard(player, 'echo-instance');

		expect(result.ok).toBe(true);
		expect(result.fromCardId).toBe('echo_blade');
		expect(result.toCardId).toBe('resonance_edge');
		expect(player.inventory[0].cardId).toBe('resonance_edge');
		expect(player.inventory[0].isEvolved).toBe(true);
		expect(player.ownedCards.resonance_edge).toBe(1);
	});

	it('Reaper\'s Scythe exposes conservative kill reward stats', () => {
		expect(CARD_DEFS.reapers_scythe).toMatchObject({
			currencyOnKill: 6,
			healOnKill: 8,
		});
	});

	it('evolves Ether Scythe +10 into Reaper\'s Scythe', () => {
		const player = {
			inventory: [
				createCardInstance('harvesting_scythe', {
					instanceId: 'scythe-1',
					grind: EVOLUTION_GRIND_REQUIRED,
				}),
			],
			ownedCards: { harvesting_scythe: 1 },
			selectedDeck: ['scythe-1'],
		};

		const result = evolveCard(player, 'scythe-1');

		expect(result.ok).toBe(true);
		expect(result.fromCardId).toBe('harvesting_scythe');
		expect(result.toCardId).toBe('reapers_scythe');
		expect(player.inventory[0].cardId).toBe('reapers_scythe');
		expect(player.inventory[0].isEvolved).toBe(true);
		expect(player.ownedCards.reapers_scythe).toBe(1);
		expect(CARD_DEFS.reapers_scythe).toMatchObject({
			damage: 14,
			magicStoneOnHit: 5,
			magicStoneOnKill: 15,
			currencyOnKill: 6,
			healOnKill: 8,
			isEvolved: true,
			specialEffect: 'reap',
			attackConeAngle: Math.PI,
		});
	});

	it('evolves Ether Siphon +10 into Soul Drain', () => {
		const player = {
			inventory: [
				createCardInstance('mana_leach', {
					instanceId: 'leach-1',
					grind: EVOLUTION_GRIND_REQUIRED,
				}),
			],
			ownedCards: { mana_leach: 1 },
			selectedDeck: ['leach-1'],
		};

		const result = evolveCard(player, 'leach-1');

		expect(result.ok).toBe(true);
		expect(result.fromCardId).toBe('mana_leach');
		expect(result.toCardId).toBe('soul_drain');
		expect(player.inventory[0].cardId).toBe('soul_drain');
		expect(CARD_DEFS.soul_drain).toMatchObject({
			damage: 42,
			magicStoneOnHit: 12,
		});
	});

	it('evolves Dragon\'s Breath +10 into Thermal Column', () => {
		const player = {
			inventory: [
				createCardInstance('dragons_breath', {
					instanceId: 'db-evolve',
					grind: EVOLUTION_GRIND_REQUIRED,
				}),
			],
			ownedCards: { dragons_breath: 1 },
			selectedDeck: ['db-evolve'],
		};

		const result = evolveCard(player, 'db-evolve');

		expect(result.ok).toBe(true);
		expect(result.toCardId).toBe('inferno_pillar');
		expect(player.inventory[0].cardId).toBe('inferno_pillar');
		expect(CARD_DEFS.inferno_pillar.damage).toBe(13);
	});

	it('defines every evolved card referenced by the transform table', () => {
		for (const [baseCardId, evolvedCardId] of Object.entries(EVOLUTION_TRANSFORMS)) {
			expect(CARD_DEFS[baseCardId]).toBeDefined();
			expect(CARD_DEFS[evolvedCardId]).toMatchObject({
				id: evolvedCardId,
				isEvolved: true,
				specialEffect: expect.any(String),
			});
		}
	});

	it('evolves Photon Slicer +10 into Infinite Disk', () => {
		const player = {
			inventory: [
				createCardInstance('photon_slicer', {
					instanceId: 'slicer-plus-10',
					grind: EVOLUTION_GRIND_REQUIRED,
				}),
			],
			ownedCards: { photon_slicer: 1 },
			selectedDeck: ['slicer-plus-10'],
		};

		const result = evolveCard(player, 'slicer-plus-10');

		expect(result.ok).toBe(true);
		expect(result.fromCardId).toBe('photon_slicer');
		expect(result.toCardId).toBe('infinite_disk');
		expect(player.inventory[0].cardId).toBe('infinite_disk');
		expect(player.ownedCards.infinite_disk).toBe(1);
	});

	it('evolves a +10 Gravity Well into Event Horizon', () => {
		const player = {
			inventory: [
				createCardInstance('gravity_well', {
					instanceId: 'gw-1',
					grind: EVOLUTION_GRIND_REQUIRED,
				}),
			],
			ownedCards: { gravity_well: 1 },
			selectedDeck: ['gw-1'],
		};

		const result = evolveCard(player, 'gw-1');

		expect(result.ok).toBe(true);
		expect(result.toCardId).toBe('event_horizon');
		expect(player.inventory[0].cardId).toBe('event_horizon');
		expect(player.ownedCards.event_horizon).toBe(1);
	});
});
