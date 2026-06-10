import { describe, it, expect, vi, beforeEach } from 'vitest';
import { _clearModelCache, isModelCacheShared, loadModel } from '../models.js';
import {
	createEnemyMesh,
	createPlayerAvatar,
	disposeOne,
	disposeAvatar,
} from '../renderer.js';

const gltfLoadMock = vi.hoisted(() => vi.fn());

/** Material stub with tintable color, clone(), and a spyable dispose(). */
function makeFakeMaterial(hex) {
	return {
		visible: undefined,
		color: { _v: hex, getHex() { return this._v; }, setHex(v) { this._v = v; } },
		dispose: vi.fn(),
		clone() {
			return makeFakeMaterial(this.color._v);
		},
	};
}

const makeVec = () => ({ x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } });
const makeScale = () => ({ x: 1, y: 1, z: 1, multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; } });

/**
 * Minimal enemy glTF scene: clone(true) shares geometry/material references
 * (mirrors Three.js deep clone of BufferGeometry/Material).
 */
function makeFakeEnemyGltfScene() {
	const geometry = {
		userData: {},
		dispose: vi.fn(),
		parameters: { width: 0.6, height: 1.8, depth: 0.6 },
	};
	const material = { userData: {}, dispose: vi.fn() };
	const body = {
		isMesh: true,
		name: 'Body',
		geometry,
		material,
		position: makeVec(),
		scale: makeScale(),
		traverse(cb) {
			cb(this);
		},
	};
	const scene = {
		children: [body],
		position: makeVec(),
		scale: makeScale(),
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
				position: makeVec(),
				scale: makeScale(),
				traverse(cb) {
					cb(this);
				},
			};
			return {
				children: [clonedBody],
				position: makeVec(),
				scale: makeScale(),
				traverse(cb) {
					cb(this);
					for (const c of this.children) c.traverse(cb);
				},
			};
		},
	};
	return scene;
}

/**
 * Minimal player glTF scene with shared geometry/material on clone(true).
 */
function makeFakePlayerGltfScene(bodyHex = 0x123456) {
	const geometry = {
		userData: {},
		dispose: vi.fn(),
		parameters: { width: 0.6, height: 1.8, depth: 0.6 },
	};
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
	return {
		children: [body],
		position: makeVec(),
		scale: makeScale(),
		userData: {},
		traverse(cb) { cb(this); for (const c of this.children) c.traverse(cb); },
		clone() {
			const clonedBody = {
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
			return {
				children: [clonedBody],
				position: makeVec(),
				scale: makeScale(),
				userData: {},
				traverse(cb) { cb(this); for (const c of this.children) c.traverse(cb); },
			};
		},
	};
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

function findPlayerBodyMesh(root) {
	let body = null;
	root.traverse((node) => {
		if (node.isMesh && node.name === 'SuperHero_Male') body = node;
	});
	return body;
}

function findEnemyGltfBody(enemyMesh) {
	const model = enemyMesh.userData.modelOverride;
	return model ? findBodyMesh(model) : null;
}

describe('disposeOne shared glTF survival', () => {
	beforeEach(() => {
		_clearModelCache();
		gltfLoadMock.mockReset();
		gltfLoadMock.mockImplementation((_path, onLoad) => {
			onLoad({ scene: makeFakeEnemyGltfScene() });
		});
	});

	it('does not dispose shared geometry/material when disposing one modeled enemy', async () => {
		const enemyA = createEnemyMesh('grunt');
		const enemyB = createEnemyMesh('grunt');

		await vi.waitFor(() => {
			expect(enemyA.userData.modelOverride).toBeTruthy();
			expect(enemyB.userData.modelOverride).toBeTruthy();
		});

		const bodyA = findEnemyGltfBody(enemyA);
		const bodyB = findEnemyGltfBody(enemyB);
		expect(bodyA.geometry).toBe(bodyB.geometry);
		expect(bodyA.material).toBe(bodyB.material);
		expect(isModelCacheShared(bodyA.geometry)).toBe(true);
		expect(isModelCacheShared(bodyA.material)).toBe(true);

		const geoDispose = vi.spyOn(bodyA.geometry, 'dispose');
		const matDispose = vi.spyOn(bodyA.material, 'dispose');

		const enemiesMap = { a: enemyA, b: enemyB };
		const scene = { remove: vi.fn() };
		disposeOne(enemiesMap, 'a', scene);

		expect(geoDispose).not.toHaveBeenCalled();
		expect(matDispose).not.toHaveBeenCalled();
		expect(enemiesMap.a).toBeUndefined();
		expect(enemiesMap.b).toBe(enemyB);
	});

	it('keeps a survivor enemy referencing the same undisposed shared resources', async () => {
		const enemyA = createEnemyMesh('grunt');
		const enemyB = createEnemyMesh('grunt');

		await vi.waitFor(() => {
			expect(enemyA.userData.modelOverride).toBeTruthy();
			expect(enemyB.userData.modelOverride).toBeTruthy();
		});

		const sharedGeo = findEnemyGltfBody(enemyA).geometry;
		const sharedMat = findEnemyGltfBody(enemyA).material;

		const geoDispose = vi.spyOn(sharedGeo, 'dispose');
		const matDispose = vi.spyOn(sharedMat, 'dispose');

		const enemiesMap = { a: enemyA, b: enemyB };
		disposeOne(enemiesMap, 'a', { remove: vi.fn() });

		const survivorBody = findEnemyGltfBody(enemyB);
		expect(survivorBody.geometry).toBe(sharedGeo);
		expect(survivorBody.material).toBe(sharedMat);
		expect(isModelCacheShared(survivorBody.geometry)).toBe(true);
		expect(isModelCacheShared(survivorBody.material)).toBe(true);
		expect(geoDispose).not.toHaveBeenCalled();
		expect(matDispose).not.toHaveBeenCalled();
	});
});

describe('disposeAvatar shared glTF survival', () => {
	beforeEach(() => {
		_clearModelCache();
		gltfLoadMock.mockReset();
		gltfLoadMock.mockImplementation((_path, onLoad) => {
			onLoad({ scene: makeFakePlayerGltfScene(0x123456) });
		});
	});

	it('disposes cloned body material but not shared cache geometry', async () => {
		const survivorClone = await loadModel('/models/player.glb');
		expect(survivorClone).toBeTruthy();
		const survivorBody = findPlayerBodyMesh(survivorClone);
		const sharedGeometry = survivorBody.geometry;

		const avatar = createPlayerAvatar({ bodyColor: 0xff0000 }, true);

		await vi.waitFor(() => {
			expect(avatar.userData.modelOverride).toBeTruthy();
		});

		const avatarBody = avatar.userData.bodyMesh;
		expect(avatarBody.geometry).toBe(sharedGeometry);
		expect(isModelCacheShared(sharedGeometry)).toBe(true);

		const clonedMaterial = avatarBody.material;
		expect(clonedMaterial).not.toBe(survivorBody.material);
		expect(isModelCacheShared(clonedMaterial)).toBe(false);

		const geoDispose = vi.spyOn(sharedGeometry, 'dispose');
		const clonedMatDispose = vi.spyOn(clonedMaterial, 'dispose');

		disposeAvatar(avatar);

		expect(geoDispose).not.toHaveBeenCalled();
		expect(clonedMatDispose).toHaveBeenCalled();

		const survivorAfter = findPlayerBodyMesh(survivorClone);
		expect(survivorAfter.geometry).toBe(sharedGeometry);
		expect(isModelCacheShared(survivorAfter.geometry)).toBe(true);
		expect(geoDispose).not.toHaveBeenCalled();
	});
});
