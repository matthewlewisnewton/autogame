// ── Wall Collision Helpers ──
// Pure functions for AABB wall bounds and player collision resolution.
// Mirrors server/simulation.js so client prediction matches authoritative moves.

const PLAYER_RADIUS = 0.5;

// ── Floor Height Sampling (re-exported from shared module) ──

import {
	sampleFloorY as _sampleFloorY,
	sampleFloorSurface as _sampleFloorSurface,
	DEFAULT_FLOOR_Y as _DEFAULT_FLOOR_Y,
	resolveFloorY as _resolveFloorY,
} from '../shared/floorSampling.esm.js';

export {
	_sampleFloorY as sampleFloorY,
	_sampleFloorSurface as sampleFloorSurface,
	_DEFAULT_FLOOR_Y as DEFAULT_FLOOR_Y,
	_resolveFloorY as resolveFloorY,
};

// ── Booth Proximity Zones (re-exported from shared module) ──

import {
	findBoothInRange as _findBoothInRange,
	BOOTH_INTERACT_RADIUS as _BOOTH_INTERACT_RADIUS,
} from '../shared/boothZones.esm.js';

export {
	_findBoothInRange as findBoothInRange,
	_BOOTH_INTERACT_RADIUS as BOOTH_INTERACT_RADIUS,
};

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
	}

	return {
		minX: wall.x - halfThickness,
		maxX: wall.x + halfThickness,
		minZ: wall.z - wall.length / 2 - halfThickness,
		maxZ: wall.z + wall.length / 2 + halfThickness,
	};
}

/**
 * Check if a player center overlaps any wall collider.
 */
export function isPositionBlocked(x, z, colliders) {
	const pr = PLAYER_RADIUS;
	for (const w of colliders) {
		if (x + pr <= w.minX || x - pr >= w.maxX) continue;
		if (z + pr <= w.minZ || z - pr >= w.maxZ) continue;
		return true;
	}
	return false;
}

/**
 * Move a player using direct movement with axis-separated wall sliding.
 * Matches the enemy movement model in server/simulation.js.
 */
export function tryPlayerMove(fromX, fromZ, dirX, dirZ, distance, colliders, walkableAABBs, bounds) {
	if (isPositionBlocked(fromX, fromZ, colliders)) {
		const resolved = resolveWallCollision(fromX, fromZ, colliders, fromX, fromZ);
		fromX = resolved.x;
		fromZ = resolved.z;
	}

	const moveX = dirX * distance;
	const moveZ = dirZ * distance;

	function attempt(targetX, targetZ) {
		const clamped = clampToDungeon(targetX, targetZ, bounds);
		const resolved = resolveWallCollision(clamped.x, clamped.z, colliders, fromX, fromZ);
		if (!isInsideDungeon(resolved.x, resolved.z, walkableAABBs)) return null;
		if (isPositionBlocked(resolved.x, resolved.z, colliders)) return null;
		if (checkSweptCollision(fromX, fromZ, resolved.x, resolved.z, colliders, { allowEndpointTouch: true })) {
			return null;
		}
		return resolved;
	}

	const direct = attempt(fromX + moveX, fromZ + moveZ);
	if (direct) {
		return {
			x: direct.x,
			z: direct.z,
			moved: direct.x !== fromX || direct.z !== fromZ,
		};
	}

	if (Math.abs(moveX) > 1e-8) {
		const xSlide = attempt(fromX + moveX, fromZ);
		if (xSlide && (Math.abs(xSlide.x - fromX) > 1e-8 || Math.abs(xSlide.z - fromZ) > 1e-8)) {
			return { x: xSlide.x, z: xSlide.z, moved: true };
		}
	}

	if (Math.abs(moveZ) > 1e-8) {
		const zSlide = attempt(fromX, fromZ + moveZ);
		if (zSlide && (Math.abs(zSlide.x - fromX) > 1e-8 || Math.abs(zSlide.z - fromZ) > 1e-8)) {
			return { x: zSlide.x, z: zSlide.z, moved: true };
		}
	}

	return { x: fromX, z: fromZ, moved: false };
}

/**
 * Resolve a proposed player position against wall colliders.
 * When the previous position is provided, push back to that side of the wall
 * so the player cannot tunnel through by landing inside the wall volume.
 */
export function resolveWallCollision(newX, newZ, colliders, fromX = newX, fromZ = newZ) {
	let resolvedX = newX;
	let resolvedZ = newZ;

	for (let pass = 0; pass < 2; pass++) {
		let adjusted = false;

		for (const w of colliders) {
			const pMinX = resolvedX - PLAYER_RADIUS;
			const pMaxX = resolvedX + PLAYER_RADIUS;
			const pMinZ = resolvedZ - PLAYER_RADIUS;
			const pMaxZ = resolvedZ + PLAYER_RADIUS;

			if (pMaxX <= w.minX || pMinX >= w.maxX || pMaxZ <= w.minZ || pMinZ >= w.maxZ) continue;

			const overlapX = Math.min(pMaxX - w.minX, w.maxX - pMinX);
			const overlapZ = Math.min(pMaxZ - w.minZ, w.maxZ - pMinZ);

			if (overlapX < overlapZ) {
				if (fromX + PLAYER_RADIUS <= w.minX) {
					resolvedX = w.minX - PLAYER_RADIUS;
				} else if (fromX - PLAYER_RADIUS >= w.maxX) {
					resolvedX = w.maxX + PLAYER_RADIUS;
				} else {
					const wallCX = (w.minX + w.maxX) / 2;
					resolvedX += resolvedX < wallCX ? -overlapX : overlapX;
				}
			} else if (fromZ + PLAYER_RADIUS <= w.minZ) {
				resolvedZ = w.minZ - PLAYER_RADIUS;
			} else if (fromZ - PLAYER_RADIUS >= w.maxZ) {
				resolvedZ = w.maxZ + PLAYER_RADIUS;
			} else {
				const wallCZ = (w.minZ + w.maxZ) / 2;
				resolvedZ += resolvedZ < wallCZ ? -overlapZ : overlapZ;
			}

			adjusted = true;
		}

		if (!adjusted) break;
	}

	return { x: resolvedX, z: resolvedZ };
}

function segmentAABBEntryT(x1, z1, x2, z2, aabb) {
	const dx = x2 - x1;
	const dz = z2 - z1;

	let tmin = 0;
	let tmax = 1;

	if (Math.abs(dx) > 1e-8) {
		let t0 = (aabb.minX - x1) / dx;
		let t1 = (aabb.maxX - x1) / dx;
		if (t0 > t1) { const tmp = t0; t0 = t1; t1 = tmp; }
		tmin = Math.max(tmin, t0);
		tmax = Math.min(tmax, t1);
		if (tmin > tmax) return null;
	} else if (x1 <= aabb.minX || x1 >= aabb.maxX) {
		return null;
	}

	if (Math.abs(dz) > 1e-8) {
		let t0 = (aabb.minZ - z1) / dz;
		let t1 = (aabb.maxZ - z1) / dz;
		if (t0 > t1) { const tmp = t0; t0 = t1; t1 = tmp; }
		tmin = Math.max(tmin, t0);
		tmax = Math.min(tmax, t1);
		if (tmin > tmax) return null;
	} else if (z1 <= aabb.minZ || z1 >= aabb.maxZ) {
		return null;
	}

	return tmin;
}

/**
 * Check if the movement segment intersects any wall collider expanded by PLAYER_RADIUS.
 */
export function checkSweptCollision(fromX, fromZ, toX, toZ, colliders, options = {}) {
	const pr = PLAYER_RADIUS;

	for (const w of colliders) {
		const aabb = {
			minX: w.minX - pr,
			maxX: w.maxX + pr,
			minZ: w.minZ - pr,
			maxZ: w.maxZ + pr,
		};

		if (options.allowEndpointTouch) {
			const entryT = segmentAABBEntryT(fromX, fromZ, toX, toZ, aabb);
			if (entryT == null) continue;
			// Standing in the expanded shell beside a wall is valid — don't block wall-slide.
			if (entryT <= 1e-8 && !isPositionBlocked(fromX, fromZ, colliders)) continue;
			if (entryT < 1 - 1e-8) return true;
		}
	}

	return false;
}

/**
 * Check if (x, z) is inside any walkable AABB.
 */
export function isInsideDungeon(x, z, walkableAABBs) {
	if (!walkableAABBs || walkableAABBs.length === 0) return false;

	for (const a of walkableAABBs) {
		if (x >= a.minX && x <= a.maxX && z >= a.minZ && z <= a.maxZ) {
			return true;
		}
	}
	return false;
}

/**
 * Clamps (x, z) to dungeon AABB bounds.
 */
export function clampToDungeon(x, z, bounds) {
	if (!bounds) return { x, z };
	return {
		x: Math.max(bounds.minX, Math.min(bounds.maxX, x)),
		z: Math.max(bounds.minZ, Math.min(bounds.maxZ, z)),
	};
}

export { PLAYER_RADIUS };
