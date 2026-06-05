import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateHub, generateLayout } from '../../server/dungeon.js';

// Drives the renderer animate() loop the way main.js does for hub (lobby) and
// in-run (playing) phases, asserting that gameState.players[id].cosmetic is
// reflected on the local avatar mesh and updates when cosmetic changes.

const gltfLoadMock = vi.hoisted(() => vi.fn());

/** Material stub with a tintable color and a clone() (mirrors GLTF material). */
function makeFakeMaterial(hex) {
	return {
		visible: undefined,
		color: { _v: hex, getHex() { return this._v; }, setHex(v) { this._v = v; } },
		clone() { return makeFakeMaterial(this.color._v); },
		dispose: vi.fn(),
	};
}

/** Minimal stand-in for a parsed player glTF scene. */
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

const NON_DEFAULT_COSMETIC = {
	bodyColor: '#ff00aa',
	accentColor: '#33cc33',
	bodyShape: 'cylinder',
	hat: 'wizard',
};

/** Mirror renderer cosmeticSignature() for assertion keys. */
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

function playerEntry(x, z, cosmetic) {
	return { x, z, hp: 100, dead: false, cosmetic };
}

describe('avatar cosmetic render (hub + in-run)', () => {
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

	it('lobby hub layout builds local avatar whose cosmeticKey matches non-default cosmetic', async () => {
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
		initScene(hubLayout, { x: 0, z: 0 });
		setMyId('p1');
		setPlayerPosition(hubSpawn.x, hubSpawn.z);
		setGameStateRef({
			gamePhase: 'lobby',
			layout: hubLayout,
			players: { p1: playerEntry(hubSpawn.x, hubSpawn.z, NON_DEFAULT_COSMETIC) },
			loot: [],
			enemies: [],
			minions: [],
		});

		animate(0);

		const mesh = getMeshMaps().playersMeshes.p1;
		expect(mesh).toBeTruthy();
		expect(mesh.userData.cosmeticKey).toBe(expectedCosmeticKey(NON_DEFAULT_COSMETIC));
		expect(mesh.userData.hatId).toBe('wizard');
		expect(mesh.userData.baseColor).toBe(0xff00aa);
	});

	it('playing quest layout builds the same avatar with cosmetic applied after mocked glTF load', async () => {
		const questLayout = generateLayout(42, 'default');
		const {
			initScene,
			setGameStateRef,
			setMyId,
			setGamePhase,
			setPlayerPosition,
			animate,
			getMeshMaps,
		} = await loadRenderer();

		setGamePhase('playing');
		const questSpawn = startCenter(questLayout);
		initScene(questLayout, { x: 0, z: 0 });
		setMyId('p1');
		setPlayerPosition(questSpawn.x, questSpawn.z);
		setGameStateRef({
			gamePhase: 'playing',
			layout: questLayout,
			players: { p1: playerEntry(questSpawn.x, questSpawn.z, NON_DEFAULT_COSMETIC) },
			loot: [],
			enemies: [],
			minions: [],
		});

		animate(0);

		const mesh = getMeshMaps().playersMeshes.p1;
		expect(mesh).toBeTruthy();
		expect(mesh.userData.cosmeticKey).toBe(expectedCosmeticKey(NON_DEFAULT_COSMETIC));
		expect(mesh.userData.hatId).toBe('wizard');

		await vi.waitFor(() => {
			expect(mesh.userData.modelOverride).toBeTruthy();
		});

		// applyLoadedModelCosmetic runs each animate(); glTF resolves async after the
		// first frame, so one more frame applies the broadcast body tint.
		animate(16);

		expect(mesh.userData.baseColor).toBe(0xff00aa);
		expect(gltfLoadMock).toHaveBeenCalledWith(
			'/models/player.glb',
			expect.any(Function),
			undefined,
			expect.any(Function),
		);
	});

	it('rebuilds avatar when cosmetic changes between animate() calls', async () => {
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
		initScene(hubLayout, { x: 0, z: 0 });
		setMyId('p1');
		setPlayerPosition(hubSpawn.x, hubSpawn.z);

		const cosmeticNoHat = { ...NON_DEFAULT_COSMETIC, hat: 'none' };
		setGameStateRef({
			gamePhase: 'lobby',
			layout: hubLayout,
			players: { p1: playerEntry(hubSpawn.x, hubSpawn.z, cosmeticNoHat) },
			loot: [],
			enemies: [],
			minions: [],
		});

		animate(0);

		let mesh = getMeshMaps().playersMeshes.p1;
		const firstMesh = mesh;
		expect(mesh.userData.cosmeticKey).toBe(expectedCosmeticKey(cosmeticNoHat));
		expect(mesh.userData.hatId).toBe('none');
		expect(mesh.userData.baseColor).toBe(0xff00aa);

		await vi.waitFor(() => {
			expect(mesh.userData.modelOverride).toBeTruthy();
		});

		animate(16);

		const cosmeticWizardBlue = {
			...NON_DEFAULT_COSMETIC,
			bodyColor: '#0011ff',
			hat: 'wizard',
		};
		setGameStateRef({
			gamePhase: 'lobby',
			layout: hubLayout,
			players: { p1: playerEntry(hubSpawn.x, hubSpawn.z, cosmeticWizardBlue) },
			loot: [],
			enemies: [],
			minions: [],
		});

		animate(16);

		mesh = getMeshMaps().playersMeshes.p1;
		expect(mesh).not.toBe(firstMesh);
		expect(mesh.userData.cosmeticKey).toBe(expectedCosmeticKey(cosmeticWizardBlue));
		expect(mesh.userData.hatId).toBe('wizard');
		expect(mesh.userData.baseColor).toBe(0x0011ff);

		await vi.waitFor(() => {
			expect(mesh.userData.modelOverride).toBeTruthy();
		});

		animate(32);

		expect(mesh.userData.baseColor).toBe(0x0011ff);
	});
});
