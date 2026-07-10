import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateHub, generateLayout } from '../../server/dungeon.js';

/**
 * Hub ↔ quest transitions must replace the THREE.Scene root (keep WebGLRenderer)
 * so combat leftovers cannot linger under a reused scene graph. Mid-run extract
 * still receives a playing snapshot with enemies — animate() must not redraw them
 * into the ship interior.
 */
describe('hub scene world reset', () => {
	let rafCallbacks;

	beforeEach(() => {
		vi.resetModules();
		rafCallbacks = [];
		vi.stubGlobal('requestAnimationFrame', vi.fn((cb) => {
			rafCallbacks.push(cb);
			return rafCallbacks.length;
		}));
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		document.body.innerHTML = '';
	});

	function startCenter(layout) {
		const start = layout.rooms.find((r) => r.role === 'start') || layout.rooms[0];
		return { x: start.x, z: start.z };
	}

	it('resetSceneWorld replaces the scene root and drops quest enemy meshes', async () => {
		const hubLayout = generateHub(0);
		const questLayout = generateLayout(42, 'default');
		const {
			initScene,
			resetSceneWorld,
			setGameStateRef,
			setMyId,
			setGamePhase,
			getMeshMaps,
			getScene,
			animate,
		} = await import('../renderer.js');

		setGamePhase('playing');
		initScene(questLayout, { x: 0, z: 0 });
		setMyId('p1');
		const questSpawn = startCenter(questLayout);
		setGameStateRef({
			gamePhase: 'playing',
			layout: questLayout,
			players: { p1: { x: questSpawn.x, z: questSpawn.z, hp: 100, dead: false } },
			loot: [],
			enemies: [
				{ id: 'e1', type: 'grunt', x: questSpawn.x + 2, z: questSpawn.z, hp: 30, maxHp: 30 },
			],
			minions: [],
		});
		animate(0);
		expect(getMeshMaps().enemiesMeshes.e1).toBeTruthy();
		const questScene = getScene();
		expect(questScene).toBeTruthy();
		const canvasCountBefore = document.querySelectorAll('canvas').length;

		resetSceneWorld(hubLayout);
		expect(getScene()).not.toBe(questScene);
		expect(getMeshMaps().enemiesMeshes.e1).toBeUndefined();
		expect(Object.keys(getMeshMaps().enemiesMeshes)).toHaveLength(0);
		expect(Object.keys(getMeshMaps().playersMeshes)).toHaveLength(0);
		// WebGLRenderer / canvas reused — no second canvas.
		expect(document.querySelectorAll('canvas').length).toBe(canvasCountBefore);
	});

	it('rebuildDungeonLayout auto-routes hub↔quest through resetSceneWorld', async () => {
		const hubLayout = generateHub(0);
		const questLayout = generateLayout(42, 'default');
		const {
			initScene,
			rebuildDungeonLayout,
			setGameStateRef,
			setMyId,
			setGamePhase,
			getMeshMaps,
			getScene,
			animate,
		} = await import('../renderer.js');

		setGamePhase('playing');
		initScene(questLayout, { x: 0, z: 0 });
		setMyId('p1');
		const questSpawn = startCenter(questLayout);
		setGameStateRef({
			gamePhase: 'playing',
			layout: questLayout,
			players: { p1: { x: questSpawn.x, z: questSpawn.z, hp: 100, dead: false } },
			loot: [],
			enemies: [
				{ id: 'e2', type: 'grunt', x: questSpawn.x + 1, z: questSpawn.z, hp: 30, maxHp: 30 },
			],
			minions: [],
		});
		animate(0);
		const questScene = getScene();
		expect(getMeshMaps().enemiesMeshes.e2).toBeTruthy();

		rebuildDungeonLayout(hubLayout);
		expect(getScene()).not.toBe(questScene);
		expect(Object.keys(getMeshMaps().enemiesMeshes)).toHaveLength(0);
	});

	it('resetSceneWorld flushes floating damage-number DOM nodes', async () => {
		const hubLayout = generateHub(0);
		const questLayout = generateLayout(42, 'default');
		const {
			initScene,
			resetSceneWorld,
			setGamePhase,
			spawnDamageNumber,
		} = await import('../renderer.js');

		setGamePhase('playing');
		initScene(questLayout, { x: 0, z: 0 });
		spawnDamageNumber(1, 1, 1, 12, '#ff0000', false);
		expect([...document.body.querySelectorAll('div')].some((el) => el.textContent === '-12')).toBe(true);

		resetSceneWorld(hubLayout);
		expect([...document.body.querySelectorAll('div')].some((el) => el.textContent === '-12')).toBe(false);
	});

	it('animate does not recreate combat meshes while phase is lobby on hub layout', async () => {
		const hubLayout = generateHub(0);
		const {
			initScene,
			setGameStateRef,
			setMyId,
			setGamePhase,
			getMeshMaps,
			animate,
		} = await import('../renderer.js');

		setGamePhase('lobby');
		initScene(hubLayout, { x: 0, z: 0 });
		setMyId('p1');
		const hubSpawn = startCenter(hubLayout);

		setGameStateRef({
			gamePhase: 'playing',
			layout: hubLayout,
			players: {
				p1: {
					x: hubSpawn.x,
					z: hubSpawn.z,
					hp: 100,
					dead: false,
					extracted: true,
				},
			},
			loot: [{ id: 'l1', x: hubSpawn.x, z: hubSpawn.z, value: 5, kind: 'currency' }],
			enemies: [
				{ id: 'e_stale', type: 'grunt', x: hubSpawn.x + 3, z: hubSpawn.z, hp: 30, maxHp: 30 },
			],
			minions: [
				{ id: 'm1', type: 'wolf', x: hubSpawn.x - 2, z: hubSpawn.z, hp: 20, maxHp: 20 },
			],
			telepipe: { x: hubSpawn.x + 1, z: hubSpawn.z + 1 },
		});
		animate(0);
		animate(16);

		expect(getMeshMaps().enemiesMeshes.e_stale).toBeUndefined();
		expect(getMeshMaps().minionsMeshes.m1).toBeUndefined();
		expect(getMeshMaps().lootMeshes.l1).toBeUndefined();
		expect(Object.keys(getMeshMaps().enemiesMeshes)).toHaveLength(0);
	});
});
