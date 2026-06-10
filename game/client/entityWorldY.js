// World Y resolution for entities — mirrors game/server/simulation.js getEntityWorldY / resolveEntityY.

import { sampleFloorY, DEFAULT_FLOOR_Y, resolveFloorY } from '../shared/floorSampling.esm.js';

/** Default hover height for flying entities without an explicit altitude. */
const DEFAULT_FLY_ALTITUDE = 3;

/**
 * Resolve world Y for any entity at its current (x, z).
 * @param {object} entity
 * @param {object | null | undefined} layout
 * @returns {number}
 */
function resolveEntityY(entity, layout) {
	const floorY = resolveFloorY(sampleFloorY(layout, entity.x, entity.z));
	if (!entity.flying) return floorY;
	const altitude = Number.isFinite(entity.altitude) ? entity.altitude : DEFAULT_FLY_ALTITUDE;
	return floorY + altitude;
}

/**
 * World Y for lock-on, aim, and render fallbacks — matches server getEntityWorldY.
 * Grounded: entity.y or sampled floor; flying: entity.y or floorY + altitude.
 * @param {object | null | undefined} entity
 * @param {object | null | undefined} layout
 * @returns {number}
 */
export function getEntityWorldY(entity, layout) {
	if (!entity) return resolveFloorY(DEFAULT_FLOOR_Y);
	if (entity.flying) {
		if (layout) return resolveEntityY(entity, layout);
		const floorY = resolveFloorY(DEFAULT_FLOOR_Y);
		const altitude = Number.isFinite(entity.altitude) ? entity.altitude : DEFAULT_FLY_ALTITUDE;
		return floorY + altitude;
	}
	if (Number.isFinite(entity.y)) return entity.y;
	if (layout) {
		return resolveFloorY(sampleFloorY(layout, entity.x, entity.z));
	}
	return resolveFloorY(DEFAULT_FLOOR_Y);
}
