// ── Hand State Module ──
// Manages the player's card hand, deck, and slot cooldowns.
// Pure logic — rendering is delegated via an optional callback.

import {
	CARD_DEFS,
	createStartingDeck,
	DESPERATION_DECK_TEMPLATE,
	buildDesperationHandCard,
} from './cards.js';

// ── Mutable state (exported so main.js can read/write in-place) ──
export let hand = [];            // array of up to 4 card objects
export let deck = [];            // remaining card id strings
export let desperationDeck = []; // shuffled desperation draw pile
export let slotCooldowns = [false, false, false, false];
export let inDesperation = false;

/**
 * Draw one card from the deck.
 * Returns null if the deck is empty or the card id is unknown.
 *
 * Copies `magicStoneCost` from the card definition when present,
 * so the client can evaluate affordability in renderHand() and sync the
 * `.no-ms` CSS class when Magic Stones regenerate.
 *
 * @returns {{ id, name, type, charges, remainingCharges, magicStoneCost?: number } | null}
 */
export function drawCard() {
	if (deck.length === 0) return null;
	const cardId = deck.pop();
	const def = CARD_DEFS[cardId];
	if (!def) return null;
	const card = {
		id: def.id,
		name: def.name,
		type: def.type,
		charges: def.charges,
		remainingCharges: def.charges,
	};
	if (def.magicStoneCost != null) {
		card.magicStoneCost = def.magicStoneCost;
	}
	return card;
}

export function drawDesperationCard() {
	if (desperationDeck.length === 0) return null;
	inDesperation = true;
	const cardId = desperationDeck.pop();
	return buildDesperationHandCard(cardId);
}

export function initDesperationDeckLocal() {
	desperationDeck = DESPERATION_DECK_TEMPLATE.slice();
	for (let i = desperationDeck.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[desperationDeck[i], desperationDeck[j]] = [desperationDeck[j], desperationDeck[i]];
	}
}

export function drawReplacementCardLocal(slotIndex) {
	const card = drawCard() || drawDesperationCard();
	if (card) {
		hand[slotIndex] = card;
		return;
	}
	hand.splice(slotIndex, 1);
}

export function setDesperationDrawPile(cardIds) {
	desperationDeck.length = 0;
	if (!Array.isArray(cardIds)) return;
	for (const id of cardIds) {
		desperationDeck.push(id);
	}
}

export function setInDesperation(value) {
	inDesperation = !!value;
}

/**
 * Initialise the hand from a fresh starting deck.
 *
 * @param {Function} [onRender] — optional callback invoked after the hand
 *   is built so the caller can update the DOM.
 */
export function initHand(onRender) {
	const deckIds = createStartingDeck();
	hand = [];
	deck = [];
	slotCooldowns = [false, false, false, false];
	inDesperation = false;
	initDesperationDeckLocal();

	// Push all card IDs into deck (reversed so pop gives original order)
	for (let i = deckIds.length - 1; i >= 0; i--) {
		deck.push(deckIds[i]);
	}

	// Deal first 4 cards
	for (let i = 0; i < 4; i++) {
		const card = drawCard();
		if (card) hand.push(card);
	}

	if (typeof onRender === 'function') onRender();
}

/**
 * Initialise the hand from a server-provided deck.
 *
 * When `serverDeckIds` is a non-empty array, uses it as the source of truth.
 * Otherwise falls back to `createStartingDeck()` (defensive guard).
 *
 * @param {string[] | null | undefined} serverDeckIds — array of card id strings
 *   from the server, or null/undefined to trigger fallback.
 * @param {Function} [onRender] — optional callback invoked after the hand
 *   is built so the caller can update the DOM.
 */
export function initHandFromDeck(serverDeckIds, onRender) {
	let deckIds;

	if (Array.isArray(serverDeckIds) && serverDeckIds.length > 0) {
		deckIds = serverDeckIds;
	} else {
		deckIds = createStartingDeck();
	}

	hand = [];
	deck = [];
	slotCooldowns = [false, false, false, false];
	inDesperation = false;
	initDesperationDeckLocal();

	// Push all card IDs into deck (reversed so pop gives original order)
	for (let i = deckIds.length - 1; i >= 0; i--) {
		deck.push(deckIds[i]);
	}

	// Deal first 4 cards
	for (let i = 0; i < 4; i++) {
		const card = drawCard();
		if (card) hand.push(card);
	}

	if (typeof onRender === 'function') onRender();
}

/**
 * Check whether a hand slot can be used right now.
 *
 * Pure read — does not mutate `hand` or `slotCooldowns`.
 *
 * @param {number} slotIndex — slot to check (0–3)
 * @returns {boolean}
 */
export function canUseSlot(slotIndex) {
	if (slotIndex < 0 || slotIndex > 3) return false;
	if (!hand[slotIndex]) return false;
	if (slotCooldowns[slotIndex]) return false;
	return true;
}

/**
 * Replace the draw pile with server-authoritative card ids.
 *
 * @param {string[] | null | undefined} cardIds
 */
export function setDrawPile(cardIds) {
	deck.length = 0;
	if (!Array.isArray(cardIds)) return;
	for (const id of cardIds) {
		deck.push(id);
	}
}

/**
 * Reset hand / deck / cooldowns to empty defaults.
 * Useful for tests that need a clean slate between cases.
 */
export function resetHandState() {
	hand = [];
	deck = [];
	desperationDeck = [];
	slotCooldowns = [false, false, false, false];
	inDesperation = false;
}
