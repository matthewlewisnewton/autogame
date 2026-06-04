import { describe, it, expect } from 'vitest';
import { CARD_DEFS, STARTING_DECK_IDS, EVOLUTION_TRANSFORMS } from '../progression.js';
import {
	VICTORY_REWARD_ROTATION,
	SHOP_CARD_POOL,
	ENEMY_CARD_DROPS,
} from '../config.js';
import cardDefsJson from '../../shared/cardDefs.json';

const ENEMY_DROP_CARD_IDS = new Set(Object.values(ENEMY_CARD_DROPS));

/** Reverse map: evolved card id → base card id */
const EVOLUTION_BASE_BY_TARGET = Object.fromEntries(
	Object.entries(EVOLUTION_TRANSFORMS).map(([base, evolved]) => [evolved, base]),
);

function getAcquisition(cardId) {
	return cardDefsJson[cardId]?.acquisition;
}

function isDirectlyObtainable(cardId) {
	const acquisition = getAcquisition(cardId);

	if (acquisition === 'starter' || STARTING_DECK_IDS.includes(cardId)) {
		return true;
	}
	if (acquisition === 'reward' && VICTORY_REWARD_ROTATION.includes(cardId)) {
		return true;
	}
	if (acquisition === 'shop' && SHOP_CARD_POOL.includes(cardId)) {
		return true;
	}
	if (acquisition === 'drop-only' && ENEMY_DROP_CARD_IDS.has(cardId)) {
		return true;
	}

	return false;
}

function isCardReachable(cardId, visited = new Set()) {
	if (visited.has(cardId)) {
		return false;
	}
	visited.add(cardId);

	if (isDirectlyObtainable(cardId)) {
		return true;
	}

	const acquisition = getAcquisition(cardId);
	if (acquisition === 'starter' || acquisition === 'reward' || acquisition === 'shop' || acquisition === 'drop-only') {
		return false;
	}

	const baseId = EVOLUTION_BASE_BY_TARGET[cardId];
	if (!baseId) {
		return false;
	}

	return isCardReachable(baseId, visited);
}

const FORMERLY_UNREACHABLE_REWARD_CARDS = [
	'mana_prism',
	'harvesting_scythe',
	'deck_sifter',
	'sacrificial_altar',
	'battery_automaton',
	'chrono_trigger',
	'spike_trap',
	'mirror_ward',
];

describe('card acquisition reachability', () => {
	it('covers all CARD_DEFS keys', () => {
		// baseline: 42 cards as of initial pack
		expect(Object.keys(CARD_DEFS).length).toBeGreaterThanOrEqual(42);
		expect(Object.keys(cardDefsJson).length).toBeGreaterThanOrEqual(42);
		expect(Object.keys(CARD_DEFS).sort()).toEqual(Object.keys(cardDefsJson).sort());
	});

	it('every card is reachable through a valid acquisition path', () => {
		const unreachable = [];

		for (const cardId of Object.keys(CARD_DEFS)) {
			if (!isCardReachable(cardId)) {
				unreachable.push(cardId);
			}
		}

		expect(unreachable, `unreachable cards: ${unreachable.join(', ')}`).toEqual([]);
	});

	it('rejects drop-only cards missing from ENEMY_CARD_DROPS', () => {
		const invalidDropOnly = Object.keys(cardDefsJson).filter(
			(cardId) => getAcquisition(cardId) === 'drop-only' && !ENEMY_DROP_CARD_IDS.has(cardId),
		);

		expect(invalidDropOnly).toEqual([]);
	});

	it('requires starter, reward, and shop tags to be directly obtainable', () => {
		const evolutionOnlyTagged = [];

		for (const cardId of Object.keys(cardDefsJson)) {
			const acquisition = getAcquisition(cardId);
			if (acquisition !== 'starter' && acquisition !== 'reward' && acquisition !== 'shop') {
				continue;
			}

			if (!isDirectlyObtainable(cardId)) {
				evolutionOnlyTagged.push(cardId);
			}
		}

		expect(
			evolutionOnlyTagged,
			`tagged cards relying on evolution-only reachability: ${evolutionOnlyTagged.join(', ')}`,
		).toEqual([]);
	});

	it('includes formerly unreachable reward cards in VICTORY_REWARD_ROTATION', () => {
		for (const cardId of FORMERLY_UNREACHABLE_REWARD_CARDS) {
			expect(getAcquisition(cardId)).toBe('reward');
			expect(VICTORY_REWARD_ROTATION).toContain(cardId);
			expect(isDirectlyObtainable(cardId)).toBe(true);
		}
	});
});
