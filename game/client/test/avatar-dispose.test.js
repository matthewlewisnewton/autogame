import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { _clearModelCache, loadModel } from '../models.js';
import { createPlayerAvatar, disposeAvatar } from '../renderer.js';
import { openPreview, updatePreview, closePreview, isPreviewOpen } from '../cosmetic-preview.js';

const gltfLoadMock = vi.hoisted(() => vi.fn());

/** Material stub with tintable color and clone() (mirrors GLTF material). */
function makeFakeMaterial(hex) {
	return {
		visible: undefined,
		color: { _v: hex, getHex() { return this._v; }, setHex(v) { this._v = v; } },
		dispose: vi.fn(),
		clone() { return makeFakeMaterial(this.color._v); },
	};
}

/**
 * Player glTF scene whose clone(true) shares geometry/material references
 * (mirrors Three.js Object3D.clone recursive behavior and loadModel tagging).
 */
function makeSharedPlayerGltfScene(bodyHex = 0x123456) {
	const makeVec = () => ({ x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } });
	const makeScale = () => ({ x: 1, y: 1, z: 1, multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; } });
	const geometry = { dispose: vi.fn(), parameters: { width: 0.6, height: 1.8, depth: 0.6 } };
	const material = makeFakeMaterial(bodyHex);
	const body = {
		isMesh: true,
		isSkinnedMesh: true,
		name: 'SuperHero_Male',
		morphTargetDictionary: { height: 0, headSize: 1 },
		geometry,
		material,
		position: makeVec(),
		scale: makeScale(),
		userData: {},
		traverse(cb) { cb(this); },
	};
	const scene = {
		children: [body],
		position: makeVec(),
		scale: makeScale(),
		userData: {},
		traverse(cb) { cb(this); for (const c of this.children) c.traverse(cb); },
		getObjectByName() { return null; },
		clone(recursive) {
			const clonedBody = {
				isMesh: true,
				isSkinnedMesh: true,
				name: 'SuperHero_Male',
				morphTargetDictionary: { height: 0, headSize: 1 },
				geometry: recursive ? geometry : { dispose: vi.fn() },
				material: recursive ? material : makeFakeMaterial(bodyHex),
				position: makeVec(),
				scale: makeScale(),
				userData: {},
				traverse(cb) { cb(this); },
			};
			return {
				children: [clonedBody],
				position: makeVec(),
				scale: makeScale(),
				userData: {},
				traverse(cb) { cb(this); for (const c of this.children) c.traverse(cb); },
				getObjectByName() { return null; },
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

describe('disposeAvatar', () => {
	beforeEach(() => {
		_clearModelCache();
		gltfLoadMock.mockReset();
		gltfLoadMock.mockImplementation((_path, onLoad) => {
			onLoad({ scene: makeSharedPlayerGltfScene() });
		});
	});

	it('does not dispose shared glTF geometry/material still used by another live avatar', async () => {
		const avatarA = createPlayerAvatar({ bodyColor: '#ff0000' }, true);
		const avatarB = createPlayerAvatar({ bodyColor: '#00ff00' }, false);

		await vi.waitFor(() => {
			expect(avatarA.userData.modelOverride).toBeTruthy();
			expect(avatarB.userData.modelOverride).toBeTruthy();
		});

		let survivorGeometry;
		avatarB.userData.modelOverride.traverse((node) => {
			if (node.isMesh) survivorGeometry = node.geometry;
		});

		const geometryDisposeSpy = vi.spyOn(survivorGeometry, 'dispose');

		const freshClone = await loadModel('/models/player.glb');
		let cacheGeometry;
		let cacheMaterial;
		freshClone.traverse((node) => {
			if (node.isMesh) {
				cacheGeometry = node.geometry;
				cacheMaterial = node.material;
			}
		});
		const cacheGeometryDisposeSpy = vi.spyOn(cacheGeometry, 'dispose');
		const cacheMaterialDisposeSpy = vi.spyOn(cacheMaterial, 'dispose');

		disposeAvatar(avatarA);

		expect(geometryDisposeSpy).not.toHaveBeenCalled();
		expect(cacheGeometryDisposeSpy).not.toHaveBeenCalled();
		expect(cacheMaterialDisposeSpy).not.toHaveBeenCalled();
	});

	it('disposes cloned per-avatar body materials from retargetPlayerBodyMesh', async () => {
		const avatar = createPlayerAvatar({ bodyColor: '#ff0000' }, true);

		await vi.waitFor(() => {
			expect(avatar.userData.modelOverride).toBeTruthy();
		});

		const clonedBodyMaterial = avatar.userData.bodyMesh.material;
		const materialDisposeSpy = vi.spyOn(clonedBodyMaterial, 'dispose');

		let sharedGeometry;
		avatar.userData.modelOverride.traverse((node) => {
			if (node.isMesh) sharedGeometry = node.geometry;
		});
		const geometryDisposeSpy = vi.spyOn(sharedGeometry, 'dispose');

		disposeAvatar(avatar);

		expect(materialDisposeSpy).toHaveBeenCalledTimes(1);
		expect(geometryDisposeSpy).not.toHaveBeenCalled();
	});

	it('fully disposes procedural fallback avatars when model load fails', async () => {
		gltfLoadMock.mockImplementation((_path, _onLoad, _progress, onError) => {
			onError(new Error('404'));
		});

		const avatar = createPlayerAvatar({ bodyColor: '#ff0000' }, true);

		await vi.waitFor(() => {
			expect(gltfLoadMock).toHaveBeenCalled();
		});

		expect(avatar.userData.modelOverride).toBeUndefined();

		const bodyGeometryDisposeSpy = vi.spyOn(avatar.userData.bodyMesh.geometry, 'dispose');
		const bodyMaterialDisposeSpy = vi.spyOn(avatar.userData.bodyMesh.material, 'dispose');
		const accentGeometryDisposeSpy = vi.spyOn(avatar.userData.accentMesh.geometry, 'dispose');
		const accentMaterialDisposeSpy = vi.spyOn(avatar.userData.accentMesh.material, 'dispose');

		disposeAvatar(avatar);

		expect(bodyGeometryDisposeSpy).toHaveBeenCalledTimes(1);
		expect(bodyMaterialDisposeSpy).toHaveBeenCalledTimes(1);
		expect(accentGeometryDisposeSpy).toHaveBeenCalledTimes(1);
		expect(accentMaterialDisposeSpy).toHaveBeenCalledTimes(1);
	});
});

describe('cosmetic preview updatePreview', () => {
	beforeEach(() => {
		_clearModelCache();
		gltfLoadMock.mockReset();
		gltfLoadMock.mockImplementation((_path, onLoad) => {
			onLoad({ scene: makeSharedPlayerGltfScene() });
		});
		vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
		vi.stubGlobal('cancelAnimationFrame', vi.fn());
	});

	afterEach(() => {
		closePreview();
		vi.unstubAllGlobals();
	});

	it('does not dispose shared glTF resources on a main-scene avatar', async () => {
		const mainAvatar = createPlayerAvatar({ bodyColor: '#ff0000' }, true);

		await vi.waitFor(() => {
			expect(mainAvatar.userData.modelOverride).toBeTruthy();
		});

		let sharedGeometry;
		let sharedMaterial;
		mainAvatar.userData.modelOverride.traverse((node) => {
			if (node.isMesh) {
				sharedGeometry = node.geometry;
				sharedMaterial = node.material;
			}
		});

		const geometryDisposeSpy = vi.spyOn(sharedGeometry, 'dispose');
		const materialDisposeSpy = vi.spyOn(sharedMaterial, 'dispose');

		const canvas = document.createElement('canvas');
		canvas.width = 180;
		canvas.height = 180;
		Object.defineProperty(canvas, 'clientWidth', { value: 180 });
		Object.defineProperty(canvas, 'clientHeight', { value: 180 });

		openPreview(canvas, {
			bodyColor: '#4f9dde',
			accentColor: '#f2c94c',
			bodyShape: 'box',
			hat: 'none',
		});

		expect(isPreviewOpen()).toBe(true);

		updatePreview({
			bodyColor: '#ef4444',
			accentColor: '#f2c94c',
			bodyShape: 'cylinder',
			hat: 'cap',
		});

		expect(geometryDisposeSpy).not.toHaveBeenCalled();
		expect(materialDisposeSpy).not.toHaveBeenCalled();
	});
});
