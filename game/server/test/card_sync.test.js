import { describe, it, expect } from 'vitest';
import { CARD_DEFS as SERVER_CARD_DEFS, STARTING_DECK_IDS } from '../index.js';
// CARD_SELL_VALUES and EVOLUTION_TRANSFORMS are sourced from progression.js:
// that module loads the shared JSON single sources and is the canonical
// server-side holder of both maps. (index.js re-exports EVOLUTION_TRANSFORMS
// but not CARD_SELL_VALUES, so we pull both from progression to compare the
// same server surface the gameplay code actually uses.)
import {
	CARD_SELL_VALUES as SERVER_CARD_SELL_VALUES,
	EVOLUTION_TRANSFORMS as SERVER_EVOLUTION_TRANSFORMS,
} from '../progression.js';
import {
	CARD_DEFS as CLIENT_CARD_DEFS,
	CARD_SELL_VALUES as CLIENT_CARD_SELL_VALUES,
	EVOLUTION_TRANSFORMS as CLIENT_EVOLUTION_TRANSFORMS,
	createStartingDeck,
} from '../../client/cards.js';

// ── Card Definitions Sync ──
// These tests catch drift between the server-side and client-side copies of
// CARD_DEFS.  If a new card is added to one side but not the other, or if any
// shared field diverges, the tests will fail.  The shared stat set lives in a
// single source (shared/cardDefs.json); the server may additionally carry
// server-only overlay fields (minion/breath/attack/dot/shield stats, cooldowns,
// Math.*/TICK_RATE-derived values) that the client never needs.

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

	it('every shared field on the client matches the server (deep-equal per field)', () => {
		for (const key of Object.keys(CLIENT_CARD_DEFS)) {
			const c = CLIENT_CARD_DEFS[key];
			const s = SERVER_CARD_DEFS[key];

			expect(s, `server missing card ${key}`).toBeDefined();

			// Every field the client carries is a shared field and must match the
			// server exactly. Server-only overlay fields are allowed to exist only
			// on the server, so we only iterate the client's keys here.
			for (const field of Object.keys(c)) {
				expect(
					s[field],
					`field "${field}" differs for card ${key}`,
				).toEqual(c[field]);
			}
		}
	});
});

// ── Shared Map Sync ──
// CARD_SELL_VALUES and EVOLUTION_TRANSFORMS must be byte-for-byte identical
// between server and client. Pre-refactor these drifted silently (the server's
// sell-value map carried `aegis_sentinel` while the client's carried
// `arcane_bolt`); these assertions make that class of drift impossible.

describe('shared map sync (server vs client)', () => {
	it('CARD_SELL_VALUES is identical on both sides', () => {
		expect(SERVER_CARD_SELL_VALUES).toEqual(CLIENT_CARD_SELL_VALUES);
	});

	it('EVOLUTION_TRANSFORMS is identical on both sides', () => {
		expect(SERVER_EVOLUTION_TRANSFORMS).toEqual(CLIENT_EVOLUTION_TRANSFORMS);
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
