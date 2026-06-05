import { describe, it, expect, vi, beforeEach } from 'vitest';
import { _clearModelCache } from '../models.js';
import {
	createPlayerAvatar,
	applyAvatarProportions,
	__testOnly,
} from '../renderer.js';

const { applyProportionMorphs, applyLoadedModelCosmetic, attachGltfHat } = __testOnly;

const gltfLoadMock = vi.hoisted(() => vi.fn());

const PROPORTION_MORPH_KEYS = [
	'height',
	'headSize',
	'torsoWidth',
	'armLength',
	'legLength',
	'shoulderWidth',
];

/** Material stub with a tintable color and a clone() (mirrors GLTF material). */
function makeFakeMaterial(hex) {
	return {
		visible: undefined,
		color: { _v: hex, getHex() { return this._v; }, setHex(v) { this._v = v; } },
		clone() { return makeFakeMaterial(this.color._v); },
	};
}

/**
 * Minimal stand-in for a parsed player glTF scene: a root holding one skinned
 * body mesh carrying all six proportion morph targets.
 */
function makeFakePlayerScene(bodyHex = 0x123456) {
	const makeVec = () => ({ x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } });
	const makeScale = () => ({ x: 1, y: 1, z: 1, multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; } });
	const morphTargetDictionary = Object.fromEntries(PROPORTION_MORPH_KEYS.map((k, i) => [k, i]));
	const morphTargetInfluences = PROPORTION_MORPH_KEYS.map(() => 0);
	const body = {
		isMesh: true,
		isSkinnedMesh: true,
		name: 'SuperHero_Male',
		morphTargetDictionary,
		morphTargetInfluences,
		geometry: { parameters: { width: 0.6, height: 1.8, depth: 0.6 } },
		material: makeFakeMaterial(bodyHex),
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
		getObjectByName() { return null; },
		clone() { return makeFakePlayerScene(bodyHex); },
	};
}

vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
	GLTFLoader: vi.fn(function GLTFLoader() {
		this.load = gltfLoadMock;
	}),
}));

describe('applyProportionMorphs', () => {
	it('maps all six proportion keys 1:1 onto morphTargetInfluences', () => {
		const mesh = {
			morphTargetDictionary: Object.fromEntries(PROPORTION_MORPH_KEYS.map((k, i) => [k, i])),
			morphTargetInfluences: [0, 0, 0, 0, 0, 0],
		};
		const proportions = {
			height: 0.1,
			headSize: 0.2,
			torsoWidth: 0.3,
			armLength: 0.4,
			legLength: 0.5,
			shoulderWidth: 0.6,
		};

		applyProportionMorphs(mesh, proportions);

		expect(mesh.morphTargetInfluences).toEqual([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);
	});

	it('skips absent, non-finite, and unknown morph keys without writing undefined', () => {
		const mesh = {
			morphTargetDictionary: { height: 0, headSize: 1 },
			morphTargetInfluences: [0.5, 0.25],
		};

		applyProportionMorphs(mesh, {
			height: NaN,
			headSize: Infinity,
			torsoWidth: 0.9,
			armLength: undefined,
		});

		expect(mesh.morphTargetInfluences[0]).toBe(0.5);
		expect(mesh.morphTargetInfluences[1]).toBe(0.25);
		expect(mesh.morphTargetInfluences).not.toContain(undefined);
	});

	it('no-ops when the mesh has no morph targets', () => {
		expect(() => applyProportionMorphs(null, { height: 1 })).not.toThrow();
		expect(() => applyProportionMorphs({ morphTargetDictionary: null }, { height: 1 })).not.toThrow();
	});
});

describe('applyLoadedModelCosmetic', () => {
	it('sets userData.baseColor from bodyColor on a loaded glTF avatar', () => {
		const bodyMesh = { material: makeFakeMaterial(0x123456) };
		const host = {
			userData: {
				modelOverride: {},
				bodyMesh,
				baseColor: 0x123456,
			},
		};

		applyLoadedModelCosmetic(host, { bodyColor: '#ff00aa' });

		expect(host.userData.baseColor).toBe(0xff00aa);
	});

	it('is a no-op when modelOverride is absent (procedural fallback)', () => {
		const host = {
			userData: {
				bodyMesh: { morphTargetInfluences: [0] },
				baseColor: 0x4f9dde,
			},
		};

		applyLoadedModelCosmetic(host, {
			bodyColor: '#ff0000',
			proportions: { height: 1 },
		});

		expect(host.userData.baseColor).toBe(0x4f9dde);
		expect(host.userData.bodyMesh.morphTargetInfluences[0]).toBe(0);
	});

	it('re-applies proportion morphs on consecutive calls without rebuild', () => {
		const morphTargetDictionary = Object.fromEntries(PROPORTION_MORPH_KEYS.map((k, i) => [k, i]));
		const morphTargetInfluences = PROPORTION_MORPH_KEYS.map(() => 0);
		const host = {
			userData: {
				modelOverride: {},
				bodyMesh: { morphTargetDictionary, morphTargetInfluences, material: makeFakeMaterial(0xffffff) },
				baseColor: 0xffffff,
			},
		};

		applyLoadedModelCosmetic(host, { proportions: { height: 0.2, legLength: 0.3 } });
		expect(host.userData.bodyMesh.morphTargetInfluences[0]).toBe(0.2);
		expect(host.userData.bodyMesh.morphTargetInfluences[4]).toBe(0.3);

		applyLoadedModelCosmetic(host, { proportions: { height: 0.8, shoulderWidth: 0.1 } });
		expect(host.userData.bodyMesh.morphTargetInfluences[0]).toBe(0.8);
		expect(host.userData.bodyMesh.morphTargetInfluences[5]).toBe(0.1);
	});
});

describe('applyAvatarProportions live re-apply', () => {
	it('updates morph influences on the existing mesh across two apply calls', () => {
		const morphTargetDictionary = { height: 0, headSize: 1 };
		const morphTargetInfluences = [0, 0];
		const host = {
			userData: {
				bodyMesh: { morphTargetDictionary, morphTargetInfluences },
			},
		};

		applyAvatarProportions(host, { height: 0.15, headSize: 0.25 });
		expect(morphTargetInfluences).toEqual([0.15, 0.25]);

		applyAvatarProportions(host, { height: 0.9, headSize: 0.05 });
		expect(morphTargetInfluences).toEqual([0.9, 0.05]);
	});
});

describe('glTF hat attach (createPlayerAvatar)', () => {
	beforeEach(() => {
		_clearModelCache();
		gltfLoadMock.mockReset();
		gltfLoadMock.mockImplementation((_path, onLoad) => {
			onLoad({ scene: makeFakePlayerScene(0x123456) });
		});
	});

	it('sets userData.gltfHatMesh when cosmetic.hat is a catalog id other than none', async () => {
		const avatar = createPlayerAvatar({ hat: 'cap', bodyColor: '#00ff00' }, true);

		await vi.waitFor(() => {
			expect(avatar.userData.modelOverride).toBeTruthy();
		});

		expect(avatar.userData.gltfHatMesh).toBeTruthy();
		expect(avatar.userData.hatId).toBe('cap');
	});

	it('adds no glTF hat for none or unknown hat ids', async () => {
		for (const hat of ['none', 'totally_unknown']) {
			const avatar = createPlayerAvatar({ hat, bodyColor: '#00ff00' }, true);

			await vi.waitFor(() => {
				expect(avatar.userData.modelOverride).toBeTruthy();
			});

			expect(avatar.userData.gltfHatMesh).toBeFalsy();
			expect(avatar.userData.hatId).toBe('none');
		}
	});

	it('produces a new gltfHatMesh when hat changes (signature rebuild)', async () => {
		const capAvatar = createPlayerAvatar({ hat: 'cap', bodyColor: '#00ff00' }, true);
		await vi.waitFor(() => expect(capAvatar.userData.gltfHatMesh).toBeTruthy());
		const capHat = capAvatar.userData.gltfHatMesh;

		const wizardAvatar = createPlayerAvatar({ hat: 'wizard', bodyColor: '#00ff00' }, true);
		await vi.waitFor(() => expect(wizardAvatar.userData.gltfHatMesh).toBeTruthy());

		expect(wizardAvatar.userData.gltfHatMesh).not.toBe(capHat);
		expect(wizardAvatar.userData.hatId).toBe('wizard');
	});
});

describe('attachGltfHat stale hat cleanup', () => {
	beforeEach(() => {
		_clearModelCache();
		gltfLoadMock.mockReset();
	});

	it('disposes the prior gltfHatMesh before attaching a new hat on the same host', async () => {
		gltfLoadMock.mockImplementation((_path, onLoad) => {
			onLoad({ scene: makeFakePlayerScene(0x123456) });
		});

		const avatar = createPlayerAvatar({ hat: 'cap', bodyColor: '#00ff00' }, true);
		await vi.waitFor(() => expect(avatar.userData.gltfHatMesh).toBeTruthy());
		const firstHat = avatar.userData.gltfHatMesh;

		avatar.userData.hatId = 'wizard';
		attachGltfHat(avatar, avatar.userData.modelOverride);

		expect(avatar.userData.gltfHatMesh).toBeTruthy();
		expect(avatar.userData.gltfHatMesh).not.toBe(firstHat);
		expect(firstHat.parent).toBeFalsy();
	});
});
