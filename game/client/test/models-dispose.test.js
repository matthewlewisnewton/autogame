import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	loadModel,
	_clearModelCache,
	isSharedModelResource,
	markSharedModelResources,
	disposeMeshTreeSafe,
} from '../models.js';

const gltfLoadMock = vi.hoisted(() => vi.fn());

/**
 * Minimal glTF scene whose clone(true) shares geometry/material references
 * (mirrors Three.js Object3D.clone recursive behavior).
 */
function makeGltfScene() {
	const geometry = { dispose: vi.fn() };
	const material = { dispose: vi.fn() };
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
		traverse(cb) {
			cb(this);
			for (const child of this.children) child.traverse(cb);
		},
		clone(recursive) {
			const clonedMesh = {
				isMesh: true,
				geometry: recursive ? geometry : { dispose: vi.fn() },
				material: recursive ? material : { dispose: vi.fn() },
				traverse(cb) {
					cb(this);
				},
			};
			return {
				children: [clonedMesh],
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

describe('loadModel shared-resource tagging', () => {
	beforeEach(() => {
		_clearModelCache();
		gltfLoadMock.mockReset();
	});

	it('tags every geometry and material on the returned clone', async () => {
		gltfLoadMock.mockImplementation((_path, onLoad) => {
			onLoad({ scene: makeGltfScene() });
		});

		const clone = await loadModel('/models/test.glb');
		let geometry;
		let material;
		clone.traverse((node) => {
			if (node.isMesh) {
				geometry = node.geometry;
				material = node.material;
			}
		});

		expect(isSharedModelResource(geometry)).toBe(true);
		expect(isSharedModelResource(material)).toBe(true);
	});
});

describe('disposeMeshTreeSafe', () => {
	beforeEach(() => {
		_clearModelCache();
		gltfLoadMock.mockReset();
	});

	it('does not dispose shared geometry/material still used by another clone', async () => {
		gltfLoadMock.mockImplementation((_path, onLoad) => {
			onLoad({ scene: makeGltfScene() });
		});

		const cloneA = await loadModel('/models/test.glb');
		const cloneB = await loadModel('/models/test.glb');

		let survivorGeometry;
		let survivorMaterial;
		cloneB.traverse((node) => {
			if (node.isMesh) {
				survivorGeometry = node.geometry;
				survivorMaterial = node.material;
			}
		});

		const geometryDisposeSpy = vi.spyOn(survivorGeometry, 'dispose');
		const materialDisposeSpy = vi.spyOn(survivorMaterial, 'dispose');

		disposeMeshTreeSafe(cloneA);

		expect(geometryDisposeSpy).not.toHaveBeenCalled();
		expect(materialDisposeSpy).not.toHaveBeenCalled();
	});

	it('does not dispose or detach a texture map owned by a shared material', async () => {
		const texture = { dispose: vi.fn() };
		const scene = makeGltfScene();
		scene.children[0].material.map = texture;
		gltfLoadMock.mockImplementation((_path, onLoad) => {
			onLoad({ scene });
		});

		const cloneA = await loadModel('/models/textured.glb');
		const cloneB = await loadModel('/models/textured.glb');
		let survivorMaterial;
		cloneB.traverse((node) => {
			if (node.isMesh) survivorMaterial = node.material;
		});

		disposeMeshTreeSafe(cloneA);

		expect(texture.dispose).not.toHaveBeenCalled();
		expect(survivorMaterial.map).toBe(texture);
	});

	it('disposes owned procedural geometry and material', () => {
		const geometry = { dispose: vi.fn() };
		const material = { dispose: vi.fn() };
		const mesh = {
			isMesh: true,
			geometry,
			material,
			traverse(cb) {
				cb(this);
			},
		};

		disposeMeshTreeSafe(mesh);

		expect(geometry.dispose).toHaveBeenCalledTimes(1);
		expect(material.dispose).toHaveBeenCalledTimes(1);
	});

	it('disposes only non-shared entries in a material array', () => {
		const sharedMat = { dispose: vi.fn() };
		const ownedMat = { dispose: vi.fn() };
		markSharedModelResources({
			traverse(cb) {
				cb({ material: [sharedMat] });
			},
		});

		const mesh = {
			geometry: { dispose: vi.fn() },
			material: [sharedMat, ownedMat],
			traverse(cb) {
				cb(this);
			},
		};

		disposeMeshTreeSafe(mesh);

		expect(sharedMat.dispose).not.toHaveBeenCalled();
		expect(ownedMat.dispose).toHaveBeenCalledTimes(1);
		expect(mesh.geometry.dispose).toHaveBeenCalledTimes(1);
	});
});
