import { describe, it, expect } from 'vitest';
import {
	CARD_DEFS as SERVER_CARD_DEFS,
	STARTING_DECK_IDS,
	CARD_SELL_VALUES as SERVER_CARD_SELL_VALUES,
	EVOLUTION_TRANSFORMS as SERVER_EVOLUTION_TRANSFORMS,
	getCardSellValue as serverGetCardSellValue,
} from '../index.js';
import {
	CARD_DEFS as CLIENT_CARD_DEFS,
	createStartingDeck,
	CARD_SELL_VALUES as CLIENT_CARD_SELL_VALUES,
	EVOLUTION_TRANSFORMS as CLIENT_EVOLUTION_TRANSFORMS,
	getCardSellValue as clientGetCardSellValue,
} from '../../client/cards.js';

// Fields the server CARD_DEFS may carry that the client legitimately lacks,
// because they require runtime computation that cannot be JSON-encoded
// (Math.PI-based cone/breath angles and astral_guardian's TICK_RATE-derived
// attack interval). They are injected by the server CARD_STAT_OVERLAY
// (server/progression.js) rather than the shared cardStats.json. Note these key
// names can also appear as ordinary shared stats on other cards (e.g.
// attackIntervalMs is a real cardStats field for null_crawler), so the allow-list
// only governs which *server-only* (absent-from-client) fields are tolerated — it
// never suppresses comparison of a field the client actually defines.
const SERVER_ONLY_OVERLAY_KEYS = [
	'breathConeAngle',
	'attackConeAngle',
	'attackIntervalMs',
];

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

	it('each card has matching acquisition and rewardOrder', () => {
		const serverKeys = Object.keys(SERVER_CARD_DEFS);

		for (const key of serverKeys) {
			const s = SERVER_CARD_DEFS[key];
			const c = CLIENT_CARD_DEFS[key];

			expect(c.acquisition).toBe(s.acquisition);
			if (s.rewardOrder !== undefined) {
				expect(c.rewardOrder).toBe(s.rewardOrder);
			} else {
				expect(c.rewardOrder).toBeUndefined();
			}
		}
	});

	it('each card has an identical full stat surface (server overlay excluded)', () => {
		for (const key of Object.keys(CLIENT_CARD_DEFS)) {
			const c = CLIENT_CARD_DEFS[key];
			const s = SERVER_CARD_DEFS[key];

			expect(s, `server missing card ${key}`).toBeDefined();

			// The client object is the shared identity + stat surface; the server
			// object is that same surface plus the computed overlay. Compare every
			// field the client defines against the server's value — this covers the
			// full client stat object. Server-only overlay fields (which the client
			// genuinely lacks) are checked separately below.
			for (const field of Object.keys(c)) {
				expect(
					s[field],
					`stat drift on card ${key}, field "${field}"`,
				).toEqual(c[field]);
			}
		}
	});

	it('only the documented overlay keys are server-only', () => {
		// Guards the allow-list: if the server gains a new computed field, it must
		// be added to SERVER_ONLY_OVERLAY_KEYS deliberately rather than silently
		// drifting from the client.
		for (const key of Object.keys(SERVER_CARD_DEFS)) {
			const s = SERVER_CARD_DEFS[key];
			const c = CLIENT_CARD_DEFS[key];
			const serverOnly = Object.keys(s).filter(
				(field) => !(field in c),
			);
			for (const field of serverOnly) {
				expect(
					SERVER_ONLY_OVERLAY_KEYS,
					`undocumented server-only field "${field}" on card ${key}`,
				).toContain(field);
			}
		}
	});
});

// ── Card Economy Sync ──
// CARD_SELL_VALUES and EVOLUTION_TRANSFORMS are sourced from the same shared
// cardEconomy.json on both sides; these guard against the two copies drifting.

describe('card economy sync (server vs client)', () => {
	it('CARD_SELL_VALUES are deeply equal', () => {
		expect(CLIENT_CARD_SELL_VALUES).toEqual(SERVER_CARD_SELL_VALUES);
	});

	it('EVOLUTION_TRANSFORMS are deeply equal', () => {
		expect(CLIENT_EVOLUTION_TRANSFORMS).toEqual(SERVER_EVOLUTION_TRANSFORMS);
	});

	it('getCardSellValue agrees on every card id (incl. computed fallback)', () => {
		for (const key of Object.keys(SERVER_CARD_DEFS)) {
			expect(
				clientGetCardSellValue(key),
				`sell value drift on card ${key}`,
			).toBe(serverGetCardSellValue(key));
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
