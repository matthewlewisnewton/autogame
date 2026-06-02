import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('models.js', () => {
	describe('modelPathFor', () => {
		it('returns the seven enemy/minion registry paths from sub-ticket 02', async () => {
			const { modelPathFor } = await import('../models.js');

			expect(modelPathFor('grunt')).toBe('/models/grunt.glb');
			expect(modelPathFor('skirmisher')).toBe('/models/skirmisher.glb');
			expect(modelPathFor('miniboss')).toBe('/models/miniboss.glb');
			expect(modelPathFor('spawner')).toBe('/models/spawner.glb');
			expect(modelPathFor('ancient_wyrm')).toBe('/models/minion-ancient-wyrm.glb');
			expect(modelPathFor('null_crawler')).toBe('/models/minion-null-crawler.glb');
			expect(modelPathFor('bulkhead_mauler')).toBe('/models/minion-bulkhead-mauler.glb');
		});

		it('keeps player null and returns null for unknown keys', async () => {
			const { modelPathFor } = await import('../models.js');

			expect(modelPathFor('player')).toBeNull();
			expect(modelPathFor('not_a_creature')).toBeNull();
		});
	});

	describe('loadModel', () => {
		const loaderLoad = vi.fn();

		beforeEach(() => {
			vi.resetModules();
			loaderLoad.mockReset();
			vi.doMock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
				GLTFLoader: vi.fn(() => ({
					load: (path, _onLoad, _progress, onError) => {
						loaderLoad(path);
						onError(new Error(`failed to load ${path}`));
					},
				})),
			}));
		});

		afterEach(() => {
			vi.doUnmock('three/examples/jsm/loaders/GLTFLoader.js');
		});

		it('resolves null for empty paths without touching the cache', async () => {
			const { loadModel } = await import('../models.js');

			await expect(loadModel(null)).resolves.toBeNull();
			await expect(loadModel('')).resolves.toBeNull();
			expect(loaderLoad).not.toHaveBeenCalled();
		});

		it('caches load failures so a bad path is fetched at most once', async () => {
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const { loadModel, _clearModelCache } = await import('../models.js');
			_clearModelCache();

			const path = '/models/missing.glb';
			await expect(loadModel(path)).resolves.toBeNull();
			await expect(loadModel(path)).resolves.toBeNull();

			expect(loaderLoad).toHaveBeenCalledTimes(1);
			expect(loaderLoad).toHaveBeenCalledWith(path);
			expect(warnSpy).toHaveBeenCalled();
			warnSpy.mockRestore();
		});
	});
});

describe('attachRegistryModel fallback', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	async function importRendererWithLoadModel(loadModelImpl) {
		vi.doMock('../models.js', async (importOriginal) => {
			const actual = await importOriginal();
			return {
				...actual,
				loadModel: vi.fn(loadModelImpl),
			};
		});
		return import('../renderer.js');
	}

	it('leaves the procedural mesh visible when loadModel resolves null', async () => {
		const { createEnemyMesh } = await importRendererWithLoadModel(() => Promise.resolve(null));

		const mesh = createEnemyMesh('grunt');
		expect(mesh).toBeDefined();
		expect(mesh.geometry.parameters.radius).toBe(0.5);
		expect(mesh.geometry.parameters.height).toBe(1);
		expect(mesh.material.color.getHex()).toBe(0xdc2626);

		await Promise.resolve();

		expect(mesh.geometry.parameters.radius).toBe(0.5);
		expect(mesh.material.color.getHex()).toBe(0xdc2626);
		expect(mesh.userData.modelOverride).toBeUndefined();
		expect(mesh.children?.length ?? 0).toBe(0);
	});

	it('does not throw or remove the host when loadModel rejects', async () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const { createEnemyMesh } = await importRendererWithLoadModel(() =>
			Promise.reject(new Error('network error')),
		);

		expect(() => createEnemyMesh('skirmisher')).not.toThrow();

		const mesh = createEnemyMesh('skirmisher');
		await Promise.resolve();
		await Promise.resolve();

		expect(mesh.geometry.parameters.radius).toBe(0.3);
		expect(mesh.material.color.getHex()).toBe(0xff6600);
		expect(mesh.userData.modelOverride).toBeUndefined();
		expect(warnSpy).toHaveBeenCalled();
		warnSpy.mockRestore();
	});
});
