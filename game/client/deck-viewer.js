// ── Deck Viewer Helpers ──
// Pure functions for in-run draw pile display (grimoire overlay + stack visual).

import {
	CARD_ACCENT_STYLE,
	CARD_TYPE_STYLE,
	DESPERATION_CARD_DEFS,
	getCardDef,
	migrateCardId,
} from './cards.js';

/**
 * Resolve a draw-pile entry to a card id string.
 * Server/client deck arrays store card ids after shuffling.
 *
 * @param {string | null | undefined} entry
 * @returns {string | null}
 */
export function resolveDeckCardId(entry) {
	if (!entry || typeof entry !== 'string') return null;
	const cardId = migrateCardId(entry);
	return getCardDef(cardId) ? cardId : null;
}

/**
 * Build display metadata for each card id in the draw pile.
 *
 * @param {string[]} deckIds
 * @returns {Array<{ cardId: string, name: string, icon: string, color: string, isEvolved: boolean, isDesperation: boolean }>}
 */
export function buildDeckMiniEntries(deckIds) {
	if (!Array.isArray(deckIds)) return [];

	return deckIds
		.map((entry) => {
			const cardId = resolveDeckCardId(entry);
			const def = cardId ? getCardDef(cardId) : null;
			if (!def) return null;
			const style = CARD_TYPE_STYLE[def.type] || CARD_TYPE_STYLE.weapon;
			const accent = CARD_ACCENT_STYLE[def.id];
			return {
				cardId: def.id,
				name: def.name,
				icon: accent?.icon ?? style.icon,
				color: accent?.color ?? style.color,
				isEvolved: !!def.isEvolved,
				isDesperation: !!DESPERATION_CARD_DEFS[def.id],
			};
		})
		.filter(Boolean);
}

/**
 * Map remaining draw-pile size to a visual stack layer count (1–5).
 *
 * @param {number} deckLength
 * @param {{ minLayers?: number, maxLayers?: number, maxDeckSize?: number }} [options]
 * @returns {number}
 */
export function getDeckStackLayerCount(deckLength, options = {}) {
	const {
		minLayers = 1,
		maxLayers = 5,
		maxDeckSize = 12,
	} = options;

	if (deckLength <= 0) return 0;
	const scaled = Math.ceil((deckLength / maxDeckSize) * maxLayers);
	return Math.max(minLayers, Math.min(maxLayers, scaled));
}

/**
 * Tooltip / header label for draw pile count.
 *
 * @param {number} deckLength — cards remaining in draw pile
 * @param {number} totalSize — full run deck size
 * @returns {string}
 */
export function formatDeckCountLabel(deckLength, totalSize) {
	return `Deck: ${deckLength}/${totalSize}`;
}

/**
 * Label for the desperation draw pile when the run deck is exhausted.
 *
 * @param {number} remaining
 * @returns {string}
 */
export function formatDesperationDeckCountLabel(remaining) {
	return `Desperation deck — ${remaining} card${remaining === 1 ? '' : 's'} left`;
}

/**
 * Infer total run deck size from draw pile + cards currently in hand.
 *
 * @param {number} deckLength
 * @param {Array<object | null | undefined>} handCards
 * @param {number} [fallbackTotal]
 * @returns {number}
 */
export function computeRunDeckTotal(deckLength, handCards, fallbackTotal = 8) {
	const inHand = Array.isArray(handCards) ? handCards.filter(Boolean).length : 0;
	const total = deckLength + inHand;
	return total > 0 ? total : fallbackTotal;
}

/**
 * Order draw pile for display (next card to draw shown first).
 *
 * @param {string[]} deckIds — internal deck storage (pop from end)
 * @returns {string[]}
 */
export function deckIdsForDisplay(deckIds) {
	if (!Array.isArray(deckIds)) return [];
	return [...deckIds].reverse();
}
