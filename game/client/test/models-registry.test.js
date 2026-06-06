import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MODEL_REGISTRY, modelPathFor, loadModel, _clearModelCache } from '../models.js';
import { createPlayerAvatar, createEnemyMesh } from '../renderer.js';

/** Enemy/minion keys wired in ticket 162 (parent mapping) plus the plaza arena_champion boss. */
const ENTITY_MODEL_PATHS = {
	grunt: '/models/grunt.glb',
	skirmisher: '/models/skirmisher.glb',
	miniboss: '/models/miniboss.glb',
	spawner: '/models/spawner.glb',
	ancient_wyrm: '/models/minion-ancient-wyrm.glb',
	null_crawler: '/models/minion-null-crawler.glb',
	bulkhead_mauler: '/models/minion-bulkhead-mauler.glb',
};

/** Stage bosses that rely on distinct procedural geometry (ENEMY_GEOMETRY) instead of glTF. */
const PROCEDURAL_ONLY_BOSSES = ['annex_overseer', 'arena_champion', 'spire_warden'];

const gltfLoadMock = vi.hoisted(() => vi.fn());

/** Material stub with a tintable color and a clone() (mirrors GLTF material). */
function makeFakeMaterial(hex) {
	return {
		visible: undefined,
		color: { _v: hex, getHex() { return this._v; }, setHex(v) { this._v = v; } },
		clone() { return makeFakeMaterial(this.color._v); },
	};
}

/**
 * Minimal stand-in for a parsed player glTF scene: a root holding one skinned
 * body mesh carrying a morph dictionary, with the position/scale/traverse/clone
 * surface that loadModel + normalizeLoadedRegistryModel + the retarget path use.
 */
function makeFakePlayerScene(bodyHex = 0x123456) {
	const makeVec = () => ({ x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } });
	const makeScale = () => ({ x: 1, y: 1, z: 1, multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; } });
	const body = {
		isMesh: true,
		isSkinnedMesh: true,
		name: 'SuperHero_Male',
		morphTargetDictionary: { height: 0, headSize: 1 },
		geometry: { parameters: { width: 0.6, height: 1.8, depth: 0.6 } },
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
		clone() { return makeFakePlayerScene(bodyHex); },
	};
}

vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
	GLTFLoader: vi.fn(function GLTFLoader() {
		this.load = gltfLoadMock;
	}),
}));

describe('MODEL_REGISTRY', () => {
	it('wires player to the committed glTF avatar', () => {
		expect(MODEL_REGISTRY.player).toBe('/models/player.glb');
		expect(modelPathFor('player')).toBe('/models/player.glb');
	});

	it('maps all enemy/minion keys to their model paths', () => {
		for (const [key, path] of Object.entries(ENTITY_MODEL_PATHS)) {
			expect(MODEL_REGISTRY[key]).toBe(path);
			expect(modelPathFor(key)).toBe(path);
		}
	});

	it('leaves loot kinds procedural (null paths)', () => {
		expect(MODEL_REGISTRY.currency).toBeNull();
		expect(MODEL_REGISTRY.crystal).toBeNull();
		expect(MODEL_REGISTRY.magic_stone).toBeNull();
	});

	it('leaves stage bosses procedural (null paths) for distinct ENEMY_GEOMETRY fallback', () => {
		for (const key of PROCEDURAL_ONLY_BOSSES) {
			expect(MODEL_REGISTRY[key]).toBeNull();
			expect(modelPathFor(key)).toBeNull();
		}
	});
});

describe('loadModel() resilience', () => {
	beforeEach(() => {
		_clearModelCache();
		gltfLoadMock.mockReset();
	});

	it('resolves null for a missing path without throwing', async () => {
		gltfLoadMock.mockImplementation((_path, _onLoad, _progress, onError) => {
			onError(new Error('404'));
		});

		await expect(loadModel('/models/__missing__.glb')).resolves.toBeNull();
	});

	it('caches failure so the same missing path is not re-fetched', async () => {
		gltfLoadMock.mockImplementation((_path, _onLoad, _progress, onError) => {
			onError(new Error('404'));
		});

		await loadModel('/models/__missing__.glb');
		await loadModel('/models/__missing__.glb');

		expect(gltfLoadMock).toHaveBeenCalledTimes(1);
	});
});

describe('registry attach fallback (renderer)', () => {
	beforeEach(() => {
		_clearModelCache();
		gltfLoadMock.mockReset();
	});

	it('createPlayerAvatar({ modelId: "player" }) requests /models/player.glb', async () => {
		gltfLoadMock.mockImplementation((_path, onLoad) => {
			onLoad({ scene: makeFakePlayerScene(0x123456) });
		});

		createPlayerAvatar({ modelId: 'player', bodyColor: 0xff0000 }, true);

		await vi.waitFor(() => {
			expect(gltfLoadMock).toHaveBeenCalledWith(
				'/models/player.glb',
				expect.any(Function),
				undefined,
				expect.any(Function),
			);
		});
	});

	it('createPlayerAvatar swaps in the loaded glTF body mesh and hides procedural', async () => {
		gltfLoadMock.mockImplementation((_path, onLoad) => {
			onLoad({ scene: makeFakePlayerScene(0x123456) });
		});

		const avatar = createPlayerAvatar({ bodyColor: 0xff0000 }, true);
		const proceduralBody = avatar.userData.bodyMesh; // captured before the async swap

		await vi.waitFor(() => {
			expect(avatar.userData.modelOverride).toBeTruthy();
		});

		// VFX body mesh is now the loaded skinned mesh (carries morph dictionary).
		expect(avatar.userData.bodyMesh).not.toBe(proceduralBody);
		expect(avatar.userData.bodyMesh.morphTargetDictionary).toBeTruthy();
		expect(avatar.userData.bodyMesh.name).toBe('SuperHero_Male');
		// baseColor tracks the loaded mesh so dead/invuln recolor restores it.
		expect(avatar.userData.baseColor).toBe(0x123456);
		// Procedural primitive is hidden, not removed.
		expect(proceduralBody.material.visible).toBe(false);
	});

	it('createPlayerAvatar keeps procedural visible when the model fails to load', async () => {
		gltfLoadMock.mockImplementation((_path, _onLoad, _progress, onError) => {
			onError(new Error('404'));
		});

		const avatar = createPlayerAvatar({ bodyColor: 0xff0000 }, true);
		const proceduralBody = avatar.userData.bodyMesh;

		await vi.waitFor(() => {
			expect(gltfLoadMock).toHaveBeenCalled();
		});

		expect(avatar.userData.modelOverride).toBeUndefined();
		expect(avatar.userData.bodyMesh).toBe(proceduralBody);
		expect(proceduralBody.material.visible).not.toBe(false);
	});

	it('createEnemyMesh keeps procedural visible when loadModel resolves null', async () => {
		gltfLoadMock.mockImplementation((_path, _onLoad, _progress, onError) => {
			onError(new Error('404'));
		});

		const mesh = createEnemyMesh('grunt');
		await vi.waitFor(() => {
			expect(gltfLoadMock).toHaveBeenCalled();
		});

		expect(mesh.userData.modelOverride).toBeUndefined();
		expect(mesh.material.visible).not.toBe(false);
	});
});
