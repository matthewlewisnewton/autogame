import { describe, it, expect } from 'vitest';
import {
	buildDungeon,
	buildDoorwayMarkers,
	buildLandmarkMesh,
	buildWallColliders,
	buildPassageFloorSpec,
	isUniformFloor,
	buildSlopedFloor,
	uniformFloorMeshY,
	getProfileMaterials,
	getProfileMaterialColors,
	LARGE_ROOM_MIN_SIZE,
	FLOOR_Y,
	WALL_HEIGHT,
	PASSAGE_WALL_HEIGHT,
} from '../dungeon.js';
import { generateLayout } from '../../server/dungeon.js';
import { sampleFloorY, DEFAULT_FLOOR_Y, resolveFloorY } from '../../shared/floorSampling.esm.js';
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

function findRoomFloorMesh(meshes, room) {
	return meshes.find(m =>
		m.position.x === room.x && m.position.z === room.z &&
		m.geometry?.parameters?.height === 0.1
	);
}

describe('profile material palette', () => {
	it('defines distinct open (warm sand) and crowded (dark metal) palettes', () => {
		const open = getProfileMaterialColors('open');
		const crowded = getProfileMaterialColors('crowded');
		expect(open.floor).toBe(0xc4a574);
		expect(crowded.floor).toBe(0x2a3444);
		expect(open.floor).not.toBe(crowded.floor);
		expect(open.wall).not.toBe(crowded.wall);
		expect(open.passageFloor).not.toBe(crowded.passageFloor);
		expect(open.passageWall).not.toBe(crowded.passageWall);
	});

	it('caches materials per profile (no per-mesh allocation)', () => {
		const a = getProfileMaterials('open');
		const b = getProfileMaterials('open');
		expect(a.floor).toBe(b.floor);
		expect(a.wall).toBe(b.wall);
	});

	it('falls back to the legacy default palette for unknown profiles', () => {
		const unknown = getProfileMaterialColors('sunken-canyon');
		const legacy = getProfileMaterialColors('default');
		expect(unknown).toEqual(legacy);
	});

	it('derives role floor tints from the active profile base', () => {
		const open = getProfileMaterialColors('open');
		const crowded = getProfileMaterialColors('crowded');
		expect(open.startFloor).not.toBe(open.floor);
		expect(open.treasureFloor).not.toBe(open.floor);
		expect(crowded.startFloor).not.toBe(crowded.floor);
		expect(open.startFloor).not.toBe(crowded.startFloor);
	});

	it('buildDungeon meshes use different combat-floor colors for open vs crowded (same seed)', () => {
		const seed = 42;
		const openLayout = generateLayout(seed, 'open');
		const crowdedLayout = generateLayout(seed, 'crowded');
		const openCombat = openLayout.rooms.find(r => r.role === 'combat');
		const crowdedCombat = crowdedLayout.rooms.find(r => r.role === 'combat');
		expect(openCombat).toBeDefined();
		expect(crowdedCombat).toBeDefined();

		const openResult = buildDungeon(mockScene(), openLayout);
		const crowdedResult = buildDungeon(mockScene(), crowdedLayout);

		const openFloor = findRoomFloorMesh(openResult.meshes, openCombat);
		const crowdedFloor = findRoomFloorMesh(crowdedResult.meshes, crowdedCombat);
		expect(openFloor).toBeDefined();
		expect(crowdedFloor).toBeDefined();
		expect(openFloor.material.color.getHex()).not.toBe(crowdedFloor.material.color.getHex());

		const openWall = openResult.meshes.find(m =>
			m.material === getProfileMaterials('open').wall
		);
		const crowdedWall = crowdedResult.meshes.find(m =>
			m.material === getProfileMaterials('crowded').wall
		);
		expect(openWall).toBeDefined();
		expect(crowdedWall).toBeDefined();
		expect(openWall.material.color.getHex()).not.toBe(crowdedWall.material.color.getHex());
	});
});

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

	it('positions passage wall Y on sloped rooms using sampleFloorY', () => {
		const roomW = 10;
		const roomD = 10;
		const halfW = roomW / 2;
		const halfD = roomD / 2;

		// Z-slope: back (NW/NE) at 0.5, front (SE/SW) at 2.0
		const slopedRoom = {
			x: 0,
			z: 0,
			width: roomW,
			depth: roomD,
			role: 'combat',
			floorCorners: { yNW: 0.5, yNE: 0.5, ySE: 2.0, ySW: 2.0 },
			walls: [],
		};

		// Passage whose side walls sit inside the sloped room footprint, so each
		// wall (x, z) samples a different sloped height.
		const passage = {
			x1: -2, z1: -halfD + 1, x2: 2, z2: halfD - 1,
			walls: [
				{ axis: 'x', x: -2, z: -halfD + 1, length: 4 },
				{ axis: 'x', x: 2, z: halfD - 1, length: 4 },
				{ axis: 'z', x: -halfW + 1, z: -1, length: 4 },
				{ axis: 'z', x: halfW - 1, z: 1, length: 4 },
			],
		};

		const layout = { rooms: [slopedRoom], passages: [passage] };
		const scene = mockScene();
		const result = buildDungeon(scene, layout);

		// ground(0) + floor(1) + passage floor(2) + 4 passage walls = 7 meshes
		expect(result.meshes.length).toBe(7);

		// Verify each passage wall's position.y = sampleFloorY + PASSAGE_WALL_HEIGHT / 2
		for (const wall of passage.walls) {
			const expectedBaseY = sampleFloorY(layout, wall.x, wall.z);
			expect(expectedBaseY).not.toBeNull();

			const wallMesh = result.meshes.slice(3).find(m =>
				m.position.x === wall.x && m.position.z === wall.z
			);
			expect(wallMesh).toBeDefined();
			expect(wallMesh.position.y).toBeCloseTo(resolveFloorY(expectedBaseY) + PASSAGE_WALL_HEIGHT / 2, 4);
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

describe('open profile hazards & platforms', () => {
	it('buildDungeon creates one recessed mesh per pit hazard', () => {
		const layout = generateLayout(42, 'open', { slopes: true });
		expect(layout.hazards.length).toBeGreaterThanOrEqual(1);

		const result = buildDungeon(mockScene(), layout);
		const pitMeshes = result.meshes.filter(m =>
			m.geometry?.parameters &&
			layout.hazards.some(h =>
				h.type === 'pit' &&
				m.geometry.parameters.width === h.width &&
				m.geometry.parameters.depth === h.depth &&
				m.geometry.parameters.height === (h.pitDepth ?? 0.12)
			)
		);
		expect(pitMeshes.length).toBe(layout.hazards.length);
	});

	it('recesses each pit slightly below the sampled floor surface', () => {
		const layout = generateLayout(42, 'open');
		const result = buildDungeon(mockScene(), layout);

		for (const h of layout.hazards) {
			const floorY = resolveFloorY(sampleFloorY(layout, h.x, h.z));
			const recess = h.pitDepth ?? 0.12;
			const mesh = result.meshes.find(m =>
				m.position.x === h.x && m.position.z === h.z &&
				m.geometry?.parameters?.height === recess
			);
			expect(mesh).toBeDefined();
			expect(mesh.position.y).toBeCloseTo(floorY - recess / 2, 4);
		}
	});

	it('renders platforms from open layouts via the existing sloped-floor path', () => {
		const layout = generateLayout(42, 'open', { slopes: true });
		expect(layout.platforms.length).toBeGreaterThanOrEqual(1);

		const result = buildDungeon(mockScene(), layout);
		const platformMeshes = layout.platforms.map(p =>
			result.meshes.find(m =>
				m.position.x === p.x && m.position.z === p.z &&
				m.geometry?.parameters?.width === p.width
			)
		);
		expect(platformMeshes.every(m => m !== undefined)).toBe(true);
	});

	it('does not add hazard footprints to wall colliders', () => {
		const layout = generateLayout(42, 'open');
		const colliders = buildWallColliders(layout);
		for (const h of layout.hazards) {
			const hit = colliders.some(w =>
				Math.abs((w.minX + w.maxX) / 2 - h.x) < 1e-6 &&
				Math.abs((w.maxX - w.minX) - h.width) < 1e-6
			);
			expect(hit).toBe(false);
		}
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
			resolveFloorY(sampleFloorY(layout, treasureRoom.x, treasureRoom.z)) + 0.75,
			4
		);
		// ground + room floors + perimeter walls + cover + treasure marker
		expect(result.meshes.length).toBeGreaterThanOrEqual(
			1 + layout.rooms.length + layout.cover.length + 1
		);
	});
});

describe('spire-ascent floors, ramps & treasure marker', () => {
	/** Treasure exit pillar from dungeon.js (THREE mock has no geometry.type). */
	function findTreasureMarker(meshes) {
		return meshes.find(m =>
			m.geometry?.parameters?.height === 1.5 &&
			m.geometry?.parameters?.radiusTop === 0.3 &&
			m.geometry?.parameters?.radiusBottom === 0.3
		);
	}

	function spireAscentFixture() {
		const yBottom = DEFAULT_FLOOR_Y;
		const yMid = DEFAULT_FLOOR_Y + 5;
		const yTop = DEFAULT_FLOOR_Y + 10;
		const tierW = 12;
		const tierD = 12;
		const rampW = 8;
		const rampD = 6;

		return {
			profile: 'spire-ascent',
			rooms: [
				{
					x: 0, z: 20, width: tierW, depth: tierD, role: 'start', walls: [], band: 'tier',
					floorCorners: { yNW: yBottom, yNE: yBottom, ySE: yBottom, ySW: yBottom },
				},
				{
					x: 0, z: 12, width: rampW, depth: rampD, role: 'connector', walls: [], band: 'ramp',
					floorCorners: { yNW: yMid, yNE: yMid, ySE: yBottom, ySW: yBottom },
				},
				{
					x: 0, z: 4, width: tierW, depth: tierD, role: 'combat', walls: [], band: 'tier',
					floorCorners: { yNW: yMid, yNE: yMid, ySE: yMid, ySW: yMid },
				},
				{
					x: 0, z: -4, width: rampW, depth: rampD, role: 'connector', walls: [], band: 'ramp',
					floorCorners: { yNW: yTop, yNE: yTop, ySE: yMid, ySW: yMid },
				},
				{
					x: 0, z: -12, width: tierW, depth: tierD, role: 'treasure', walls: [], band: 'tier',
					floorCorners: { yNW: yTop, yNE: yTop, ySE: yTop, ySW: yTop },
				},
			],
			passages: [],
		};
	}

	it('buildDungeon emits ground + one floor per room + treasure marker', () => {
		const layout = spireAscentFixture();
		const result = buildDungeon(mockScene(), layout);
		const expected = 1 + layout.rooms.length + 1; // ground + floors + marker
		expect(result.meshes.length).toBe(expected);
	});

	it('places the treasure marker on the top tier, well above DEFAULT_FLOOR_Y', () => {
		const layout = spireAscentFixture();
		const top = layout.rooms.find(r => r.role === 'treasure');
		const result = buildDungeon(mockScene(), layout);
		const marker = findTreasureMarker(result.meshes);
		expect(marker).toBeDefined();
		const topFloorY = sampleFloorY(layout, top.x, top.z);
		expect(marker.position.y).toBeGreaterThan(DEFAULT_FLOOR_Y + 8);
		expect(marker.position.y).toBeCloseTo(topFloorY + 0.75, 4);
	});

	it('keeps the bottom start tier at DEFAULT_FLOOR_Y elevation', () => {
		const layout = spireAscentFixture();
		const bottom = layout.rooms.find(r => r.role === 'start');
		const bottomFloorY = sampleFloorY(layout, bottom.x, bottom.z);
		expect(bottomFloorY).toBeCloseTo(DEFAULT_FLOOR_Y, 4);
		const result = buildDungeon(mockScene(), layout);
		const bottomFloor = result.meshes.find(m =>
			m.position.x === bottom.x && m.position.z === bottom.z &&
			m.geometry?.parameters?.height === 0.1
		);
		expect(bottomFloor).toBeDefined();
		expect(uniformFloorMeshY(bottom)).toBe(FLOOR_Y);
	});

	it('renders ramp rooms with sloped floor meshes', () => {
		const layout = spireAscentFixture();
		const result = buildDungeon(mockScene(), layout);
		const ramps = layout.rooms.filter(r => r.band === 'ramp');
		for (const ramp of ramps) {
			const rampFloor = result.meshes.find(m =>
				m.position.x === ramp.x && m.position.z === ramp.z &&
				m.geometry?.parameters?.height === 0.1
			);
			expect(rampFloor).toBeDefined();
			expect(
				Math.abs(rampFloor.rotation.x) > 0.01 || Math.abs(rampFloor.rotation.z) > 0.01
			).toBe(true);
		}
	});

	it('renders server-generated spire-ascent with treasure marker ≥ bottom tier + 8', () => {
		const layout = generateLayout(42, 'spire-ascent');
		const result = buildDungeon(mockScene(), layout);
		const bottom = layout.rooms.find(r => r.role === 'start');
		const treasure = layout.rooms.find(r => r.role === 'treasure');
		const marker = findTreasureMarker(result.meshes);
		expect(marker).toBeDefined();
		const yBottom = sampleFloorY(layout, bottom.x, bottom.z);
		const yTreasure = sampleFloorY(layout, treasure.x, treasure.z);
		expect(yTreasure - yBottom).toBeGreaterThanOrEqual(8);
		expect(marker.position.y).toBeGreaterThan(yBottom + 8);
		expect(marker.position.y).toBeCloseTo(yTreasure + 0.75, 4);
	});
});

function findDoorwayMarkers(meshes) {
	return meshes.filter(m => m.userData?.doorwayMarker);
}

/** Synthetic large room with north + east passage gaps (passageWidth 6, room 20×20). */
function largeRoomWithTwoDoorways() {
	const half = 10;
	const gap = 6;
	const segLen = (20 - gap) / 2;
	return room(0, 0, {
		width: 20,
		depth: 20,
		walls: [
			{ x: -gap / 2 - segLen / 2, z: -half, length: segLen, axis: 'x' },
			{ x: gap / 2 + segLen / 2, z: -half, length: segLen, axis: 'x' },
			{ x: 0, z: half, length: 20, axis: 'x' },
			{ x: -half, z: 0, length: 20, axis: 'z' },
			{ x: half, z: -gap / 2 - segLen / 2, length: segLen, axis: 'z' },
			{ x: half, z: gap / 2 + segLen / 2, length: segLen, axis: 'z' },
		],
	});
}

describe('buildDoorwayMarkers()', () => {
	it('places one marker per passage gap on large rooms only', () => {
		const materials = getProfileMaterials('open');
		const largeLayout = {
			profile: 'open',
			passageWidth: 6,
			rooms: [largeRoomWithTwoDoorways()],
			passages: [
				{ x1: 0, z1: 0, x2: 0, z2: -28, walls: [] },
				{ x1: 0, z1: 0, x2: 28, z2: 0, walls: [] },
			],
		};
		const markers = buildDoorwayMarkers(largeLayout.rooms[0], largeLayout, materials);
		expect(markers).toHaveLength(2);
		for (const m of markers) {
			expect(m.userData.doorwayMarker).toBe(true);
			expect(m.material).toBe(materials.accent);
			expect(m.material.emissiveIntensity).toBeGreaterThan(0);
		}
	});

	it('creates no markers below the large-room size threshold', () => {
		const materials = getProfileMaterials('open');
		const gap = 4;
		const segLen = (8 - gap) / 2;
		const smallRoom = room(0, 0, {
			width: 8,
			depth: 8,
			walls: [
				{ x: -gap / 2 - segLen / 2, z: -4, length: segLen, axis: 'x' },
				{ x: gap / 2 + segLen / 2, z: -4, length: segLen, axis: 'x' },
				{ x: 0, z: 4, length: 8, axis: 'x' },
				{ x: -4, z: 0, length: 8, axis: 'z' },
				{ x: 4, z: 0, length: 8, axis: 'z' },
			],
		});
		const smallLayout = {
			profile: 'open',
			passageWidth: 4,
			rooms: [smallRoom],
			passages: [{ x1: 0, z1: 0, x2: 0, z2: -12, walls: [] }],
		};
		expect(Math.min(smallRoom.width, smallRoom.depth)).toBeLessThan(LARGE_ROOM_MIN_SIZE);
		expect(buildDoorwayMarkers(smallRoom, smallLayout, materials)).toHaveLength(0);
	});

	it('buildDungeon adds doorway markers for large rooms and none for small rooms', () => {
		const materials = getProfileMaterials('open');
		const largeLayout = {
			profile: 'open',
			passageWidth: 6,
			rooms: [largeRoomWithTwoDoorways()],
			passages: [
				{ x1: 0, z1: 0, x2: 0, z2: -28, walls: [] },
				{ x1: 0, z1: 0, x2: 28, z2: 0, walls: [] },
			],
		};
		const largeResult = buildDungeon(mockScene(), largeLayout);
		expect(findDoorwayMarkers(largeResult.meshes)).toHaveLength(2);

		const gap = 4;
		const segLen = (8 - gap) / 2;
		const smallLayout = {
			profile: 'open',
			passageWidth: 4,
			rooms: [room(50, 50, {
				width: 8,
				depth: 8,
				walls: [
					{ x: 50 - gap / 2 - segLen / 2, z: 46, length: segLen, axis: 'x' },
					{ x: 50 + gap / 2 + segLen / 2, z: 46, length: segLen, axis: 'x' },
					{ x: 50, z: 54, length: 8, axis: 'x' },
					{ x: 46, z: 50, length: 8, axis: 'z' },
					{ x: 54, z: 50, length: 8, axis: 'z' },
				],
			})],
			passages: [{ x1: 50, z1: 50, x2: 50, z2: 38, walls: [] }],
		};
		const smallResult = buildDungeon(mockScene(), smallLayout);
		expect(findDoorwayMarkers(smallResult.meshes)).toHaveLength(0);
		expect(materials.accent).toBeDefined();
	});
});

describe('profile landmark rendering', () => {
	it('buildLandmarkMesh composes primitives for each profile type', () => {
		const crowded = getProfileMaterials('crowded');
		for (const type of ['reactor_coil', 'pipe_stack']) {
			const group = buildLandmarkMesh(type, crowded);
			expect(group).toBeInstanceOf(THREE.Group);
			expect(group.userData.landmarkType).toBe(type);
			expect(group.children.length).toBeGreaterThan(0);
			expect(group.children.some(c => c.material === crowded.accent)).toBe(true);
		}
		const open = getProfileMaterials('open');
		for (const type of ['sand_spire', 'sun_arch']) {
			const group = buildLandmarkMesh(type, open);
			expect(group.userData.landmarkType).toBe(type);
			expect(group.children.length).toBeGreaterThan(0);
		}
	});

	it('buildDungeon adds one landmark group per server landmark entry', () => {
		for (const profile of ['crowded', 'open']) {
			const layout = generateLayout(42, profile);
			expect(layout.landmarks?.length).toBeGreaterThanOrEqual(1);
			const scene = mockScene();
			const { meshes } = buildDungeon(scene, layout);
			const landmarkGroups = scene.added.filter(o => o.userData?.landmarkType);
			expect(landmarkGroups).toHaveLength(layout.landmarks.length);
			const trackedFromGroups = landmarkGroups.reduce((n, g) => n + g.children.length, 0);
			const trackedInMeshes = meshes.filter(m =>
				landmarkGroups.some(g => g.children.includes(m))
			).length;
			expect(trackedInMeshes).toBe(trackedFromGroups);
		}
	});

	it('buildWallColliders ignores landmarks (visual-only, no collision)', () => {
		const layout = generateLayout(42, 'crowded');
		expect(layout.landmarks.length).toBeGreaterThan(0);
		const withLandmarks = buildWallColliders(layout);
		const withoutLandmarks = buildWallColliders({ ...layout, landmarks: [] });
		expect(withLandmarks).toEqual(withoutLandmarks);
	});
});
