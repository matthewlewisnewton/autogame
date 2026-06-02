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
} from './collision.js';
import { PASSAGE_WIDTH, BOUNDS_MARGIN } from './config.js';
import {
	computePassageFloorSlab,
	resolvePassageFloorSlab,
	passageWalkableAABB,
} from '../shared/passageFloorSlab.esm.js';

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

/**
 * Passage floor geometry should cover only the corridor gap between room edges.
 * Full center-to-center strips overlap room floors and z-fight at doorways.
 */
export function buildPassageFloorSpec(passage, layout) {
	const passageWidth = layout.passageWidth ?? PASSAGE_WIDTH;
	const slab = resolvePassageFloorSlab(passage, layout) ?? computePassageFloorSlab(passage, layout);

	if (slab) {
		return {
			width: slab.floorWidth,
			height: 0.1,
			depth: slab.floorDepth,
			x: slab.floorX,
			z: slab.floorZ,
			rotationY: slab.rotationY ?? 0,
		};
	}

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
	for (const room of layout.rooms) {
		// Pick floor material based on room role (graceful fallback to default)
		const floorMat = roleFloorMaterials[room.role] || floorMaterial;

		// Room floor: flat (legacy or uniform corners) or sloped
		let floorMesh;
		if (isUniformFloor(room)) {
			const floorGeo = new THREE.BoxGeometry(room.width, 0.1, room.depth);
			floorMesh = new THREE.Mesh(floorGeo, floorMat);
			floorMesh.position.set(room.x, FLOOR_Y, room.z);
		} else {
			const { mesh } = buildSlopedFloor(room, floorMat);
			floorMesh = mesh;
		}
		scene.add(floorMesh);
		meshes.push(floorMesh);

		// Treasure room marker: glowing gold pillar at room center
		if (room.role === 'treasure') {
			const markerGeo = new THREE.CylinderGeometry(0.3, 0.3, 1.5, 8);
			const marker = new THREE.Mesh(markerGeo, treasureMarkerMaterial);
			marker.position.set(room.x, 0.75 + FLOOR_Y, room.z);
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

			const wallBaseY = sampleFloorY(layout, wallX, wallZ) ?? DEFAULT_FLOOR_Y;
			const wallMesh = new THREE.Mesh(wallGeo, wallMaterial);
			wallMesh.position.set(wallX, wallBaseY + WALL_HEIGHT / 2, wallZ);
			scene.add(wallMesh);
			meshes.push(wallMesh);
		}
	}

	// ── Build passages ──
	for (const passage of layout.passages) {
		const floorSpec = buildPassageFloorSpec(passage, layout);
		const slab = resolvePassageFloorSlab(passage, layout) ?? {
			floorX: floorSpec.x,
			floorZ: floorSpec.z,
			floorWidth: floorSpec.width,
			floorDepth: floorSpec.depth,
		};

		let passageFloor;
		const slopedPassage = passage.floorCorners && !isUniformFloor({ floorCorners: passage.floorCorners });
		if (slopedPassage) {
			const pseudoRoom = {
				x: slab.floorX,
				z: slab.floorZ,
				width: slab.floorWidth,
				depth: slab.floorDepth,
				floorCorners: passage.floorCorners,
			};
			({ mesh: passageFloor } = buildSlopedFloor(pseudoRoom, passageFloorMaterial));
		} else {
			const passageFloorGeo = new THREE.BoxGeometry(floorSpec.width, floorSpec.height, floorSpec.depth);
			passageFloor = new THREE.Mesh(passageFloorGeo, passageFloorMaterial);
			passageFloor.position.set(floorSpec.x, FLOOR_Y, floorSpec.z);
			passageFloor.rotation.y = floorSpec.rotationY;
		}
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

			const wallBaseY = sampleFloorY(layout, wallX, wallZ) ?? DEFAULT_FLOOR_Y;
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
			aabbs.push(passageWalkableAABB(p, halfGap));
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
