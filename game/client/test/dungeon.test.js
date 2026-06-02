import { describe, it, expect } from 'vitest';
import {
	buildDungeon,
	buildWallColliders,
	buildPassageFloorSpec,
	isUniformFloor,
	uniformFloorElevation,
	buildSlopedFloor,
	FLOOR_Y,
	WALL_HEIGHT,
	PASSAGE_WALL_HEIGHT,
} from '../dungeon.js';
import { generateLayout } from '../../server/dungeon.js';
import { sampleFloorY, DEFAULT_FLOOR_Y } from '../../shared/floorSampling.esm.js';
import * as THREE from 'three';

/** Minimal mock scene that `buildDungeon` only needs `.add()` on. */
function mockScene() {
	const added = [];
	const scene = { add: function (mesh) { added.push(mesh); } };
	scene.added = added;
	return scene;
}

/** Build a minimal room object suitable for `buildDungeon`. */
function room(x, z, opts = {}) {
	return {
		x,
		z,
		width: opts.width ?? 8,
		depth: opts.depth ?? 8,
		role: opts.role ?? null,
		walls: opts.walls ?? [],
	};
}

describe('buildDungeon() spawn position', () => {
	it('selects spawn position from the room with role "start" even at non-zero index', () => {
		const layout = {
			rooms: [
				room(10, 10, { role: 'combat' }),
				room(20, 20, { role: 'combat' }),
				room(30, 30, { role: 'start' }),  // start at index 2
				room(40, 40, { role: 'treasure' }),
			],
			passages: [],
		};

		const result = buildDungeon(mockScene(), layout);

		expect(result.spawnPosition.x).toBe(30);
		expect(result.spawnPosition.z).toBe(30);
	});

	it('falls back to rooms[0] center when no room has role "start"', () => {
		const layout = {
			rooms: [
				room(5, 15, { role: 'combat' }),
				room(25, 35, { role: 'treasure' }),
			],
			passages: [],
		};

		const result = buildDungeon(mockScene(), layout);

		expect(result.spawnPosition.x).toBe(5);
		expect(result.spawnPosition.z).toBe(15);
	});
});

describe('buildWallColliders()', () => {
	it('uses passage wall.length for colliders so they match rendered geometry', () => {
		const layout = {
			rooms: [],
			passages: [{
				x1: 0, z1: 0, x2: 20, z2: 0,
				corridorLength: 4,
				walls: [{ x: 10, z: -2, length: 20, axis: 'x' }],
			}],
		};

		const [collider] = buildWallColliders(layout);
		expect(collider.maxX - collider.minX).toBeCloseTo(20 + 0.3);
	});
});

describe('buildPassageFloorSpec()', () => {
	it('spans only the corridor gap between room edges, not full center-to-center distance', () => {
		const layout = generateLayout(42, 'crowded');
		const passage = layout.passages.find(p => p.x1 !== p.x2);
		expect(passage).toBeDefined();

		const spec = buildPassageFloorSpec(passage, layout);
		const centerDist = Math.hypot(passage.x2 - passage.x1, passage.z2 - passage.z1);
		expect(spec.width).toBeCloseTo(passage.corridorLength, 5);
		expect(spec.width).toBeLessThan(centerDist);
	});
});

describe('isUniformFloor()', () => {
	it('returns true when floorCorners is absent', () => {
		expect(isUniformFloor({ x: 0, z: 0, width: 10, depth: 10 })).toBe(true);
	});

	it('returns true when all four corners are equal', () => {
		const room = { x: 0, z: 0, width: 10, depth: 10, floorCorners: { yNW: 0.5, yNE: 0.5, ySE: 0.5, ySW: 0.5 } };
		expect(isUniformFloor(room)).toBe(true);
	});

	it('returns false when corners differ', () => {
		const room = { x: 0, z: 0, width: 10, depth: 10, floorCorners: { yNW: 0.5, yNE: 0.5, ySE: 2.0, ySW: 2.0 } };
		expect(isUniformFloor(room)).toBe(false);
	});
});

describe('buildSlopedFloor()', () => {
	it('produces a Z-slope mesh with non-zero rotation.x when north-south ramp', () => {
		const room = { x: 0, z: 0, width: 12, depth: 12, floorCorners: { yNW: 0.5, yNE: 0.5, ySE: 2.0, ySW: 2.0 } };
		const mat = new THREE.MeshStandardMaterial({ color: 0xff00ff });
		const { mesh } = buildSlopedFloor(room, mat);

		expect(mesh.rotation.x).toBeGreaterThan(0);
		// angle = atan2(1.5, 12) ≈ 0.124
		expect(mesh.rotation.x).toBeCloseTo(Math.atan2(1.5, 12), 4);
		expect(mesh.position.x).toBe(0);
		expect(mesh.position.z).toBe(0);
		// avgY = (0.5 + 2.0) / 2 = 1.25
		expect(mesh.position.y).toBeCloseTo(1.25, 4);
	});

	it('produces an X-slope mesh with non-zero rotation.z when east-west ramp', () => {
		const room = { x: 5, z: 5, width: 14, depth: 10, floorCorners: { yNW: 0.5, yNE: 2.0, ySE: 2.0, ySW: 0.5 } };
		const mat = new THREE.MeshStandardMaterial({ color: 0xff00ff });
		const { mesh } = buildSlopedFloor(room, mat);

		expect(Math.abs(mesh.rotation.z)).toBeGreaterThan(0.01);
		// angle = atan2(1.5, 14) ≈ 0.106; rotation.z = -angle
		expect(mesh.rotation.z).toBeCloseTo(-Math.atan2(1.5, 14), 4);
		expect(mesh.position.x).toBe(5);
		expect(mesh.position.z).toBe(5);
	});
});

describe('buildDungeon() with floorCorners', () => {
	it('renders uniform floorCorners at the shared corner Y', () => {
		const layout = {
			rooms: [
				{ x: 0, z: 0, width: 10, depth: 10, role: 'start', walls: [], floorCorners: { yNW: 0.5, yNE: 0.5, ySE: 0.5, ySW: 0.5 } },
			],
			passages: [],
		};
		const scene = mockScene();
		const result = buildDungeon(scene, layout);

		// ground (index 0) + floor (index 1)
		expect(result.meshes.length).toBe(2);
		const floor = result.meshes[1];
		expect(floor.position.y).toBeCloseTo(0.5, 4);
		expect(floor.rotation.x).toBe(0);
		expect(floor.rotation.z).toBe(0);
	});

	it('renders uniform floorCorners at Y=0 using legacy FLOOR_Y', () => {
		const layout = {
			rooms: [
				{ x: 0, z: 0, width: 10, depth: 10, role: 'start', walls: [], floorCorners: { yNW: 0, yNE: 0, ySE: 0, ySW: 0 } },
			],
			passages: [],
		};
		const scene = mockScene();
		const result = buildDungeon(scene, layout);

		const floor = result.meshes[1];
		expect(floor.position.y).toBe(FLOOR_Y);
	});

	it('renders flat rooms identically when floorCorners is absent (legacy)', () => {
		const layout = {
			rooms: [
				{ x: 0, z: 0, width: 10, depth: 10, role: 'start', walls: [] },
			],
			passages: [],
		};
		const scene = mockScene();
		const result = buildDungeon(scene, layout);

		expect(result.meshes.length).toBe(2);
		const floor = result.meshes[1];
		expect(floor.position.y).toBe(FLOOR_Y);
		expect(floor.rotation.x).toBe(0);
		expect(floor.rotation.z).toBe(0);
	});

	it('renders sloped rooms with rotated floor mesh', () => {
		const layout = {
			rooms: [
				{ x: 0, z: 0, width: 12, depth: 12, role: 'start', walls: [], floorCorners: { yNW: 0.5, yNE: 0.5, ySE: 2.0, ySW: 2.0 } },
			],
			passages: [],
		};
		const scene = mockScene();
		const result = buildDungeon(scene, layout);

		// ground (index 0) + sloped floor (index 1)
		expect(result.meshes.length).toBe(2);
		const floor = result.meshes[1];
		expect(floor.rotation.x).toBeGreaterThan(0);
		// Position Y should be average of min/max corner Y = (0.5 + 2.0) / 2 = 1.25
		expect(floor.position.y).toBeCloseTo(1.25, 4);
	});

	it('handles mixed flat and sloped rooms in same layout', () => {
		const layout = {
			rooms: [
				{ x: 0, z: 0, width: 10, depth: 10, role: 'start', walls: [] }, // legacy flat
				{ x: 20, z: 0, width: 12, depth: 12, role: 'combat', walls: [], floorCorners: { yNW: 0.5, yNE: 0.5, ySE: 2.0, ySW: 2.0 } }, // sloped
				{ x: 0, z: 20, width: 10, depth: 10, role: 'combat', walls: [], floorCorners: { yNW: 0.5, yNE: 0.5, ySE: 0.5, ySW: 0.5 } }, // explicit flat
			],
			passages: [],
		};
		const scene = mockScene();
		const result = buildDungeon(scene, layout);

		// ground(0) + 3 floors = 4 meshes
		expect(result.meshes.length).toBe(4);
		// Room 0: flat at FLOOR_Y, no rotation
		expect(result.meshes[1].position.y).toBe(FLOOR_Y);
		expect(result.meshes[1].rotation.x).toBe(0);
		// Room 1: sloped, rotated
		expect(result.meshes[2].rotation.x).toBeGreaterThan(0);
		// Room 2: uniform explicit flat at corner Y
		expect(result.meshes[3].position.y).toBeCloseTo(0.5, 4);
		expect(result.meshes[3].rotation.x).toBe(0);
	});

	it('works with server-generated sloped layout', () => {
		const layout = generateLayout(42, 'default', { slopes: true });
		const scene = mockScene();
		const result = buildDungeon(scene, layout);

		// At least one room should have a sloped floor (non-zero rotation)
		const sloped = result.meshes.slice(1).find(m => Math.abs(m.rotation.x) > 0.01 || Math.abs(m.rotation.z) > 0.01);
		expect(sloped).toBeDefined();

		// Start room should remain flat (spawn area is index 0, skipped by slope gen)
		const startRoom = layout.rooms.find(r => r.role === 'start');
		expect(startRoom).toBeDefined();
		expect(isUniformFloor(startRoom)).toBe(true);
	});

	it('positions wall Y on sloped rooms using sampleFloorY', () => {
		const roomCenter = { x: 0, z: 0 };
		const roomW = 10;
		const roomD = 10;
		const halfW = roomW / 2;
		const halfD = roomD / 2;

		// Z-slope: back (NW/SW) at 0.5, front (NE/SE) at 2.0
		const slopedRoom = {
			x: roomCenter.x,
			z: roomCenter.z,
			width: roomW,
			depth: roomD,
			role: 'combat',
			floorCorners: { yNW: 0.5, yNE: 2.0, ySE: 2.0, ySW: 0.5 },
			walls: [
				// Back wall (axis x, centered at z = -halfD)
				{ axis: 'x', x: 0, z: -halfD, length: roomW },
				// Front wall (axis x, centered at z = +halfD)
				{ axis: 'x', x: 0, z: halfD, length: roomW },
				// Left wall (axis z, centered at x = -halfW)
				{ axis: 'z', x: -halfW, z: 0, length: roomD },
				// Right wall (axis z, centered at x = +halfW)
				{ axis: 'z', x: halfW, z: 0, length: roomD },
			],
		};

		const layout = { rooms: [slopedRoom], passages: [] };
		const scene = mockScene();
		const result = buildDungeon(scene, layout);

		// ground(0) + floor(1) + 4 walls = 6 meshes
		expect(result.meshes.length).toBe(6);

		// Verify each wall's position.y = sampleFloorY(layout, wallX, wallZ) + WALL_HEIGHT / 2
		for (const wall of slopedRoom.walls) {
			const expectedBaseY = sampleFloorY(layout, wall.x, wall.z);
			expect(expectedBaseY).not.toBeNull();

			const wallMesh = result.meshes.slice(2).find(m =>
				m.position.x === wall.x && m.position.z === wall.z
			);
			expect(wallMesh).toBeDefined();
			expect(wallMesh.position.y).toBeCloseTo(expectedBaseY + WALL_HEIGHT / 2, 4);
		}
	});

	it('positions treasure marker using sampleFloorY', () => {
		const layout = {
			rooms: [
				{
					x: 0,
					z: 0,
					width: 10,
					depth: 10,
					role: 'treasure',
					walls: [],
					floorCorners: { yNW: 2, yNE: 2, ySE: 2, ySW: 2 },
				},
			],
			passages: [],
		};
		const scene = mockScene();
		const result = buildDungeon(scene, layout);

		// ground + floor + treasure pillar
		expect(result.meshes.length).toBe(3);
		const marker = result.meshes[2];
		const floorY = sampleFloorY(layout, 0, 0) ?? DEFAULT_FLOOR_Y;
		expect(marker.position.y).toBeCloseTo(0.75 + floorY, 4);
	});

	it('positions passage floor and walls using sampleFloorY', () => {
		const layout = generateLayout(42, 'crowded');
		const passage = layout.passages.find(p => p.walls && p.walls.length > 0);
		expect(passage).toBeDefined();

		const scene = mockScene();
		const result = buildDungeon(scene, layout);
		const floorSpec = buildPassageFloorSpec(passage, layout);
		const expectedFloorY = sampleFloorY(layout, floorSpec.x, floorSpec.z) ?? DEFAULT_FLOOR_Y;

		const passageFloor = result.meshes.find(m =>
			m.position.x === floorSpec.x &&
			m.position.z === floorSpec.z &&
			Math.abs(m.position.y - expectedFloorY) < 0.01
		);
		expect(passageFloor).toBeDefined();

		const wall = passage.walls[0];
		const expectedWallY = (sampleFloorY(layout, wall.x, wall.z) ?? DEFAULT_FLOOR_Y) + PASSAGE_WALL_HEIGHT / 2;
		const passageWall = result.meshes.find(m =>
			m.position.x === wall.x && m.position.z === wall.z
		);
		expect(passageWall).toBeDefined();
		expect(passageWall.position.y).toBeCloseTo(expectedWallY, 4);
	});
});

describe('uniformFloorElevation()', () => {
	it('returns shared Y for uniform floorCorners', () => {
		const room = { floorCorners: { yNW: 10, yNE: 10, ySE: 10, ySW: 10 } };
		expect(uniformFloorElevation(room)).toBe(10);
	});

	it('returns null when floorCorners are absent', () => {
		expect(uniformFloorElevation({})).toBeNull();
	});
});

describe('buildDungeon() sunken-canyon elevation bands', () => {
	function roomFloorMesh(meshes, room) {
		return meshes.find(m =>
			m.position.x === room.x &&
			m.position.z === room.z &&
			m.rotation.x === 0 &&
			m.rotation.z === 0
		);
	}

	it('plateau and canyon uniform floors match band Y with drop >= 8', () => {
		const layout = generateLayout(42, undefined, { stage: 'sunken-canyon', slopes: true });
		const plateau = layout.rooms.find(r => r.elevationBand === 'plateau');
		const canyon = layout.rooms.find(r => r.elevationBand === 'canyon');
		expect(plateau).toBeDefined();
		expect(canyon).toBeDefined();
		expect(uniformFloorElevation(plateau)).toBe(10);
		expect(uniformFloorElevation(canyon)).toBe(2);

		const scene = mockScene();
		const { meshes } = buildDungeon(scene, layout);
		const plateauFloor = roomFloorMesh(meshes, plateau);
		const canyonFloor = roomFloorMesh(meshes, canyon);
		expect(plateauFloor).toBeDefined();
		expect(canyonFloor).toBeDefined();
		expect(plateauFloor.position.y).toBeCloseTo(10, 2);
		expect(canyonFloor.position.y).toBeCloseTo(2, 2);
		expect(plateauFloor.position.y - canyonFloor.position.y).toBeGreaterThanOrEqual(8);
	});
});
