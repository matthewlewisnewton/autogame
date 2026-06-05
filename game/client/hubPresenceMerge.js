/**
 * Merge lobby-scoped hub presence hot fields into a players map.
 * Remote ids receive x/y/z/rotation/cosmetic/username; the local id is skipped.
 * Remote players absent from the presence payload are removed.
 *
 * @param {Record<string, object>} players - mutable gameState.players map
 * @param {Record<string, object>} presencePlayers - payload.players from hubPresenceUpdate
 * @param {string | null | undefined} myId
 */
export function mergeHubPresenceIntoPlayers(players, presencePlayers, myId) {
	if (!players || !presencePlayers) return;

	const presenceIds = new Set(Object.keys(presencePlayers));

	for (const id of Object.keys(players)) {
		if (id !== myId && !presenceIds.has(id)) {
			delete players[id];
		}
	}

	for (const [id, entry] of Object.entries(presencePlayers)) {
		if (id === myId || !entry) continue;
		const existing = players[id] || {};
		const hot = {};
		if (entry.x !== undefined) hot.x = entry.x;
		if (entry.y !== undefined) hot.y = entry.y;
		if (entry.z !== undefined) hot.z = entry.z;
		if (entry.rotation !== undefined) hot.rotation = entry.rotation;
		if (entry.cosmetic !== undefined) hot.cosmetic = entry.cosmetic;
		if (entry.username !== undefined) hot.username = entry.username;
		players[id] = { ...existing, ...hot };
	}
}
