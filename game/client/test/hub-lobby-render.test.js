import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateHub, generateLayout } from '../../server/dungeon.js';
import { computeWalkableAABBs } from '../dungeon.js';

// Drives the renderer the way main.js does during the lobby phase: build the
// hub layout, spawn the local avatar in it, then deploy and confirm the geometry
// switches to the quest layout. main.js itself is not unit-testable (it is
// v8-ignored UI glue), so we exercise the renderer contract main.js relies on.
describe('hub lobby render', () => {
	let rafCallbacks;

	beforeEach(() => {
		vi.resetModules();
		rafCallbacks = [];
		vi.stubGlobal('requestAnimationFrame', vi.fn((cb) => {
			rafCallbacks.push(cb);
			return rafCallbacks.length;
		}));
		window.__soundLogEnabled = true;
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		document.body.innerHTML = '';
	});

	/** Center of the layout's `role: 'start'` room — where buildDungeon spawns. */
	function startCenter(layout) {
		const start = layout.rooms.find((r) => r.role === 'start') || layout.rooms[0];
		return { x: start.x, z: start.z };
	}

	it('renders the hub during the lobby and spawns the local avatar on the hub floor', async () => {
		const hubLayout = generateHub(0);
		expect(hubLayout.profile).toBe('hub');
		// The hub carries walkable collision geometry like other stages.
		expect(computeWalkableAABBs(hubLayout).length).toBeGreaterThan(0);

		const {
			initScene,
			setGameStateRef,
			setMyId,
			setGamePhase,
			setPlayerPosition,
			getSpawnPosition,
			getWallColliders,
			getMeshMaps,
			animate,
		} = await import('../renderer.js');

		// Lobby-phase render: build the scene from the hub layout (profile 'hub').
		setGamePhase('lobby');
		initScene(hubLayout, { x: 0, z: 0 });

		// The avatar spawns at the hub's start room (operations), and the renderer
		// built wall colliders from the hub so the avatar sits on the hub floor.
		const hubSpawn = startCenter(hubLayout);
		expect(getSpawnPosition()).toEqual(hubSpawn);
		expect(getWallColliders().length).toBeGreaterThan(0);

		// Wire up the local player and run a frame — the animate loop builds the
		// local avatar mesh from gameState.players[myId].
		setMyId('p1');
		setPlayerPosition(hubSpawn.x, hubSpawn.z);
		setGameStateRef({
			gamePhase: 'lobby',
			layout: hubLayout,
			players: { p1: { x: hubSpawn.x, z: hubSpawn.z, hp: 100, dead: false } },
			loot: [],
			enemies: [],
			minions: [],
		});

		animate(0);

		expect(getMeshMaps().playersMeshes.p1).toBeTruthy();
	});

	it('rebuilds to the quest layout on deploy, moving the avatar off the hub', async () => {
		const hubLayout = generateHub(0);
		const questLayout = generateLayout(42, 'default');
		expect(questLayout.profile).not.toBe('hub');

		const {
			initScene,
			rebuildDungeonLayout,
			setGameStateRef,
			setMyId,
			setGamePhase,
			setPlayerPosition,
			getSpawnPosition,
			getMeshMaps,
			animate,
		} = await import('../renderer.js');

		// Start in the hub (lobby), avatar built.
		setGamePhase('lobby');
		initScene(hubLayout, { x: 0, z: 0 });
		setMyId('p1');
		const hubSpawn = startCenter(hubLayout);
		setPlayerPosition(hubSpawn.x, hubSpawn.z);
		setGameStateRef({
			gamePhase: 'lobby',
			layout: hubLayout,
			players: { p1: { x: hubSpawn.x, z: hubSpawn.z, hp: 100, dead: false } },
			loot: [],
			enemies: [],
			minions: [],
		});
		animate(0);
		expect(getSpawnPosition()).toEqual(hubSpawn);
		expect(getMeshMaps().playersMeshes.p1).toBeTruthy();

		// Deploy: rebuild to the quest layout. The spawn switches to the quest
		// start room, proving the run uses the quest geometry, not the hub.
		const questSpawn = startCenter(questLayout);
		expect(questSpawn).not.toEqual(hubSpawn);
		rebuildDungeonLayout(questLayout);
		expect(getSpawnPosition()).toEqual(questSpawn);

		// Avatar persists into the run.
		setGamePhase('playing');
		setGameStateRef({
			gamePhase: 'playing',
			layout: questLayout,
			players: { p1: { x: questSpawn.x, z: questSpawn.z, hp: 100, dead: false } },
			loot: [],
			enemies: [],
			minions: [],
		});
		animate(0);
		expect(getMeshMaps().playersMeshes.p1).toBeTruthy();
	});
});
