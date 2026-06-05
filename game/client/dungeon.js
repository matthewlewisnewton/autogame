import * as THREE from 'three';
import {
	wallAABB,
	resolveWallCollision as resolveWallCollisionPure,
	checkSweptCollision as checkSweptCollisionPure,
	isInsideDungeon as isInsideDungeonPure,
	clampToDungeon as clampToDungeonPure,
	tryPlayerMove as tryPlayerMovePure,
	isPositionBlocked as isPositionBlockedPure,
	sampleFloorY,
	DEFAULT_FLOOR_Y,
	resolveFloorY,
} from './collision.js';
import { PASSAGE_WIDTH, BOUNDS_MARGIN } from './config.js';

// ── Visual constants ──

export const WALL_HEIGHT = 2.5;
export const WALL_THICKNESS = 0.4;
export const FLOOR_Y = 0.05; // slightly above background to avoid z-fighting
export const GROUND_Y = -0.02; // background plane sits below room floor bottoms (y=0)
export const PASSAGE_WALL_HEIGHT = 1.5;
export const PASSAGE_WALL_THICKNESS = 0.3;

// ── Shared materials ──

export const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
export const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7 });
export const passageFloorMaterial = new THREE.MeshStandardMaterial({ color: 0x2d3a4a, roughness: 0.8 });
const passageWallMaterial = new THREE.MeshStandardMaterial({ color: 0x3d4f63, roughness: 0.7 });
export const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 1.0 });

// Spire-ascent summit tints — lighter/cooler slate derived from the base dungeon palette
const SPIRE_SUMMIT_FLOOR_HEX = 0x64748b;
const SPIRE_SUMMIT_WALL_HEX = 0x7c8fa3;

const spireTierMaterialsCache = new Map();
const spireRampMaterialsCache = new Map();

function materialColorHex(material) {
	return typeof material.color.getHex === 'function'
		? material.color.getHex()
		: material.color;
}

function lerpColorHex(fromHex, toHex, t) {
	const fr = (fromHex >> 16) & 0xff;
	const fg = (fromHex >> 8) & 0xff;
	const fb = fromHex & 0xff;
	const tr = (toHex >> 16) & 0xff;
	const tg = (toHex >> 8) & 0xff;
	const tb = toHex & 0xff;
	const r = Math.round(fr + (tr - fr) * t);
	const g = Math.round(fg + (tg - fg) * t);
	const b = Math.round(fb + (tb - fb) * t);
	return (r << 16) | (g << 8) | b;
}

/**
 * Cached floor/wall materials for a spire-ascent tier. Tier 0 matches the base
 * dungeon slate; the highest tier lerps toward the summit palette.
 */
export function getSpireAscentTierMaterials(tierIndex, tierCount) {
	const key = `t-${tierCount}-${tierIndex}`;
	if (!spireTierMaterialsCache.has(key)) {
		const t = tierCount <= 1 ? 0 : tierIndex / (tierCount - 1);
		const floorHex = lerpColorHex(materialColorHex(floorMaterial), SPIRE_SUMMIT_FLOOR_HEX, t);
		const wallHex = lerpColorHex(materialColorHex(wallMaterial), SPIRE_SUMMIT_WALL_HEX, t);
		spireTierMaterialsCache.set(key, {
			floor: new THREE.MeshStandardMaterial({ color: floorHex, roughness: 0.8 }),
			wall: new THREE.MeshStandardMaterial({ color: wallHex, roughness: 0.7 }),
		});
	}
	return spireTierMaterialsCache.get(key);
}

/**
 * Cached floor/wall materials for a spire-ascent ramp between two tier indices.
 */
export function getSpireAscentRampMaterials(fromTierIndex, toTierIndex, tierCount) {
	const lo = Math.min(fromTierIndex, toTierIndex);
	const hi = Math.max(fromTierIndex, toTierIndex);
	const key = `r-${tierCount}-${lo}-${hi}`;
	if (!spireRampMaterialsCache.has(key)) {
		const fromMats = getSpireAscentTierMaterials(lo, tierCount);
		const toMats = getSpireAscentTierMaterials(hi, tierCount);
		const floorHex = lerpColorHex(materialColorHex(fromMats.floor), materialColorHex(toMats.floor), 0.5);
		const wallHex = lerpColorHex(materialColorHex(fromMats.wall), materialColorHex(toMats.wall), 0.5);
		spireRampMaterialsCache.set(key, {
			floor: new THREE.MeshStandardMaterial({ color: floorHex, roughness: 0.8 }),
			wall: new THREE.MeshStandardMaterial({ color: wallHex, roughness: 0.7 }),
		});
	}
	return spireRampMaterialsCache.get(key);
}

function getSpireTierCount(layout) {
	const tiers = layout.rooms.filter(r => r.band === 'tier');
	if (tiers.length === 0) return 1;
	return Math.max(...tiers.map(r => r.tierIndex ?? 0)) + 1;
}

function inferSpireRampTierIndices(room, layout) {
	const fc = room.floorCorners;
	if (!fc) return { from: 0, to: 1 };

	const yLow = Math.min(fc.yNW, fc.yNE, fc.ySE, fc.ySW);
	const yHigh = Math.max(fc.yNW, fc.yNE, fc.ySE, fc.ySW);
	const tierRooms = layout.rooms.filter(r => r.band === 'tier' && r.tierIndex != null);

	function yToTier(y) {
		for (const t of tierRooms) {
			const ty = t.floorCorners?.yNW ?? DEFAULT_FLOOR_Y;
			if (Math.abs(ty - y) < 0.001) return t.tierIndex;
		}
		const sorted = [...tierRooms].sort(
			(a, b) => (a.floorCorners?.yNW ?? DEFAULT_FLOOR_Y) - (b.floorCorners?.yNW ?? DEFAULT_FLOOR_Y)
		);
		for (const t of sorted) {
			const ty = t.floorCorners?.yNW ?? DEFAULT_FLOOR_Y;
			if (Math.abs(ty - y) < 0.001) return t.tierIndex;
		}
		return 0;
	}

	return { from: yToTier(yLow), to: yToTier(yHigh) };
}

function resolveSpireRoomMaterials(room, layout, tierCount) {
	if (room.band === 'tier' && room.tierIndex != null) {
		return getSpireAscentTierMaterials(room.tierIndex, tierCount);
	}
	if (room.band === 'ramp') {
		const { from, to } = inferSpireRampTierIndices(room, layout);
		return getSpireAscentRampMaterials(from, to, tierCount);
	}
	return null;
}

// Role-specific floor materials (shared across rooms to avoid per-room allocation)
const roleFloorMaterials = {
	start: new THREE.MeshStandardMaterial({ color: 0x3a5a3a, roughness: 0.8 }),
	combat: floorMaterial, // default — no visual change
	treasure: new THREE.MeshStandardMaterial({ color: 0x5a5a2a, roughness: 0.8 }),
};

// Treasure room marker material (emissive gold pillar)
const treasureMarkerMaterial = new THREE.MeshStandardMaterial({
	color: 0xffd700,
	emissive: 0xaa8800,
	emissiveIntensity: 0.6,
	roughness: 0.4,
});

/**
 * Check whether a room's floorCorners are uniform (flat floor).
 * Returns true if floorCorners is absent or all four values are equal.
 */
export function isUniformFloor(room) {
	const fc = room.floorCorners;
	if (!fc) return true;
	const v = fc.yNW;
	return fc.yNE === v && fc.ySE === v && fc.ySW === v;
}

/**
 * Visual Y for a uniform (flat) room floor mesh.
 * Legacy/default-band rooms use FLOOR_Y; elevated bands (e.g. sunken-canyon plateau)
 * use their uniform corner height.
 */
export function uniformFloorMeshY(room) {
	if (!isUniformFloor(room)) return FLOOR_Y;
	const fc = room.floorCorners;
	if (!fc) return FLOOR_Y;
	if (fc.yNW === DEFAULT_FLOOR_Y) return FLOOR_Y;
	return fc.yNW;
}

/**
 * Build a sloped floor mesh for a room with non-uniform floorCorners.
 * Determines the dominant slope axis (Z or X) by comparing edge averages,
 * then returns a rotated BoxGeometry mesh positioned at the average height.
 *
 * The rotated BoxGeometry is a visual approximation of the bilinear surface
 * defined by `sampleFloorY()`. Minor gaps may appear at room edges for
 * non-axis-aligned corner patterns (e.g. diagonal ramps). This is intentional —
 * a four-corner BufferGeometry match is deferred to a future art pass.
 */
export function buildSlopedFloor(room, floorMat) {
	const fc = room.floorCorners;
	const yNW = fc.yNW;
	const yNE = fc.yNE;
	const ySE = fc.ySE;
	const ySW = fc.ySW;

	// Edge averages to determine dominant slope axis
	const zSlopeDelta = Math.abs((ySW + ySE) / 2 - (yNW + yNE) / 2);
	const xSlopeDelta = Math.abs((yNE + ySE) / 2 - (yNW + ySW) / 2);

	let geo;
	let mesh;

	if (zSlopeDelta >= xSlopeDelta) {
		// Z-slope: ramp along Z axis
		const yDelta = (ySW + ySE) / 2 - (yNW + yNE) / 2;
		const slopeLen = Math.hypot(room.depth, yDelta);
		const angle = Math.atan2(yDelta, room.depth);
		const avgY = (Math.min(yNW, yNE, ySE, ySW) + Math.max(yNW, yNE, ySE, ySW)) / 2;

		geo = new THREE.BoxGeometry(room.width, 0.1, slopeLen);
		mesh = new THREE.Mesh(geo, floorMat);
		mesh.position.set(room.x, avgY, room.z);
		mesh.rotation.x = angle;
	} else {
		// X-slope: ramp along X axis
		const yDelta = (yNE + ySE) / 2 - (yNW + ySW) / 2;
		const slopeLen = Math.hypot(room.width, yDelta);
		const angle = Math.atan2(yDelta, room.width);
		const avgY = (Math.min(yNW, yNE, ySE, ySW) + Math.max(yNW, yNE, ySE, ySW)) / 2;

		geo = new THREE.BoxGeometry(slopeLen, 0.1, room.depth);
		mesh = new THREE.Mesh(geo, floorMat);
		mesh.position.set(room.x, avgY, room.z);
		mesh.rotation.z = -angle;
	}

	return { mesh, geometry: geo };
}

/**
 * Remove all dungeon meshes from the scene and dispose geometries.
 * Shared materials are NOT disposed (they are reused across builds).
 *
 * @param {THREE.Scene} scene
 * @param {THREE.Mesh[]} dungeonMeshes - array to clear
 */
export function clearDungeon(scene, dungeonMeshes) {
	for (const mesh of dungeonMeshes) {
		if (scene) scene.remove(mesh);
		if (mesh.geometry) mesh.geometry.dispose();
		// Do NOT dispose materials — they are shared module-level constants
	}
	dungeonMeshes.length = 0;
}

function findRoomAt(layout, x, z) {
	return layout.rooms.find(r => r.x === x && r.z === z);
}

/**
 * Passage floor geometry should cover only the corridor gap between room edges.
 * Full center-to-center strips overlap room floors and z-fight at doorways.
 */
export function buildPassageFloorSpec(passage, layout) {
	const passageWidth = layout.passageWidth ?? PASSAGE_WIDTH;
	const corridorLength = passage.corridorLength;
	const fromRoom = findRoomAt(layout, passage.x1, passage.z1);
	const toRoom = findRoomAt(layout, passage.x2, passage.z2);

	if (!fromRoom || !toRoom || !Number.isFinite(corridorLength) || corridorLength <= 0) {
		const dx = passage.x2 - passage.x1;
		const dz = passage.z2 - passage.z1;
		const dist = Math.hypot(dx, dz);
		return {
			width: dist,
			height: 0.1,
			depth: passageWidth,
			x: (passage.x1 + passage.x2) / 2,
			z: (passage.z1 + passage.z2) / 2,
			rotationY: Math.atan2(dz, dx),
		};
	}

	if (passage.x1 !== passage.x2) {
		const sign = Math.sign(passage.x2 - passage.x1) || 1;
		const xStart = fromRoom.x + sign * (fromRoom.width / 2);
		const xEnd = toRoom.x - sign * (toRoom.width / 2);
		return {
			width: corridorLength,
			height: 0.1,
			depth: passageWidth,
			x: (xStart + xEnd) / 2,
			z: passage.z1,
			rotationY: 0,
		};
	}

	const sign = Math.sign(passage.z2 - passage.z1) || 1;
	const zStart = fromRoom.z + sign * (fromRoom.depth / 2);
	const zEnd = toRoom.z - sign * (toRoom.depth / 2);
	return {
		width: passageWidth,
		height: 0.1,
		depth: corridorLength,
		x: passage.x1,
		z: (zStart + zEnd) / 2,
		rotationY: 0,
	};
}

/**
 * Build all dungeon geometry (rooms, passages, ground) from a server layout.
 *
 * @param {THREE.Scene} scene
 * @param {object} layout - { rooms, passages } from server
 * @returns {{ meshes: THREE.Mesh[], spawnPosition: {x: number, z: number} }}
 */
export function buildDungeon(scene, layout) {
	if (!layout || !layout.rooms || !layout.passages) {
		return { meshes: [], spawnPosition: { x: 0, z: 0 } };
	}

	const meshes = [];

	// Background ground (large flat plane behind everything)
	const groundGeo = new THREE.PlaneGeometry(200, 200);
	const ground = new THREE.Mesh(groundGeo, groundMaterial);
	ground.rotation.x = -Math.PI / 2;
	ground.position.y = GROUND_Y;
	scene.add(ground);
	meshes.push(ground);

	// Spawn position: center of the room with role 'start' (designated by server),
	// falling back to the first room, or { x: 0, z: 0 } if the layout is empty.
	const startRoom = layout.rooms.find(r => r.role === 'start');
	const spawnRoom = startRoom || (layout.rooms.length > 0 ? layout.rooms[0] : null);
	const spawnPosition = spawnRoom ? { x: spawnRoom.x, z: spawnRoom.z } : { x: 0, z: 0 };

	// ── Build rooms ──
	const isSpireAscent = layout.profile === 'spire-ascent';
	const spireTierCount = isSpireAscent ? getSpireTierCount(layout) : 0;

	for (const room of layout.rooms) {
		const spireMats = isSpireAscent ? resolveSpireRoomMaterials(room, layout, spireTierCount) : null;
		// Pick floor material: spire tier/ramp tints, else role-based fallback
		const floorMat = spireMats?.floor ?? (roleFloorMaterials[room.role] || floorMaterial);
		const roomWallMat = spireMats?.wall ?? wallMaterial;

		// Room floor: flat (legacy or uniform corners) or sloped
		let floorMesh;
		if (isUniformFloor(room)) {
			const floorGeo = new THREE.BoxGeometry(room.width, 0.1, room.depth);
			floorMesh = new THREE.Mesh(floorGeo, floorMat);
			floorMesh.position.set(room.x, uniformFloorMeshY(room), room.z);
		} else {
			const { mesh } = buildSlopedFloor(room, floorMat);
			floorMesh = mesh;
		}
		scene.add(floorMesh);
		meshes.push(floorMesh);

		// Treasure room marker: glowing gold pillar at room center
		if (room.role === 'treasure') {
			const treasureFloorY = resolveFloorY(sampleFloorY(layout, room.x, room.z));
			const markerGeo = new THREE.CylinderGeometry(0.3, 0.3, 1.5, 8);
			const marker = new THREE.Mesh(markerGeo, treasureMarkerMaterial);
			marker.position.set(room.x, 0.75 + treasureFloorY, room.z);
			scene.add(marker);
			meshes.push(marker);
		}

		// Room walls
		for (const wall of room.walls) {
			let wallGeo;
			let wallX, wallZ;

			if (wall.axis === 'x') {
				wallGeo = new THREE.BoxGeometry(wall.length, WALL_HEIGHT, WALL_THICKNESS);
				wallX = wall.x;
				wallZ = wall.z;
			} else {
				wallGeo = new THREE.BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, wall.length);
				wallX = wall.x;
				wallZ = wall.z;
			}

			const wallBaseY = resolveFloorY(sampleFloorY(layout, wallX, wallZ));
			const wallMesh = new THREE.Mesh(wallGeo, roomWallMat);
			wallMesh.position.set(wallX, wallBaseY + WALL_HEIGHT / 2, wallZ);
			scene.add(wallMesh);
			meshes.push(wallMesh);
		}
	}

	// ── Build open-plaza platforms ──
	// Each platform is a gently sloped raised floor patch. It carries the same
	// { width, depth, floorCorners } fields a room needs, so reuse the room
	// sloped-floor builder. A distinguishable existing material keeps the raised
	// surface readable. Guarded by `|| []` so non-plaza layouts are unaffected.
	for (const platform of layout.platforms || []) {
		const { mesh } = buildSlopedFloor(platform, passageFloorMaterial);
		scene.add(mesh);
		meshes.push(mesh);
	}

	// ── Build open-plaza cover pieces ──
	// Each cover entry (pillar = tall box, broken_wall = low box) is a solid
	// obstacle rendered as a box that rests on the floor at its (x, z). A piece
	// sitting on a platform reads the raised surface via sampleFloorY. Guarded by
	// `|| []` so non-plaza layouts are unaffected.
	for (const c of layout.cover || []) {
		const coverGeo = new THREE.BoxGeometry(c.width, c.height, c.depth);
		const coverMesh = new THREE.Mesh(coverGeo, wallMaterial);
		const floorY = resolveFloorY(sampleFloorY(layout, c.x, c.z));
		coverMesh.position.set(c.x, floorY + c.height / 2, c.z);
		scene.add(coverMesh);
		meshes.push(coverMesh);
	}

	// ── Build passages ──
	for (const passage of layout.passages) {
		const floorSpec = buildPassageFloorSpec(passage, layout);
		const passageFloorGeo = new THREE.BoxGeometry(floorSpec.width, floorSpec.height, floorSpec.depth);
		const passageFloor = new THREE.Mesh(passageFloorGeo, passageFloorMaterial);
		passageFloor.position.set(floorSpec.x, FLOOR_Y, floorSpec.z);
		passageFloor.rotation.y = floorSpec.rotationY;
		scene.add(passageFloor);
		meshes.push(passageFloor);

		// Passage side walls
		for (const wall of passage.walls) {
			let wallGeo;
			let wallX, wallZ;

			if (wall.axis === 'x') {
				wallGeo = new THREE.BoxGeometry(wall.length, PASSAGE_WALL_HEIGHT, PASSAGE_WALL_THICKNESS);
				wallX = wall.x;
				wallZ = wall.z;
			} else {
				wallGeo = new THREE.BoxGeometry(PASSAGE_WALL_THICKNESS, PASSAGE_WALL_HEIGHT, wall.length);
				wallX = wall.x;
				wallZ = wall.z;
			}

			const wallBaseY = resolveFloorY(sampleFloorY(layout, wallX, wallZ));
			const wallMesh = new THREE.Mesh(wallGeo, passageWallMaterial);
			wallMesh.position.set(wallX, wallBaseY + PASSAGE_WALL_HEIGHT / 2, wallZ);
			scene.add(wallMesh);
			meshes.push(wallMesh);
		}
	}

	return { meshes, spawnPosition };
}

/**
 * Build an array of wall AABB colliders from a server layout.
 *
 * @param {object} layout - { rooms, passages } from server
 * @returns {{ minX: number, maxX: number, minZ: number, maxZ: number }[]}
 */
export function buildWallColliders(layout) {
	const colliders = [];
	if (!layout || !layout.rooms || !layout.passages) return colliders;

	for (const room of layout.rooms) {
		for (const wall of room.walls) {
			colliders.push(wallAABB(wall, WALL_THICKNESS / 2));
		}
	}
	for (const passage of layout.passages) {
		for (const wall of passage.walls) {
			colliders.push(wallAABB(wall, PASSAGE_WALL_THICKNESS / 2));
		}
	}

	// Open-plaza cover pieces are solid obstacles. Push an AABB for each footprint
	// matching the server's collider (see server simulation.js) so client-side
	// prediction stops the player at cover. Guarded by `|| []` for other layouts.
	for (const c of layout.cover || []) {
		colliders.push({
			minX: c.x - c.width / 2,
			maxX: c.x + c.width / 2,
			minZ: c.z - c.depth / 2,
			maxZ: c.z + c.depth / 2,
		});
	}

	return colliders;
}

/**
 * Compute dungeon AABB bounds from layout rooms.
 * @param {object} layout
 */
export function computeDungeonBounds(layout) {
	let minX = Infinity;
	let maxX = -Infinity;
	let minZ = Infinity;
	let maxZ = -Infinity;

	if (!layout || !layout.rooms) {
		return { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
	}

	for (const room of layout.rooms) {
		const halfW = room.width / 2;
		const halfD = room.depth / 2;
		minX = Math.min(minX, room.x - halfW);
		maxX = Math.max(maxX, room.x + halfW);
		minZ = Math.min(minZ, room.z - halfD);
		maxZ = Math.max(maxZ, room.z + halfD);
	}

	return {
		minX: minX - BOUNDS_MARGIN,
		maxX: maxX + BOUNDS_MARGIN,
		minZ: minZ - BOUNDS_MARGIN,
		maxZ: maxZ + BOUNDS_MARGIN,
	};
}

/**
 * Compute walkable AABBs from the dungeon layout.
 * @param {object} layout
 */
export function computeWalkableAABBs(layout) {
	const aabbs = [];
	if (!layout) return aabbs;

	if (layout.rooms) {
		for (const room of layout.rooms) {
			const halfW = room.width / 2;
			const halfD = room.depth / 2;
			aabbs.push({
				minX: room.x - halfW,
				maxX: room.x + halfW,
				minZ: room.z - halfD,
				maxZ: room.z + halfD,
			});
		}
	}

	if (layout.passages) {
		const halfGap = (layout.passageWidth ?? PASSAGE_WIDTH) / 2;
		for (const p of layout.passages) {
			aabbs.push({
				minX: Math.min(p.x1, p.x2) - halfGap,
				maxX: Math.max(p.x1, p.x2) + halfGap,
				minZ: Math.min(p.z1, p.z2) - halfGap,
				maxZ: Math.max(p.z1, p.z2) + halfGap,
			});
		}
	}

	return aabbs;
}

/**
 * Resolve a proposed player position against a list of wall AABB colliders.
 */
export function resolveWallCollision(newX, newZ, collidersRef, fromX = newX, fromZ = newZ) {
	return resolveWallCollisionPure(newX, newZ, collidersRef, fromX, fromZ);
}

export function checkSweptCollision(fromX, fromZ, toX, toZ, collidersRef, options = {}) {
	return checkSweptCollisionPure(fromX, fromZ, toX, toZ, collidersRef, options);
}

export function tryPlayerMove(fromX, fromZ, dirX, dirZ, distance, collidersRef, walkableAABBsRef, bounds) {
	return tryPlayerMovePure(fromX, fromZ, dirX, dirZ, distance, collidersRef, walkableAABBsRef, bounds);
}

export function isPositionBlocked(x, z, collidersRef) {
	return isPositionBlockedPure(x, z, collidersRef);
}

export function isInsideDungeon(x, z, walkableAABBs) {
	return isInsideDungeonPure(x, z, walkableAABBs);
}

export function clampToDungeon(x, z, bounds) {
	return clampToDungeonPure(x, z, bounds);
}
