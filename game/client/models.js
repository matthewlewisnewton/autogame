// ── glTF Model Loading Module ──
// Additive plumbing for loading .glb models via Three.js GLTFLoader. Renderer
// consults MODEL_REGISTRY via attachRegistryModel; enemy types are wired here.
//
// Usage:
//   import { loadModel, modelPathFor, MODEL_REGISTRY } from './models.js';
//   const scene = await loadModel(modelPathFor('player'));
//   if (scene) group.add(scene); // each caller gets a fresh clone
//
// Resilience: a missing/broken/unparseable path logs a warning and resolves to
// null (never throws uncaught, never leaves a hung promise). Failures are cached
// so a bad path is not re-fetched on every call.

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Registry mapping entity keys to a model path. Keys match how renderer.js keys
// its meshes: ENEMY_GEOMETRY (enemy types), MINION_VISUAL (minion types),
// createLootMesh (loot kinds), and the player avatar (via cosmetic.modelId →
// modelPathFor). Null means procedural-only.
export const MODEL_REGISTRY = {
	// Player avatar
	player: '/models/player.glb',

	// Enemy types (renderer.js ENEMY_GEOMETRY)
	grunt: '/models/grunt.glb',
	skirmisher: '/models/skirmisher.glb',
	miniboss: '/models/miniboss.glb',
	annex_overseer: null,
	arena_champion: null,
	spire_warden: null,
	permafrost_warden: null,
	glacial_tyrant: null,
	spawner: '/models/spawner.glb',
	field_medic: null,
	ember_wraith: null,

	// Minion types (renderer.js MINION_VISUAL)
	ancient_wyrm: '/models/minion-ancient-wyrm.glb',
	null_crawler: '/models/minion-null-crawler.glb',
	bulkhead_mauler: '/models/minion-bulkhead-mauler.glb',

	// Loot kinds (renderer.js createLootMesh)
	currency: null,
	crystal: null,
	magic_stone: null,
};

// Per-path cache of the in-flight/resolved load promise. Concurrent callers for
// the same path share one fetch+parse; resolved entries (including cached null
// failures) are reused so a path is fetched at most once.
const modelCache = new Map();

/** Module-private tag for geometry/material shared with the glTF model cache. */
const SHARED_MODEL_RESOURCE = Symbol('sharedModelResource');

/**
 * @param {import('three').BufferGeometry|import('three').Material|null|undefined} resource
 * @returns {boolean}
 */
export function isSharedModelResource(resource) {
	return resource != null && resource[SHARED_MODEL_RESOURCE] === true;
}

function tagSharedModelResource(resource) {
	if (resource != null) resource[SHARED_MODEL_RESOURCE] = true;
}

function tagSharedMaterials(material) {
	if (!material) return;
	if (Array.isArray(material)) {
		for (const mat of material) tagSharedModelResource(mat);
	} else {
		tagSharedModelResource(material);
	}
}

/**
 * Walk a loaded model clone and tag every geometry/material as cache-shared.
 * @param {import('three').Object3D} root
 */
export function markSharedModelResources(root) {
	if (!root?.traverse) return;
	root.traverse((node) => {
		if (node.geometry) tagSharedModelResource(node.geometry);
		if (node.material) tagSharedMaterials(node.material);
	});
}

function disposeGeometrySafe(geometry) {
	if (geometry && !isSharedModelResource(geometry)) geometry.dispose();
}

function disposeMaterialSafe(material) {
	if (!material) return;
	if (Array.isArray(material)) {
		for (const mat of material) {
			if (mat && !isSharedModelResource(mat)) mat.dispose();
		}
	} else if (!isSharedModelResource(material)) {
		material.dispose();
	}
}

/**
 * Dispose geometry/material under `root`, skipping cache-shared glTF resources.
 * Procedural (untagged) resources are still disposed.
 * @param {import('three').Object3D} root
 */
export function disposeMeshTreeSafe(root) {
	if (!root) return;
	if (root.traverse) {
		root.traverse((child) => {
			disposeGeometrySafe(child.geometry);
			disposeMaterialSafe(child.material);
		});
	} else {
		disposeGeometrySafe(root.geometry);
		disposeMaterialSafe(root.material);
	}
}

/**
 * Look up the registry path for an entity key.
 * @param {string} key - e.g. 'player', 'grunt', 'magic_stone'
 * @returns {string|null} the model path, or null when the key is absent/empty.
 */
export function modelPathFor(key) {
	return MODEL_REGISTRY[key] ?? null;
}

/**
 * Load a .glb model from `path`, fetching+parsing at most once per path.
 *
 * Resolves to a fresh clone(true) of the loaded scene on every call so callers
 * never share a single instance. A missing/broken/unparseable path (or a
 * falsy/empty path) logs a warning and resolves to null; the failure is cached
 * so the path is not re-fetched indefinitely.
 *
 * @param {string} path
 * @returns {Promise<import('three').Object3D|null>}
 */
export function loadModel(path) {
	if (!path) {
		// No path to load (e.g. registry value is null). Resolve to null without
		// caching — there is nothing to fetch.
		return Promise.resolve(null);
	}

	let entry = modelCache.get(path);
	if (!entry) {
		entry = new Promise((resolve) => {
			let loader;
			try {
				loader = new GLTFLoader();
			} catch (err) {
				console.warn(`[models] failed to create GLTFLoader for "${path}":`, err);
				resolve(null);
				return;
			}
			loader.load(
				path,
				(gltf) => resolve(gltf && gltf.scene ? gltf.scene : null),
				undefined,
				(err) => {
					console.warn(`[models] failed to load model "${path}":`, err);
					resolve(null);
				},
			);
		});
		modelCache.set(path, entry);
	}

	// Each caller resolves to its own clone so instances are never shared. A
	// cached null failure stays null. clone(true) still shares geometry/material
	// with the cache and other clones — tag them so disposal can skip safely.
	return entry.then((scene) => {
		if (!scene) return null;
		const clone = scene.clone(true);
		markSharedModelResources(clone);
		return clone;
	});
}

/** Clear the model cache (testing/dev helper; not used by gameplay). */
export function _clearModelCache() {
	modelCache.clear();
}
