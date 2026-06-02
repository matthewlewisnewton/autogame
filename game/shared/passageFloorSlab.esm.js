// Corridor floor slab geometry for passages (aligned with client buildPassageFloorSpec).

export const DEFAULT_PASSAGE_WIDTH = 4;

function findRoomAt(layout, x, z) {
	if (!layout?.rooms) return undefined;
	return layout.rooms.find((r) => r.x === x && r.z === z);
}

/**
 * Compute corridor slab center and size between two connected rooms.
 * Matches buildPassageFloorSpec in game/client/dungeon.js.
 *
 * @param {object} passage
 * @param {object} layout - { rooms, passageWidth? }
 * @returns {{ floorX: number, floorZ: number, floorWidth: number, floorDepth: number, rotationY: number } | null}
 */
export function computePassageFloorSlab(passage, layout) {
	const passageWidth = layout?.passageWidth ?? DEFAULT_PASSAGE_WIDTH;
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
		return {
			floorWidth: corridorLength,
			floorDepth: passageWidth,
			floorX: (xStart + xEnd) / 2,
			floorZ: passage.z1,
			rotationY: 0,
		};
	}

	const sign = Math.sign(passage.z2 - passage.z1) || 1;
	const zStart = fromRoom.z + sign * (fromRoom.depth / 2);
	const zEnd = toRoom.z - sign * (toRoom.depth / 2);
	return {
		floorWidth: passageWidth,
		floorDepth: corridorLength,
		floorX: passage.x1,
		floorZ: (zStart + zEnd) / 2,
		rotationY: 0,
	};
}

/**
 * Resolve passage floor slab fields, preferring explicit passage properties.
 *
 * @param {object} passage
 * @param {object} [layout]
 * @returns {{ floorX: number, floorZ: number, floorWidth: number, floorDepth: number } | null}
 */
export function resolvePassageFloorSlab(passage, layout) {
	const { floorX, floorZ, floorWidth, floorDepth } = passage;
	if (
		Number.isFinite(floorX) &&
		Number.isFinite(floorZ) &&
		Number.isFinite(floorWidth) &&
		Number.isFinite(floorDepth) &&
		floorWidth > 0 &&
		floorDepth > 0
	) {
		return { floorX, floorZ, floorWidth, floorDepth };
	}
	if (!layout) return null;
	const computed = computePassageFloorSlab(passage, layout);
	if (!computed) return null;
	return {
		floorX: computed.floorX,
		floorZ: computed.floorZ,
		floorWidth: computed.floorWidth,
		floorDepth: computed.floorDepth,
	};
}

/**
 * Walkable AABB for a passage: corridor slab when explicit floor fields exist on
 * the passage object, else legacy center-to-center strip (matches server simulation).
 *
 * @param {object} passage
 * @param {number} halfGap - half of layout passage width
 * @returns {{ minX: number, maxX: number, minZ: number, maxZ: number }}
 */
export function passageWalkableAABB(passage, halfGap) {
	const { floorX, floorZ, floorWidth, floorDepth } = passage;
	if (
		Number.isFinite(floorX) &&
		Number.isFinite(floorZ) &&
		Number.isFinite(floorWidth) &&
		Number.isFinite(floorDepth) &&
		floorWidth > 0 &&
		floorDepth > 0
	) {
		const halfW = floorWidth / 2;
		const halfD = floorDepth / 2;
		return {
			minX: floorX - halfW,
			maxX: floorX + halfW,
			minZ: floorZ - halfD,
			maxZ: floorZ + halfD,
		};
	}
	return {
		minX: Math.min(passage.x1, passage.x2) - halfGap,
		maxX: Math.max(passage.x1, passage.x2) + halfGap,
		minZ: Math.min(passage.z1, passage.z2) - halfGap,
		maxZ: Math.max(passage.z1, passage.z2) + halfGap,
	};
}
