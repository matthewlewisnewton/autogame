// Pure helpers for the PSO-inspired Vanguard HUD (testable without DOM).

import { CARD_DEFS } from './cards.js';

/** Map HP percentage to a CSS tier class for bar coloring. */
export function getHpBarTier(pct) {
	if (pct > 50) return 'hp-high';
	if (pct > 25) return 'hp-mid';
	return 'hp-low';
}

/** Count draw-pile cards by type (weapon / spell / creature / enchantment). */
export function countDeckTypes(deck) {
	const counts = { weapon: 0, spell: 0, creature: 0, enchantment: 0 };
	if (!Array.isArray(deck)) return counts;
	for (const cardId of deck) {
		const def = CARD_DEFS[cardId];
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
 */
export function computeDeckHudStats(deck, handCards) {
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
		types: countDeckTypes(drawPile),
	};
}

/** Placeholder level until a player-level stat exists on the server. */
export function formatPlayerLevel() {
	return 1;
}

/** Short label for the portrait frame from a player id. */
export function formatCharacterId(playerId) {
	if (!playerId) return '?';
	return playerId.slice(0, 2).toUpperCase();
}
