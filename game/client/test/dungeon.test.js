import { describe, it, expect } from 'vitest';
import {
	buildDungeon,
	buildWallColliders,
	buildPassageFloorSpec,
	isUniformFloor,
	buildSlopedFloor,
	uniformFloorMeshY,
	computeDungeonBounds,
	FLOOR_Y,
	WALL_HEIGHT,
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

describe('open-plaza cover & platforms', () => {
	// Synthetic plaza: one flat room, two cover pieces (one on the platform,
	// one on the flat floor), and one gently sloped platform.
	function plazaLayout() {
		return {
			rooms: [{
				x: 0, z: 0, width: 40, depth: 40, role: 'start', walls: [],
				floorCorners: { yNW: DEFAULT_FLOOR_Y, yNE: DEFAULT_FLOOR_Y, ySE: DEFAULT_FLOOR_Y, ySW: DEFAULT_FLOOR_Y },
			}],
			passages: [],
			platforms: [
				{ x: -9, z: -9, width: 6, depth: 6, floorCorners: { yNW: 1.0, yNE: 1.3, ySE: 1.4, ySW: 1.1 } },
			],
			cover: [
				{ x: -9, z: -9, width: 1.6, depth: 1.6, height: 3.0, type: 'pillar' },       // on platform
				{ x: 5, z: 5, width: 4.0, depth: 1.2, height: 1.0, type: 'broken_wall' },     // on flat floor
			],
		};
	}

	it('buildWallColliders emits one AABB per cover piece with the correct footprint', () => {
		const layout = plazaLayout();
		const colliders = buildWallColliders(layout);

		// No room/passage walls here, so every collider is a cover footprint.
		expect(colliders.length).toBe(layout.cover.length);

		for (const c of layout.cover) {
			const match = colliders.find(col =>
				col.minX === c.x - c.width / 2 && col.maxX === c.x + c.width / 2 &&
				col.minZ === c.z - c.depth / 2 && col.maxZ === c.z + c.depth / 2
			);
			expect(match).toBeDefined();
		}
	});

	it('buildDungeon returns one mesh per cover piece and per platform', () => {
		const layout = plazaLayout();
		const result = buildDungeon(mockScene(), layout);

		// ground(1) + plaza floor(1) + platform(1) + 2 cover = 5 meshes
		expect(result.meshes.length).toBe(1 + 1 + layout.platforms.length + layout.cover.length);
	});

	it('rests each cover box on the floor: base at sampleFloorY, centered at floorY + height/2', () => {
		const layout = plazaLayout();
		const result = buildDungeon(mockScene(), layout);

		for (const c of layout.cover) {
			const floorY = sampleFloorY(layout, c.x, c.z);
			// Match the cover box by its (x, z) and box height — the platform mesh
			// can share a pillar's (x, z) but uses a thin sloped-floor geometry.
			const mesh = result.meshes.find(m =>
				m.position.x === c.x && m.position.z === c.z &&
				m.geometry.parameters && m.geometry.parameters.height === c.height
			);
			expect(mesh).toBeDefined();
			expect(mesh.position.y).toBeCloseTo(floorY + c.height / 2, 4);
		}

		// The pillar standing on the platform sits higher than the floor cover.
		const onPlatform = sampleFloorY(layout, -9, -9);
		expect(onPlatform).toBeGreaterThan(DEFAULT_FLOOR_Y);
	});

	it('renders existing room/passage layouts unchanged when cover/platforms are absent', () => {
		const layout = { rooms: [room(0, 0, { walls: [] })], passages: [] };
		const result = buildDungeon(mockScene(), layout);
		// ground(1) + room floor(1) = 2 meshes; no extra cover/platform geometry.
		expect(result.meshes.length).toBe(2);
		expect(buildWallColliders(layout).length).toBe(0);
	});
});

describe('sunken-canyon cover, floors & treasure marker', () => {
	const yHigh = DEFAULT_FLOOR_Y + 8;
	const yLow = DEFAULT_FLOOR_Y;

	/** Treasure exit pillar from dungeon.js (THREE mock has no geometry.type). */
	function findTreasureMarker(meshes) {
		return meshes.find(m =>
			m.geometry?.parameters?.height === 1.5 &&
			m.geometry?.parameters?.radiusTop === 0.3 &&
			m.geometry?.parameters?.radiusBottom === 0.3
		);
	}

	function sunkenCanyonFixture() {
		return {
			profile: 'sunken-canyon',
			rooms: [
				{
					x: 0, z: -20, width: 12, depth: 12, role: 'start', walls: [], band: 'plateau',
					floorCorners: { yNW: yHigh, yNE: yHigh, ySE: yHigh, ySW: yHigh },
				},
				{
					x: 0, z: -12, width: 8, depth: 6, role: 'connector', walls: [], band: 'ramp',
					floorCorners: { yNW: yHigh, yNE: yHigh, ySE: yLow, ySW: yLow },
				},
				{
					x: 0, z: 0, width: 32, depth: 32, role: 'treasure', walls: [], band: 'canyon',
					floorCorners: { yNW: yLow, yNE: yLow, ySE: yLow, ySW: yLow },
				},
			],
			passages: [],
			cover: [
				{ x: 5, z: 5, width: 1.6, depth: 1.6, height: 3.0, type: 'pillar' },
				{ x: -8, z: 8, width: 4.0, depth: 1.2, height: 1.0, type: 'broken_wall' },
			],
		};
	}

	it('buildDungeon emits ground + one floor per room + treasure marker + cover meshes', () => {
		const layout = sunkenCanyonFixture();
		const result = buildDungeon(mockScene(), layout);
		const roomFloors = layout.rooms.length;
		const expected = 1 + roomFloors + 1 + layout.cover.length; // ground + floors + marker + cover
		expect(result.meshes.length).toBe(expected);
	});

	it('places the treasure marker on the canyon floor, above DEFAULT_FLOOR_Y', () => {
		const layout = sunkenCanyonFixture();
		const canyon = layout.rooms.find(r => r.role === 'treasure');
		const result = buildDungeon(mockScene(), layout);
		const marker = findTreasureMarker(result.meshes);
		expect(marker).toBeDefined();
		const canyonFloorY = sampleFloorY(layout, canyon.x, canyon.z);
		expect(marker.position.y).toBeGreaterThan(DEFAULT_FLOOR_Y);
		expect(marker.position.y).toBeCloseTo(canyonFloorY + 0.75, 4);
	});

	it('elevates the plateau uniform floor to the high band', () => {
		const layout = sunkenCanyonFixture();
		const plateau = layout.rooms.find(r => r.band === 'plateau');
		expect(uniformFloorMeshY(plateau)).toBe(yHigh);
		const result = buildDungeon(mockScene(), layout);
		const plateauFloor = result.meshes.find(m =>
			m.position.x === plateau.x && m.position.z === plateau.z &&
			m.geometry?.parameters?.height === 0.1
		);
		expect(plateauFloor).toBeDefined();
		expect(plateauFloor.position.y).toBeGreaterThan(DEFAULT_FLOOR_Y);
		expect(plateauFloor.position.y).toBeCloseTo(yHigh, 4);
	});

	it('rests cover boxes on sampleFloorY in the canyon', () => {
		const layout = sunkenCanyonFixture();
		const result = buildDungeon(mockScene(), layout);
		for (const c of layout.cover) {
			const floorY = sampleFloorY(layout, c.x, c.z);
			const mesh = result.meshes.find(m =>
				m.position.x === c.x && m.position.z === c.z &&
				m.geometry?.parameters?.height === c.height
			);
			expect(mesh).toBeDefined();
			expect(mesh.position.y).toBeCloseTo(floorY + c.height / 2, 4);
		}
	});

	it('buildWallColliders includes cover footprints', () => {
		const layout = sunkenCanyonFixture();
		const colliders = buildWallColliders(layout);
		expect(colliders.length).toBe(layout.cover.length);
	});

	it('renders server-generated sunken-canyon with treasure marker on canyon floor', () => {
		const layout = generateLayout(42, 'sunken-canyon');
		const result = buildDungeon(mockScene(), layout);
		const treasureRoom = layout.rooms.find(r => r.role === 'treasure');
		const marker = findTreasureMarker(result.meshes);
		expect(marker).toBeDefined();
		expect(marker.position.y).toBeGreaterThan(DEFAULT_FLOOR_Y);
		expect(marker.position.y).toBeCloseTo(
			(sampleFloorY(layout, treasureRoom.x, treasureRoom.z) ?? DEFAULT_FLOOR_Y) + 0.75,
			4
		);
		// ground + room floors + perimeter walls + cover + treasure marker
		expect(result.meshes.length).toBeGreaterThanOrEqual(
			1 + layout.rooms.length + layout.cover.length + 1
		);
	});
});

describe('spire-ascent floors, treasure marker & bounds', () => {
	const yStart = DEFAULT_FLOOR_Y;
	const yTop = DEFAULT_FLOOR_Y + 8;

	/** Treasure exit pillar from dungeon.js (THREE mock has no geometry.type). */
	function findTreasureMarker(meshes) {
		return meshes.find(m =>
			m.geometry?.parameters?.height === 1.5 &&
			m.geometry?.parameters?.radiusTop === 0.3 &&
			m.geometry?.parameters?.radiusBottom === 0.3
		);
	}

	/** One flat floor mesh per room centre (uniform box or sloped ramp). */
	function roomFloorMeshes(meshes, layout) {
		return layout.rooms.map(room => {
			const match = meshes.find(m =>
				Math.abs(m.position.x - room.x) < 0.01 &&
				Math.abs(m.position.z - room.z) < 0.01 &&
				m.geometry?.parameters?.height === 0.1
			);
			expect(match).toBeDefined();
			return match;
		});
	}

	function spireAscentFixture() {
		const tier0 = {
			x: 0,
			z: 0,
			width: 12,
			depth: 12,
			role: 'start',
			band: 'tier-0',
			walls: [],
			floorCorners: { yNW: yStart, yNE: yStart, ySE: yStart, ySW: yStart },
		};
		const ramp = {
			x: 0,
			z: -10,
			width: 8,
			depth: 6,
			role: 'connector',
			band: 'ramp',
			walls: [],
			floorCorners: { yNW: yTop, yNE: yTop, ySE: yStart, ySW: yStart },
		};
		const tier2 = {
			x: 0,
			z: -22,
			width: 12,
			depth: 12,
			role: 'treasure',
			band: 'tier-2',
			walls: [],
			floorCorners: { yNW: yTop, yNE: yTop, ySE: yTop, ySW: yTop },
		};
		return {
			profile: 'spire-ascent',
			rooms: [tier0, ramp, tier2],
			passages: [],
		};
	}

	it('buildDungeon emits ground + one floor per room + treasure marker', () => {
		const layout = spireAscentFixture();
		const result = buildDungeon(mockScene(), layout);
		expect(result.meshes.length).toBe(1 + layout.rooms.length + 1);
		expect(roomFloorMeshes(result.meshes, layout).length).toBe(layout.rooms.length);
	});

	it('renders bottom tier flat, ramp sloped, and top tier elevated', () => {
		const layout = spireAscentFixture();
		const result = buildDungeon(mockScene(), layout);
		const [bottomFloor, rampFloor, topFloor] = roomFloorMeshes(result.meshes, layout);

		// Default-band flat tiers use visual FLOOR_Y; collision height stays yStart.
		expect(bottomFloor.position.y).toBe(FLOOR_Y);
		expect(sampleFloorY(layout, layout.rooms[0].x, layout.rooms[0].z)).toBeCloseTo(yStart, 4);
		expect(bottomFloor.rotation.x).toBe(0);
		expect(Math.abs(rampFloor.rotation.x)).toBeGreaterThan(0);
		expect(topFloor.position.y).toBeCloseTo(yTop, 4);
		expect(topFloor.rotation.x).toBe(0);
	});

	it('places treasure marker on the top tier, well above the start tier floor', () => {
		const layout = spireAscentFixture();
		const treasure = layout.rooms.find(r => r.role === 'treasure');
		const start = layout.rooms.find(r => r.role === 'start');
		const result = buildDungeon(mockScene(), layout);
		const marker = findTreasureMarker(result.meshes);

		const startFloorY = sampleFloorY(layout, start.x, start.z);
		const treasureFloorY = sampleFloorY(layout, treasure.x, treasure.z);
		expect(marker).toBeDefined();
		expect(marker.position.y).toBeGreaterThanOrEqual(startFloorY + 8);
		expect(marker.position.y).toBeCloseTo(treasureFloorY + 0.75, 4);
		expect(treasureFloorY).toBeGreaterThan(FLOOR_Y);
	});

	it('computeDungeonBounds unions every tier and ramp footprint on XZ', () => {
		const layout = spireAscentFixture();
		const bounds = computeDungeonBounds(layout);

		for (const room of layout.rooms) {
			const halfW = room.width / 2;
			const halfD = room.depth / 2;
			expect(bounds.minX).toBeLessThanOrEqual(room.x - halfW);
			expect(bounds.maxX).toBeGreaterThanOrEqual(room.x + halfW);
			expect(bounds.minZ).toBeLessThanOrEqual(room.z - halfD);
			expect(bounds.maxZ).toBeGreaterThanOrEqual(room.z + halfD);
		}
	});

	it('renders server-generated spire-ascent with elevated treasure marker', () => {
		const layout = generateLayout(42, 'spire-ascent');
		const result = buildDungeon(mockScene(), layout);
		const start = layout.rooms.find(r => r.role === 'start');
		const treasure = layout.rooms.find(r => r.role === 'treasure');
		const marker = findTreasureMarker(result.meshes);

		const yStartSample = sampleFloorY(layout, start.x, start.z);
		const yTreasureSample = sampleFloorY(layout, treasure.x, treasure.z);
		expect(marker).toBeDefined();
		expect(marker.position.y).toBeGreaterThanOrEqual(yStartSample + 8);
		expect(marker.position.y).toBeCloseTo(yTreasureSample + 0.75, 4);
		expect(roomFloorMeshes(result.meshes, layout).length).toBe(layout.rooms.length);

		const bounds = computeDungeonBounds(layout);
		for (const room of layout.rooms) {
			const halfW = room.width / 2;
			const halfD = room.depth / 2;
			expect(bounds.minZ).toBeLessThanOrEqual(room.z - halfD);
			expect(bounds.maxZ).toBeGreaterThanOrEqual(room.z + halfD);
		}
	});

	it('leaves default crowded layouts unchanged', () => {
		const layout = generateLayout(99, 'crowded');
		expect(layout.profile).not.toBe('spire-ascent');
		const result = buildDungeon(mockScene(), layout);
		expect(result.meshes.length).toBeGreaterThan(0);
		const startRoom = layout.rooms.find(r => r.role === 'start');
		const startFloor = result.meshes.find(m =>
			Math.abs(m.position.x - startRoom.x) < 0.01 &&
			Math.abs(m.position.z - startRoom.z) < 0.01 &&
			m.geometry?.parameters?.height === 0.1
		);
		expect(startFloor.position.y).toBe(FLOOR_Y);
	});
});
