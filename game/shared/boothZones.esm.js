// Canonical implementation of boothZones (single source of truth).
// The CJS bridge (boothZones.js) loads this file at require time via
// `fs.readFileSync` + `new Function` — do not duplicate logic there.
//
// A "booth zone" is a circular proximity region centred on a hub booth anchor.
// `boothAnchors` is the `{ booth: { x, z }, ... }` map produced by
// `generateHub` in game/server/dungeon.js.

// Trigger radius around a booth anchor centre. Comfortably smaller than
// HUB_ANCHOR_INSET (= 4) so the two booths sharing a hub room don't both
// trigger from a single position.
export const BOOTH_INTERACT_RADIUS = 2.5;

/**
 * Map a planar position to the booth anchor it is standing in.
 *
 * Returns the id of the nearest booth anchor whose centre lies within
 * `radius` of `(x, z)`, or `null` when no anchor is in range.
 *
 * @param {object} boothAnchors - `{ booth: { x, z }, ... }` from generateHub
 * @param {number} x - world X coordinate
 * @param {number} z - world Z coordinate
 * @param {number} [radius] - trigger radius (defaults to BOOTH_INTERACT_RADIUS)
 * @returns {string|null} nearest in-range booth id, or null
 */
export function findBoothInRange(boothAnchors, x, z, radius = BOOTH_INTERACT_RADIUS) {
	if (!boothAnchors || !Number.isFinite(x) || !Number.isFinite(z)) {
		return null;
	}

	let nearestId = null;
	let nearestDist = Infinity;

	for (const [id, anchor] of Object.entries(boothAnchors)) {
		if (!anchor || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.z)) {
			continue;
		}
		const dist = Math.hypot(anchor.x - x, anchor.z - z);
		if (dist <= radius && dist < nearestDist) {
			nearestId = id;
			nearestDist = dist;
		}
	}

	return nearestId;
}
