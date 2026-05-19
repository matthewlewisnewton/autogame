import { describe, it, expect } from 'vitest';
import { CARD_DEFS as SERVER_CARD_DEFS, STARTING_DECK_IDS } from '../index.js';
import {
	CARD_DEFS as CLIENT_CARD_DEFS,
	createStartingDeck,
} from '../../client/cards.js';

// ── Card Definitions Sync ──
// These tests catch drift between the server-side and client-side copies of
// CARD_DEFS.  If a new card is added to one side but not the other, or if
// id / name / type / charges diverge, the tests will fail.

describe('CARD_DEFS sync (server vs client)', () => {
	it('has the same card ids on both sides', () => {
		const serverKeys = Object.keys(SERVER_CARD_DEFS).sort();
		const clientKeys = Object.keys(CLIENT_CARD_DEFS).sort();
		expect(serverKeys).toEqual(clientKeys);
	});

	it('each card has matching id, name, type, and charges', () => {
		const serverKeys = Object.keys(SERVER_CARD_DEFS);

		for (const key of serverKeys) {
			const s = SERVER_CARD_DEFS[key];
			const c = CLIENT_CARD_DEFS[key];

			expect(c, `client missing card ${key}`).toBeDefined();
			expect(c.id).toBe(s.id);
			expect(c.name).toBe(s.name);
			expect(c.type).toBe(s.type);
			expect(c.charges).toBe(s.charges);
		}
	});
});

// ── Starting Deck Sync ──
// Verifies that STARTING_DECK_IDS (server) and createStartingDeck() (client)
// return the same card ids in the same order.

describe('starting deck sync (server vs client)', () => {
	it('STARTING_DECK_IDS and createStartingDeck() return identical arrays', () => {
		const clientDeck = createStartingDeck();
		expect(clientDeck).toEqual(STARTING_DECK_IDS);
	});
});
