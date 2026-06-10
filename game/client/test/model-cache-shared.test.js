import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Mesh, BoxGeometry, MeshStandardMaterial } from 'three';
import { loadModel, isModelCacheShared, _clearModelCache } from '../models.js';

const gltfLoadMock = vi.hoisted(() => vi.fn());

/**
 * Minimal glTF scene whose clone(true) shares geometry/material references
 * (mirrors Three.js deep clone of BufferGeometry/Material).
 */
function makeFakeGltfScene() {
	const geometry = { userData: {} };
	const material = { userData: {} };
	const body = {
		isMesh: true,
		name: 'Body',
		geometry,
		material,
		traverse(cb) {
			cb(this);
		},
	};
	const scene = {
		children: [body],
		traverse(cb) {
			cb(this);
			for (const c of this.children) c.traverse(cb);
		},
		clone() {
			const clonedBody = {
				isMesh: true,
				name: 'Body',
				geometry,
				material,
				traverse(cb) {
					cb(this);
				},
			};
			return {
				children: [clonedBody],
				traverse(cb) {
					cb(this);
					for (const c of this.children) c.traverse(cb);
				},
			};
		},
	};
	return scene;
}

vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
	GLTFLoader: vi.fn(function GLTFLoader() {
		this.load = gltfLoadMock;
	}),
}));

function findBodyMesh(root) {
	let body = null;
	root.traverse((node) => {
		if (node.isMesh && node.name === 'Body') body = node;
	});
	return body;
}

describe('model cache shared marking', () => {
	beforeEach(() => {
		_clearModelCache();
		gltfLoadMock.mockReset();
		gltfLoadMock.mockImplementation((_path, onLoad) => {
			onLoad({ scene: makeFakeGltfScene() });
		});
	});

	it('marks geometry and material on every successful loadModel clone', async () => {
		const clone1 = await loadModel('/models/__test__.glb');
		const clone2 = await loadModel('/models/__test__.glb');

		expect(clone1).toBeTruthy();
		expect(clone2).toBeTruthy();

		const body1 = findBodyMesh(clone1);
		const body2 = findBodyMesh(clone2);

		expect(isModelCacheShared(body1.geometry)).toBe(true);
		expect(isModelCacheShared(body1.material)).toBe(true);
		expect(isModelCacheShared(body2.geometry)).toBe(true);
		expect(isModelCacheShared(body2.material)).toBe(true);
		expect(body1.geometry).toBe(body2.geometry);
		expect(body1.material).toBe(body2.material);
	});

	it('isModelCacheShared returns false for procedural meshes', () => {
		const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
		expect(isModelCacheShared(mesh.geometry)).toBe(false);
		expect(isModelCacheShared(mesh.material)).toBe(false);
	});

	it('leaves failed/null loads unchanged', async () => {
		gltfLoadMock.mockImplementation((_path, _onLoad, _progress, onError) => {
			onError(new Error('404'));
		});

		const result = await loadModel('/models/__missing__.glb');
		expect(result).toBeNull();
	});
});
