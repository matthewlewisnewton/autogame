import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateHub } from '../../server/dungeon.js';

// Drives the renderer animate() loop with lobby gameState shaped like a
// hubPresenceUpdate merge: local + remote party-mate, then remote departure.

const gltfLoadMock = vi.hoisted(() => vi.fn());

function makeFakeMaterial(hex) {
	return {
		visible: undefined,
		color: { _v: hex, getHex() { return this._v; }, setHex(v) { this._v = v; } },
		clone() { return makeFakeMaterial(this.color._v); },
		dispose: vi.fn(),
	};
}

function makeFakePlayerScene(bodyHex = 0x123456) {
	const makeVec = () => ({ x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } });
	const makeScale = () => ({ x: 1, y: 1, z: 1, multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; } });
	const morphTargetDictionary = {
		height: 0,
		headSize: 1,
		torsoWidth: 2,
		armLength: 3,
		legLength: 4,
		shoulderWidth: 5,
	};
	const morphTargetInfluences = [0, 0, 0, 0, 0, 0];
	const body = {
		isMesh: true,
		isSkinnedMesh: true,
		name: 'SuperHero_Male',
		morphTargetDictionary,
		morphTargetInfluences,
		geometry: {
			parameters: { width: 0.6, height: 1.8, depth: 0.6 },
			dispose: vi.fn(),
		},
		material: makeFakeMaterial(bodyHex),
		position: makeVec(),
		scale: makeScale(),
		userData: {},
		traverse(cb) { cb(this); },
	};
	return {
		children: [body],
		position: makeVec(),
		scale: makeScale(),
		userData: {},
		traverse(cb) { cb(this); for (const c of this.children) c.traverse(cb); },
		getObjectByName() { return null; },
		clone() { return makeFakePlayerScene(bodyHex); },
	};
}

vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
	GLTFLoader: vi.fn(function GLTFLoader() {
		this.load = gltfLoadMock;
	}),
}));

const LOCAL_COSMETIC = {
	bodyColor: '#3366ff',
	accentColor: '#ffcc00',
	bodyShape: 'box',
	hat: 'none',
};

const REMOTE_COSMETIC = {
	bodyColor: '#ff00aa',
	accentColor: '#33cc33',
	bodyShape: 'cylinder',
	hat: 'wizard',
};

function expectedCosmeticKey(cosmetic) {
	const shapes = new Set(['box', 'cylinder', 'cone', 'capsule']);
	const hats = new Set(['none', 'cap', 'wizard', 'crown', 'bandana', 'beanie']);
	const hexRe = /^#[0-9a-f]{6}$/i;
	const shape = shapes.has(cosmetic.bodyShape) ? cosmetic.bodyShape : 'box';
	const body = (typeof cosmetic.bodyColor === 'string' && hexRe.test(cosmetic.bodyColor))
		? cosmetic.bodyColor.toLowerCase()
		: 'default';
	const accent = (typeof cosmetic.accentColor === 'string' && hexRe.test(cosmetic.accentColor))
		? cosmetic.accentColor.toLowerCase()
		: 'default';
	const hat = hats.has(cosmetic.hat) ? cosmetic.hat : 'none';
	return `${shape}|${body}|${accent}|${hat}|player`;
}

function startCenter(layout) {
	const start = layout.rooms.find((r) => r.role === 'start') || layout.rooms[0];
	return { x: start.x, z: start.z };
}

function lobbyPlayer(x, z, cosmetic, extra = {}) {
	return { x, z, hp: 100, dead: false, cosmetic, ...extra };
}

describe('hub presence render (lobby remote avatars)', () => {
	let rafCallbacks;

	beforeEach(() => {
		vi.resetModules();
		rafCallbacks = [];
		vi.stubGlobal('requestAnimationFrame', vi.fn((cb) => {
			rafCallbacks.push(cb);
			return rafCallbacks.length;
		}));
		gltfLoadMock.mockReset();
		gltfLoadMock.mockImplementation((_path, onLoad) => {
			onLoad({ scene: makeFakePlayerScene(0x123456) });
		});
		window.__soundLogEnabled = true;
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		document.body.innerHTML = '';
	});

	async function loadRenderer() {
		const { _clearModelCache } = await import('../models.js');
		_clearModelCache();
		return import('../renderer.js');
	}

	it('creates a remote party-mate mesh with distinct cosmetic, then removes it on departure', async () => {
		const hubLayout = generateHub(0);
		const {
			initScene,
			setGameStateRef,
			setMyId,
			setGamePhase,
			setPlayerPosition,
			animate,
			getMeshMaps,
		} = await loadRenderer();

		setGamePhase('lobby');
		const hubSpawn = startCenter(hubLayout);
		const remotePos = { x: hubSpawn.x + 2, z: hubSpawn.z + 1, rotation: 1.2 };
		initScene(hubLayout, { x: 0, z: 0 });
		setMyId('p1');
		setPlayerPosition(hubSpawn.x, hubSpawn.z);

		setGameStateRef({
			gamePhase: 'lobby',
			layout: hubLayout,
			players: {
				p1: lobbyPlayer(hubSpawn.x, hubSpawn.z, LOCAL_COSMETIC),
				p2: lobbyPlayer(remotePos.x, remotePos.z, REMOTE_COSMETIC, {
					rotation: remotePos.rotation,
				}),
			},
			loot: [],
			enemies: [],
			minions: [],
		});

		animate(0);

		const maps = getMeshMaps();
		expect(maps.playersMeshes.p1).toBeTruthy();
		const remoteMesh = maps.playersMeshes.p2;
		expect(remoteMesh).toBeTruthy();
		expect(remoteMesh.userData.cosmeticKey).toBe(expectedCosmeticKey(REMOTE_COSMETIC));
		expect(remoteMesh.userData.hatId).toBe('wizard');
		expect(remoteMesh.userData.baseColor).toBe(0xff00aa);
		expect(remoteMesh.position.x).toBe(remotePos.x);
		expect(remoteMesh.position.z).toBe(remotePos.z);
		expect(remoteMesh.rotation.y).toBe(remotePos.rotation - Math.PI / 2);

		const movedPos = { x: remotePos.x + 1, z: remotePos.z - 0.5, rotation: 2.5 };
		setGameStateRef({
			gamePhase: 'lobby',
			layout: hubLayout,
			players: {
				p1: lobbyPlayer(hubSpawn.x, hubSpawn.z, LOCAL_COSMETIC),
				p2: lobbyPlayer(movedPos.x, movedPos.z, REMOTE_COSMETIC, {
					rotation: movedPos.rotation,
				}),
			},
			loot: [],
			enemies: [],
			minions: [],
		});

		animate(16);

		expect(maps.playersMeshes.p2.position.x).toBe(movedPos.x);
		expect(maps.playersMeshes.p2.position.z).toBe(movedPos.z);
		expect(maps.playersMeshes.p2.rotation.y).toBe(movedPos.rotation - Math.PI / 2);

		setGameStateRef({
			gamePhase: 'lobby',
			layout: hubLayout,
			players: {
				p1: lobbyPlayer(hubSpawn.x, hubSpawn.z, LOCAL_COSMETIC),
			},
			loot: [],
			enemies: [],
			minions: [],
		});

		animate(32);

		expect(maps.playersMeshes.p2).toBeUndefined();
		expect(maps.playersMeshes.p1).toBeTruthy();
	});
});
