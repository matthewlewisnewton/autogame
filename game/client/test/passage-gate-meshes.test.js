import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('passage gate meshes', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	function minimalLayout() {
		return {
			profile: 'default',
			passageWidth: 4,
			rooms: [],
			passages: [
				{ x1: 0, z1: 0, x2: 12, z2: 0, walls: [] },
				{ x1: 0, z1: 0, x2: 0, z2: 12, walls: [] },
			],
		};
	}

	it('creates one gate mesh per locked passage and removes it when unlocked', async () => {
		const { initScene, syncPassageLockGates, getMeshMaps } = await import('../renderer.js');

		const layout = minimalLayout();
		initScene(layout, { x: 0, z: 0 });

		syncPassageLockGates([{ passageIndex: 0, locked: true }], layout);
		expect(Object.keys(getMeshMaps().passageGateMeshes)).toHaveLength(1);
		expect(getMeshMaps().passageGateMeshes[0]).toBeDefined();

		syncPassageLockGates([{ passageIndex: 0, locked: false }], layout);
		expect(Object.keys(getMeshMaps().passageGateMeshes)).toHaveLength(0);
	});

	it('tracks multiple locked passages independently', async () => {
		const { initScene, syncPassageLockGates, getMeshMaps } = await import('../renderer.js');

		const layout = minimalLayout();
		initScene(layout, { x: 0, z: 0 });

		syncPassageLockGates([
			{ passageIndex: 0, locked: true },
			{ passageIndex: 1, locked: true },
		], layout);
		expect(Object.keys(getMeshMaps().passageGateMeshes)).toHaveLength(2);

		syncPassageLockGates([
			{ passageIndex: 0, locked: true },
			{ passageIndex: 1, locked: false },
		], layout);
		expect(Object.keys(getMeshMaps().passageGateMeshes)).toHaveLength(1);
		expect(getMeshMaps().passageGateMeshes[0]).toBeDefined();
		expect(getMeshMaps().passageGateMeshes[1]).toBeUndefined();
	});

	it('clears gate meshes on rebuildDungeonLayout', async () => {
		const { initScene, syncPassageLockGates, rebuildDungeonLayout, getMeshMaps } =
			await import('../renderer.js');

		const layout = minimalLayout();
		initScene(layout, { x: 0, z: 0 });
		syncPassageLockGates([{ passageIndex: 0, locked: true }], layout);
		expect(Object.keys(getMeshMaps().passageGateMeshes)).toHaveLength(1);

		rebuildDungeonLayout(layout, [{ passageIndex: 0, locked: true }]);
		expect(Object.keys(getMeshMaps().passageGateMeshes)).toHaveLength(1);
		expect(getMeshMaps().passageGateMeshes[0]).toBeDefined();
	});
});
