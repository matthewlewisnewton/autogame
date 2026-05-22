import { describe, it, expect, beforeEach } from 'vitest';
import {
	resetGameState,
	gameState,
	createPlayerProgress,
	createCardInstance,
	grindCard,
	getGrindCost,
	getStatMultiplier,
	scaledGrindStat,
	drawCardFromDeck,
	createDrawDeckFromSelectedDeck,
	initPlayerHand,
	extractPersistentData,
	stateSnapshot,
	EVOLUTION_GRIND_REQUIRED,
	CARD_DEFS,
} from '../index.js';

function freshPlayer(currency = 0) {
	const progress = createPlayerProgress();
	return {
		...progress,
		currency,
		selectedDeck: progress.inventory.slice(0, 4).map((card) => card.instanceId),
	};
}

describe('card grinding', () => {
	beforeEach(() => {
		resetGameState();
	});

	it('computes escalating grind costs', () => {
		expect(getGrindCost(0)).toBe(100);
		expect(getGrindCost(1)).toBe(200);
		expect(getGrindCost(4)).toBe(500);
		expect(getGrindCost(0)).toBe(100);
	});

	it('computes stat multipliers from grind level', () => {
		expect(getStatMultiplier(0)).toBe(1);
		expect(getStatMultiplier(5)).toBeCloseTo(1.25);
		expect(getStatMultiplier(10)).toBeCloseTo(1.5);
	});

	it('grinds a card while preserving instance identity', () => {
		const player = freshPlayer(500);
		const instance = player.inventory.find((card) => card.cardId === 'iron_sword');

		const result = grindCard(player, instance.instanceId);

		expect(result.ok).toBe(true);
		expect(result.cost).toBe(100);
		expect(result.currency).toBe(400);
		expect(result.instance.instanceId).toBe(instance.instanceId);
		const updated = player.inventory.find((card) => card.instanceId === instance.instanceId);
		expect(updated.grind).toBe(1);
		expect(player.currency).toBe(400);
	});

	it('rejects grinding without enough gold', () => {
		const player = freshPlayer(50);
		const instance = player.inventory.find((card) => card.cardId === 'iron_sword');

		const result = grindCard(player, instance.instanceId);

		expect(result.ok).toBe(false);
		expect(result.reason).toContain('Not enough gold');
		expect(instance.grind).toBe(0);
		expect(player.currency).toBe(50);
	});

	it('rejects grinding beyond +10', () => {
		const player = freshPlayer(9999);
		const instance = player.inventory.find((card) => card.cardId === 'iron_sword');
		instance.grind = EVOLUTION_GRIND_REQUIRED;

		const result = grindCard(player, instance.instanceId);

		expect(result.ok).toBe(false);
		expect(result.reason).toContain(`+${EVOLUTION_GRIND_REQUIRED}`);
		expect(instance.grind).toBe(EVOLUTION_GRIND_REQUIRED);
	});

	it('carries grind from inventory instances into drawn hand cards', () => {
		const player = freshPlayer(9999);
		const instance = player.inventory.find((card) => card.cardId === 'iron_sword');
		instance.grind = 5;
		player.selectedDeck = [instance.instanceId];

		createDrawDeckFromSelectedDeck(player);
		const hand = initPlayerHand(player);

		expect(player.deck).toEqual([]);
		expect(hand[0]).toMatchObject({
			id: 'iron_sword',
			grind: 5,
			instanceId: instance.instanceId,
		});
	});

	it('scales weapon damage for ground cards in combat stats', () => {
		const baseDamage = CARD_DEFS.iron_sword.damage;
		expect(scaledGrindStat(baseDamage, 5)).toBe(Math.round(baseDamage * 1.25));
	});

	it('persists grind in snapshots and persistence', () => {
		const player = freshPlayer(500);
		const instance = player.inventory.find((card) => card.cardId === 'flame_blade');
		grindCard(player, instance.instanceId);
		gameState.players.p1 = player;

		const persistent = extractPersistentData(player);
		expect(persistent.inventory.find((card) => card.instanceId === instance.instanceId).grind).toBe(1);
		expect(persistent.currency).toBe(400);

		const snapshot = stateSnapshot();
		expect(snapshot.players.p1.inventory.find((card) => card.instanceId === instance.instanceId).grind).toBe(1);
	});

	it('draws legacy card-id deck entries with zero grind', () => {
		const player = {
			inventory: [createCardInstance('iron_sword', { instanceId: 'legacy-instance', grind: 7 })],
			selectedDeck: ['iron_sword'],
			deck: ['iron_sword'],
			hand: [],
		};

		const card = drawCardFromDeck(player);

		expect(card).toMatchObject({ id: 'iron_sword', grind: 0 });
	});
});
