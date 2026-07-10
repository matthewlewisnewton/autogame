import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateHub, generateLayout } from '../../server/dungeon.js';

/**
 * Regression: returning to / extracting into the hub ship reused the Three.js
 * scene via rebuildDungeonLayout() without flushing combat meshes. animate()
 * then kept reconciling gameState.enemies (still present during mid-run
 * extract), so dungeon enemies appeared behind the lobby interior.
 */
describe('hub combat world cleanup', () => {
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

	it('rebuildDungeonLayout to hub disposes enemy meshes left from a quest run', async () => {
		const hubLayout = generateHub(0);
		const questLayout = generateLayout(42, 'default');
		const {
			initScene,
			rebuildDungeonLayout,
			setGameStateRef,
			setMyId,
			setGamePhase,
			getMeshMaps,
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

		// Mid-run extract / return-to-lobby: geometry swaps to hub while the
		// playing snapshot may still list enemies.
		rebuildDungeonLayout(hubLayout);
		expect(getMeshMaps().enemiesMeshes.e1).toBeUndefined();
		expect(Object.keys(getMeshMaps().enemiesMeshes)).toHaveLength(0);
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
			clearWorldEntityMeshes,
		} = await import('../renderer.js');

		setGamePhase('lobby');
		initScene(hubLayout, { x: 0, z: 0 });
		setMyId('p1');
		const hubSpawn = startCenter(hubLayout);

		// Extracted player still receives a playing-world snapshot with enemies,
		// but the renderer is showing the hub under lobby phase.
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
		clearWorldEntityMeshes();
		animate(0);
		animate(16);

		expect(getMeshMaps().enemiesMeshes.e_stale).toBeUndefined();
		expect(getMeshMaps().minionsMeshes.m1).toBeUndefined();
		expect(getMeshMaps().lootMeshes.l1).toBeUndefined();
		expect(Object.keys(getMeshMaps().enemiesMeshes)).toHaveLength(0);
	});

	it('clearWorldEntityMeshes is idempotent and safe with an empty scene', async () => {
		const { initScene, clearWorldEntityMeshes, getMeshMaps } = await import('../renderer.js');
		initScene(null, { x: 0, z: 0 });
		expect(() => clearWorldEntityMeshes()).not.toThrow();
		expect(() => clearWorldEntityMeshes()).not.toThrow();
		expect(Object.keys(getMeshMaps().enemiesMeshes)).toHaveLength(0);
	});
});
