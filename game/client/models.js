import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** Entity key → glTF URL under `/models/`, or null until assets are wired. */
export const MODEL_REGISTRY = {
	player: null,
	grunt: null,
	skirmisher: null,
	miniboss: null,
	spawner: null,
	ancient_wyrm: null,
	null_crawler: null,
	bulkhead_mauler: null,
	currency: null,
	crystal: null,
	magic_stone: null
};

/**
 * @param {string} key
 * @returns {string | null}
 */
export function getRegistryModelPath(key) {
	if (!Object.prototype.hasOwnProperty.call(MODEL_REGISTRY, key)) {
		return null;
	}
	return MODEL_REGISTRY[key];
}

/** @type {Map<string, Promise<import('three').Object3D | null>>} */
const templateCache = new Map();
const loader = new GLTFLoader();

function fetchTemplate(path) {
	return new Promise((resolve) => {
		try {
			loader.load(
				path,
				(gltf) => resolve(gltf.scene),
				undefined,
				(err) => {
					console.warn('[models] failed to load', path, err);
					resolve(null);
				}
			);
		} catch (err) {
			console.warn('[models] failed to load', path, err);
			resolve(null);
		}
	});
}

/**
 * Load a glTF model by URL. Parsed scenes are cached per path; each call returns
 * a fresh clone so instances do not share object references.
 * @param {string} path
 * @returns {Promise<import('three').Object3D | null>}
 */
export function loadModel(path) {
	if (!templateCache.has(path)) {
		templateCache.set(path, fetchTemplate(path));
	}
	return templateCache.get(path).then((template) => {
		if (!template) return null;
		return template.clone(true);
	});
}
