// Pure helpers for Active Loadout display in the lobby deck editor.

import { getCardDef } from './cards.js';

/** Display order for loadout rows (matches Vanguard HUD type breakdown). */
export const LOADOUT_TYPE_ORDER = ['weapon', 'spell', 'creature', 'enchantment'];

export function loadoutTypeRank(type) {
	const idx = LOADOUT_TYPE_ORDER.indexOf(type);
	return idx >= 0 ? idx : LOADOUT_TYPE_ORDER.length;
}

/**
 * Group selected deck entries by card id and attune level (one row per type + grind).
 *
 * @param {string[]} selectedDeck
 * @param {(entryId: string) => string|null} cardIdForEntry
 * @param {(entryId: string) => number} [grindForEntry]
 * @returns {Array<{ cardId: string, def: object, entryIds: string[], count: number, grind: number }>}
 */
export function groupLoadoutDeckEntries(selectedDeck, cardIdForEntry, grindForEntry = () => 0) {
	if (!Array.isArray(selectedDeck)) return [];

	const groups = new Map();
	const order = [];

	for (const entryId of selectedDeck) {
		const cardId = cardIdForEntry(entryId);
		const def = cardId ? getCardDef(cardId) : null;
		if (!def) continue;

		const grind = Number.isFinite(grindForEntry(entryId))
			? Math.max(0, Math.floor(grindForEntry(entryId)))
			: 0;
		const groupKey = `${cardId}\0${grind}`;

		if (!groups.has(groupKey)) {
			groups.set(groupKey, { cardId, def, entryIds: [], grind });
			order.push(groupKey);
		}
		groups.get(groupKey).entryIds.push(entryId);
	}

	return order.map((groupKey) => {
		const group = groups.get(groupKey);
		return {
			cardId: group.cardId,
			def: group.def,
			entryIds: group.entryIds,
			count: group.entryIds.length,
			grind: group.grind,
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
 * @param {(entryId: string) => number} [grindForEntry]
 */
export function buildLoadoutDeckDisplay(selectedDeck, cardIdForEntry, grindForEntry) {
	return sortLoadoutDeckGroups(groupLoadoutDeckEntries(selectedDeck, cardIdForEntry, grindForEntry));
}
