// Pure helpers for Active Loadout display in the lobby deck editor.

import { getCardDef } from './cards.js';

/** Display order for loadout rows (matches Vanguard HUD type breakdown). */
export const LOADOUT_TYPE_ORDER = ['weapon', 'spell', 'creature', 'enchantment'];

export function loadoutTypeRank(type) {
	const idx = LOADOUT_TYPE_ORDER.indexOf(type);
	return idx >= 0 ? idx : LOADOUT_TYPE_ORDER.length;
}

/**
 * Group selected deck entries by card id (one row per card type in the loadout).
 *
 * @param {string[]} selectedDeck
 * @param {(entryId: string) => string|null} cardIdForEntry
 * @returns {Array<{ cardId: string, def: object, entryIds: string[], count: number }>}
 */
export function groupLoadoutDeckEntries(selectedDeck, cardIdForEntry) {
	if (!Array.isArray(selectedDeck)) return [];

	const groups = new Map();
	const order = [];

	for (const entryId of selectedDeck) {
		const cardId = cardIdForEntry(entryId);
		const def = cardId ? getCardDef(cardId) : null;
		if (!def) continue;

		if (!groups.has(cardId)) {
			groups.set(cardId, { cardId, def, entryIds: [] });
			order.push(cardId);
		}
		groups.get(cardId).entryIds.push(entryId);
	}

	return order.map((cardId) => {
		const group = groups.get(cardId);
		return {
			cardId,
			def: group.def,
			entryIds: group.entryIds,
			count: group.entryIds.length,
		};
	});
}

/**
 * Sort loadout groups by card type, then name.
 *
 * @param {Array<{ def: { type: string, name: string } }>} groups
 * @returns {typeof groups}
 */
export function sortLoadoutDeckGroups(groups) {
	return [...groups].sort((a, b) => {
		const typeCmp = loadoutTypeRank(a.def.type) - loadoutTypeRank(b.def.type);
		if (typeCmp !== 0) return typeCmp;
		return a.def.name.localeCompare(b.def.name);
	});
}

/**
 * Build grouped, type-sorted rows for the Active Loadout panel.
 *
 * @param {string[]} selectedDeck
 * @param {(entryId: string) => string|null} cardIdForEntry
 */
export function buildLoadoutDeckDisplay(selectedDeck, cardIdForEntry) {
	return sortLoadoutDeckGroups(groupLoadoutDeckEntries(selectedDeck, cardIdForEntry));
}
