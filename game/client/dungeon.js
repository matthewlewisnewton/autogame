import * as THREE from 'three';
import { wallAABB, resolveWallCollision as resolveWallCollisionPure } from './collision.js';
import { PASSAGE_WIDTH } from './config.js';

// ── Visual constants ──

export const WALL_HEIGHT = 2.5;
export const WALL_THICKNESS = 0.4;
export const FLOOR_Y = 0.05; // slightly above background to avoid z-fighting
export const PASSAGE_WALL_HEIGHT = 1.5;
export const PASSAGE_WALL_THICKNESS = 0.3;

// ── Shared materials ──

export const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
export const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7 });
export const passageFloorMaterial = new THREE.MeshStandardMaterial({ color: 0x2d3a4a, roughness: 0.8 });
const passageWallMaterial = new THREE.MeshStandardMaterial({ color: 0x3d4f63, roughness: 0.7 });
export const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 1.0 });

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
	ground.position.y = 0;
	scene.add(ground);
	meshes.push(ground);

	// Spawn position: center of first room
	const spawnPosition = layout.rooms.length > 0
		? { x: layout.rooms[0].x, z: layout.rooms[0].z }
		: { x: 0, z: 0 };

	// ── Build rooms ──
	for (const room of layout.rooms) {
		// Room floor tile (raised slightly)
		const floorGeo = new THREE.BoxGeometry(room.width, 0.1, room.depth);
		const floorMesh = new THREE.Mesh(floorGeo, floorMaterial);
		floorMesh.position.set(room.x, FLOOR_Y, room.z);
		scene.add(floorMesh);
		meshes.push(floorMesh);

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

			const wallMesh = new THREE.Mesh(wallGeo, wallMaterial);
			wallMesh.position.set(wallX, WALL_HEIGHT / 2 + FLOOR_Y, wallZ);
			scene.add(wallMesh);
			meshes.push(wallMesh);
		}
	}

	// ── Build passages ──
	for (const passage of layout.passages) {
		const dx = passage.x2 - passage.x1;
		const dz = passage.z2 - passage.z1;
		const dist = Math.hypot(dx, dz);

		// Passage floor strip
		const passageFloorGeo = new THREE.BoxGeometry(dist, 0.1, PASSAGE_WIDTH);
		const passageFloor = new THREE.Mesh(passageFloorGeo, passageFloorMaterial);
		const midX = (passage.x1 + passage.x2) / 2;
		const midZ = (passage.z1 + passage.z2) / 2;
		passageFloor.position.set(midX, FLOOR_Y, midZ);
		passageFloor.rotation.y = Math.atan2(dz, dx);
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

			const wallMesh = new THREE.Mesh(wallGeo, passageWallMaterial);
			wallMesh.position.set(wallX, PASSAGE_WALL_HEIGHT / 2 + FLOOR_Y, wallZ);
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
			colliders.push(wallAABB({ ...wall, length: passage.corridorLength }, PASSAGE_WALL_THICKNESS / 2));
		}
	}

	return colliders;
}

/**
 * Resolve a proposed player position against a list of wall AABB colliders.
 *
 * @param {number} newX
 * @param {number} newZ
 * @param {{ minX: number, maxX: number, minZ: number, maxZ: number }[]} collidersRef
 * @returns {{ x: number, z: number }}
 */
export function resolveWallCollision(newX, newZ, collidersRef) {
	return resolveWallCollisionPure(newX, newZ, collidersRef);
}
