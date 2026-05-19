// ── Wall Collision Helpers ──
// Pure functions for AABB wall bounds and player collision resolution.
// No DOM or Three.js dependencies — safe to unit test in Node / jsdom.

const PLAYER_RADIUS = 0.5;

/**
 * Compute the axis-aligned bounding box for a wall segment.
 *
 * @param {{ axis: 'x'|'z', x: number, z: number, length: number }} wall
 * @param {number} halfThickness  — half the wall's physical thickness
 * @returns {{ minX: number, maxX: number, minZ: number, maxZ: number }}
 */
export function wallAABB(wall, halfThickness) {
	if (wall.axis === 'x') {
		return {
			minX: wall.x - wall.length / 2 - halfThickness,
			maxX: wall.x + wall.length / 2 + halfThickness,
			minZ: wall.z - halfThickness,
			maxZ: wall.z + halfThickness,
		};
	} else {
		return {
			minX: wall.x - halfThickness,
			maxX: wall.x + halfThickness,
			minZ: wall.z - wall.length / 2 - halfThickness,
			maxZ: wall.z + wall.length / 2 + halfThickness,
		};
	}
}

/**
 * Resolve a proposed player position against a list of wall AABB colliders.
 *
 * Pushes the player back to the edge of the wall along the axis of least
 * penetration.  A secondary pass handles corner cases where the first push-out
 * still overlaps another wall.
 *
 * @param {number}  newX
 * @param {number}  newZ
 * @param {{ minX: number, maxX: number, minZ: number, maxZ: number }[]} colliders
 * @returns {{ x: number, z: number }}
 */
export function resolveWallCollision(newX, newZ, colliders) {
	// Player bounding box
	const pMinX = newX - PLAYER_RADIUS;
	const pMaxX = newX + PLAYER_RADIUS;
	const pMinZ = newZ - PLAYER_RADIUS;
	const pMaxZ = newZ + PLAYER_RADIUS;

	let resolvedX = newX;
	let resolvedZ = newZ;

	for (const w of colliders) {
		// Quick overlap test
		if (pMaxX <= w.minX || pMinX >= w.maxX || pMaxZ <= w.minZ || pMinZ >= w.maxZ) continue;

		// Compute overlap on each axis
		const overlapX = Math.min(pMaxX - w.minX, w.maxX - pMinX);
		const overlapZ = Math.min(pMaxZ - w.minZ, w.maxZ - pMinZ);

		// Push out along the axis of least penetration
		if (overlapX < overlapZ) {
			const centerX = (pMinX + pMaxX) / 2;
			const wallCX = (w.minX + w.maxX) / 2;
			resolvedX = centerX + (centerX < wallCX ? -overlapX : overlapX);
		} else {
			const centerZ = (pMinZ + pMaxZ) / 2;
			const wallCZ = (w.minZ + w.maxZ) / 2;
			resolvedZ = centerZ + (centerZ < wallCZ ? -overlapZ : overlapZ);
		}

		// Update player box after push-out (colliders are static, so no infinite loop)
		const rMinX = resolvedX - PLAYER_RADIUS;
		const rMaxX = resolvedX + PLAYER_RADIUS;
		const rMinZ = resolvedZ - PLAYER_RADIUS;
		const rMaxZ = resolvedZ + PLAYER_RADIUS;

		// Re-check: if still overlapping on one axis, clamp further
		// (handles corner cases where pushing on one axis still overlaps another wall)
		for (const w2 of colliders) {
			if (rMaxX <= w2.minX || rMinX >= w2.maxX || rMaxZ <= w2.minZ || rMinZ >= w2.maxZ) continue;
			const oX = Math.min(rMaxX - w2.minX, w2.maxX - rMinX);
			const oZ = Math.min(rMaxZ - w2.minZ, w2.maxZ - rMinZ);
			if (oX < oZ) {
				const cX = (rMinX + rMaxX) / 2;
				const wcX = (w2.minX + w2.maxX) / 2;
				resolvedX = cX + (cX < wcX ? -oX : oX);
			} else {
				const cZ = (rMinZ + rMaxZ) / 2;
				const wcZ = (w2.minZ + w2.maxZ) / 2;
				resolvedZ = cZ + (cZ < wcZ ? -oZ : oZ);
			}
		}
	}

	return { x: resolvedX, z: resolvedZ };
}

export { PLAYER_RADIUS };
