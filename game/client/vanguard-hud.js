// Pure helpers for the PSO-inspired Vanguard HUD (testable without DOM).

import { CARD_DEFS, getCardDef } from './cards.js';

/** Map HP percentage to a CSS tier class for bar coloring. */
export function getHpBarTier(pct) {
	if (pct > 50) return 'hp-high';
	if (pct > 25) return 'hp-mid';
	return 'hp-low';
}

/** Map Magic Stone percentage to a CSS tier class for bar coloring. */
export function getMsBarTier(pct) {
	if (pct > 55) return 'ms-high';
	if (pct > 25) return 'ms-mid';
	return 'ms-low';
}

/** Resolve a card's Magic Stone cost from its instance or definition. */
export function getCardMagicStoneCost(card) {
	if (!card) return 0;
	const cost = card.magicStoneCost ?? CARD_DEFS[card.id]?.magicStoneCost;
	return cost != null && cost > 0 ? cost : 0;
}

/** Resolve a draw-pile entry (card id or inventory instance id) to a card id. */
export function resolveDeckEntryCardId(entry, inventory) {
	if (typeof entry !== 'string' || entry.length === 0) return null;
	if (getCardDef(entry)) return entry;

	if (Array.isArray(inventory)) {
		const instance = inventory.find((item) => item && item.instanceId === entry);
		if (instance && instance.cardId) return instance.cardId;
	}

	return null;
}

/** Count draw-pile cards by type (weapon / spell / creature / enchantment). */
export function countDeckTypes(deck, inventory) {
	const counts = { weapon: 0, spell: 0, creature: 0, enchantment: 0 };
	if (!Array.isArray(deck)) return counts;
	for (const entry of deck) {
		const cardId = resolveDeckEntryCardId(entry, inventory);
		const def = cardId ? getCardDef(cardId) : null;
		if (def && Object.prototype.hasOwnProperty.call(counts, def.type)) {
			counts[def.type] += 1;
		}
	}
	return counts;
}

/**
 * Build deck HUD stats from the server draw pile and cards still in hand.
 * @param {string[]|null|undefined} deck - remaining draw pile (server `player.deck`)
 * @param {Array<object|null>|null|undefined} handCards - cards currently in hand slots
 * @param {Array<object>|null|undefined} inventory - player inventory for instance-id deck entries
 */
export function computeDeckHudStats(deck, handCards, inventory) {
	const drawPile = Array.isArray(deck) ? deck : [];
	const inHand = Array.isArray(handCards)
		? handCards.filter(Boolean).length
		: 0;
	const drawCount = drawPile.length;
	const total = drawCount + inHand;

	return {
		drawCount,
		total,
		label: `Deck: ${drawCount}/${total}`,
		types: countDeckTypes(drawPile, inventory),
	};
}

/**
 * HUD stats while drawing from the desperation deck.
 *
 * @param {string[]} desperationDeckIds
 * @param {Array<object|null>|null|undefined} handCards
 */
export function computeDesperationHudStats(desperationDeckIds, handCards) {
	const drawPile = Array.isArray(desperationDeckIds) ? desperationDeckIds : [];
	const drawCount = drawPile.length;
	const inHand = Array.isArray(handCards)
		? handCards.filter((card) => card && card.isDesperation).length
		: 0;

	return {
		drawCount,
		total: drawCount + inHand,
		label: drawCount > 0
			? `Desperation: ${drawCount} left`
			: (inHand > 0 ? 'Desperation: in hand' : 'No cards left'),
		types: countDeckTypes(drawPile),
	};
}

/**
 * Resolve the level shown on the portrait badge from the player snapshot.
 * Falls back to 1 when the player or its `level` field is missing/invalid.
 * @param {object|null|undefined} player - local player's state-snapshot entry
 */
export function formatPlayerLevel(player) {
	const lvl = Number(player?.level);
	return Number.isFinite(lvl) && lvl >= 1 ? Math.floor(lvl) : 1;
}

/** Short label for the portrait frame from a player id. */
export function formatCharacterId(playerId) {
	if (!playerId) return '?';
	return playerId.slice(0, 2).toUpperCase();
}
