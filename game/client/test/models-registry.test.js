import { describe, it, expect, vi, beforeEach } from 'vitest';

const loadModelMock = vi.fn(() => Promise.resolve(null));

vi.mock('../models.js', async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		loadModel: (...args) => loadModelMock(...args),
	};
});

const ENEMY_REGISTRY_PATHS = {
	grunt: '/models/grunt.glb',
	skirmisher: '/models/skirmisher.glb',
	miniboss: '/models/miniboss.glb',
	spawner: '/models/spawner.glb',
};

const MINION_REGISTRY_PATHS = {
	ancient_wyrm: '/models/minion-ancient-wyrm.glb',
	null_crawler: '/models/minion-null-crawler.glb',
	bulkhead_mauler: '/models/minion-bulkhead-mauler.glb',
};

/** Expected MODEL_FIT targets derived from MINION_VISUAL in renderer.js */
const MINION_FIT_EXPECTED = {
	ancient_wyrm: { targetHeight: 2.25, targetFootprint: 1.8 },
	null_crawler: { targetHeight: 0.7, targetFootprint: 0.7 },
	bulkhead_mauler: { targetHeight: 1.2, targetFootprint: 0.9 },
};

async function flushAsync() {
	await Promise.resolve();
	await Promise.resolve();
}

describe('MODEL_REGISTRY', () => {
	beforeEach(() => {
		loadModelMock.mockClear();
		loadModelMock.mockResolvedValue(null);
	});

	it('maps minion types to /models paths, keeps player null, enemy paths unchanged', async () => {
		const { MODEL_REGISTRY } = await import('../models.js');
		expect(MODEL_REGISTRY.player).toBe(null);
		for (const [key, path] of Object.entries(ENEMY_REGISTRY_PATHS)) {
			expect(MODEL_REGISTRY[key]).toBe(path);
		}
		for (const [key, path] of Object.entries(MINION_REGISTRY_PATHS)) {
			expect(MODEL_REGISTRY[key]).toBe(path);
		}
	});

	it('MODEL_FIT minion entries match MINION_VISUAL dimensions', async () => {
		const { MODEL_FIT } = await import('../renderer.js');
		for (const [key, expected] of Object.entries(MINION_FIT_EXPECTED)) {
			const fit = MODEL_FIT[key];
			expect(fit.targetHeight).toBeCloseTo(expected.targetHeight, 5);
			expect(fit.targetFootprint).toBeCloseTo(expected.targetFootprint, 5);
		}
	});
});

describe('registry model fallback', () => {
	beforeEach(() => {
		loadModelMock.mockClear();
		loadModelMock.mockResolvedValue(null);
	});

	it('createMinionMesh keeps procedural material visible when loadModel returns null', async () => {
		const { createMinionMesh } = await import('../renderer.js');
		const mesh = createMinionMesh('ancient_wyrm');

		expect(mesh).toBeTruthy();
		expect(mesh.material).toBeTruthy();
		mesh.material.visible = true;

		expect(loadModelMock).toHaveBeenCalledWith(MINION_REGISTRY_PATHS.ancient_wyrm);

		await flushAsync();

		expect(mesh.material.visible).not.toBe(false);
		expect(mesh.userData.modelOverride).toBeUndefined();
	});

	it('createEnemyMesh keeps procedural material visible when loadModel returns null', async () => {
		const { createEnemyMesh } = await import('../renderer.js');
		const mesh = createEnemyMesh('grunt');

		expect(mesh).toBeTruthy();
		expect(mesh.material).toBeTruthy();
		mesh.material.visible = true;

		expect(loadModelMock).toHaveBeenCalledWith(ENEMY_REGISTRY_PATHS.grunt);

		await flushAsync();

		expect(mesh.material.visible).not.toBe(false);
		expect(mesh.userData.modelOverride).toBeUndefined();
	});
});
