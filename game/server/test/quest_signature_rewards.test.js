import { describe, it, expect, beforeEach } from 'vitest';
import {
	createGameState,
	gameState,
	createRunState,
	buildCardChoices,
	grantRunRewards,
	CARD_DEFS,
} from '../index.js';
import {
	QUEST_DEFS,
	getSignatureCardId,
	getQuestRewardCards,
} from '../quests.js';
import { VICTORY_REWARD_ROTATION } from '../config.js';
import cardDefsJson from '../../shared/cardDefs.json';

// ── Helpers ──

function resetState() {
	Object.assign(gameState, createGameState());
	delete gameState._victoryCounters;
}

function addPlayer(id, overrides = {}) {
	gameState.players[id] = {
		x: 0,
		y: 0.5,
		z: 0,
		rotation: 0,
		hp: 100,
		dead: false,
		lastActivity: Date.now(),
		ready: false,
		currency: 0,
		ownedCards: {},
		debugScenario: null,
		pendingSummons: new Set(),
		deck: [],
		...overrides,
	};
}

function startRunFor(questId, tier = 1) {
	gameState.selectedQuestId = questId;
	gameState.selectedQuestTier = tier;
	gameState.run = createRunState();
}

const SIGNATURE_QUEST_TIERS = [
	['frost_crossing', 1, 'ice_ball', ['ice_ball', 'frost_nova', 'permafrost_lance']],
	['frost_crossing', 2, 'ice_ball', ['ice_ball', 'frost_nova', 'permafrost_lance']],
	['ember_descent', 1, 'fireball', ['fireball', 'dragons_breath']],
	['spire_ascent', 1, 'gravity_well', ['gravity_well']],
	['spire_ascent', 2, 'gravity_well', ['gravity_well']],
	['crystal_rescue', 1, 'mana_prism', ['mana_prism', 'harvesting_scythe']],
	['crystal_rescue', 2, 'mana_prism', ['mana_prism', 'harvesting_scythe']],
	['crucible_duel', 1, 'sacrificial_altar', ['sacrificial_altar', 'chrono_trigger']],
	['vault_onslaught', 1, 'dungeon_drake', ['dungeon_drake', 'mana_leach']],
];

const NON_SIGNATURE_QUEST_IDS = [
	'training_caverns',
	'arena_trials',
	'canyon_descent',
	'endless_siege',
];

// ── quests.js helpers ──

describe('getSignatureCardId / getQuestRewardCards', () => {
	it('returns the configured signature card and pool for signature quest tiers', () => {
		for (const [questId, tier, signatureCardId, rewardCards] of SIGNATURE_QUEST_TIERS) {
			expect(getSignatureCardId(questId, tier)).toBe(signatureCardId);
			expect(getQuestRewardCards(questId, tier)).toEqual(rewardCards);
		}
	});

	it('only uses existing acquisition: reward cards from cardDefs.json', () => {
		for (const [questId, tier] of SIGNATURE_QUEST_TIERS) {
			for (const cardId of getQuestRewardCards(questId, tier)) {
				expect(cardDefsJson[cardId]?.acquisition).toBe('reward');
			}
		}
	});

	it('returns null for quests without a signature pool', () => {
		for (const questId of NON_SIGNATURE_QUEST_IDS) {
			expect(getSignatureCardId(questId, 1)).toBeNull();
			expect(getQuestRewardCards(questId, 1)).toBeNull();
		}
	});

	it('leaves non-signature quest tier defs without the new fields', () => {
		for (const questId of NON_SIGNATURE_QUEST_IDS) {
			for (const tierDef of Object.values(QUEST_DEFS[questId].tiers)) {
				expect(tierDef.signatureCardId).toBeUndefined();
				expect(tierDef.rewardCards).toBeUndefined();
			}
		}
	});

	it('returns null for unknown quests and tiers', () => {
		expect(getSignatureCardId('missing_quest', 1)).toBeNull();
		expect(getSignatureCardId('frost_crossing', 3)).toBeNull();
		expect(getQuestRewardCards('missing_quest', 1)).toBeNull();
		expect(getQuestRewardCards('frost_crossing', 3)).toBeNull();
	});

	it('falls back to rewardCards[0] / [signatureCardId] when only one field is set', () => {
		const tierDef = QUEST_DEFS.training_caverns.tiers[1];
		try {
			tierDef.rewardCards = ['frost_nova'];
			expect(getSignatureCardId('training_caverns', 1)).toBe('frost_nova');
			delete tierDef.rewardCards;
			tierDef.signatureCardId = 'frost_nova';
			expect(getQuestRewardCards('training_caverns', 1)).toEqual(['frost_nova']);
		} finally {
			delete tierDef.rewardCards;
			delete tierDef.signatureCardId;
		}
	});
});

// ── buildCardChoices signature injection ──

describe('buildCardChoices signature injection', () => {
	beforeEach(resetState);

	it('offers the signature card even when the run had no drops', () => {
		addPlayer('p1');
		startRunFor('frost_crossing', 1);
		gameState.players.p1.runCardDropIds = [];

		const choices = buildCardChoices('p1');
		expect(choices.map((c) => c.id)).toEqual(['ice_ball']);
		expect(choices[0]).toEqual(expect.objectContaining({
			id: 'ice_ball',
			name: CARD_DEFS.ice_ball.name,
			type: CARD_DEFS.ice_ball.type,
		}));
	});

	it('injects the signature card first and keeps the MAX_CARD_CHOICES cap', () => {
		addPlayer('p1');
		startRunFor('frost_crossing', 1);
		gameState.players.p1.runCardDropIds = ['iron_sword', 'flame_blade', 'dungeon_drake'];

		const choices = buildCardChoices('p1');
		expect(choices).toHaveLength(3);
		expect(choices.map((c) => c.id)).toEqual(['ice_ball', 'iron_sword', 'flame_blade']);
	});

	it('dedupes the signature card against run drops', () => {
		addPlayer('p1');
		startRunFor('frost_crossing', 1);
		gameState.players.p1.runCardDropIds = ['iron_sword', 'ice_ball', 'flame_blade'];

		const choices = buildCardChoices('p1');
		expect(choices.map((c) => c.id)).toEqual(['ice_ball', 'iron_sword', 'flame_blade']);
	});

	it('leaves non-signature quest choices identical to the drop-derived selection', () => {
		addPlayer('p1');
		startRunFor('training_caverns', 1);
		gameState.players.p1.runCardDropIds = ['iron_sword', 'flame_blade'];

		const choices = buildCardChoices('p1');
		expect(choices.map((c) => c.id)).toEqual(['iron_sword', 'flame_blade']);
		expect(choices.map((c) => c.id)).not.toContain('ice_ball');
		for (const choice of choices) {
			expect(choice).toEqual(expect.objectContaining({
				name: CARD_DEFS[choice.id].name,
				type: CARD_DEFS[choice.id].type,
			}));
			expect(typeof choice.description).toBe('string');
		}
	});

	it('keeps ice_ball for a non-signature quest only when it was an actual run drop', () => {
		addPlayer('p1');
		startRunFor('training_caverns', 1);
		gameState.players.p1.runCardDropIds = ['ice_ball', 'iron_sword'];

		const choices = buildCardChoices('p1');
		expect(choices.map((c) => c.id)).toEqual(['ice_ball', 'iron_sword']);
	});

	it('does not inject a signature card when no run is active', () => {
		addPlayer('p1');
		gameState.run = null;
		gameState.players.p1.runCardDropIds = ['iron_sword'];

		const choices = buildCardChoices('p1');
		expect(choices.map((c) => c.id)).toEqual(['iron_sword']);
	});

	it('still returns [] for missing players and non-array drop lists', () => {
		startRunFor('frost_crossing', 1);
		expect(buildCardChoices('ghost')).toEqual([]);

		addPlayer('p1');
		expect(buildCardChoices('p1')).toEqual([]);
	});
});

// ── grantRunRewards victory path ──

describe('grantRunRewards per-quest signature rewards', () => {
	beforeEach(resetState);

	it('winning frost_crossing offers pendingCardChoices containing ice_ball first', () => {
		addPlayer('p1');
		startRunFor('frost_crossing', 1);
		gameState.players.p1.runCardDropIds = ['iron_sword'];

		grantRunRewards('p1', { status: 'victory' });

		const pending = gameState.players.p1.pendingCardChoices;
		expect(pending.map((c) => c.id)).toEqual(['ice_ball', 'iron_sword']);
		// Draft choices replace auto-grants: nothing is granted outright.
		expect(gameState.players.p1.runRewards.cards).toEqual([]);
		expect(gameState.players.p1.ownedCards.ice_ball).toBeUndefined();
	});

	it('winning training_caverns offers choices without ice_ball', () => {
		addPlayer('p1');
		startRunFor('training_caverns', 1);
		gameState.players.p1.runCardDropIds = ['iron_sword', 'flame_blade'];

		grantRunRewards('p1', { status: 'victory' });

		const pending = gameState.players.p1.pendingCardChoices;
		expect(pending.map((c) => c.id)).toEqual(['iron_sword', 'flame_blade']);
		expect(pending.map((c) => c.id)).not.toContain('ice_ball');
	});

	it('empty-choices fallback rotates through the quest pool for a signature quest', () => {
		addPlayer('p1');
		startRunFor('frost_crossing', 1);
		// No runCardDropIds array → buildCardChoices returns [] → fallback grant.

		grantRunRewards('p1', { status: 'victory' });
		grantRunRewards('p1', { status: 'victory' });
		grantRunRewards('p1', { status: 'victory' });
		grantRunRewards('p1', { status: 'victory' });

		const owned = gameState.players.p1.ownedCards;
		expect(owned.ice_ball).toBe(2);
		expect(owned.frost_nova).toBe(1);
		expect(owned.permafrost_lance).toBe(1);
		expect(gameState._victoryCounters.p1).toBe(4);
	});

	it('empty-choices fallback keeps the global rotation for a non-signature quest', () => {
		addPlayer('p1');
		startRunFor('training_caverns', 1);

		grantRunRewards('p1', { status: 'victory' });

		const owned = gameState.players.p1.ownedCards;
		expect(owned[VICTORY_REWARD_ROTATION[0]]).toBe(1);
		expect(owned.ice_ball).toBeUndefined();
		expect(gameState._victoryCounters.p1).toBe(1);
	});

	it('keeps per-player _victoryCounters independent', () => {
		addPlayer('p1');
		addPlayer('p2');
		startRunFor('frost_crossing', 1);

		grantRunRewards('p1', { status: 'victory' });
		grantRunRewards('p1', { status: 'victory' });
		grantRunRewards('p2', { status: 'victory' });

		expect(gameState.players.p1.ownedCards.ice_ball).toBe(1);
		expect(gameState.players.p1.ownedCards.frost_nova).toBe(1);
		expect(gameState.players.p2.ownedCards.ice_ball).toBe(1);
		expect(gameState.players.p2.ownedCards.frost_nova).toBeUndefined();
		expect(gameState._victoryCounters).toEqual({ p1: 2, p2: 1 });
	});
});
