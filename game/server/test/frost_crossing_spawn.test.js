import { describe, it, expect, beforeEach } from 'vitest';
import { generateLayout, questLayoutSeed } from '../dungeon.js';
import {
	getLayoutProfileForQuest,
	getLayoutGenerationOptions,
} from '../quests.js';
import { resetGameState, gameState, spawnEnemies } from '../index.js';

const QUEST_ID = 'frost_crossing';
const TIER = 1;
const SEED = questLayoutSeed(QUEST_ID, TIER);

function iceCavernLayout(seed = SEED) {
	return generateLayout(
		seed,
		getLayoutProfileForQuest(QUEST_ID, TIER),
		getLayoutGenerationOptions(QUEST_ID, TIER),
	);
}

describe('frost_crossing quest deploy layout', () => {
	beforeEach(() => resetGameState());

	it('uses ice-cavern profile when frost_crossing tier 1 is deployed', () => {
		gameState.selectedQuestId = QUEST_ID;
		gameState.selectedQuestTier = TIER;
		gameState.layout = iceCavernLayout();
		gameState.layoutSeed = SEED;
		gameState.enemies = [];
		gameState.loot = [];
		spawnEnemies();

		expect(gameState.layout.profile).toBe('ice-cavern');
		expect(gameState.enemies.length).toBeGreaterThan(0);
		const iceRoom = gameState.layout.rooms.find((r) => r.band === 'ice');
		expect(iceRoom.floorSurface).toBe('slippery');
	});
});
