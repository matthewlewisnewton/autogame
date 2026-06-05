import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateHub } from '../../server/dungeon.js';

// Exercises the renderer contract that main.js relies on after applyHubPresence
// merges hub-presence entries into gameState.players during the lobby phase.

const NON_DEFAULT_COSMETIC = {
	bodyColor: '#ff00aa',
	accentColor: '#33cc33',
	bodyShape: 'cylinder',
	hat: 'wizard',
};

function startCenter(layout) {
	const start = layout.rooms.find((r) => r.role === 'start') || layout.rooms[0];
	return { x: start.x, z: start.z };
}

function lobbyPlayerState(hubLayout, myId, remoteId, remotePos) {
	return {
		gamePhase: 'lobby',
		layout: hubLayout,
		players: {
			[myId]: {
				id: myId,
				x: startCenter(hubLayout).x,
				z: startCenter(hubLayout).z,
				y: 0.5,
				hp: 100,
				dead: false,
				cosmetic: { bodyShape: 'box', hat: 'none' },
			},
			[remoteId]: {
				id: remoteId,
				x: remotePos.x,
				z: remotePos.z,
				y: 0.5,
				rotation: 0,
				hp: 100,
				dead: false,
				cosmetic: NON_DEFAULT_COSMETIC,
			},
		},
		loot: [],
		enemies: [],
		minions: [],
	};
}

describe('hub presence avatars (lobby)', () => {
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

	it('builds meshes for local and remote lobby players', async () => {
		const hubLayout = generateHub(0);
		const hubSpawn = startCenter(hubLayout);
		const remoteSpawn = { x: hubSpawn.x + 4, z: hubSpawn.z + 2 };

		const {
			initScene,
			setGameStateRef,
			setMyId,
			setGamePhase,
			setPlayerPosition,
			animate,
			getMeshMaps,
		} = await import('../renderer.js');

		setGamePhase('lobby');
		initScene(hubLayout, { x: 0, z: 0 });
		setMyId('p1');
		setPlayerPosition(hubSpawn.x, hubSpawn.z);
		setGameStateRef(lobbyPlayerState(hubLayout, 'p1', 'p2', remoteSpawn));

		animate(0);

		const meshes = getMeshMaps().playersMeshes;
		expect(meshes.p1).toBeTruthy();
		expect(meshes.p2).toBeTruthy();
		expect(meshes.p2.position.x).toBeCloseTo(remoteSpawn.x, 5);
		expect(meshes.p2.position.z).toBeCloseTo(remoteSpawn.z, 5);
		expect(meshes.p2.userData.hatId).toBe('wizard');
	});

	it('moves the remote mesh when hub presence coordinates change', async () => {
		const hubLayout = generateHub(0);
		const hubSpawn = startCenter(hubLayout);
		const remoteStart = { x: hubSpawn.x + 2, z: hubSpawn.z };
		const remoteMoved = { x: hubSpawn.x + 8, z: hubSpawn.z + 5 };

		const {
			initScene,
			setGameStateRef,
			setMyId,
			setGamePhase,
			setPlayerPosition,
			animate,
			getMeshMaps,
		} = await import('../renderer.js');

		setGamePhase('lobby');
		initScene(hubLayout, { x: 0, z: 0 });
		setMyId('p1');
		setPlayerPosition(hubSpawn.x, hubSpawn.z);

		const gs = lobbyPlayerState(hubLayout, 'p1', 'p2', remoteStart);
		setGameStateRef(gs);
		animate(0);

		const remoteMesh = getMeshMaps().playersMeshes.p2;
		expect(remoteMesh.position.x).toBeCloseTo(remoteStart.x, 5);
		expect(remoteMesh.position.z).toBeCloseTo(remoteStart.z, 5);

		gs.players.p2.x = remoteMoved.x;
		gs.players.p2.z = remoteMoved.z;
		setGameStateRef(gs);
		animate(16);

		expect(remoteMesh.position.x).toBeCloseTo(remoteMoved.x, 5);
		expect(remoteMesh.position.z).toBeCloseTo(remoteMoved.z, 5);
	});
});
