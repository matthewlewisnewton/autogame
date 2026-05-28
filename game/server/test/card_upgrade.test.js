import { describe, it, expect, beforeEach } from 'vitest';
import {
	resetGameState,
	gameState,
	createPlayerProgress,
	createCardInstance,
	upgradeCard,
	extractPersistentData,
	getUpgradeCost,
	MAX_CARD_LEVEL,
	UPGRADE_COST_BASE,
} from '../index.js';

function freshPlayer(currency = 1000) {
	const progress = createPlayerProgress();
	return {
		...progress,
		currency,
		selectedDeck: progress.inventory.slice(0, 4).map((card) => card.instanceId),
	};
}

describe('card upgrade', () => {
	beforeEach(() => {
		resetGameState();
	});

	it('increments level and deducts GOLD from the player', () => {
		const player = freshPlayer(500);
		const instance = player.inventory.find((card) => card.cardId === 'iron_sword');
		expect(instance.level).toBe(1);

		const result = upgradeCard(player, instance.instanceId);

		expect(result.ok).toBe(true);
		expect(result.previousLevel).toBe(1);
		expect(result.newLevel).toBe(2);
		expect(result.cost).toBe(getUpgradeCost(1));
		expect(player.currency).toBe(500 - getUpgradeCost(1));
		const upgradedInstance = player.inventory.find((card) => card.instanceId === instance.instanceId);
		expect(upgradedInstance.level).toBe(2);
		expect(upgradedInstance.instanceId).toBe(result.instance.instanceId);
	});

	it('rejects upgrades when the player has insufficient GOLD', () => {
		const player = freshPlayer(50);
		const instance = player.inventory.find((card) => card.cardId === 'iron_sword');
		const startingCurrency = player.currency;

		const result = upgradeCard(player, instance.instanceId);

		expect(result.ok).toBe(false);
		expect(result.reason).toContain('Insufficient Money');
		expect(player.currency).toBe(startingCurrency);
		expect(instance.level).toBe(1);
	});

	it('rejects upgrades at max level', () => {
		const player = freshPlayer(99999);
		const instance = player.inventory.find((card) => card.cardId === 'flame_blade');
		instance.level = MAX_CARD_LEVEL;

		const result = upgradeCard(player, instance.instanceId);

		expect(result.ok).toBe(false);
		expect(result.reason).toContain('max level');
		expect(instance.level).toBe(MAX_CARD_LEVEL);
	});

	it('persists upgraded inventory and level in snapshots', () => {
		const player = freshPlayer(1000);
		const instance = player.inventory.find((card) => card.cardId === 'battle_familiar');
		upgradeCard(player, instance.instanceId);
		gameState.players.p1 = player;

		const persistent = extractPersistentData(player);
		const savedInstance = persistent.inventory.find((card) => card.instanceId === instance.instanceId);
		expect(savedInstance.level).toBe(2);
		expect(persistent.currency).toBe(1000 - UPGRADE_COST_BASE);
	});
});
