// ── Hand State Module ──
// Manages the player's card hand, deck, and slot cooldowns.
// Pure logic — rendering is delegated via an optional callback.

import {
	CARD_DEFS,
	createStartingDeck,
	DESPERATION_DECK_TEMPLATE,
	buildDesperationHandCard,
} from './cards.js';
import { MAX_HAND_SLOTS, OPENING_HAND_SIZE, HAND_SLOT_FILL_ORDER } from './config.js';

// ── Mutable state (exported so main.js can read/write in-place) ──
export let hand = [];
export let deck = [];
export let desperationDeck = [];
export let slotCooldowns = new Array(MAX_HAND_SLOTS).fill(false);
export let inDesperation = false;

/** @type {() => boolean} */
let handInputLockChecker = () => false;

/**
 * Register a callback that reports whether the local player's hand input is
 * locked (e.g. during card wind-up commitment). Set from main.js.
 *
 * @param {() => boolean} checker
 */
export function setHandInputLockChecker(checker) {
	handInputLockChecker = typeof checker === 'function' ? checker : () => false;
}

/** @returns {boolean} */
export function isHandInputLocked() {
	return handInputLockChecker();
}

/**
 * Draw one card from the deck.
 * Returns null if the deck is empty or the card id is unknown.
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

function ensureHandSlotsLocal() {
	while (hand.length < MAX_HAND_SLOTS) {
		hand.push(null);
	}
	if (hand.length > MAX_HAND_SLOTS) {
		hand.length = MAX_HAND_SLOTS;
	}
}

/**
 * Initialise the hand from a fresh starting deck.
 *
 * @param {Function} [onRender] — optional callback invoked after the hand
 *   is built so the caller can update the DOM.
 */
export function initHand(onRender) {
	const deckIds = createStartingDeck();
	hand = new Array(MAX_HAND_SLOTS).fill(null);
	deck = [];
	slotCooldowns = new Array(MAX_HAND_SLOTS).fill(false);
	inDesperation = false;
	initDesperationDeckLocal();

	for (let i = deckIds.length - 1; i >= 0; i--) {
		deck.push(deckIds[i]);
	}

	for (let i = 0; i < OPENING_HAND_SIZE; i++) {
		const slotIndex = HAND_SLOT_FILL_ORDER[i];
		const card = drawCard();
		if (card) hand[slotIndex] = card;
	}

	if (typeof onRender === 'function') onRender();
}

/**
 * Initialise the hand from a server-provided deck.
 *
 * @param {string[] | null | undefined} serverDeckIds — array of card id strings
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

	hand = new Array(MAX_HAND_SLOTS).fill(null);
	deck = [];
	slotCooldowns = new Array(MAX_HAND_SLOTS).fill(false);
	inDesperation = false;
	initDesperationDeckLocal();

	for (let i = deckIds.length - 1; i >= 0; i--) {
		deck.push(deckIds[i]);
	}

	for (let i = 0; i < OPENING_HAND_SIZE; i++) {
		const slotIndex = HAND_SLOT_FILL_ORDER[i];
		const card = drawCard();
		if (card) hand[slotIndex] = card;
	}

	if (typeof onRender === 'function') onRender();
}

/**
 * Check whether a hand slot can be used right now.
 *
 * @param {number} slotIndex — slot to check (0–5)
 * @returns {boolean}
 */
export function canUseSlot(slotIndex) {
	if (slotIndex < 0 || slotIndex >= MAX_HAND_SLOTS) return false;
	if (!hand[slotIndex]) return false;
	if (slotCooldowns[slotIndex]) return false;
	if (isHandInputLocked()) return false;
	return true;
}

export function countFilledHandSlotsLocal() {
	return hand.filter(Boolean).length;
}

export function canDrawIntoHandLocal() {
	const filled = countFilledHandSlotsLocal();
	const deckHasCards = deck.length > 0 || desperationDeck.length > 0;
	return filled < MAX_HAND_SLOTS && deckHasCards;
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
	hand = new Array(MAX_HAND_SLOTS).fill(null);
	deck = [];
	desperationDeck = [];
	slotCooldowns = new Array(MAX_HAND_SLOTS).fill(false);
	inDesperation = false;
}

export { MAX_HAND_SLOTS, OPENING_HAND_SIZE };
