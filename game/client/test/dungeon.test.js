import { describe, it, expect } from 'vitest';
import {
	buildDungeon,
	buildDoorwayMarkers,
	buildLandmarkMesh,
	buildPerimeterDecorMesh,
	buildFloorMarkingMesh,
	buildWallColliders,
	buildPassageFloorSpec,
	isUniformFloor,
	buildSlopedFloor,
	uniformFloorMeshY,
	floorMaterial,
	wallMaterial,
	getProfileMaterials,
	getProfileMaterialColors,
	getSunkenCanyonBandFloorHex,
	getSunkenCanyonBandMaterials,
	getIceCavernBandFloorHex,
	getIceCavernBandMaterials,
	getSlipperyFloorMaterial,
	getFireCavernBandFloorHex,
	getFireCavernBandMaterials,
	getEntryRoomMaterialColors,
	getEntryRoomMaterials,
	LARGE_ROOM_MIN_SIZE,
	FLOOR_Y,
	WALL_HEIGHT,
	PASSAGE_WALL_HEIGHT,
	SPIRE_SUMMIT_BEACON_TAG,
	SPIRE_EDGE_HAZARD_TAG,
	CANYON_CLIFF_LIP_TAG,
	buildSpireEdgeHazardMesh,
	buildCanyonCliffLipMesh,
	buildCoverMesh,
	buildEntryDecorMesh,
} from '../dungeon.js';
import { generateLayout, questLayoutSeed } from '../../server/dungeon.js';
import {
	getLayoutProfileForQuest,
	getLayoutGenerationOptions,
} from '../../server/quests.js';
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

function findRoomWallMesh(meshes, room) {
	const walls = room.walls || [];
	if (walls.length === 0) return undefined;
	const wall = walls[0];
	return meshes.find(m =>
		m.geometry?.parameters?.height === WALL_HEIGHT &&
		Math.abs(m.position.x - wall.x) < 0.01 &&
		Math.abs(m.position.z - wall.z) < 0.01
	);
}

function layoutForQuestTier(questId, tier = 1) {
	return generateLayout(
		questLayoutSeed(questId, tier),
		getLayoutProfileForQuest(questId, tier),
		getLayoutGenerationOptions(questId, tier),
	);
}

/** @returns {{ floorHex: number, wallHex: number, decorTypes: string[] }} */
function collectStartRoomAppearance(layout) {
	const startRoom = layout.rooms.find(r => r.role === 'start');
	const { meshes } = buildDungeon(mockScene(), layout);
	const startFloor = findRoomFloorMesh(meshes, startRoom);
	const startWall = findRoomWallMesh(meshes, startRoom);
	return {
		floorHex: startFloor.material.color.getHex(),
		wallHex: startWall.material.color.getHex(),
		decorTypes: [...new Set((layout.entryDecor || []).map(d => d.type))],
	};
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
		const unknown = getProfileMaterialColors('not-a-real-profile');
		const legacy = getProfileMaterialColors('default');
		expect(unknown).toEqual(legacy);
	});

	it('defines sunken-canyon band palettes distinct from open-plaza and crowded profiles', () => {
		const plaza = getProfileMaterialColors('open-plaza');
		const canyon = getProfileMaterialColors('sunken-canyon');
		const crowded = getProfileMaterialColors('crowded');
		expect(plaza.floor).toBe(0xb8a078);
		expect(canyon.floor).toBe(0x2f3d35);
		expect(plaza.floor).not.toBe(canyon.floor);
		expect(canyon.floor).not.toBe(crowded.floor);
		expect(getSunkenCanyonBandFloorHex('plateau')).toBe(0x4a5f4a);
		expect(getSunkenCanyonBandFloorHex('canyon')).toBe(0x2f3d35);
	});

	it('defines fire-cavern band palettes distinct from default and sunken-canyon', () => {
		const defaults = getProfileMaterialColors('default');
		const canyon = getProfileMaterialColors('sunken-canyon');
		const fire = getProfileMaterialColors('fire-cavern');
		const fireMats = getProfileMaterials('fire-cavern');
		const canyonMats = getProfileMaterials('sunken-canyon');
		expect(fire.floor).toBe(0x3d2820);
		expect(fire.floor).not.toBe(defaults.floor);
		expect(fire.floor).not.toBe(canyon.floor);
		expect(fire.wall).not.toBe(canyon.wall);
		expect(fireMats.accent.color.getHex()).not.toBe(canyonMats.accent.color.getHex());
		expect(getFireCavernBandFloorHex('rim')).toBe(0x2a1f24);
		expect(getFireCavernBandFloorHex('basin')).toBe(0x5c2818);
		expect(getFireCavernBandFloorHex('rim')).not.toBe(getSunkenCanyonBandFloorHex('plateau'));
	});

	it('getProfileMaterials(fire-cavern) floor hex differs from default and sunken-canyon', () => {
		const defaults = getProfileMaterials('default');
		const canyon = getProfileMaterials('sunken-canyon');
		const fire = getProfileMaterials('fire-cavern');
		const fireFloorHex = fire.floor.color.getHex();
		expect(fireFloorHex).not.toBe(defaults.floor.color.getHex());
		expect(fireFloorHex).not.toBe(canyon.floor.color.getHex());
	});

	it('derives role floor tints from the active profile base', () => {
		const open = getProfileMaterialColors('open');
		const crowded = getProfileMaterialColors('crowded');
		expect(open.startFloor).not.toBe(open.floor);
		expect(open.treasureFloor).not.toBe(open.floor);
		expect(crowded.startFloor).not.toBe(crowded.floor);
		expect(open.startFloor).not.toBe(crowded.startFloor);
	});

	it('resolves open-plaza profile palette (warm stone + amber accent)', () => {
		const plaza = getProfileMaterialColors('open-plaza');
		const legacy = getProfileMaterialColors('default');
		expect(plaza).not.toEqual(legacy);
		expect(plaza.floor).toBe(0xb8a078);
		expect(plaza.wall).toBe(0x9a8268);
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

describe('entry room palette (per-biome start tinting)', () => {
	it('getEntryRoomMaterialColors returns three mutually distinct floor hex values', () => {
		const ice = getEntryRoomMaterialColors('ice-cavern');
		const fire = getEntryRoomMaterialColors('fire-cavern');
		const crowded = getEntryRoomMaterialColors('crowded');
		expect(ice).toEqual({ floor: 0x4a6278, wall: 0xb8d4e8 });
		expect(fire).toEqual({ floor: 0x2a1818, wall: 0xc45020 });
		expect(crowded).toEqual({ floor: 0x1e2838, wall: 0x5a6a42 });
		expect(ice.floor).not.toBe(fire.floor);
		expect(ice.floor).not.toBe(crowded.floor);
		expect(fire.floor).not.toBe(crowded.floor);
	});

	it('caches entry room materials per profile', () => {
		const a = getEntryRoomMaterials('ice-cavern');
		const b = getEntryRoomMaterials('ice-cavern');
		expect(a.floor).toBe(b.floor);
		expect(a.wall).toBe(b.wall);
	});

	it('buildDungeon start-room floor hex differs across ice-cavern, fire-cavern, and crowded (seed 42)', () => {
		const seed = 42;
		const profiles = ['ice-cavern', 'fire-cavern', 'crowded'];
		const startFloorHexes = profiles.map((profile) => {
			const layout = generateLayout(seed, profile);
			const startRoom = layout.rooms.find(r => r.role === 'start');
			expect(startRoom).toBeDefined();
			const { meshes } = buildDungeon(mockScene(), layout);
			const startFloor = findRoomFloorMesh(meshes, startRoom);
			expect(startFloor).toBeDefined();
			return startFloor.material.color.getHex();
		});
		expect(new Set(startFloorHexes).size).toBe(3);
		for (const profile of profiles) {
			const entryHex = getEntryRoomMaterialColors(profile).floor;
			const layout = generateLayout(seed, profile);
			const startRoom = layout.rooms.find(r => r.role === 'start');
			const { meshes } = buildDungeon(mockScene(), layout);
			const startFloor = findRoomFloorMesh(meshes, startRoom);
			expect(startFloor.material.color.getHex()).toBe(entryHex);
		}
	});

	it('non-start rooms do not use entry palette on ice-cavern and fire-cavern', () => {
		const iceLayout = generateLayout(42, 'ice-cavern');
		const iceStart = iceLayout.rooms.find(r => r.role === 'start');
		const iceTreasure = iceLayout.rooms.find(r => r.role === 'treasure');
		const iceResult = buildDungeon(mockScene(), iceLayout);
		const iceEntryHex = getEntryRoomMaterialColors('ice-cavern').floor;
		expect(findRoomFloorMesh(iceResult.meshes, iceStart).material.color.getHex()).toBe(iceEntryHex);
		expect(findRoomFloorMesh(iceResult.meshes, iceTreasure).material.color.getHex()).not.toBe(iceEntryHex);

		const fireLayout = generateLayout(42, 'fire-cavern');
		const fireStart = fireLayout.rooms.find(r => r.role === 'start');
		const fireTreasure = fireLayout.rooms.find(r => r.role === 'treasure');
		const fireResult = buildDungeon(mockScene(), fireLayout);
		const fireEntryHex = getEntryRoomMaterialColors('fire-cavern').floor;
		expect(findRoomFloorMesh(fireResult.meshes, fireStart).material.color.getHex()).toBe(fireEntryHex);
		expect(findRoomFloorMesh(fireResult.meshes, fireTreasure).material.color.getHex()).not.toBe(fireEntryHex);
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
			profile: 'open-plaza',
			rooms: [{
				x: 0, z: 0, width: 40, depth: 40, role: 'start', walls: [],
				floorCorners: { yNW: DEFAULT_FLOOR_Y, yNE: DEFAULT_FLOOR_Y, ySE: DEFAULT_FLOOR_Y, ySW: DEFAULT_FLOOR_Y },
			}],
			passages: [],
			platforms: [
				{ x: -9, z: -9, width: 6, depth: 6, floorCorners: { yNW: 1.3, yNE: 1.6, ySE: 1.7, ySW: 1.4 } },
			],
			cover: [
				{ x: -9, z: -9, width: 1.6, depth: 1.6, height: 3.0, type: 'pillar' },
				{ x: 5, z: 5, width: 4.0, depth: 1.2, height: 1.0, type: 'broken_wall' },
				{ x: 8, z: -8, width: 3.5, depth: 1.0, height: 1.1, type: 'barricade' },
				{ x: -8, z: 8, width: 1.8, depth: 1.8, height: 2.2, type: 'crate_stack' },
			],
		};
	}

	function coverGroupAt(scene, c) {
		return scene.added.find(
			o => o.userData?.coverType === c.type && o.position.x === c.x && o.position.z === c.z,
		);
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

	it('buildDungeon returns platform meshes plus one child mesh per cover primitive', () => {
		const layout = plazaLayout();
		const scene = mockScene();
		const result = buildDungeon(scene, layout);
		const coverChildCount = layout.cover.reduce((n, c) => n + coverGroupAt(scene, c).children.length, 0);

		// ground(1) + plaza floor(1) + platform(1) + cover primitives
		expect(result.meshes.length).toBe(1 + 1 + layout.platforms.length + coverChildCount);
	});

	it('buildCoverMesh uses distinct child counts for barricade and crate_stack', () => {
		const mat = wallMaterial;
		expect(buildCoverMesh({ type: 'pillar', width: 1.6, depth: 1.6, height: 3 }, mat).children.length).toBe(1);
		expect(buildCoverMesh({ type: 'broken_wall', width: 4, depth: 1.2, height: 1 }, mat).children.length).toBe(1);
		expect(buildCoverMesh({ type: 'barricade', width: 3.5, depth: 1, height: 1.1 }, mat).children.length).toBe(2);
		expect(buildCoverMesh({ type: 'crate_stack', width: 1.8, depth: 1.8, height: 2.2 }, mat).children.length).toBe(3);
	});

	it('rests each cover group on sampleFloorY with its top near floorY + height', () => {
		const layout = plazaLayout();
		const scene = mockScene();
		buildDungeon(scene, layout);

		for (const c of layout.cover) {
			const floorY = resolveFloorY(sampleFloorY(layout, c.x, c.z));
			const group = coverGroupAt(scene, c);
			expect(group).toBeDefined();
			expect(group.position.y).toBeCloseTo(floorY, 4);
			const topY = group.position.y + Math.max(
				...group.children.map(m => m.position.y + m.geometry.parameters.height / 2),
			);
			expect(topY).toBeCloseTo(floorY + c.height, 3);
		}

		expect(sampleFloorY(layout, -9, -9)).toBeGreaterThanOrEqual(DEFAULT_FLOOR_Y + 1.0);
	});

	it('generated open-plaza layout renders distinct cover footprints per type', () => {
		const layout = generateLayout(123, 'open-plaza');
		const scene = mockScene();
		buildDungeon(scene, layout);

		const byType = new Map();
		for (const c of layout.cover) {
			const group = coverGroupAt(scene, c);
			expect(group).toBeDefined();
			byType.set(c.type, group);
		}
		expect(byType.get('barricade').children.length).toBe(2);
		expect(byType.get('crate_stack').children.length).toBe(3);
		const barricadeWidths = byType.get('barricade').children.map(m => m.geometry.parameters.width);
		const pillarWidths = byType.get('pillar').children.map(m => m.geometry.parameters.width);
		expect(barricadeWidths.some(w => w > Math.max(...pillarWidths))).toBe(true);
	});

	it('renders existing room/passage layouts unchanged when cover/platforms are absent', () => {
		const layout = { rooms: [room(0, 0, { walls: [] })], passages: [] };
		const result = buildDungeon(mockScene(), layout);
		// ground(1) + room floor(1) = 2 meshes; no extra cover/platform geometry.
		expect(result.meshes.length).toBe(2);
		expect(buildWallColliders(layout).length).toBe(0);
	});
});

describe('open-plaza profile hazards & platforms', () => {
	it('buildDungeon creates one recessed mesh per pit hazard', () => {
		const layout = generateLayout(42, 'open-plaza');
		expect(layout.hazards.length).toBeGreaterThanOrEqual(1);
		expect(layout.platforms.length).toBeGreaterThanOrEqual(3);

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
		const layout = generateLayout(42, 'open-plaza');
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

	it('renders one canyon_monolith landmark group on sampleFloorY for seed 42', () => {
		const layout = generateLayout(42, 'sunken-canyon');
		expect(layout.landmarks).toHaveLength(1);
		expect(layout.landmarks[0].type).toBe('canyon_monolith');
		const scene = mockScene();
		const { meshes } = buildDungeon(scene, layout);
		const monolithGroups = scene.added.filter(o => o.userData?.landmarkType === 'canyon_monolith');
		expect(monolithGroups).toHaveLength(1);
		const lm = layout.landmarks[0];
		const floorY = resolveFloorY(sampleFloorY(layout, lm.x, lm.z));
		expect(monolithGroups[0].position.y).toBeCloseTo(floorY, 4);
		expect(monolithGroups[0].children.length).toBeGreaterThan(0);
		expect(meshes.some(m => monolithGroups[0].children.includes(m))).toBe(true);
	});

	it('assigns three distinct band floor colors for plateau, ramp, and canyon rooms', () => {
		const layout = sunkenCanyonFixture();
		const result = buildDungeon(mockScene(), layout);
		const plateau = layout.rooms.find(r => r.band === 'plateau');
		const ramp = layout.rooms.find(r => r.band === 'ramp');
		const canyon = layout.rooms.find(r => r.band === 'canyon');

		const plateauFloor = findRoomFloorMesh(result.meshes, plateau);
		const rampFloor = result.meshes.find(m =>
			m.geometry?.parameters?.height === 0.1 &&
			Math.abs(m.position.x - ramp.x) < 0.01 &&
			Math.abs(m.position.z - ramp.z) < 0.01
		);
		const canyonFloor = findRoomFloorMesh(result.meshes, canyon);

		expect(plateauFloor).toBeDefined();
		expect(rampFloor).toBeDefined();
		expect(canyonFloor).toBeDefined();

		const plateauHex = plateauFloor.material.color.getHex();
		const rampHex = rampFloor.material.color.getHex();
		const canyonHex = canyonFloor.material.color.getHex();

		expect(plateauHex).not.toBe(canyonHex);
		expect(rampHex).not.toBe(plateauHex);
		expect(rampHex).not.toBe(canyonHex);
	});

	it('server-generated seed 42: start (plateau) and treasure (canyon) floors differ', () => {
		const layout = generateLayout(42, 'sunken-canyon');
		const startRoom = layout.rooms.find(r => r.role === 'start');
		const treasureRoom = layout.rooms.find(r => r.role === 'treasure');
		expect(startRoom?.band).toBe('plateau');
		expect(treasureRoom?.band).toBe('canyon');

		const result = buildDungeon(mockScene(), layout);
		const startFloor = findRoomFloorMesh(result.meshes, startRoom);
		const treasureFloor = findRoomFloorMesh(result.meshes, treasureRoom);
		expect(startFloor).toBeDefined();
		expect(treasureFloor).toBeDefined();
		expect(startFloor.material.color.getHex()).not.toBe(treasureFloor.material.color.getHex());
	});

	it('caches sunken-canyon band materials as singletons', () => {
		const a = getSunkenCanyonBandMaterials('plateau');
		const b = getSunkenCanyonBandMaterials('plateau');
		expect(a.floor).toBe(b.floor);
		expect(a.floor.color.getHex()).toBe(getSunkenCanyonBandFloorHex('plateau'));
	});

	function findCliffLipMeshes(meshes) {
		return meshes.filter(m => m.userData?.dungeonTag === CANYON_CLIFF_LIP_TAG);
	}

	it('renders emissive cliff lip strips for server-generated sunken-canyon', () => {
		const layout = generateLayout(42, 'sunken-canyon');
		expect(layout.cliffLips.length).toBeGreaterThanOrEqual(4);
		const plateau = layout.rooms.find(r => r.band === 'plateau');
		const yHigh = resolveFloorY(sampleFloorY(layout, plateau.x, plateau.z));
		const result = buildDungeon(mockScene(), layout);
		const lipMeshes = findCliffLipMeshes(result.meshes);
		expect(lipMeshes.length).toBe(layout.cliffLips.length);
		for (const mesh of lipMeshes) {
			expect(mesh.material.emissiveIntensity).toBeGreaterThan(0);
			expect(mesh.position.y).toBeGreaterThanOrEqual(yHigh);
			expect(mesh.geometry.parameters.height).toBeLessThanOrEqual(WALL_HEIGHT);
		}
	});

	function findEdgeHazardMeshes(meshes) {
		return meshes.filter(m => m.userData?.dungeonTag === SPIRE_EDGE_HAZARD_TAG);
	}

	it('renders emissive edge hazard strips for server-generated sunken-canyon', () => {
		const layout = generateLayout(42, 'sunken-canyon');
		expect(layout.edgeHazards.length).toBeGreaterThanOrEqual(1);
		const plateau = layout.rooms.find(r => r.band === 'plateau');
		const yHigh = resolveFloorY(sampleFloorY(layout, plateau.x, plateau.z));
		const result = buildDungeon(mockScene(), layout);
		const hazardMeshes = findEdgeHazardMeshes(result.meshes);
		expect(hazardMeshes.length).toBe(layout.edgeHazards.length);
		for (const mesh of hazardMeshes) {
			expect(mesh.material.emissiveIntensity).toBeGreaterThan(0);
			expect(mesh.position.y).toBeGreaterThanOrEqual(yHigh);
			expect(mesh.geometry.parameters.height).toBeLessThanOrEqual(WALL_HEIGHT);
		}
	});

	it('buildCanyonCliffLipMesh tracks lip AABB footprint', () => {
		const lip = {
			minX: -3,
			maxX: 3,
			minZ: -28.5,
			maxZ: -27.3,
			y: DEFAULT_FLOOR_Y + 10,
		};
		const mesh = buildCanyonCliffLipMesh(lip);
		expect(mesh.userData.dungeonTag).toBe(CANYON_CLIFF_LIP_TAG);
		expect(mesh.position.x).toBeCloseTo(0, 4);
		expect(mesh.position.z).toBeCloseTo(-27.9, 4);
	});
});

describe('fire-cavern cover, floors & treasure marker', () => {
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

	function fireCavernFixture() {
		return {
			profile: 'fire-cavern',
			rooms: [
				{
					x: 0, z: -20, width: 12, depth: 12, role: 'start', walls: [], band: 'rim',
					floorCorners: { yNW: yHigh, yNE: yHigh, ySE: yHigh, ySW: yHigh },
				},
				{
					x: 0, z: -12, width: 8, depth: 6, role: 'connector', walls: [], band: 'ramp',
					floorCorners: { yNW: yHigh, yNE: yHigh, ySE: yLow, ySW: yLow },
				},
				{
					x: 0, z: 0, width: 32, depth: 32, role: 'treasure', walls: [], band: 'basin',
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
		const layout = fireCavernFixture();
		const result = buildDungeon(mockScene(), layout);
		const roomFloors = layout.rooms.length;
		const expected = 1 + roomFloors + 1 + layout.cover.length; // ground + floors + marker + cover
		expect(result.meshes.length).toBe(expected);
	});

	it('places the treasure marker on the basin floor, below rim elevation', () => {
		const layout = fireCavernFixture();
		const basin = layout.rooms.find(r => r.role === 'treasure');
		const rim = layout.rooms.find(r => r.band === 'rim');
		const result = buildDungeon(mockScene(), layout);
		const marker = findTreasureMarker(result.meshes);
		expect(marker).toBeDefined();
		const basinFloorY = sampleFloorY(layout, basin.x, basin.z);
		const rimFloorY = sampleFloorY(layout, rim.x, rim.z);
		expect(marker.position.y).toBeGreaterThanOrEqual(DEFAULT_FLOOR_Y);
		expect(marker.position.y).toBeCloseTo(basinFloorY + 0.75, 4);
		expect(marker.position.y).toBeLessThan(rimFloorY);
	});

	it('elevates the rim uniform floor to the high band', () => {
		const layout = fireCavernFixture();
		const rim = layout.rooms.find(r => r.band === 'rim');
		expect(uniformFloorMeshY(rim)).toBe(yHigh);
		const result = buildDungeon(mockScene(), layout);
		const rimFloor = result.meshes.find(m =>
			m.position.x === rim.x && m.position.z === rim.z &&
			m.geometry?.parameters?.height === 0.1
		);
		expect(rimFloor).toBeDefined();
		expect(rimFloor.position.y).toBeGreaterThan(DEFAULT_FLOOR_Y);
		expect(rimFloor.position.y).toBeCloseTo(yHigh, 4);
	});

	it('rests cover boxes on sampleFloorY in the basin', () => {
		const layout = fireCavernFixture();
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

	it('renders ramp rooms with sloped floor meshes', () => {
		const layout = fireCavernFixture();
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

	it('buildWallColliders includes cover footprints', () => {
		const layout = fireCavernFixture();
		const colliders = buildWallColliders(layout);
		expect(colliders.length).toBe(layout.cover.length);
	});

	it('server-generated seed 42: rim spawn floor Y exceeds treasure marker Y', () => {
		const layout = generateLayout(42, 'fire-cavern');
		const rim = layout.rooms.find(r => r.role === 'start');
		const treasureRoom = layout.rooms.find(r => r.role === 'treasure');
		const result = buildDungeon(mockScene(), layout);
		const marker = findTreasureMarker(result.meshes);
		expect(marker).toBeDefined();
		expect(marker.position.y).toBeGreaterThanOrEqual(DEFAULT_FLOOR_Y);
		const rimFloorY = sampleFloorY(layout, rim.x, rim.z);
		expect(rimFloorY).toBeGreaterThan(marker.position.y);
		expect(marker.position.y).toBeCloseTo(
			resolveFloorY(sampleFloorY(layout, treasureRoom.x, treasureRoom.z)) + 0.75,
			4
		);
	});

	it('renders server-generated fire-cavern with cover and multi-band floors', () => {
		const layout = generateLayout(42, 'fire-cavern');
		const result = buildDungeon(mockScene(), layout);
		const marker = findTreasureMarker(result.meshes);
		expect(marker).toBeDefined();
		expect(layout.cover.length).toBeGreaterThanOrEqual(6);
		expect(result.meshes.length).toBeGreaterThanOrEqual(
			1 + layout.rooms.length + layout.cover.length + 1
		);
	});

	it('applies distinct rim and basin floor materials on server-generated fire-cavern', () => {
		const layout = generateLayout(42, 'fire-cavern');
		const rim = layout.rooms.find(r => r.role === 'start');
		const basin = layout.rooms.find(r => r.band === 'basin');
		const result = buildDungeon(mockScene(), layout);
		const rimFloor = findRoomFloorMesh(result.meshes, rim);
		const basinFloor = findRoomFloorMesh(result.meshes, basin);
		expect(rimFloor).toBeDefined();
		expect(basinFloor).toBeDefined();
		expect(rimFloor.material.color.getHex()).not.toBe(basinFloor.material.color.getHex());
	});

	it('caches fire-cavern band materials as singletons', () => {
		const a = getFireCavernBandMaterials('rim');
		const b = getFireCavernBandMaterials('rim');
		expect(a.floor).toBe(b.floor);
		expect(a.floor.color.getHex()).toBe(getFireCavernBandFloorHex('rim'));
	});

	it('layouts without fire-cavern profile behave exactly as before', () => {
		const layout = { rooms: [room(0, 0, { walls: [] })], passages: [] };
		const result = buildDungeon(mockScene(), layout);
		const floor = result.meshes[1];
		expect(floor.material).toBe(getProfileMaterials('crowded').floor);
	});
});

describe('spire-ascent floors, ramps & summit beacon', () => {
	/** Default gold treasure pillar (non-spire profiles). */
	function findTreasureMarker(meshes) {
		return meshes.find(m =>
			m.geometry?.parameters?.height === 1.5 &&
			m.geometry?.parameters?.radiusTop === 0.3 &&
			m.geometry?.parameters?.radiusBottom === 0.3
		);
	}

	function findSummitBeaconMeshes(meshes) {
		return meshes.filter(m => m.userData?.dungeonTag === SPIRE_SUMMIT_BEACON_TAG);
	}

	function findEdgeHazardMeshes(meshes) {
		return meshes.filter(m => m.userData?.dungeonTag === SPIRE_EDGE_HAZARD_TAG);
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
					tierIndex: 0,
					floorCorners: { yNW: yBottom, yNE: yBottom, ySE: yBottom, ySW: yBottom },
				},
				{
					x: 0, z: 12, width: rampW, depth: rampD, role: 'connector', walls: [], band: 'ramp',
					floorCorners: { yNW: yMid, yNE: yMid, ySE: yBottom, ySW: yBottom },
				},
				{
					x: 0, z: 4, width: tierW, depth: tierD, role: 'combat', walls: [], band: 'tier',
					tierIndex: 1,
					floorCorners: { yNW: yMid, yNE: yMid, ySE: yMid, ySW: yMid },
				},
				{
					x: 0, z: -4, width: rampW, depth: rampD, role: 'connector', walls: [], band: 'ramp',
					floorCorners: { yNW: yTop, yNE: yTop, ySE: yMid, ySW: yMid },
				},
				{
					x: 0, z: -12, width: tierW, depth: tierD, role: 'treasure', walls: [], band: 'tier',
					tierIndex: 2,
					floorCorners: { yNW: yTop, yNE: yTop, ySE: yTop, ySW: yTop },
				},
			],
			passages: [],
		};
	}

	function findRoomFloorMesh(meshes, room) {
		return meshes.find(m =>
			m.position.x === room.x && m.position.z === room.z &&
			m.geometry?.parameters?.height === 0.1
		);
	}

	it('buildDungeon emits ground + one floor per room + summit beacon meshes', () => {
		const layout = spireAscentFixture();
		const result = buildDungeon(mockScene(), layout);
		const expected = 1 + layout.rooms.length + 2; // ground + floors + shaft + cap
		expect(result.meshes.length).toBe(expected);
	});

	it('places an emissive summit beacon on the top tier, well above DEFAULT_FLOOR_Y', () => {
		const layout = spireAscentFixture();
		const top = layout.rooms.find(r => r.role === 'treasure');
		const result = buildDungeon(mockScene(), layout);
		const beaconMeshes = findSummitBeaconMeshes(result.meshes);
		expect(beaconMeshes.length).toBeGreaterThanOrEqual(2);
		expect(findTreasureMarker(result.meshes)).toBeUndefined();
		const topFloorY = sampleFloorY(layout, top.x, top.z);
		const yBottom = sampleFloorY(layout, layout.rooms.find(r => r.role === 'start').x, layout.rooms.find(r => r.role === 'start').z);
		for (const mesh of beaconMeshes) {
			expect(mesh.material.emissiveIntensity).toBeGreaterThan(0);
			expect(mesh.position.y).toBeGreaterThan(yBottom + 8);
		}
		const shaft = beaconMeshes.find(m => m.userData.beaconPart === 'shaft');
		expect(shaft).toBeDefined();
		expect(shaft.position.y).toBeGreaterThan(DEFAULT_FLOOR_Y + 8);
		expect(shaft.position.y).toBeCloseTo(topFloorY + 1.6, 4);
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

	it('renders server-generated spire-ascent with summit beacon ≥ bottom tier + 8', () => {
		const layout = generateLayout(42, 'spire-ascent');
		const result = buildDungeon(mockScene(), layout);
		const bottom = layout.rooms.find(r => r.role === 'start');
		const treasure = layout.rooms.find(r => r.role === 'treasure');
		const beaconMeshes = findSummitBeaconMeshes(result.meshes);
		expect(beaconMeshes.length).toBeGreaterThanOrEqual(2);
		expect(findTreasureMarker(result.meshes)).toBeUndefined();
		const yBottom = sampleFloorY(layout, bottom.x, bottom.z);
		const yTreasure = sampleFloorY(layout, treasure.x, treasure.z);
		expect(yTreasure - yBottom).toBeGreaterThanOrEqual(8);
		for (const mesh of beaconMeshes) {
			expect(mesh.material.emissiveIntensity).toBeGreaterThan(0);
			expect(mesh.position.y).toBeGreaterThan(yBottom + 8);
		}
		const shaft = beaconMeshes.find(m => m.userData.beaconPart === 'shaft');
		expect(shaft.position.y).toBeCloseTo(yTreasure + 1.6, 4);
	});

	it('renders emissive edge hazard strips for server-generated spire-ascent', () => {
		const layout = generateLayout(42, 'spire-ascent');
		expect(layout.edgeHazards.length).toBeGreaterThanOrEqual(1);
		const result = buildDungeon(mockScene(), layout);
		const hazardMeshes = findEdgeHazardMeshes(result.meshes);
		expect(hazardMeshes.length).toBe(layout.edgeHazards.length);
		for (const mesh of hazardMeshes) {
			expect(mesh.material.emissiveIntensity).toBeGreaterThan(0);
			expect(mesh.geometry.parameters.height).toBeLessThanOrEqual(WALL_HEIGHT);
		}
	});

	it('buildSpireEdgeHazardMesh tracks hazard AABB footprint', () => {
		const hazard = {
			minX: 4,
			maxX: 5.2,
			minZ: -2,
			maxZ: 8,
			y: DEFAULT_FLOOR_Y + 5,
		};
		const mesh = buildSpireEdgeHazardMesh(hazard);
		expect(mesh.userData.dungeonTag).toBe(SPIRE_EDGE_HAZARD_TAG);
		expect(mesh.position.x).toBeCloseTo(4.6, 4);
		expect(mesh.position.z).toBeCloseTo(3, 4);
	});

	it('assigns distinct tier floor colors from bottom to summit', () => {
		const layout = spireAscentFixture();
		const result = buildDungeon(mockScene(), layout);
		const bottom = layout.rooms.find(r => r.tierIndex === 0);
		const top = layout.rooms.find(r => r.tierIndex === 2);
		const bottomFloor = findRoomFloorMesh(result.meshes, bottom);
		const topFloor = findRoomFloorMesh(result.meshes, top);
		expect(bottomFloor).toBeDefined();
		expect(topFloor).toBeDefined();
		expect(bottomFloor.material.color.getHex()).not.toBe(topFloor.material.color.getHex());
		expect(bottomFloor.material.color.getHex()).toBe(floorMaterial.color.getHex());
	});

	it('uses ramp floor colors interpolated between adjacent tiers', () => {
		const layout = spireAscentFixture();
		const result = buildDungeon(mockScene(), layout);
		const bottom = layout.rooms.find(r => r.tierIndex === 0);
		const top = layout.rooms.find(r => r.tierIndex === 2);
		const ramp = layout.rooms.find(r => r.band === 'ramp' && r.floorCorners.yNW === DEFAULT_FLOOR_Y + 5 && r.floorCorners.ySE === DEFAULT_FLOOR_Y);
		const bottomHex = findRoomFloorMesh(result.meshes, bottom).material.color.getHex();
		const topHex = findRoomFloorMesh(result.meshes, top).material.color.getHex();
		const rampHex = findRoomFloorMesh(result.meshes, ramp).material.color.getHex();
		expect(rampHex).not.toBe(bottomHex);
		expect(rampHex).not.toBe(topHex);
	});

	it('uses tier-matched wall materials instead of the global default on tiers', () => {
		const layout = spireAscentFixture();
		const top = layout.rooms.find(r => r.tierIndex === 2);
		top.walls = [{ axis: 'x', x: top.x, z: top.z - top.depth / 2, length: top.width }];
		const result = buildDungeon(mockScene(), layout);
		const wallMesh = result.meshes.find(m =>
			m.position.x === top.walls[0].x && m.position.z === top.walls[0].z &&
			m.geometry?.parameters?.height === WALL_HEIGHT
		);
		expect(wallMesh).toBeDefined();
		expect(wallMesh.material.color.getHex()).not.toBe(wallMaterial.color.getHex());
	});

	it('leaves non-spire layouts on profile materials (not spire tier tints)', () => {
		const layout = { rooms: [room(0, 0, { walls: [] })], passages: [] };
		const result = buildDungeon(mockScene(), layout);
		const floor = result.meshes[1];
		expect(floor.material).toBe(getProfileMaterials('crowded').floor);
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
		const canyon = getProfileMaterials('sunken-canyon');
		const monolith = buildLandmarkMesh('canyon_monolith', canyon);
		expect(monolith.userData.landmarkType).toBe('canyon_monolith');
		expect(monolith.children.length).toBeGreaterThan(0);
		expect(monolith.children.some(c => c.material === canyon.wall)).toBe(true);
		expect(monolith.children.some(c => c.material === canyon.accent)).toBe(true);
		const maxChildY = Math.max(...monolith.children.map(c => c.position.y + (c.geometry?.parameters?.height ?? 0) / 2));
		expect(maxChildY).toBeGreaterThanOrEqual(2.5);
		const plaza = getProfileMaterials('open-plaza');
		const dais = buildLandmarkMesh('arena_dais', plaza);
		expect(dais).toBeInstanceOf(THREE.Group);
		expect(dais.userData.landmarkType).toBe('arena_dais');
		expect(dais.children.length).toBeGreaterThan(0);
		expect(dais.children.every(c => c.geometry)).toBe(true);
		expect(dais.children.some(c => c.material === plaza.accent)).toBe(true);
		const vaultDais = buildLandmarkMesh('vault_dais', crowded);
		expect(vaultDais).toBeInstanceOf(THREE.Group);
		expect(vaultDais.userData.landmarkType).toBe('vault_dais');
		expect(vaultDais.children.length).toBeGreaterThan(0);
		expect(vaultDais.children.filter(c => c.material === crowded.accent).length).toBeGreaterThanOrEqual(3);
		const vaultMaxY = Math.max(...vaultDais.children.map(c => c.position.y + (c.geometry?.parameters?.height ?? 0) / 2));
		expect(vaultMaxY).toBeGreaterThan(1.4);
		const ice = getProfileMaterials('ice-cavern');
		const cairn = buildLandmarkMesh('ice_cairn', ice);
		expect(cairn).toBeInstanceOf(THREE.Group);
		expect(cairn.userData.landmarkType).toBe('ice_cairn');
		expect(cairn.children.length).toBeGreaterThan(0);
		expect(cairn.children.some(c => c.material === ice.wall)).toBe(true);
		expect(cairn.children.some(c => c.material === ice.accent)).toBe(true);
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

	it('buildDungeon on open-plaza layout emits one arena_dais landmark group', () => {
		const layout = generateLayout(42, 'open-plaza');
		expect(layout.landmarks).toHaveLength(1);
		const scene = mockScene();
		const { meshes } = buildDungeon(scene, layout);
		const landmarkGroups = scene.added.filter(o => o.userData?.landmarkType === 'arena_dais');
		expect(landmarkGroups).toHaveLength(1);
		expect(landmarkGroups[0].position.x).toBe(0);
		expect(landmarkGroups[0].position.z).toBe(0);
		const trackedInMeshes = meshes.filter(m =>
			landmarkGroups.some(g => g.children.includes(m))
		).length;
		expect(trackedInMeshes).toBe(landmarkGroups[0].children.length);
	});

	it('buildDungeon on rigid crowded layout emits one vault_dais landmark group', () => {
		const layout = generateLayout(123, 'crowded', { layoutMode: 'rigid' });
		expect(layout.landmarks).toHaveLength(1);
		expect(layout.landmarks[0].type).toBe('vault_dais');
		const scene = mockScene();
		const { meshes } = buildDungeon(scene, layout);
		const landmarkGroups = scene.added.filter(o => o.userData?.landmarkType === 'vault_dais');
		expect(landmarkGroups).toHaveLength(1);
		expect(landmarkGroups[0].position.x).toBe(layout.landmarks[0].x);
		expect(landmarkGroups[0].position.z).toBe(layout.landmarks[0].z);
		const trackedInMeshes = meshes.filter(m =>
			landmarkGroups.some(g => g.children.includes(m))
		).length;
		expect(trackedInMeshes).toBe(landmarkGroups[0].children.length);
	});

	it('buildWallColliders ignores landmarks (visual-only, no collision)', () => {
		const layout = generateLayout(42, 'crowded');
		expect(layout.landmarks.length).toBeGreaterThan(0);
		const withLandmarks = buildWallColliders(layout);
		const withoutLandmarks = buildWallColliders({ ...layout, landmarks: [] });
		expect(withLandmarks).toEqual(withoutLandmarks);
	});
});

describe('open-plaza perimeter decor', () => {
	function minimalPlazaWithDecor(perimeterDecor) {
		return {
			profile: 'open-plaza',
			rooms: [{
				x: 0,
				z: 0,
				width: 32,
				depth: 32,
				role: 'start',
				walls: [
					{ x: 0, z: -16, length: 32, axis: 'x' },
					{ x: 0, z: 16, length: 32, axis: 'x' },
					{ x: -16, z: 0, length: 32, axis: 'z' },
					{ x: 16, z: 0, length: 32, axis: 'z' },
				],
			}],
			passages: [],
			perimeterDecor,
		};
	}

	it('buildPerimeterDecorMesh sets decorType and accent child on arena_banner', () => {
		const materials = getProfileMaterials('open-plaza');
		const banner = buildPerimeterDecorMesh('arena_banner', materials);
		expect(banner).toBeInstanceOf(THREE.Group);
		expect(banner.userData.decorType).toBe('arena_banner');
		expect(banner.children.length).toBeGreaterThan(0);
		expect(banner.children.some(c => c.material === materials.accent)).toBe(true);
		const tier = buildPerimeterDecorMesh('arena_tier', materials);
		expect(tier.userData.decorType).toBe('arena_tier');
		expect(tier.children.length).toBeGreaterThanOrEqual(3);
	});

	it('buildDungeon emits one decor group per perimeterDecor entry', () => {
		const decor = [
			{ type: 'arena_banner', x: -9, z: -14, wall: 'north', yaw: 0 },
			{ type: 'arena_tier', x: 9, z: 14, wall: 'south', yaw: Math.PI },
			{ type: 'arena_tier', x: -14, z: -9, wall: 'west', yaw: Math.PI / 2 },
			{ type: 'arena_banner', x: 14, z: 9, wall: 'east', yaw: -Math.PI / 2 },
		];
		const layout = minimalPlazaWithDecor(decor);
		const scene = mockScene();
		const { meshes } = buildDungeon(scene, layout);
		const decorGroups = scene.added.filter(o => o.userData?.decorType);
		expect(decorGroups).toHaveLength(decor.length);
		const bannerGroup = decorGroups.find(g => g.userData.decorType === 'arena_banner');
		expect(bannerGroup.children.some(c => c.material === getProfileMaterials('open-plaza').accent)).toBe(true);
		const trackedInMeshes = meshes.filter(m =>
			decorGroups.some(g => g.children.includes(m))
		).length;
		const childCount = decorGroups.reduce((n, g) => n + g.children.length, 0);
		expect(trackedInMeshes).toBe(childCount);
	});

	it('buildDungeon on generated open-plaza includes perimeter decor groups', () => {
		const layout = generateLayout(42, 'open-plaza');
		expect(layout.perimeterDecor?.length).toBeGreaterThanOrEqual(8);
		const scene = mockScene();
		const { meshes } = buildDungeon(scene, layout);
		const decorGroups = scene.added.filter(o => o.userData?.decorType);
		expect(decorGroups.length).toBe(layout.perimeterDecor.length);
		const trackedInMeshes = meshes.filter(m =>
			decorGroups.some(g => g.children.includes(m))
		).length;
		expect(trackedInMeshes).toBe(
			layout.perimeterDecor.reduce((n, d) => {
				const g = decorGroups.find(o => o.userData.decorType === d.type
					&& Math.abs(o.position.x - d.x) < 1e-6 && Math.abs(o.position.z - d.z) < 1e-6);
				return n + (g ? g.children.length : 0);
			}, 0)
		);
	});

	it('layouts without perimeterDecor render unchanged (no perimeter decor groups)', () => {
		const layout = generateLayout(42, 'crowded');
		expect(layout.perimeterDecor).toBeUndefined();
		const scene = mockScene();
		buildDungeon(scene, layout);
		const perimeterTypes = new Set(['arena_banner', 'arena_tier']);
		const perimeterDecorGroups = scene.added.filter(o =>
			o.userData?.decorType && perimeterTypes.has(o.userData.decorType)
		);
		expect(perimeterDecorGroups).toHaveLength(0);
	});

	it('buildWallColliders ignores perimeter decor', () => {
		const layout = generateLayout(42, 'open-plaza');
		const withDecor = buildWallColliders(layout);
		const withoutDecor = buildWallColliders({ ...layout, perimeterDecor: [] });
		expect(withDecor).toEqual(withoutDecor);
	});
});

describe('open-plaza center ring floor markings', () => {
	function minimalPlazaLayout(floorMarkings) {
		return {
			profile: 'open-plaza',
			rooms: [{
				x: 0,
				z: 0,
				width: 32,
				depth: 32,
				role: 'start',
				walls: [
					{ x: 0, z: -16, length: 32, axis: 'x' },
					{ x: 0, z: 16, length: 32, axis: 'x' },
					{ x: -16, z: 0, length: 32, axis: 'z' },
					{ x: 16, z: 0, length: 32, axis: 'z' },
				],
			}],
			passages: [],
			floorMarkings,
		};
	}

	it('buildFloorMarkingMesh returns a flat RingGeometry mesh with accent material', () => {
		const materials = getProfileMaterials('open-plaza');
		const marking = { type: 'center_ring', x: 0, z: 0, innerRadius: 3.5, outerRadius: 4.5 };
		const mesh = buildFloorMarkingMesh(marking, materials);
		expect(mesh).toBeInstanceOf(THREE.Mesh);
		expect(mesh.geometry).toBeInstanceOf(THREE.RingGeometry);
		expect(mesh.material).toBe(materials.accent);
		expect(mesh.rotation.x).toBeCloseTo(-Math.PI / 2);
		expect(mesh.userData.floorMarkingType).toBe('center_ring');
	});

	it('buildDungeon emits one ring mesh per floor marking near DEFAULT_FLOOR_Y', () => {
		const layout = minimalPlazaLayout([
			{ type: 'center_ring', x: 0, z: 0, innerRadius: 3.5, outerRadius: 4.5 },
		]);
		const materials = getProfileMaterials('open-plaza');
		const scene = mockScene();
		const { meshes } = buildDungeon(scene, layout);
		const ringMeshes = meshes.filter(m => m.userData?.floorMarkingType === 'center_ring');
		expect(ringMeshes).toHaveLength(1);
		expect(ringMeshes[0].material).toBe(materials.accent);
		expect(ringMeshes[0].position.x).toBe(0);
		expect(ringMeshes[0].position.z).toBe(0);
		expect(ringMeshes[0].position.y).toBeCloseTo(DEFAULT_FLOOR_Y + 0.02, 5);
	});

	it('buildDungeon on generated open-plaza includes center ring marking meshes', () => {
		const layout = generateLayout(42, 'open-plaza');
		expect(layout.floorMarkings?.length).toBeGreaterThanOrEqual(1);
		const { meshes } = buildDungeon(mockScene(), layout);
		const ringMeshes = meshes.filter(m => m.userData?.floorMarkingType === 'center_ring');
		expect(ringMeshes.length).toBe(layout.floorMarkings.length);
	});

	it('layouts without floorMarkings render unchanged (no ring meshes)', () => {
		const layout = generateLayout(42, 'crowded');
		expect(layout.floorMarkings).toBeUndefined();
		const { meshes } = buildDungeon(mockScene(), layout);
		expect(meshes.filter(m => m.userData?.floorMarkingType === 'center_ring')).toHaveLength(0);
	});

	it('buildWallColliders ignores floor markings', () => {
		const layout = generateLayout(42, 'open-plaza');
		const withMarkings = buildWallColliders(layout);
		const withoutMarkings = buildWallColliders({ ...layout, floorMarkings: [] });
		expect(withMarkings).toEqual(withoutMarkings);
	});
});

describe('rift arena floor band markings', () => {
	const iceMarking = { type: 'rift_ice_band', x: -7.7, z: 0, width: 7.4, depth: 22.8 };
	const emberMarking = { type: 'rift_ember_band', x: 7.7, z: 0, width: 7.4, depth: 22.8 };

	it('buildFloorMarkingMesh renders flat band meshes with distinct frost/ember materials', () => {
		const materials = getProfileMaterials('boss-arena');
		const ice = buildFloorMarkingMesh(iceMarking, materials);
		const ember = buildFloorMarkingMesh(emberMarking, materials);

		expect(ice).toBeInstanceOf(THREE.Mesh);
		expect(ember).toBeInstanceOf(THREE.Mesh);
		expect(ice.geometry).toBeInstanceOf(THREE.PlaneGeometry);
		expect(ember.geometry).toBeInstanceOf(THREE.PlaneGeometry);
		expect(ice.rotation.x).toBeCloseTo(-Math.PI / 2);
		expect(ember.rotation.x).toBeCloseTo(-Math.PI / 2);
		expect(ice.userData.floorMarkingType).toBe('rift_ice_band');
		expect(ember.userData.floorMarkingType).toBe('rift_ember_band');

		// Distinct materials: frost-blue (blue-dominant) vs ember-orange (red-dominant).
		expect(ice.material).not.toBe(ember.material);
		const iceHex = ice.material.color.getHex();
		const emberHex = ember.material.color.getHex();
		expect(iceHex).not.toBe(emberHex);
		expect(iceHex & 0xff).toBeGreaterThan((iceHex >> 16) & 0xff);
		expect((emberHex >> 16) & 0xff).toBeGreaterThan(emberHex & 0xff);
	});

	it('unknown floor marking types still return null', () => {
		const materials = getProfileMaterials('boss-arena');
		expect(buildFloorMarkingMesh({ type: 'mystery_glyph', x: 0, z: 0 }, materials)).toBeNull();
	});

	it('buildDungeon on a rift-themed boss arena emits both band meshes plus the ring', () => {
		const layout = generateLayout(42, 'boss-arena', { arenaTheme: 'rift' });
		const { meshes } = buildDungeon(mockScene(), layout);
		const bandTypes = meshes
			.filter(m => m.userData?.floorMarkingType?.startsWith('rift_'))
			.map(m => m.userData.floorMarkingType)
			.sort();
		expect(bandTypes).toEqual(['rift_ember_band', 'rift_ice_band']);
		expect(meshes.filter(m => m.userData?.floorMarkingType === 'center_ring')).toHaveLength(1);
	});
});

describe('entry room decor rendering', () => {
	it('buildEntryDecorMesh sets decorType on each decor kind', () => {
		const iceMats = { ...getEntryRoomMaterials('ice-cavern'), accent: getProfileMaterials('ice-cavern').accent };
		const fireMats = { ...getEntryRoomMaterials('fire-cavern'), accent: getProfileMaterials('fire-cavern').accent };
		const crowdedMats = { ...getEntryRoomMaterials('crowded'), accent: getProfileMaterials('crowded').accent };
		expect(buildEntryDecorMesh('icicle_cluster', iceMats).userData.decorType).toBe('icicle_cluster');
		expect(buildEntryDecorMesh('ember_vent', fireMats).userData.decorType).toBe('ember_vent');
		expect(buildEntryDecorMesh('vault_rubble', crowdedMats).userData.decorType).toBe('vault_rubble');
	});

	it('buildDungeon decor groups carry decorType matching layout entryDecor (seed 42)', () => {
		const profiles = [
			{ profile: 'ice-cavern', type: 'icicle_cluster' },
			{ profile: 'fire-cavern', type: 'ember_vent' },
			{ profile: 'crowded', type: 'vault_rubble' },
		];
		for (const { profile, type } of profiles) {
			const layout = generateLayout(42, profile);
			expect(layout.entryDecor?.length).toBeGreaterThanOrEqual(2);
			const scene = mockScene();
			buildDungeon(scene, layout);
			const decorGroups = scene.added.filter(o => o.userData?.decorType);
			expect(decorGroups).toHaveLength(layout.entryDecor.length);
			expect(decorGroups.every(g => g.userData.decorType === type)).toBe(true);
			for (const d of layout.entryDecor) {
				const group = decorGroups.find(g =>
					Math.abs(g.position.x - d.x) < 1e-6 && Math.abs(g.position.z - d.z) < 1e-6
				);
				expect(group).toBeDefined();
				expect(group.userData.decorType).toBe(d.type);
			}
		}
	});

	it('buildWallColliders ignores entry decor', () => {
		const layout = generateLayout(42, 'crowded');
		expect(layout.entryDecor?.length).toBeGreaterThanOrEqual(2);
		const withDecor = buildWallColliders(layout);
		const withoutDecor = buildWallColliders({ ...layout, entryDecor: [] });
		expect(withDecor).toEqual(withoutDecor);
	});
});

describe('cross-quest entry room distinguishability (tier 1)', () => {
	const TIER = 1;
	const QUEST_CASES = [
		{ questId: 'frost_crossing', decorType: 'icicle_cluster' },
		{ questId: 'ember_descent', decorType: 'ember_vent' },
		{ questId: 'training_caverns', decorType: 'vault_rubble' },
	];

	it('start-room floor/wall colors and entry decor differ across frost_crossing, ember_descent, and training_caverns', () => {
		const appearances = Object.fromEntries(
			QUEST_CASES.map(({ questId }) => [
				questId,
				collectStartRoomAppearance(layoutForQuestTier(questId, TIER)),
			]),
		);

		const frost = appearances.frost_crossing;
		const ember = appearances.ember_descent;
		const vault = appearances.training_caverns;

		expect(new Set([frost.floorHex, ember.floorHex, vault.floorHex]).size).toBe(3);
		expect(new Set([frost.wallHex, ember.wallHex, vault.wallHex]).size).toBeGreaterThanOrEqual(2);

		for (const { questId, decorType } of QUEST_CASES) {
			expect(appearances[questId].decorTypes).toEqual([decorType]);
		}
	});
});

describe('ice-cavern profile & slippery floors', () => {
	/** Treasure exit pillar from dungeon.js (THREE mock has no geometry.type). */
	function findTreasureMarker(meshes) {
		return meshes.find(m =>
			m.geometry?.parameters?.height === 1.5 &&
			m.geometry?.parameters?.radiusTop === 0.3 &&
			m.geometry?.parameters?.radiusBottom === 0.3
		);
	}

	function slipperyFloorLabLayout() {
		return {
			profile: 'slippery-floor-lab',
			passageWidth: 4,
			rooms: [
				{ role: 'start', x: 0, z: 0, width: 12, depth: 12, floorSurface: 'normal', walls: [] },
				{ x: 0, z: 18, width: 12, depth: 12, floorSurface: 'slippery', walls: [] },
			],
			passages: [{ x1: 0, z1: 0, x2: 0, z2: 18, walls: [], corridorLength: 18 }],
		};
	}

	it('defines ice-cavern palette distinct from sunken-canyon and crowded', () => {
		const ice = getProfileMaterialColors('ice-cavern');
		const canyon = getProfileMaterialColors('sunken-cavern');
		const crowded = getProfileMaterialColors('crowded');
		expect(ice.floor).toBe(0x5c6b7a);
		expect(ice.floor).not.toBe(canyon.floor);
		expect(ice.floor).not.toBe(crowded.floor);
		expect(ice.wall).not.toBe(canyon.wall);
		expect(ice.wall).not.toBe(crowded.wall);
		expect(getIceCavernBandFloorHex('stone')).toBe(0x5c6b7a);
		expect(getIceCavernBandFloorHex('ice')).toBe(0xc8e8f8);
	});

	it('caches profile and band materials as singletons', () => {
		const profileA = getProfileMaterials('ice-cavern');
		const profileB = getProfileMaterials('ice-cavern');
		expect(profileA.floor).toBe(profileB.floor);
		const bandA = getIceCavernBandMaterials('stone');
		const bandB = getIceCavernBandMaterials('stone');
		expect(bandA.floor).toBe(bandB.floor);
		const slipperyA = getSlipperyFloorMaterial();
		const slipperyB = getSlipperyFloorMaterial();
		expect(slipperyA).toBe(slipperyB);
		expect(slipperyA.emissiveIntensity).toBeGreaterThan(0);
	});

	it('slippery room mesh material differs from co-layout normal room (lab fixture)', () => {
		const layout = slipperyFloorLabLayout();
		const result = buildDungeon(mockScene(), layout);
		const normalRoom = layout.rooms[0];
		const slipperyRoom = layout.rooms[1];
		const normalFloor = findRoomFloorMesh(result.meshes, normalRoom);
		const slipperyFloor = findRoomFloorMesh(result.meshes, slipperyRoom);
		expect(normalFloor).toBeDefined();
		expect(slipperyFloor).toBeDefined();
		expect(slipperyFloor.material).toBe(getSlipperyFloorMaterial());
		expect(slipperyFloor.material.color.getHex()).not.toBe(normalFloor.material.color.getHex());
	});

	it('generateLayout(42, ice-cavern) builds without error and emits ≥1 slippery floor mesh', () => {
		const layout = generateLayout(42, 'ice-cavern');
		expect(layout.profile).toBe('ice-cavern');
		const slipperyRooms = layout.rooms.filter(r => r.floorSurface === 'slippery');
		expect(slipperyRooms.length).toBeGreaterThanOrEqual(1);

		const result = buildDungeon(mockScene(), layout);
		for (const room of slipperyRooms) {
			const floor = findRoomFloorMesh(result.meshes, room);
			expect(floor).toBeDefined();
			expect(floor.material).toBe(getSlipperyFloorMaterial());
		}
	});

	it('assigns distinct stone and ice band floor colors before slippery override', () => {
		const layout = generateLayout(42, 'ice-cavern');
		const stoneStart = layout.rooms.find(r => r.role === 'start');
		const iceField = layout.rooms.find(r => r.band === 'ice');
		expect(stoneStart.floorSurface).toBe('normal');
		expect(iceField.floorSurface).toBe('slippery');

		const result = buildDungeon(mockScene(), layout);
		const stoneFloor = findRoomFloorMesh(result.meshes, stoneStart);
		const iceFloor = findRoomFloorMesh(result.meshes, iceField);
		expect(stoneFloor).toBeDefined();
		expect(iceFloor).toBeDefined();
		expect(stoneFloor.material.color.getHex()).not.toBe(iceFloor.material.color.getHex());
		expect(iceFloor.material).toBe(getSlipperyFloorMaterial());
	});

	it('places treasure marker on sampled floor Y for ice-cavern', () => {
		const layout = generateLayout(42, 'ice-cavern');
		const treasure = layout.rooms.find(r => r.role === 'treasure');
		const result = buildDungeon(mockScene(), layout);
		const marker = findTreasureMarker(result.meshes);
		expect(marker).toBeDefined();
		const floorY = resolveFloorY(sampleFloorY(layout, treasure.x, treasure.z));
		expect(marker.position.y).toBeCloseTo(floorY + 0.75, 4);
	});

	it('renders one ice_cairn landmark group at treasure room centre for seed 42', () => {
		const layout = generateLayout(42, 'ice-cavern');
		expect(layout.landmarks).toHaveLength(1);
		expect(layout.landmarks[0].type).toBe('ice_cairn');
		const scene = mockScene();
		const { meshes } = buildDungeon(scene, layout);
		const cairnGroups = scene.added.filter(o => o.userData?.landmarkType === 'ice_cairn');
		expect(cairnGroups).toHaveLength(1);
		const lm = layout.landmarks[0];
		const treasure = layout.rooms.find(r => r.role === 'treasure');
		expect(lm.x).toBe(treasure.x);
		expect(lm.z).toBe(treasure.z);
		const floorY = resolveFloorY(sampleFloorY(layout, lm.x, lm.z));
		expect(cairnGroups[0].position.x).toBe(lm.x);
		expect(cairnGroups[0].position.z).toBe(lm.z);
		expect(cairnGroups[0].position.y).toBeCloseTo(floorY, 4);
		expect(cairnGroups[0].children.length).toBeGreaterThan(0);
		expect(meshes.some(m => cairnGroups[0].children.includes(m))).toBe(true);
	});
});
