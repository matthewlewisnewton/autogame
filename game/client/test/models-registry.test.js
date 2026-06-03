import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MODEL_REGISTRY, modelPathFor, loadModel, _clearModelCache } from '../models.js';
import { createPlayerAvatar, createEnemyMesh } from '../renderer.js';

/** Seven enemy/minion keys wired in ticket 162 (parent mapping). */
const ENTITY_MODEL_PATHS = {
	grunt: '/models/grunt.glb',
	skirmisher: '/models/skirmisher.glb',
	miniboss: '/models/miniboss.glb',
	spawner: '/models/spawner.glb',
	ancient_wyrm: '/models/minion-ancient-wyrm.glb',
	null_crawler: '/models/minion-null-crawler.glb',
	bulkhead_mauler: '/models/minion-bulkhead-mauler.glb',
};

const gltfLoadMock = vi.hoisted(() => vi.fn());

vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
	GLTFLoader: vi.fn(function GLTFLoader() {
		this.load = gltfLoadMock;
	}),
}));

describe('MODEL_REGISTRY', () => {
	it('keeps player procedural (null path)', () => {
		expect(MODEL_REGISTRY.player).toBeNull();
		expect(modelPathFor('player')).toBeNull();
	});

	it('maps all seven enemy/minion keys to parent ticket paths', () => {
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

	it('createPlayerAvatar stays procedural (no model path)', () => {
		const avatar = createPlayerAvatar({ bodyColor: 0xff0000 }, true);
		expect(avatar.userData.modelOverride).toBeUndefined();
		expect(avatar.userData.bodyMesh?.material?.visible).not.toBe(false);
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
