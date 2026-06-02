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
function bilinearFloorY(fc, centerX, centerZ, width, depth, x, z) {
	const halfW = width / 2;
	const halfD = depth / 2;
	const u = (x - (centerX - halfW)) / width;
	const v = (z - (centerZ - halfD)) / depth;

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

export function sampleFloorY(layout, x, z) {
	if (!layout) return null;

	if (layout.rooms) {
		for (const room of layout.rooms) {
			const halfW = room.width / 2;
			const halfD = room.depth / 2;
			if (
				x >= room.x - halfW &&
				x <= room.x + halfW &&
				z >= room.z - halfD &&
				z <= room.z + halfD
			) {
				return bilinearFloorY(
					room.floorCorners,
					room.x,
					room.z,
					room.width,
					room.depth,
					x,
					z,
				);
			}
		}
	}

	if (layout.passages) {
		for (const passage of layout.passages) {
			if (!passage.floorCorners) continue;

			const fw = passage.floorWidth;
			const fd = passage.floorDepth;
			const fx = passage.floorX;
			const fz = passage.floorZ;
			if (
				!Number.isFinite(fw) ||
				!Number.isFinite(fd) ||
				!Number.isFinite(fx) ||
				!Number.isFinite(fz) ||
				fw <= 0 ||
				fd <= 0
			) {
				continue;
			}

			const halfW = fw / 2;
			const halfD = fd / 2;
			if (
				x >= fx - halfW &&
				x <= fx + halfW &&
				z >= fz - halfD &&
				z <= fz + halfD
			) {
				return bilinearFloorY(passage.floorCorners, fx, fz, fw, fd, x, z);
			}
		}
	}

	return null;
}
