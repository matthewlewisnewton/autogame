import * as THREE from 'three';

// Defaults used when a cosmetic field is missing/invalid. Mirrors the server's
// DEFAULT_COSMETIC in game/server/cosmetic.js.
const DEFAULT_AVATAR_BODY_COLOR = 0x4f9dde;
const DEFAULT_AVATAR_ACCENT_COLOR = 0xf2c94c;

// Body-shape vocabulary, kept in sync with the server's BODY_SHAPES.
const AVATAR_BODY_SHAPES = new Set(['box', 'cylinder', 'cone', 'capsule']);
const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

// Proportion morph-target vocabulary — the SAME case-sensitive strings used by
// the server's cosmetic.proportions{}, the glTF morph targets, and the UI
// sliders. There is NO alias/rename layer (see game/docs/MODEL_SPIKE.md):
// proportions[key] maps 1:1 onto morphTargetInfluences[morphTargetDictionary[key]].
const PROPORTION_MORPH_KEYS = [
	'height',
	'headSize',
	'torsoWidth',
	'armLength',
	'legLength',
	'shoulderWidth',
];

// Hat catalog ids, kept in sync with the server's HAT_CATALOG in
// game/server/cosmetic.js. 'none' (and any unknown id) renders no hat.
const AVATAR_HAT_IDS = new Set(['none', 'cap', 'wizard', 'crown', 'bandana', 'beanie']);

// Base mesh variant ids, kept in sync with MODEL_IDS in game/server/cosmetic.js.
const AVATAR_MODEL_IDS = new Set(['player']);

// Per-hat colors, distinct from one another and from the default body/accent.
const HAT_CAP_COLOR = 0x2e7d32; // forest green
const HAT_WIZARD_COLOR = 0x5b3a8a; // deep purple
const HAT_CROWN_COLOR = 0xffd700; // gold
const HAT_BANDANA_COLOR = 0xc62828; // crimson red
const HAT_BEANIE_COLOR = 0x00695c; // slate teal

// Desired world-space scale and seating for a hat worn on the loaded glTF head.
const HAT_HEAD_WORLD_SCALE = 0.45;
const HAT_HEAD_WORLD_OFFSET = 0.18;
const HAT_FALLBACK_WORLD_Y = 1.72;

// Desired world-space scale and seating for a key-item prop worn on the loaded glTF torso.
const KEY_ITEM_BODY_WORLD_SCALE = 0.5;
const KEY_ITEM_BODY_WORLD_OFFSET = 0.16;
const KEY_ITEM_FALLBACK_WORLD_Y = 1.25;
const KEY_ITEM_FALLBACK_WORLD_Z = 0.22;

// Local chest seating for the procedural primitive avatar (~1-unit body).
const KEY_ITEM_PROC_CHEST_Y = 0.18;
const KEY_ITEM_PROC_CHEST_Z = 0.45;

/** @type {{ getScene: () => THREE.Scene|null, getPlayersMeshes: () => Object, attachRegistryModel: Function, buildKeyItemProp: Function } | null} */
let ctx = null;

/**
 * @param {object} context
 * @param {() => THREE.Scene|null} context.getScene
 * @param {() => Object} context.getPlayersMeshes
 * @param {(key: string, host: THREE.Object3D) => void} context.attachRegistryModel
 * @param {(keyItemId: string) => THREE.Object3D|null} context.buildKeyItemProp
 */
export function createAvatarSync(context) {
	ctx = context;
	return { syncPlayerAvatar };
}

function requireCtx() {
	if (!ctx) throw new Error('avatarSync: call createAvatarSync before using avatar helpers');
	return ctx;
}

function buildBodyGeometry(shape) {
	switch (shape) {
		case 'cylinder':
			return new THREE.CylinderGeometry(0.5, 0.5, 1, 24);
		case 'cone':
			return new THREE.ConeGeometry(0.55, 1, 24);
		case 'capsule':
			return new THREE.CapsuleGeometry(0.4, 0.5, 8, 16);
		case 'box':
		default:
			return new THREE.BoxGeometry(1, 1, 1);
	}
}

function bodyTopY(shape) {
	switch (shape) {
		case 'capsule':
			return 0.65;
		case 'box':
		case 'cylinder':
		case 'cone':
		default:
			return 0.5;
	}
}

function buildHatMesh(hatId) {
	switch (hatId) {
		case 'cap': {
			const hat = new THREE.Group();
			const crownGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.22, 20);
			const crownMat = new THREE.MeshStandardMaterial({ color: HAT_CAP_COLOR });
			const crown = new THREE.Mesh(crownGeo, crownMat);
			crown.position.y = 0.13;
			hat.add(crown);
			const brimGeo = new THREE.CylinderGeometry(0.58, 0.58, 0.05, 20);
			const brimMat = new THREE.MeshStandardMaterial({ color: HAT_CAP_COLOR });
			const brim = new THREE.Mesh(brimGeo, brimMat);
			brim.position.y = 0.025;
			hat.add(brim);
			return hat;
		}
		case 'wizard': {
			const geo = new THREE.ConeGeometry(0.42, 0.85, 20);
			const mat = new THREE.MeshStandardMaterial({ color: HAT_WIZARD_COLOR });
			const cone = new THREE.Mesh(geo, mat);
			cone.position.y = 0.425;
			return cone;
		}
		case 'crown': {
			const geo = new THREE.TorusGeometry(0.34, 0.09, 12, 24);
			const mat = new THREE.MeshStandardMaterial({
				color: HAT_CROWN_COLOR,
				metalness: 0.6,
				roughness: 0.3,
			});
			const ring = new THREE.Mesh(geo, mat);
			ring.rotation.x = Math.PI / 2;
			ring.position.y = 0.1;
			return ring;
		}
		case 'bandana': {
			const hat = new THREE.Group();
			const mat = new THREE.MeshStandardMaterial({ color: HAT_BANDANA_COLOR });
			const bandGeo = new THREE.TorusGeometry(0.4, 0.05, 10, 24);
			const band = new THREE.Mesh(bandGeo, mat);
			band.rotation.x = Math.PI / 2;
			band.position.y = 0.06;
			hat.add(band);
			const knotGeo = new THREE.ConeGeometry(0.08, 0.18, 8);
			const knot = new THREE.Mesh(knotGeo, mat);
			knot.position.set(-0.4, 0.06, 0);
			knot.rotation.z = Math.PI / 2;
			hat.add(knot);
			return hat;
		}
		case 'beanie': {
			const geo = new THREE.SphereGeometry(0.44, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);
			const mat = new THREE.MeshStandardMaterial({
				color: HAT_BEANIE_COLOR,
				roughness: 0.9,
			});
			return new THREE.Mesh(geo, mat);
		}
		case 'none':
		default:
			return null;
	}
}

function avatarColorHex(hex, fallbackHex) {
	if (typeof hex === 'string' && HEX_COLOR_RE.test(hex)) return parseInt(hex.slice(1), 16);
	return fallbackHex;
}

function resolveAvatarModelKey(modelId) {
	return (typeof modelId === 'string' && AVATAR_MODEL_IDS.has(modelId)) ? modelId : 'player';
}

/**
 * Stable signature string for a cosmetic, used to detect when an avatar needs
 * to be rebuilt. Only the fields that affect geometry/material are included.
 * @param {*} cosmetic
 * @returns {string}
 */
export function cosmeticSignature(cosmetic) {
	const c = (cosmetic && typeof cosmetic === 'object' && !Array.isArray(cosmetic)) ? cosmetic : {};
	const shape = AVATAR_BODY_SHAPES.has(c.bodyShape) ? c.bodyShape : 'box';
	const body = (typeof c.bodyColor === 'string' && HEX_COLOR_RE.test(c.bodyColor)) ? c.bodyColor.toLowerCase() : 'default';
	const accent = (typeof c.accentColor === 'string' && HEX_COLOR_RE.test(c.accentColor)) ? c.accentColor.toLowerCase() : 'default';
	const hat = AVATAR_HAT_IDS.has(c.hat) ? c.hat : 'none';
	const modelKey = resolveAvatarModelKey(c.modelId);
	return `${shape}|${body}|${accent}|${hat}|${modelKey}`;
}

/**
 * Dispose every mesh geometry/material under an avatar group (or bare mesh) so
 * it can be safely removed from the scene without leaking GPU resources.
 * @param {THREE.Object3D} obj
 */
export function disposeAvatar(obj) {
	if (!obj) return;
	obj.traverse((node) => {
		if (node.isMesh) {
			if (node.geometry) node.geometry.dispose();
			if (node.material) node.material.dispose();
		}
	});
}

function resolveBodyMesh(obj) {
	if (!obj) return null;
	if (obj.userData && obj.userData.bodyMesh) return obj.userData.bodyMesh;
	return obj;
}

function applyProportionMorphs(skinnedMesh, proportions) {
	const dict = skinnedMesh && skinnedMesh.morphTargetDictionary;
	const influences = skinnedMesh && skinnedMesh.morphTargetInfluences;
	if (!dict || !influences) return;
	if (!proportions || typeof proportions !== 'object' || Array.isArray(proportions)) return;

	for (const key of PROPORTION_MORPH_KEYS) {
		if (!Object.prototype.hasOwnProperty.call(proportions, key)) continue;
		const value = proportions[key];
		if (!Number.isFinite(value)) continue;
		const idx = dict[key];
		if (idx === undefined) continue;
		influences[idx] = value;
	}
}

/**
 * (Re)apply cosmetic proportions + body/accent tint to a player's LOADED glTF
 * avatar each update, so a broadcast cosmetic change takes effect WITHOUT a page
 * reload.
 * @param {THREE.Object3D} host
 * @param {*} cosmetic
 */
export function applyLoadedModelCosmetic(host, cosmetic) {
	if (!host || !host.userData || !host.userData.modelOverride) return;
	const bodyMesh = host.userData.bodyMesh;
	if (!bodyMesh) return;

	const c = (cosmetic && typeof cosmetic === 'object' && !Array.isArray(cosmetic)) ? cosmetic : {};

	applyProportionMorphs(bodyMesh, c.proportions);

	host.userData.baseColor = avatarColorHex(c.bodyColor, DEFAULT_AVATAR_BODY_COLOR);

	if (Array.isArray(bodyMesh.material) && bodyMesh.material.length > 1) {
		const accentMat = bodyMesh.material[1];
		if (accentMat && accentMat.color && accentMat.color.setHex) {
			accentMat.color.setHex(avatarColorHex(c.accentColor, DEFAULT_AVATAR_ACCENT_COLOR));
		}
	}
}

/**
 * @param {THREE.Object3D|null|undefined} host
 * @param {*} proportions
 */
export function applyAvatarProportions(host, proportions) {
	if (!host) return;
	applyProportionMorphs(resolveBodyMesh(host), proportions);
}

function attachProceduralKeyItemProp(host) {
	const prop = requireCtx().buildKeyItemProp(host.userData.keyItemId);
	if (!prop) return;
	prop.position.set(0, KEY_ITEM_PROC_CHEST_Y, KEY_ITEM_PROC_CHEST_Z);
	host.add(prop);
	host.userData.keyItemPropMesh = prop;
}

/**
 * Build the equipped hat and seat it on the loaded glTF avatar's head bone.
 * @param {THREE.Object3D} host
 * @param {THREE.Object3D} model
 */
export function attachGltfHat(host, model) {
	const existing = host.userData.gltfHatMesh;
	if (existing) {
		if (existing.parent) existing.parent.remove(existing);
		disposeAvatar(existing);
		host.userData.gltfHatMesh = null;
	}

	const hatId = host.userData.hatId;
	const hat = buildHatMesh(hatId);
	if (!hat) return;

	const headBone = model.getObjectByName('Head');
	if (headBone) {
		headBone.add(hat);

		const boneScale = new THREE.Vector3();
		headBone.getWorldScale(boneScale);
		const sFactor = HAT_HEAD_WORLD_SCALE / (boneScale.x || 1);
		hat.scale.setScalar(sFactor);

		const boneQuat = new THREE.Quaternion();
		headBone.getWorldQuaternion(boneQuat);
		const hostQuat = new THREE.Quaternion();
		host.getWorldQuaternion(hostQuat);
		hat.quaternion.copy(boneQuat).invert().multiply(hostQuat);

		const localUp = new THREE.Vector3(0, 1, 0).applyQuaternion(hat.quaternion);
		hat.position.copy(localUp.multiplyScalar(HAT_HEAD_WORLD_OFFSET / (boneScale.x || 1)));
	} else {
		host.add(hat);
		hat.scale.setScalar(HAT_HEAD_WORLD_SCALE);
		hat.position.set(0, HAT_FALLBACK_WORLD_Y, 0);
	}

	host.userData.gltfHatMesh = hat;
}

/**
 * Build the equipped key-item prop and seat it on the loaded glTF torso.
 * @param {THREE.Object3D} host
 * @param {THREE.Object3D} model
 */
export function attachGltfKeyItemProp(host, model) {
	const existing = host.userData.keyItemPropMesh;
	if (existing) {
		if (existing.parent) existing.parent.remove(existing);
		disposeAvatar(existing);
		host.userData.keyItemPropMesh = null;
	}

	const prop = requireCtx().buildKeyItemProp(host.userData.keyItemId);
	if (!prop) return;

	const spineBone = model.getObjectByName('spine_03')
		|| model.getObjectByName('spine_02')
		|| model.getObjectByName('spine_01');
	if (spineBone) {
		spineBone.add(prop);

		const boneScale = new THREE.Vector3();
		spineBone.getWorldScale(boneScale);
		const sFactor = KEY_ITEM_BODY_WORLD_SCALE / (boneScale.x || 1);
		prop.scale.setScalar(sFactor);

		const boneQuat = new THREE.Quaternion();
		spineBone.getWorldQuaternion(boneQuat);
		const hostQuat = new THREE.Quaternion();
		host.getWorldQuaternion(hostQuat);
		prop.quaternion.copy(boneQuat).invert().multiply(hostQuat);

		const localFwd = new THREE.Vector3(0, 0, 1).applyQuaternion(prop.quaternion);
		prop.position.copy(localFwd.multiplyScalar(KEY_ITEM_BODY_WORLD_OFFSET / (boneScale.x || 1)));
	} else {
		host.add(prop);
		prop.scale.setScalar(KEY_ITEM_BODY_WORLD_SCALE);
		prop.position.set(0, KEY_ITEM_FALLBACK_WORLD_Y, KEY_ITEM_FALLBACK_WORLD_Z);
	}

	host.userData.keyItemPropMesh = prop;
}

/**
 * Apply a key-item equip change to a rendered avatar WITHOUT a page reload.
 * @param {THREE.Object3D} host
 * @param {string} equippedKeyItemId
 */
export function updateKeyItemProp(host, equippedKeyItemId) {
	const newId = equippedKeyItemId || 'none';
	if (!host || !host.userData) return;
	if (host.userData.keyItemId === newId) return;

	try {
		const old = host.userData.keyItemPropMesh;
		if (old) {
			if (old.parent) old.parent.remove(old);
			disposeAvatar(old);
			host.userData.keyItemPropMesh = null;
		}
		host.userData.keyItemId = newId;
		if (host.userData.modelOverride) {
			attachGltfKeyItemProp(host, host.userData.modelOverride);
		} else {
			attachProceduralKeyItemProp(host);
		}
	} catch (err) {
		console.warn('[renderer] failed to update key-item prop:', err);
	}
}

/**
 * Build a player avatar as a THREE.Group from a cosmetic profile.
 * @param {object} cosmetic
 * @param {boolean} isSelf
 * @param {string} [equippedKeyItemId]
 * @returns {THREE.Group}
 */
export function createPlayerAvatar(cosmetic, isSelf, equippedKeyItemId) {
	const c = (cosmetic && typeof cosmetic === 'object' && !Array.isArray(cosmetic)) ? cosmetic : {};
	const shape = AVATAR_BODY_SHAPES.has(c.bodyShape) ? c.bodyShape : 'box';

	const group = new THREE.Group();

	const bodyHex = avatarColorHex(c.bodyColor, DEFAULT_AVATAR_BODY_COLOR);
	const bodyGeo = buildBodyGeometry(shape);
	const bodyMat = new THREE.MeshStandardMaterial({ color: bodyHex });
	const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
	group.add(bodyMesh);

	const accentHex = avatarColorHex(c.accentColor, DEFAULT_AVATAR_ACCENT_COLOR);
	const accentGeo = new THREE.CylinderGeometry(0.56, 0.56, 0.18, 24);
	const accentMat = new THREE.MeshStandardMaterial({ color: accentHex });
	const accentMesh = new THREE.Mesh(accentGeo, accentMat);
	accentMesh.position.y = 0.18;
	group.add(accentMesh);

	const hatId = AVATAR_HAT_IDS.has(c.hat) ? c.hat : 'none';
	const hat = buildHatMesh(hatId);
	if (hat) {
		hat.position.y = bodyTopY(shape);
		group.add(hat);
		group.userData.hatMesh = hat;
	}
	group.userData.hatId = hatId;

	const keyItemId = equippedKeyItemId || 'none';
	group.userData.keyItemId = keyItemId;
	attachProceduralKeyItemProp(group);

	group.userData.isAvatar = true;
	group.userData.bodyMesh = bodyMesh;
	group.userData.accentMesh = accentMesh;
	group.userData.baseColor = bodyHex;
	group.userData.cosmeticKey = cosmeticSignature(c);

	const modelKey = resolveAvatarModelKey(c.modelId);
	requireCtx().attachRegistryModel(modelKey, group);

	return group;
}

/**
 * Cosmetic-driven avatar build/rebuild for one player snapshot entry.
 * @param {string} id
 * @param {*} pData
 * @param {{ isLocal: boolean }} options
 */
export function syncPlayerAvatar(id, pData, { isLocal }) {
	const scene = requireCtx().getScene();
	const playersMeshes = requireCtx().getPlayersMeshes();
	if (!scene) return;

	const sig = cosmeticSignature(pData.cosmetic);
	if (!playersMeshes[id] || playersMeshes[id].userData.cosmeticKey !== sig) {
		if (playersMeshes[id]) {
			disposeAvatar(playersMeshes[id]);
			scene.remove(playersMeshes[id]);
		}
		const avatar = createPlayerAvatar(pData.cosmetic, isLocal, pData.equippedKeyItemId);
		scene.add(avatar);
		playersMeshes[id] = avatar;
	}

	applyLoadedModelCosmetic(playersMeshes[id], pData.cosmetic);
	updateKeyItemProp(playersMeshes[id], pData.equippedKeyItemId);
}

/** @internal Test-only exports for avatar cosmetic morph/tint/hat unit coverage. */
export const __testOnly = {
	applyProportionMorphs,
	applyLoadedModelCosmetic,
	attachGltfHat,
};

/** Resolve the body mesh from an avatar group for VFX helpers in renderer.js. */
export function resolveBodyMeshForVfx(obj) {
	return resolveBodyMesh(obj);
}
