// Canonical implementation of floorSampling (single source of truth).
// The CJS wrapper (floorSampling.js) loads this file at require time
// via `fs.readFileSync` + `new Function` — do not duplicate logic there.

export const DEFAULT_FLOOR_Y = 0.5;

/**
 * Return the walkable surface Y height at world (x, z) using bilinear
 * interpolation of the containing room's floorCorners.
 *
 * Corner ordering:
 *   NW = (−width/2, −depth/2),  NE = (+width/2, −depth/2)
 *   SE = (+width/2, +depth/2),  SW = (−width/2, +depth/2)
 *
 * @param {object} layout - dungeon layout from generateLayout()
 * @param {number} x - world X coordinate
 * @param {number} z - world Z coordinate
 * @returns {number|null} interpolated Y height, or null if outside all rooms
 */
export function sampleFloorY(layout, x, z) {
	for (const room of layout.rooms) {
		const halfW = room.width / 2;
		const halfD = room.depth / 2;
		if (
			x >= room.x - halfW &&
			x <= room.x + halfW &&
			z >= room.z - halfD &&
			z <= room.z + halfD
		) {
			// Normalized local coordinates [0, 1]
			const u = (x - (room.x - halfW)) / room.width;
			const v = (z - (room.z - halfD)) / room.depth;

			const fc = room.floorCorners;
			const yNW = fc ? fc.yNW : DEFAULT_FLOOR_Y;
			const yNE = fc ? fc.yNE : DEFAULT_FLOOR_Y;
			const ySE = fc ? fc.ySE : DEFAULT_FLOOR_Y;
			const ySW = fc ? fc.ySW : DEFAULT_FLOOR_Y;

			// Bilinear interpolation
			return (
				(1 - u) * (1 - v) * yNW +
				u * (1 - v) * yNE +
				u * v * ySE +
				(1 - u) * v * ySW
			);
		}
	}
	return null;
}
