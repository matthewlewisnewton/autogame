import { describe, it, expect, vi, beforeEach } from 'vitest';
import { _clearModelCache } from '../models.js';
import { createEnemyMesh } from '../renderer.js';
import { disposeOne } from '../renderer/meshSync.js';

const gltfLoadMock = vi.hoisted(() => vi.fn());

/**
 * Minimal glTF scene whose clone(true) shares geometry/material references
 * (mirrors Three.js Object3D.clone recursive behavior).
 */
function makeGltfScene() {
	const geometry = { dispose: vi.fn(), isMesh: true };
	const material = { dispose: vi.fn(), visible: true };
	const mesh = {
		isMesh: true,
		geometry,
		material,
		traverse(cb) {
			cb(this);
		},
	};
	return {
		children: [mesh],
		position: { y: 0 },
		scale: { multiplyScalar() {} },
		traverse(cb) {
			cb(this);
			for (const child of this.children) child.traverse(cb);
		},
		clone(recursive) {
			const clonedMesh = {
				isMesh: true,
				geometry: recursive ? geometry : { dispose: vi.fn() },
				material: recursive ? material : { dispose: vi.fn(), visible: true },
				traverse(cb) {
					cb(this);
				},
			};
			return {
				children: [clonedMesh],
				position: { y: 0 },
				scale: { multiplyScalar() {} },
				traverse(cb) {
					cb(this);
					for (const child of this.children) child.traverse(cb);
				},
			};
		},
	};
}

vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
	GLTFLoader: vi.fn(function GLTFLoader() {
		this.load = gltfLoadMock;
	}),
}));

function makeSceneStub() {
	return { remove: vi.fn() };
}

describe('disposeOne', () => {
	beforeEach(() => {
		_clearModelCache();
		gltfLoadMock.mockReset();
	});

	it('does not dispose shared glTF geometry/material still used by another live enemy', async () => {
		gltfLoadMock.mockImplementation((_path, onLoad) => {
			onLoad({ scene: makeGltfScene() });
		});

		const meshA = createEnemyMesh('grunt');
		const meshB = createEnemyMesh('grunt');

		await vi.waitFor(() => {
			expect(meshA.userData.modelOverride).toBeTruthy();
			expect(meshB.userData.modelOverride).toBeTruthy();
		});

		let survivorGeometry;
		let survivorMaterial;
		meshB.userData.modelOverride.traverse((node) => {
			if (node.isMesh) {
				survivorGeometry = node.geometry;
				survivorMaterial = node.material;
			}
		});

		const geometryDisposeSpy = vi.spyOn(survivorGeometry, 'dispose');
		const materialDisposeSpy = vi.spyOn(survivorMaterial, 'dispose');

		const map = { enemyA: meshA, enemyB: meshB };
		const scene = makeSceneStub();
		disposeOne(map, 'enemyA', scene);

		expect(geometryDisposeSpy).not.toHaveBeenCalled();
		expect(materialDisposeSpy).not.toHaveBeenCalled();
		expect(map.enemyA).toBeUndefined();
		expect(map.enemyB).toBe(meshB);
		expect(scene.remove).toHaveBeenCalledWith(meshA);
	});

	it('disposes owned procedural geometry/material when model load fails', async () => {
		gltfLoadMock.mockImplementation((_path, _onLoad, _progress, onError) => {
			onError(new Error('404'));
		});

		const mesh = createEnemyMesh('grunt');

		await vi.waitFor(() => {
			expect(gltfLoadMock).toHaveBeenCalled();
		});

		expect(mesh.userData.modelOverride).toBeUndefined();

		const geometryDisposeSpy = vi.spyOn(mesh.geometry, 'dispose');
		const materialDisposeSpy = vi.spyOn(mesh.material, 'dispose');

		const map = { enemyA: mesh };
		const scene = makeSceneStub();
		disposeOne(map, 'enemyA', scene);

		expect(geometryDisposeSpy).toHaveBeenCalledTimes(1);
		expect(materialDisposeSpy).toHaveBeenCalledTimes(1);
		expect(map.enemyA).toBeUndefined();
		expect(scene.remove).toHaveBeenCalledWith(mesh);
	});
});
