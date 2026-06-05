import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateHub } from '../../server/dungeon.js';
import { mergeHubPresenceIntoPlayers } from '../hubPresenceMerge.js';

describe('hub presence render', () => {
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

	function startCenter(layout) {
		const start = layout.rooms.find((r) => r.role === 'start') || layout.rooms[0];
		return { x: start.x, z: start.z };
	}

	it('renders a remote peer mesh with a distinct cosmetic after presence merge', async () => {
		const hubLayout = generateHub(0);
		const hubSpawn = startCenter(hubLayout);
		const remoteSpawn = { x: hubSpawn.x + 4, z: hubSpawn.z + 2 };

		const {
			initScene,
			setGameStateRef,
			setMyId,
			setGamePhase,
			setPlayerPosition,
			getMeshMaps,
			animate,
		} = await import('../renderer.js');

		setGamePhase('lobby');
		initScene(hubLayout, { x: 0, z: 0 });
		setMyId('p1');
		setPlayerPosition(hubSpawn.x, hubSpawn.z);

		const localCosmetic = {
			bodyShape: 'box',
			bodyColor: '#3366cc',
			accentColor: '#ffcc00',
			hat: 'none',
		};
		const remoteCosmetic = {
			bodyShape: 'cylinder',
			bodyColor: '#cc3366',
			accentColor: '#33ff99',
			hat: 'none',
		};

		const gameState = {
			gamePhase: 'lobby',
			layout: hubLayout,
			players: {
				p1: {
					x: hubSpawn.x,
					z: hubSpawn.z,
					hp: 100,
					dead: false,
					cosmetic: localCosmetic,
				},
			},
			loot: [],
			enemies: [],
			minions: [],
		};

		mergeHubPresenceIntoPlayers(gameState.players, {
			p1: {
				x: hubSpawn.x,
				z: hubSpawn.z,
				rotation: 0,
				cosmetic: localCosmetic,
			},
			p2: {
				x: remoteSpawn.x,
				z: remoteSpawn.z,
				rotation: 1.2,
				cosmetic: remoteCosmetic,
			},
		}, 'p1');

		setGameStateRef(gameState);
		animate(0);

		const meshes = getMeshMaps().playersMeshes;
		expect(meshes.p1).toBeTruthy();
		expect(meshes.p2).toBeTruthy();
		expect(meshes.p1.userData.cosmeticKey).toBe('box|#3366cc|#ffcc00|none');
		expect(meshes.p2.userData.cosmeticKey).toBe('cylinder|#cc3366|#33ff99|none');
		expect(meshes.p1.userData.cosmeticKey).not.toBe(meshes.p2.userData.cosmeticKey);
	});

	it('removes a departed remote peer mesh after presence merge drops them', async () => {
		const hubLayout = generateHub(0);
		const hubSpawn = startCenter(hubLayout);

		const {
			initScene,
			setGameStateRef,
			setMyId,
			setGamePhase,
			setPlayerPosition,
			getMeshMaps,
			animate,
		} = await import('../renderer.js');

		setGamePhase('lobby');
		initScene(hubLayout, { x: 0, z: 0 });
		setMyId('p1');
		setPlayerPosition(hubSpawn.x, hubSpawn.z);

		const cosmetic = {
			bodyShape: 'box',
			bodyColor: '#3366cc',
			accentColor: '#ffcc00',
			hat: 'none',
		};

		const gameState = {
			gamePhase: 'lobby',
			layout: hubLayout,
			players: {
				p1: { x: hubSpawn.x, z: hubSpawn.z, hp: 100, dead: false, cosmetic },
				p2: {
					x: hubSpawn.x + 3,
					z: hubSpawn.z,
					hp: 100,
					dead: false,
					cosmetic: {
						bodyShape: 'cylinder',
						bodyColor: '#cc3366',
						accentColor: '#33ff99',
						hat: 'none',
					},
				},
			},
			loot: [],
			enemies: [],
			minions: [],
		};

		setGameStateRef(gameState);
		animate(0);
		expect(getMeshMaps().playersMeshes.p2).toBeTruthy();

		mergeHubPresenceIntoPlayers(gameState.players, {
			p1: { x: hubSpawn.x, z: hubSpawn.z, rotation: 0, cosmetic },
		}, 'p1');
		setGameStateRef(gameState);
		animate(0);

		expect(getMeshMaps().playersMeshes.p2).toBeUndefined();
	});
});
