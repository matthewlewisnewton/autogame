import { describe, it, expect, vi } from 'vitest';

describe('getRegistryModelTarget', () => {
	it('returns host-local minion targets without minion.scale', async () => {
		const { getRegistryModelTarget } = await import('../renderer.js');

		expect(getRegistryModelTarget('ancient_wyrm')).toEqual({
			height: 1.5,
			footY: -0.75,
		});
		expect(getRegistryModelTarget('null_crawler')).toEqual({
			height: 0.7,
			footY: -0.35,
		});
		expect(getRegistryModelTarget('bulkhead_mauler')).toEqual({
			height: 1.2,
			footY: -0.6,
		});
	});

	it('leaves enemy geometry targets unchanged', async () => {
		const { getRegistryModelTarget } = await import('../renderer.js');

		expect(getRegistryModelTarget('grunt')).toEqual({ height: 1, footY: -0.5 });
		expect(getRegistryModelTarget('spawner')).toEqual({
			height: 1.2,
			footY: -0.6,
		});
	});
});

describe('normalizeRegistryModel', () => {
	it('under a scaled host yields expected world-space bbox for ancient_wyrm', async () => {
		vi.doUnmock('three');
		vi.resetModules();

		const THREE = await vi.importActual('three');
		const { normalizeRegistryModel } = await import('../renderer.js');

		const host = new THREE.Object3D();
		host.scale.setScalar(1.5);

		const model = new THREE.Mesh(
			new THREE.BoxGeometry(1, 2, 1),
			new THREE.MeshBasicMaterial(),
		);
		host.add(model);

		normalizeRegistryModel(model, 'ancient_wyrm');

		const worldBox = new THREE.Box3().setFromObject(host);
		const worldHeight = worldBox.max.y - worldBox.min.y;
		expect(worldHeight).toBeCloseTo(2.25, 5);
		expect(worldBox.min.y).toBeCloseTo(-1.125, 5);
	});
});
