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
		expect(evolvedInstance.cardId).toBe('steel_broadsword');
		expect(evolvedInstance.grind).toBe(0);
		expect(evolvedInstance.evolvedFrom).toBe('iron_sword');
		expect(evolvedInstance.isEvolved).toBe(true);
		expect(player.ownedCards.steel_broadsword).toBe(1);
		expect(player.ownedCards.iron_sword).toBe(2);
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
		expect(player.ownedCards.flame_blade).toBe(2);
	});

	it('rejects cards without an evolution transform', () => {
		const player = {
			inventory: [
				createCardInstance('steel_broadsword', {
					instanceId: 'evolved-weapon',
					grind: EVOLUTION_GRIND_REQUIRED,
					isEvolved: true,
				}),
			],
			ownedCards: { steel_broadsword: 1 },
			selectedDeck: ['steel_broadsword'],
		};

		const result = evolveCard(player, 'evolved-weapon');

		expect(result.ok).toBe(false);
		expect(result.reason).toContain('No evolution available');
		expect(player.inventory[0].cardId).toBe('steel_broadsword');
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
			cardId: 'guardian_familiar',
			evolvedFrom: 'battle_familiar',
			isEvolved: true,
		});
		expect(persistent.ownedCards.guardian_familiar).toBe(1);

		const snapshot = stateSnapshot();
		expect(snapshot.players.p1.inventory).toEqual(player.inventory);
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
