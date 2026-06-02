// Canonical implementation of floorSampling (single source of truth).
// The CJS wrapper (floorSampling.js) loads this file at require time
// via `fs.readFileSync` + `new Function` — do not duplicate logic there.

export const DEFAULT_FLOOR_Y = 0.5;

const DEFAULT_PASSAGE_WIDTH = 4;

function bilinearFloorY(fc, u, v) {
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

function findRoomAt(layout, cx, cz) {
	if (!layout.rooms) return null;
	return layout.rooms.find((r) => r.x === cx && r.z === cz) ?? null;
}

/**
 * Corridor slab bounds for a ramp passage (mirrors buildPassageFloorSpec).
 * Returns null when rooms or corridorLength are unavailable.
 */
function getRampPassageSlab(passage, layout) {
	const passageWidth = layout.passageWidth ?? DEFAULT_PASSAGE_WIDTH;
	const corridorLength = passage.corridorLength;
	const fromRoom = findRoomAt(layout, passage.x1, passage.z1);
	const toRoom = findRoomAt(layout, passage.x2, passage.z2);

	if (!fromRoom || !toRoom || !Number.isFinite(corridorLength) || corridorLength <= 0) {
		return null;
	}

	if (passage.x1 !== passage.x2) {
		const sign = Math.sign(passage.x2 - passage.x1) || 1;
		const xStart = fromRoom.x + sign * (fromRoom.width / 2);
		const xEnd = toRoom.x - sign * (toRoom.width / 2);
		const cx = (xStart + xEnd) / 2;
		const halfLen = corridorLength / 2;
		const halfW = passageWidth / 2;
		return {
			minX: cx - halfLen,
			maxX: cx + halfLen,
			minZ: passage.z1 - halfW,
			maxZ: passage.z1 + halfW,
			sizeU: corridorLength,
			sizeV: passageWidth,
		};
	}

	const sign = Math.sign(passage.z2 - passage.z1) || 1;
	const zStart = fromRoom.z + sign * (fromRoom.depth / 2);
	const zEnd = toRoom.z - sign * (toRoom.depth / 2);
	const cz = (zStart + zEnd) / 2;
	const halfLen = corridorLength / 2;
	const halfW = passageWidth / 2;
	return {
		minX: passage.x1 - halfW,
		maxX: passage.x1 + halfW,
		minZ: cz - halfLen,
		maxZ: cz + halfLen,
		sizeU: passageWidth,
		sizeV: corridorLength,
	};
}

function samplePassageFloorY(layout, passage, x, z) {
	if (!passage.floorCorners) return null;

	const slab = getRampPassageSlab(passage, layout);
	if (!slab) return null;

	if (x < slab.minX || x > slab.maxX || z < slab.minZ || z > slab.maxZ) {
		return null;
	}

	const u = (x - slab.minX) / slab.sizeU;
	const v = (z - slab.minZ) / slab.sizeV;
	return bilinearFloorY(passage.floorCorners, u, v);
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
 * @returns {number|null} interpolated Y height, or null if outside walkable floor
 */
export function sampleFloorY(layout, x, z) {
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
				const u = (x - (room.x - halfW)) / room.width;
				const v = (z - (room.z - halfD)) / room.depth;
				return bilinearFloorY(room.floorCorners, u, v);
			}
		}
	}

	if (layout.passages) {
		for (const passage of layout.passages) {
			const y = samplePassageFloorY(layout, passage, x, z);
			if (y !== null) return y;
		}
	}

	return null;
}
