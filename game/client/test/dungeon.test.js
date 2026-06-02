import { describe, it, expect } from 'vitest';
import { buildDungeon, buildWallColliders, buildPassageFloorSpec, isUniformFloor, buildSlopedFloor, clearDungeon, coverAABB, coverHeight, FLOOR_Y, WALL_HEIGHT } from '../dungeon.js';
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

	it('appends one footprint AABB per cover piece, matching coverAABB', () => {
		const cover = [
			{ x: 10, z: 10, width: 2, depth: 2, height: 3.0, type: 'pillar' },
			{ x: -10, z: 8, width: 4, depth: 1, height: 1.2, type: 'brokenWall' },
			{ x: 8, z: -12, width: 2.5, depth: 2.5, height: 0.8, type: 'planter' },
		];
		const layout = {
			rooms: [{ x: 0, z: 0, width: 40, depth: 40, role: 'start', walls: [] }],
			passages: [],
			cover,
		};
		// Room has no walls and there are no passages, so every collider is cover.
		const colliders = buildWallColliders(layout);
		expect(colliders.length).toBe(cover.length);

		// Each collider equals the piece footprint (no inflation), matching server.
		for (const piece of cover) {
			const expected = coverAABB(piece);
			const match = colliders.find(c =>
				c.minX === expected.minX && c.maxX === expected.maxX &&
				c.minZ === expected.minZ && c.maxZ === expected.maxZ
			);
			expect(match).toBeDefined();
		}
	});

	it('omits cover colliders when the layout has no cover array', () => {
		const layout = {
			rooms: [{ x: 0, z: 0, width: 10, depth: 10, role: 'start', walls: [{ axis: 'x', x: 0, z: -5, length: 10 }] }],
			passages: [],
		};
		expect(buildWallColliders(layout).length).toBe(1);
	});

	it('produces a cover collider per piece on a server-generated open-plaza layout', () => {
		const layout = generateLayout(7, 'open-plaza');
		const colliders = buildWallColliders(layout);
		const wallColliders = layout.rooms.reduce((n, r) => n + r.walls.length, 0);
		expect(colliders.length).toBe(wallColliders + layout.cover.length);
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
	it('renders flat rooms identically when floorCorners are uniform', () => {
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
		expect(floor.position.y).toBe(FLOOR_Y);
		expect(floor.rotation.x).toBe(0);
		expect(floor.rotation.z).toBe(0);
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
		// Room 2: flat at FLOOR_Y, no rotation
		expect(result.meshes[3].position.y).toBe(FLOOR_Y);
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

	it('renders open-plaza cover pieces as boxes plus sloped platforms', () => {
		const cover = [
			{ x: 10, z: 10, width: 2, depth: 2, height: 3.0, type: 'pillar' },
			{ x: -10, z: 8, width: 4, depth: 1, height: 1.2, type: 'brokenWall' },
			{ x: 8, z: -12, width: 2.5, depth: 2.5, height: 0.8, type: 'planter' },
			// Two pieces carry a gently sloped, walkable platform (apron larger
			// than the cover footprint, centered on the piece).
			{
				x: -8, z: -8, width: 2, depth: 2, height: 3.0, type: 'pillar',
				platform: { width: 4, depth: 4, floorCorners: { yNW: 0.5, yNE: 0.5, ySE: 1.0, ySW: 1.0 } },
			},
			{
				x: 14, z: -4, width: 4, depth: 1, height: 1.2, type: 'brokenWall',
				platform: { width: 6, depth: 3, floorCorners: { yNW: 0.5, yNE: 0.5, ySE: 1.0, ySW: 1.0 } },
			},
		];
		const layout = {
			rooms: [
				{ x: 0, z: 0, width: 40, depth: 40, role: 'start', walls: [], floorCorners: { yNW: 0.5, yNE: 0.5, ySE: 0.5, ySW: 0.5 } },
			],
			passages: [],
			cover,
		};
		const scene = mockScene();
		const result = buildDungeon(scene, layout);

		// One box mesh per cover piece, seated at its footprint center.
		const coverBoxes = result.meshes.filter(m =>
			cover.some(c => m.position.x === c.x && m.position.z === c.z && m.geometry?.parameters?.height === coverHeight(c))
		);
		expect(coverBoxes.length).toBe(cover.length);

		// One sloped platform mesh per piece that carries a platform. The patch
		// spans the larger platform footprint but is centered on the piece.
		const slopedCount = cover.filter(c => c.platform).length;
		const platforms = result.meshes.filter(m =>
			m.geometry?.parameters?.height === 0.1 &&
			cover.some(c => m.position.x === c.x && m.position.z === c.z)
		);
		expect(platforms.length).toBe(slopedCount);

		// Each platform patch is sized to the platform footprint (the walkable
		// apron), strictly larger than the cover box footprint underneath it.
		for (const c of cover.filter(p => p.platform)) {
			const box = result.meshes.find(m =>
				m.position.x === c.x && m.position.z === c.z &&
				m.geometry?.parameters?.height === coverHeight(c)
			);
			const patch = result.meshes.find(m =>
				m.position.x === c.x && m.position.z === c.z &&
				m.geometry?.parameters?.height === 0.1
			);
			expect(box).toBeDefined();
			expect(patch).toBeDefined();
			// The slope patch footprint covers the apron, wider/deeper than the box.
			const patchW = patch.geometry.parameters.width;
			const patchD = patch.geometry.parameters.depth;
			expect(Math.max(patchW, patchD)).toBeGreaterThan(Math.max(c.width, c.depth));
		}

		// Total = ground(1) + plaza floor(1) + cover boxes + platforms.
		expect(result.meshes.length).toBe(2 + cover.length + slopedCount);

		// All meshes (including cover) are added to the scene and tracked for cleanup.
		expect(scene.added.length).toBe(result.meshes.length);
	});

	it('builds a layout without a cover array (backward compatible)', () => {
		const layout = {
			rooms: [
				{ x: 0, z: 0, width: 10, depth: 10, role: 'start', walls: [] },
			],
			passages: [],
		};
		const scene = mockScene();
		expect(() => buildDungeon(scene, layout)).not.toThrow();
		// ground(0) + floor(1), no cover meshes.
		expect(buildDungeon(mockScene(), layout).meshes.length).toBe(2);
	});

	it('clearDungeon removes and disposes all cover/platform meshes (no leak)', () => {
		const layout = generateLayout(7, 'open-plaza');
		const scene = mockScene();
		scene.remove = function (mesh) { this.added = this.added.filter(m => m !== mesh); };
		const { meshes } = buildDungeon(scene, layout);

		const tracked = [...meshes];
		expect(tracked.length).toBeGreaterThan(0);
		const disposed = new Set();
		for (const m of tracked) {
			const orig = m.geometry.dispose.bind(m.geometry);
			m.geometry.dispose = () => { disposed.add(m); orig(); };
		}

		clearDungeon(scene, meshes);

		expect(meshes.length).toBe(0);
		expect(disposed.size).toBe(tracked.length);
		expect(scene.added.length).toBe(0);
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
});
