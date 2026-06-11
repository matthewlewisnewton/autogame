// Canonical implementation of floorSampling (single source of truth).
// The CJS wrapper (floorSampling.js) loads this file at require time
// via `fs.readFileSync` + `new Function` — do not duplicate logic there.

export const DEFAULT_FLOOR_Y = 0.5;

/**
 * Canonical fallback for `sampleFloorY` results: returns a concrete Y height.
 * Non-finite values and `null` map to `DEFAULT_FLOOR_Y`.
 *
 * @param {number|null} sampled - result from `sampleFloorY`, or any Y candidate
 * @returns {number} finite Y height
 */
export function resolveFloorY(sampled) {
	return Number.isFinite(sampled) ? sampled : DEFAULT_FLOOR_Y;
}

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
	if (!layout) return DEFAULT_FLOOR_Y;

	// Open-plaza platforms take precedence: a point standing on a platform reads
	// the raised platform height rather than the flat plaza floor beneath it.
	// When `platforms` is absent this block is skipped, preserving room behavior.
	if (layout.platforms) {
		for (const platform of layout.platforms) {
			const halfW = platform.width / 2;
			const halfD = platform.depth / 2;
			if (
				x >= platform.x - halfW &&
				x <= platform.x + halfW &&
				z >= platform.z - halfD &&
				z <= platform.z + halfD
			) {
				const u = (x - (platform.x - halfW)) / platform.width;
				const v = (z - (platform.z - halfD)) / platform.depth;
				const fc = platform.floorCorners;
				const yNW = fc ? fc.yNW : DEFAULT_FLOOR_Y;
				const yNE = fc ? fc.yNE : DEFAULT_FLOOR_Y;
				const ySE = fc ? fc.ySE : DEFAULT_FLOOR_Y;
				const ySW = fc ? fc.ySW : DEFAULT_FLOOR_Y;
				return (
					(1 - u) * (1 - v) * yNW +
					u * (1 - v) * yNE +
					u * v * ySE +
					(1 - u) * v * ySW
				);
			}
		}
	}

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

/**
 * Return the floor surface type at world (x, z).
 * Uses the same room/platform containment rules as `sampleFloorY`.
 * Platforms inherit `'normal'` unless explicitly tagged; rooms default to `'normal'`.
 *
 * @param {object} layout - dungeon layout from generateLayout()
 * @param {number} x - world X coordinate
 * @param {number} z - world Z coordinate
 * @returns {'normal'|'slippery'}
 */
export function sampleFloorSurface(layout, x, z) {
	if (!layout) return 'normal';

	if (layout.platforms) {
		for (const platform of layout.platforms) {
			const halfW = platform.width / 2;
			const halfD = platform.depth / 2;
			if (
				x >= platform.x - halfW &&
				x <= platform.x + halfW &&
				z >= platform.z - halfD &&
				z <= platform.z + halfD
			) {
				return platform.floorSurface === 'slippery' ? 'slippery' : 'normal';
			}
		}
	}

	for (const room of layout.rooms) {
		const halfW = room.width / 2;
		const halfD = room.depth / 2;
		if (
			x >= room.x - halfW &&
			x <= room.x + halfW &&
			z >= room.z - halfD &&
			z <= room.z + halfD
		) {
			return room.floorSurface === 'slippery' ? 'slippery' : 'normal';
		}
	}

	return 'normal';
}
